import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AgentBackendRunRecord, AgentUsageEvent } from "./types";
import { isAuthEnabled } from "@/lib/auth/config";
import { createSupabaseRouteClient } from "@/lib/auth/supabase-server";

interface UsageAuthContext {
  supabase: SupabaseClient;
  user: User;
}

interface UsageLimitStatus {
  allowed: boolean;
  usedTokens: number;
  limitTokens: number | null;
  periodStart: string;
}

interface UsageUserOptions {
  requireSignedIn?: boolean;
}

/**
 * Return whether Supabase-backed usage tracking should run for this deployment.
 */
function canTrackAgentUsage(): boolean {
  return Boolean(
    isAuthEnabled() &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Resolve the configured monthly token allowance.
 * @throws Error when the limit env var is set to a non-positive integer value.
 */
export function resolveAgentMonthlyTokenLimit(): number | null {
  const rawLimit = process.env["AGENT_MONTHLY_TOKEN_LIMIT"]?.trim();
  if (!rawLimit) return null;

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Monthly token limit must be a positive integer.`);
  }
  return limit;
}

/**
 * Return the UTC first day for the month that owns the supplied date.
 * @param date Date to place into a monthly usage period.
 */
function usagePeriodStart(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/**
 * Resolve the signed-in user for a route request when usage tracking is enabled.
 * @param request Incoming request with Supabase auth cookies in the Next runtime.
 * @param options User lookup options.
 * @throws Error when a signed-in user is required but unavailable.
 */
async function resolveUsageUser(
  request: Request,
  options: UsageUserOptions = {},
): Promise<UsageAuthContext | null> {
  if (!canTrackAgentUsage()) return null;

  const response = NextResponse.next();
  const supabase = createSupabaseRouteClient(request as NextRequest, response);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    if (!options.requireSignedIn) return null;
    throw new Error("Sign in to use Pip.");
  }
  return { supabase, user: data.user };
}

/**
 * Sum a user's recorded Pip token usage for a period.
 * @param supabase Supabase route client authenticated as the user.
 * @param periodStart First day of the usage month.
 * @throws Error when usage rows cannot be read.
 */
async function readMonthlyTokenUsage(
  supabase: SupabaseClient,
  periodStart: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("agent_usage_events")
    .select("total_tokens")
    .eq("period_start", periodStart);

  if (error) {
    throw new Error("Could not read Pip usage.");
  }

  return (data ?? []).reduce((sum, row) => {
    const tokens = typeof row.total_tokens === "number" ? row.total_tokens : 0;
    return sum + tokens;
  }, 0);
}

/**
 * Check whether the current user may start or resume a Pip run this month.
 * @param request Incoming request.
 * @throws Error when the usage check cannot be completed.
 */
export async function checkAgentUsageLimit(
  request: Request,
): Promise<UsageLimitStatus> {
  const periodStart = usagePeriodStart();
  const limitTokens = resolveAgentMonthlyTokenLimit();
  if (limitTokens === null) {
    return {
      allowed: true,
      usedTokens: 0,
      limitTokens,
      periodStart,
    };
  }

  const auth = await resolveUsageUser(request, { requireSignedIn: true });
  if (!auth) {
    return {
      allowed: true,
      usedTokens: 0,
      limitTokens,
      periodStart,
    };
  }

  const usedTokens = await readMonthlyTokenUsage(auth.supabase, periodStart);
  return {
    allowed: usedTokens < limitTokens,
    usedTokens,
    limitTokens,
    periodStart,
  };
}

/**
 * Build the response shown when a user has consumed the monthly Pip allowance.
 * @param status Current usage limit status.
 */
export function agentUsageLimitResponse(
  status: UsageLimitStatus,
): NextResponse {
  const limitTokens = status.limitTokens ?? 0;
  return NextResponse.json(
    {
      error: `You've used ${status.usedTokens.toLocaleString()} of ${limitTokens.toLocaleString()} Pip tokens for this month. Your allowance resets next month.`,
      code: "agent_token_limit_exceeded",
      usedTokens: status.usedTokens,
      limitTokens,
      periodStart: status.periodStart,
    },
    { status: 429 },
  );
}

/**
 * Normalize a token count from the hosted backend.
 * @param value Raw token value.
 */
function normalizeTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

/**
 * Convert one hosted usage event to its billable token count.
 * @param event Hosted backend usage event.
 */
function totalTokensForUsageEvent(event: AgentUsageEvent): number {
  const totalTokens = normalizeTokenCount(event.totalTokens);
  if (totalTokens > 0) {
    return totalTokens;
  }

  return (
    normalizeTokenCount(event.inputTokens) +
    normalizeTokenCount(event.outputTokens)
  );
}

/**
 * Store the usage events returned by the hosted Pip backend for this user.
 * @param request Incoming request carrying the user session.
 * @param record Hosted backend run record that may include usage events.
 * @throws Error when usage events cannot be persisted.
 */
export async function recordAgentUsageFromRun(
  request: Request,
  record: AgentBackendRunRecord,
): Promise<void> {
  if (!record.usageEvents?.length) return;
  const auth = await resolveUsageUser(request, {
    requireSignedIn: resolveAgentMonthlyTokenLimit() !== null,
  });
  if (!auth) return;

  const periodStart = usagePeriodStart();
  const rows = record.usageEvents.map((event, eventIndex) => ({
    user_id: auth.user.id,
    run_id: record.runId,
    event_index: eventIndex,
    period_start: periodStart,
    action: event.action,
    provider: event.provider ?? null,
    model: event.model ?? null,
    input_tokens: normalizeTokenCount(event.inputTokens),
    output_tokens: normalizeTokenCount(event.outputTokens),
    total_tokens: totalTokensForUsageEvent(event),
  }));

  const { error } = await auth.supabase
    .from("agent_usage_events")
    .upsert(rows, { onConflict: "user_id,run_id,event_index" });

  if (error) {
    throw new Error("Could not save Pip usage.");
  }
}
