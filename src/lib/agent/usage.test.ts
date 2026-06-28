import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAgentUsageLimit, resolveAgentMonthlyTokenLimit } from "./usage";

const usageMocks = vi.hoisted(() => ({
  createSupabaseRouteClient: vi.fn(),
  isAuthEnabled: vi.fn(),
}));

vi.mock("@/lib/auth/config", () => ({
  isAuthEnabled: usageMocks.isAuthEnabled,
}));

vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseRouteClient: usageMocks.createSupabaseRouteClient,
}));

/**
 * Build a Supabase route-client mock for usage limit reads.
 * @param rows Usage rows returned by the mocked query.
 */
function usageSupabaseMock(rows: Array<{ total_tokens: number }>) {
  const eq = vi.fn(async () => ({ data: rows, error: null }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user_123" } },
        error: null,
      })),
    },
    from,
  };
}

describe("agent usage limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("treats an unset monthly limit as unlimited", async () => {
    vi.stubEnv("AGENT_MONTHLY_TOKEN_LIMIT", "");
    usageMocks.isAuthEnabled.mockReturnValue(true);

    const status = await checkAgentUsageLimit(
      new Request("http://localhost/api/agent/run"),
    );

    expect(status.allowed).toBe(true);
    expect(status.limitTokens).toBeNull();
    expect(status.usedTokens).toBe(0);
    expect(usageMocks.createSupabaseRouteClient).not.toHaveBeenCalled();
  });

  it("enforces the configured monthly token limit", async () => {
    vi.stubEnv("AGENT_MONTHLY_TOKEN_LIMIT", "50");
    usageMocks.isAuthEnabled.mockReturnValue(true);
    usageMocks.createSupabaseRouteClient.mockReturnValue(
      usageSupabaseMock([{ total_tokens: 20 }, { total_tokens: 30 }]),
    );

    const status = await checkAgentUsageLimit(
      new Request("http://localhost/api/agent/run"),
    );

    expect(status.allowed).toBe(false);
    expect(status.limitTokens).toBe(50);
    expect(status.usedTokens).toBe(50);
  });

  it("rejects invalid monthly token limit values", () => {
    vi.stubEnv("AGENT_MONTHLY_TOKEN_LIMIT", "not-a-number");

    expect(() => resolveAgentMonthlyTokenLimit()).toThrow(
      `AGENT_MONTHLY_TOKEN_LIMIT must be a positive integer.`,
    );
  });
});
