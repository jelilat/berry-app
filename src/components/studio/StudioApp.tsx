'use client'

import { ArrowLeft, Clock3, Monitor } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadBerryProjectFromJson, serializeBerryProject } from '@/lib/project/io'
import {
  addComponent,
  connectTerminals,
  createEmptyProject,
  moveComponent,
  renameProject,
  removeComponent,
  removeWire,
  resetWireRoute,
  replaceProject,
  rotateComponent,
  setComponentTerminalSite,
  setWireBreadboardEndpoint,
  type WireEndpointRef,
} from '@/lib/project/mutations'
import { parseBreadboardHoleLabel } from '@/lib/project/breadboard'
import { getComponentDefinition, getWireTemplate } from '@/lib/project/catalog'
import type { BerryProject, BreadboardSite, ComponentTypeId, WireTypeId } from '@/lib/project/types'
import {
  createDefaultFirmwareSource,
  createEsp32BlinkFirmwareSource,
  DEFAULT_FIRMWARE_PATH,
} from '@/lib/firmware/source'
import type { BuildResult } from '@/lib/build/types'
import type { SimulationResult } from '@/lib/simulation'
import type {
  AgentAnswerSubmission,
  AgentBackendRunAccepted,
  AgentBackendRunRecord,
  AgentRunState,
  AgentRunResult,
} from '@/lib/agent/types'
import { isTerminalAgentRun, type AgentRunPollingOptions } from '@/lib/agent/polling'
import {
  isEditableFirmwareWorktreePath,
  isPreviewFirmwareWorktreePath,
  resolveFirmwareWorktreeFileContent,
} from '@/lib/firmware/worktree'
import { hasValidationErrors, validate, type ValidationResult } from '@/lib/validation'
import { useProjectHistory } from '@/lib/studio/history'
import { useValidation } from '@/lib/studio/use-validation'
import type { ValidationSubject } from '@/lib/validation'
import {
  loadFirmwareSourceFromStorage,
  loadProjectFromStorage,
  saveFirmwareSourceToStorage,
  saveProjectToStorage,
} from '@/lib/studio/storage'
import { consumePendingAgentRun } from '@/lib/studio/session-bootstrap'
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-browser'
import { hasSupabaseBrowserConfig, isAuthEnabled } from '@/lib/auth/config'
import {
  loadCloudUserProject,
  upsertCloudUserProject,
} from '@/lib/projects/cloud-projects'
import { ComponentInspectorPanel } from './ComponentInspectorPanel'
import { AIAssistantPanel, type SubmittedPrompt } from './AIAssistantPanel'
import { ComponentTray } from './ComponentTray'
import { FirmwareEditorPanel } from './FirmwareEditorPanel'
import { FirmwareWorktreePanel } from './FirmwareWorktreePanel'
import { PipelineTerminalPanel } from './PipelineTerminalPanel'
import { Studio3DPlaceholder } from './Studio3DPlaceholder'
import { StudioCanvas } from './StudioCanvas'
import { StudioToolbar } from './StudioToolbar'
import { ValidationFlyout } from './ValidationFlyout'
import type { StudioViewMode } from './ViewModeToggle'
import { WireInspectorPanel } from './WireInspectorPanel'

type StudioStatus = 'loading' | 'ready' | 'error'
type EmptyBenchState = 'idle' | 'preparing' | 'needs_input'

const AGENT_POLL_INTERVAL_MS = 5000
const AGENT_MAX_POLL_ATTEMPTS = 100

/**
 * Wait for a fixed number of milliseconds.
 * @param ms Delay duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Parse a fetch response as JSON, returning a stable error object when parsing fails.
 * @param response Fetch response to parse.
 */
async function parseJsonResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => ({ error: 'Agent API returned invalid JSON' }))
}

/**
 * True while the AI bench flow still owns the empty canvas state.
 * @param record Latest hosted agent run record.
 */
function isActiveAgentLoopRecord(record: AgentBackendRunRecord | null): boolean {
  return record?.status === 'queued' ||
    record?.status === 'running' ||
    record?.status === 'needs_clarification'
}

/**
 * Poll the local proxy until a hosted agent run reaches a terminal status.
 * @param runId Hosted backend run id.
 * @param onRecord Optional callback for every successful poll response.
 * @param options Polling behavior for clarification pauses.
 * @throws Error when polling fails or times out.
 */
async function pollAgentRun(
  runId: string,
  onRecord?: (record: AgentBackendRunRecord) => void,
  options?: AgentRunPollingOptions,
): Promise<AgentBackendRunRecord> {
  for (let attempt = 0; attempt < AGENT_MAX_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(AGENT_POLL_INTERVAL_MS)
    }
    const response = await fetch(`/api/agent/run/${encodeURIComponent(runId)}`)
    const json = await parseJsonResponse(response)
    if (!response.ok) {
      const error = json as { error?: string }
      throw new Error(error.error ?? 'Agent status request failed')
    }
    const record = json as AgentBackendRunRecord
    onRecord?.(record)
    if (isTerminalAgentRun(record, options)) {
      return record
    }
  }
  throw new Error('Agent run timed out while waiting for the backend')
}

/**
 * Extract the workflow result from a terminal hosted run record.
 * @param record Hosted agent run record.
 */
function resultFromRunRecord(record: AgentBackendRunRecord): AgentRunResult | null {
  if (record.result?.state) {
    return record.result
  }
  if (record.status === 'failed') {
    return {
      ok: false,
      status: 'failed',
      error: record.error ?? 'Agent workflow failed',
      state: {
        runId: record.runId,
        userPrompt: record.input?.prompt ?? '',
        clarification: {
          status: 'ready',
          normalizedGoal: record.input?.prompt ?? '',
          assumptions: [],
        },
        project: createEmptyProject(),
        firmwareFiles: {},
        validationResults: [],
        timeline: [],
      },
    }
  }
  return null
}

/**
 * Extract a visualizable workflow snapshot from a hosted run record.
 * @param record Hosted agent run record that may include a partial state snapshot.
 */
function visualizableResultFromRunRecord(record: AgentBackendRunRecord): AgentRunResult | null {
  const terminalResult = resultFromRunRecord(record)
  if (terminalResult) return terminalResult

  const snapshot = record as AgentBackendRunRecord & {
    state?: AgentRunState
    partialResult?: AgentRunResult
  }
  if (snapshot.partialResult?.state?.project) {
    return snapshot.partialResult
  }
  if (snapshot.state?.project) {
    return {
      ok: false,
      status: record.status === 'failed' ? 'failed' : 'needs_clarification',
      state: snapshot.state,
      error: record.error,
    }
  }
  return null
}

/**
 * Create the local chat namespace for a loaded bench project.
 * @param project Project currently opened in the bench.
 */
function createProjectChatKey(project: BerryProject): string {
  const stableSource = project.metadata.createdAt ?? `${project.board}:${project.metadata.name}`
  return stableSource
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Display title for the current project.
 * @param project Project currently opened in the bench.
 */
function projectTitle(project: BerryProject): string {
  return project.metadata.name.trim() || 'Untitled project'
}

/**
 * Whether a metadata name is only the default placeholder.
 * @param name Project metadata name.
 */
function isPlaceholderProjectName(name: string): boolean {
  return name.trim().length === 0 || name.trim().toLowerCase() === 'untitled project'
}

/**
 * Keep the current bench identity while accepting generated project metadata.
 * @param current Project that started the AI run.
 * @param generated Project returned by the AI build workflow.
 */
function preserveProjectIdentity(
  current: BerryProject,
  generated: BerryProject,
): BerryProject {
  return {
    ...generated,
    metadata: {
      ...generated.metadata,
      name: isPlaceholderProjectName(generated.metadata.name)
        ? projectTitle(current)
        : generated.metadata.name,
      createdAt: current.metadata.createdAt ?? generated.metadata.createdAt,
    },
  }
}

/**
 * Stable key for comparing validation findings before and after a tentative edit.
 * @param result Validation finding.
 */
function validationResultKey(result: ValidationResult): string {
  const subject = result.subject
  return [
    result.severity,
    result.code,
    result.message,
    subject?.netId,
    subject?.wireId,
    subject?.componentId,
    subject?.terminalId,
  ]
    .filter(Boolean)
    .join(':')
}

/**
 * Error findings that exist after an edit but not before it.
 * @param before Current validation results.
 * @param after Validation results from a tentative project.
 */
function newValidationErrors(
  before: ValidationResult[],
  after: ValidationResult[],
): ValidationResult[] {
  const existing = new Set(
    before
      .filter((result) => result.severity === 'error')
      .map(validationResultKey),
  )
  return after.filter(
    (result) =>
      result.severity === 'error' && !existing.has(validationResultKey(result)),
  )
}

/**
 * Client Studio shell: visual tray, 2D canvas, persistence, undo/redo.
 * @param props Studio route options.
 */
export function StudioApp({ projectId }: { projectId?: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<StudioStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<StudioViewMode>('2d')
  const [activeWireType, setActiveWireType] = useState<WireTypeId>('jumper-mm')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null)
  const [pipelineNotice, setPipelineNotice] = useState<string | null>(null)
  const [buildLoading, setBuildLoading] = useState(false)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [simulateLoading, setSimulateLoading] = useState(false)
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentWaitingForAnswers, setAgentWaitingForAnswers] = useState(false)
  const [agentResult, setAgentResult] = useState<AgentRunResult | null>(null)
  const [agentRunRecord, setAgentRunRecord] = useState<AgentBackendRunRecord | null>(null)
  const [agentClarificationSubmitted, setAgentClarificationSubmitted] = useState(false)
  const [submittedPrompt, setSubmittedPrompt] = useState<SubmittedPrompt | null>(null)
  const [validationFlyoutOpen, setValidationFlyoutOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [firmwareSource, setFirmwareSource] = useState<string>(() =>
    createDefaultFirmwareSource('esp32-devkit-v1'),
  )
  const [selectedFirmwarePath, setSelectedFirmwarePath] = useState(DEFAULT_FIRMWARE_PATH)
  const skipNextPipelineResetRef = useRef(false)
  const visualizedAgentProjectRef = useRef<string | null>(null)
  const cloudAutosaveTimerRef = useRef<number | null>(null)
  const handleAgentRunRef = useRef<
    (
      prompt: string,
      mode?: 'auto' | 'deterministic' | 'real',
      provider?: string,
      model?: string,
      reasoningEffort?: string,
      answerSubmission?: AgentAnswerSubmission,
    ) => Promise<void>
  >(async () => {})
  const initialProjectRef = useRef<BerryProject | null>(null)
  if (!initialProjectRef.current) {
    initialProjectRef.current = createEmptyProject()
  }
  const [projectChatKey, setProjectChatKey] = useState(() =>
    createProjectChatKey(initialProjectRef.current!),
  )
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null)
  const [cloudAutosaveReady, setCloudAutosaveReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const {
    project,
    setProject,
    resetProject,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProjectHistory(initialProjectRef.current)

  const validationResults = useValidation(project)
  const validationHasErrors = hasValidationErrors(validationResults)
  const selectedFirmwareContent =
    resolveFirmwareWorktreeFileContent(
      selectedFirmwarePath,
      project,
      project.board,
      firmwareSource,
      buildResult,
    ) ?? firmwareSource
  const selectedFirmwareReadOnly =
    !isEditableFirmwareWorktreePath(selectedFirmwarePath) ||
    isPreviewFirmwareWorktreePath(selectedFirmwarePath)

  useEffect(() => {
    if (!pipelineNotice) return
    const timer = window.setTimeout(() => setPipelineNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [pipelineNotice])

  const handlePipelinePlaceholder = useCallback(() => {
    setPipelineNotice('Deploy is coming soon — for now, run Build and Simulate for the demo path')
  }, [])

  const hasSuccessfulBuildArtifact =
    buildResult?.ok === true && !!buildResult.artifact?.firmwareHash

  useEffect(() => {
    if (skipNextPipelineResetRef.current) {
      skipNextPipelineResetRef.current = false
      return
    }
    setBuildResult(null)
    setSimulationResult(null)
  }, [project, firmwareSource])

  useEffect(() => {
    if (buildLoading || simulateLoading || buildResult || simulationResult) {
      setTerminalOpen(true)
    }
  }, [buildLoading, buildResult, simulateLoading, simulationResult])

  useEffect(() => {
    let mounted = true

    /**
     * Load a guest bench from local browser storage.
     */
    function loadGuestBench(): void {
      const stored = loadProjectFromStorage()
      if (stored) {
        resetProject(stored)
      }
      setProjectChatKey(createProjectChatKey(stored ?? initialProjectRef.current!))
      setFirmwareSource(
        loadFirmwareSourceFromStorage() ??
          createDefaultFirmwareSource(stored?.board ?? 'esp32-devkit-v1'),
      )
      setStatus('ready')
    }

    /**
     * Resolve auth before choosing cloud persistence or guest local storage.
     */
    async function loadInitialBench(): Promise<void> {
      setCloudAutosaveReady(false)
      setStatus('loading')
      setErrorMessage(null)

      if (!isAuthEnabled() || !hasSupabaseBrowserConfig()) {
        setSignedIn(false)
        setCloudProjectId(null)
        loadGuestBench()
        setCloudAutosaveReady(true)
        return
      }

      try {
        const supabase = createSupabaseBrowserClient()
        const { data } = await supabase.auth.getUser()
        if (!mounted) return

        if (!data.user) {
          setSignedIn(false)
          setCloudProjectId(null)
          if (projectId) {
            setErrorMessage('Sign in to open this project')
            setStatus('error')
            setCloudAutosaveReady(false)
            return
          }
          loadGuestBench()
          setCloudAutosaveReady(true)
          return
        }

        setSignedIn(true)
        if (projectId) {
          const entry = await loadCloudUserProject(supabase, projectId)
          if (!mounted) return
          if (!entry) {
            setErrorMessage('Project not found')
            setStatus('error')
            setCloudAutosaveReady(false)
            return
          }
          const loadedProject = loadBerryProjectFromJson(entry.projectJson)
          resetProject(loadedProject)
          setProjectChatKey(entry.id)
          setFirmwareSource(createDefaultFirmwareSource(loadedProject.board))
          setCloudProjectId(entry.id)
          setStatus('ready')
          setCloudAutosaveReady(true)
          return
        }

        const freshProject = createEmptyProject()
        resetProject(freshProject)
        setProjectChatKey(createProjectChatKey(freshProject))
        setFirmwareSource(createDefaultFirmwareSource(freshProject.board))
        setCloudProjectId(null)
        setStatus('ready')
        setCloudAutosaveReady(true)
      } catch (error) {
        if (!mounted) return
        setSignedIn(false)
        setCloudProjectId(null)
        setErrorMessage(error instanceof Error ? error.message : 'Failed to open project')
        setStatus('error')
        setCloudAutosaveReady(false)
      }
    }

    void loadInitialBench()

    return () => {
      mounted = false
    }
  }, [projectId, resetProject])

  const handleSimulate = useCallback(async () => {
    if (validationHasErrors || simulateLoading || !hasSuccessfulBuildArtifact) return
    const firmwareHash = buildResult!.artifact!.firmwareHash
    setSimulateLoading(true)
    setSimulationResult(null)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project,
          artifact: { firmwareHash },
          files: { [DEFAULT_FIRMWARE_PATH]: firmwareSource },
        }),
      })
      const json = await response.json()

      if (response.status === 400 && Array.isArray(json.validationResults)) {
        setErrorMessage('Fix wiring errors before simulating')
        return
      }

      if (!response.ok) {
        setErrorMessage(json.error ?? 'Simulation request failed')
        return
      }

      setSimulationResult(json.result as SimulationResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Simulation request failed')
    } finally {
      setSimulateLoading(false)
    }
  }, [
    buildResult,
    firmwareSource,
    hasSuccessfulBuildArtifact,
    project,
    simulateLoading,
    validationHasErrors,
  ])

  const handleBuild = useCallback(async () => {
    if (validationHasErrors || buildLoading) return
    setBuildLoading(true)
    setBuildResult(null)
    setSimulationResult(null)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project,
          files: { [DEFAULT_FIRMWARE_PATH]: firmwareSource },
        }),
      })
      const json = await response.json()

      if (response.status === 400 && Array.isArray(json.validationResults)) {
        setErrorMessage('Fix wiring errors before building')
        setBuildResult({
          ok: false,
          backend: json.backend ?? 'local',
          diagnostics: json.diagnostics ?? [],
        })
        return
      }

      if (!response.ok) {
        setErrorMessage(json.error ?? 'Build request failed')
        return
      }

      setBuildResult(json as BuildResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Build request failed')
    } finally {
      setBuildLoading(false)
    }
  }, [buildLoading, firmwareSource, project, validationHasErrors])

  /**
   * Show the agent-designed project graph as soon as it is available.
   * @param result Latest agent workflow result or partial run snapshot.
   * @param notice Optional status notice after visualizing the graph.
   */
  const visualizeAgentProject = useCallback((result: AgentRunResult, notice?: string) => {
    if (!result.state.circuitIntent && result.status !== 'completed') return
    const nextProject = replaceProject(
      preserveProjectIdentity(project, result.state.project),
    )
    const signature = `${result.state.runId}:${serializeBerryProject(nextProject, false)}`
    if (visualizedAgentProjectRef.current === signature) return

    visualizedAgentProjectRef.current = signature
    skipNextPipelineResetRef.current = true
    resetProject(nextProject)
    setSelectedNodeId(null)
    setSelectedWireId(null)
    setViewMode('2d')
    if (notice) {
      setPipelineNotice(notice)
    }
  }, [project, resetProject])

  const handleAgentRun = useCallback(async (
    prompt: string,
    mode: 'auto' | 'deterministic' | 'real' = 'auto',
    provider?: string,
    model?: string,
    reasoningEffort?: string,
    answerSubmission?: AgentAnswerSubmission,
  ) => {
    if (agentLoading || prompt.trim().length === 0) return
    if (agentWaitingForAnswers && !answerSubmission) return
    setAgentLoading(true)
    setAgentWaitingForAnswers(false)
    setAgentResult(null)
    setAgentClarificationSubmitted(!!answerSubmission)
    visualizedAgentProjectRef.current = null
    if (!answerSubmission) {
      setAgentRunRecord(null)
    }
    setErrorMessage(null)
    try {
      const response = answerSubmission
        ? await fetch(`/api/agent/run/${encodeURIComponent(answerSubmission.runId)}/answers`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ answers: answerSubmission.answers }),
          })
        : await fetch('/api/agent/run', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ prompt, project, mode, provider, model, reasoningEffort }),
          })
      const json = await parseJsonResponse(response)
      if (!response.ok) {
        const error = json as { error?: string }
        setErrorMessage(error.error ?? 'Agent request failed')
        return
      }

      const accepted = json as AgentBackendRunAccepted
      const record = await pollAgentRun(
        accepted.runId,
        (nextRecord) => {
          setAgentRunRecord(nextRecord)
          const visualizableResult = visualizableResultFromRunRecord(nextRecord)
          if (visualizableResult) {
            visualizeAgentProject(visualizableResult, 'Circuit ready on the bench')
          }
        },
        {
          pauseOnClarification: !answerSubmission,
        },
      )
      const result = resultFromRunRecord(record)
      if (!result) {
        setErrorMessage(record.error ?? 'Agent run finished without a workflow result')
        return
      }

      setAgentResult(result)
      setAgentWaitingForAnswers(result.status === 'needs_clarification')
      if (result.status === 'completed') {
        visualizeAgentProject(result)
        const source = result.state.firmwareFiles[DEFAULT_FIRMWARE_PATH]
        if (source) {
          setFirmwareSource(source)
          setSelectedFirmwarePath(DEFAULT_FIRMWARE_PATH)
        }
        setBuildResult(result.state.buildResult ?? null)
        setSimulationResult(result.state.simulationResult ?? null)
        setViewMode('2d')
        setPipelineNotice('AI build loop completed')
      }
      if (result.status === 'failed') {
        setAgentWaitingForAnswers(false)
        setErrorMessage(result.error ?? 'Agent workflow failed')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Agent request failed')
    } finally {
      setAgentClarificationSubmitted(false)
      setAgentLoading(false)
    }
  }, [agentLoading, agentWaitingForAnswers, project, visualizeAgentProject])

  handleAgentRunRef.current = handleAgentRun

  useEffect(() => {
    if (status !== 'ready') return
    const pending = consumePendingAgentRun()
    if (pending) {
      const submission = { id: `main_${Date.now().toString(36)}`, text: pending.prompt }
      setSubmittedPrompt(submission)
      window.setTimeout(() => {
        void handleAgentRunRef.current(
          pending.prompt,
          pending.mode,
          pending.provider,
          pending.model,
          pending.reasoningEffort,
        )
      }, 0)
    }
  }, [status])

  useEffect(() => {
    if (signedIn || status !== 'ready' || !cloudAutosaveReady) return
    saveProjectToStorage(project)
  }, [cloudAutosaveReady, project, signedIn, status])

  useEffect(() => {
    if (!signedIn || status !== 'ready' || !cloudAutosaveReady) return

    if (cloudAutosaveTimerRef.current) {
      window.clearTimeout(cloudAutosaveTimerRef.current)
    }

    /**
     * Save the current bench to Supabase for signed-in users.
     */
    async function saveProjectToCloud() {
      try {
        if (!isAuthEnabled() || !hasSupabaseBrowserConfig()) return
        const supabase = createSupabaseBrowserClient()
        const { data } = await supabase.auth.getUser()
        if (!data.user) return
        const entry = await upsertCloudUserProject(supabase, project, cloudProjectId)
        if (entry.id !== cloudProjectId) {
          setCloudProjectId(entry.id)
          if (!projectId) {
            router.replace(`/bench/${entry.id}`)
          }
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save cloud project')
      }
    }

    cloudAutosaveTimerRef.current = window.setTimeout(() => {
      void saveProjectToCloud()
    }, 900)

    return () => {
      if (cloudAutosaveTimerRef.current) {
        window.clearTimeout(cloudAutosaveTimerRef.current)
      }
    }
  }, [cloudAutosaveReady, cloudProjectId, project, projectId, router, signedIn, status])

  useEffect(() => {
    if (signedIn || status !== 'ready') return
    saveFirmwareSourceToStorage(firmwareSource)
  }, [firmwareSource, signedIn, status])

  const handleNew = useCallback(() => {
    if (signedIn && projectId) {
      router.push('/bench')
      return
    }

    const nextProject = createEmptyProject()
    setCloudProjectId(null)
    resetProject(nextProject)
    setProjectChatKey(createProjectChatKey(nextProject))
    setFirmwareSource(createDefaultFirmwareSource(nextProject.board))
    setSelectedNodeId(null)
    setSelectedWireId(null)
    setAgentWaitingForAnswers(false)
    setAgentResult(null)
    setErrorMessage(null)
    setViewMode('2d')
  }, [projectId, resetProject, router, signedIn])

  const handleLoadExample = useCallback(async () => {
    setStatus('loading')
    setErrorMessage(null)
    try {
      const res = await fetch('/examples/esp32-led-blink.project.json')
      if (!res.ok) throw new Error('Example file not found')
      const json = await res.text()
      const parsed = loadBerryProjectFromJson(json)
      resetProject(replaceProject(parsed))
      if (!signedIn) {
        setCloudProjectId(null)
      }
      setProjectChatKey(signedIn && cloudProjectId ? cloudProjectId : createProjectChatKey(parsed))
      setFirmwareSource(createEsp32BlinkFirmwareSource())
      setAgentWaitingForAnswers(false)
      setAgentResult(null)
      setViewMode('2d')
      setStatus('ready')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load example')
      setStatus('error')
    }
  }, [cloudProjectId, resetProject, signedIn])

  const handleSave = useCallback(() => {
    if (!signedIn) {
      saveProjectToStorage(project)
      saveFirmwareSourceToStorage(firmwareSource)
      return
    }

    /**
     * Save the current bench to Supabase when a signed-in user presses Save.
     */
    async function saveCloudNow() {
      try {
        if (!isAuthEnabled() || !hasSupabaseBrowserConfig()) return
        const supabase = createSupabaseBrowserClient()
        const { data } = await supabase.auth.getUser()
        if (!data.user) return
        const entry = await upsertCloudUserProject(supabase, project, cloudProjectId)
        setCloudProjectId(entry.id)
        if (!projectId) {
          router.replace(`/bench/${entry.id}`)
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save cloud project')
      }
    }

    void saveCloudNow()
  }, [cloudProjectId, firmwareSource, project, projectId, router, signedIn])

  const handleRenameProject = useCallback((name: string) => {
    try {
      const next = renameProject(project, name)
      if (next === project) return
      setProject(next)
      setErrorMessage(null)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Could not rename project')
    }
  }, [project, setProject])

  const handleResetFirmwareSource = useCallback(() => {
    setFirmwareSource(createDefaultFirmwareSource(project.board))
  }, [project.board])

  const handleAddPart = useCallback(
    (type: ComponentTypeId) => {
      const offset = project.components.length * 0.04
      try {
        setProject(addComponent(project, type, { x: 0.2 + offset, y: 0.2 + offset }))
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Could not add part')
        setStatus('error')
      }
    },
    [project, setProject],
  )

  const handleDropPart = useCallback(
    (type: ComponentTypeId, x: number, y: number) => {
      try {
        const next = addComponent(project, type, { x, y })
        setProject(next)
        setSelectedNodeId(next.components.at(-1)?.id ?? null)
        setSelectedWireId(null)
        setErrorMessage(null)
        setStatus('ready')
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Could not add part')
        setStatus('error')
      }
    },
    [project, setProject],
  )

  const handleWireConnect = useCallback(
    (
      from: WireEndpointRef,
      to: WireEndpointRef,
      points: { x: number; y: number; z: number }[],
    ) => {
      try {
        const wireTemplate = getWireTemplate(activeWireType)
        const next = connectTerminals(project, from, to, {
          color: wireTemplate.defaultColor,
          connectors: wireTemplate.connectors,
          type: activeWireType,
          points,
        })
        const newErrors = newValidationErrors(validationResults, validate(next))
        if (newErrors.length > 0) {
          setErrorMessage(newErrors[0]?.message ?? 'That wire would create a validation error')
          return
        }
        setProject(next)
        setErrorMessage(null)
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Could not connect terminals')
      }
    },
    [activeWireType, project, setProject, validationResults],
  )

  const handleSelectionChange = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId)
    if (nodeId) setSelectedWireId(null)
  }, [])

  const handleWireSelectionChange = useCallback((wireId: string | null) => {
    setSelectedWireId(wireId)
    if (wireId) setSelectedNodeId(null)
  }, [])

  /**
   * Focus Studio selection from a validation finding subject.
   *
   * @param subject Graph ids attached to the clicked row.
   */
  const handleValidationSelectSubject = useCallback((subject: ValidationSubject) => {
    if (subject.wireId) {
      setSelectedWireId(subject.wireId)
      setSelectedNodeId(null)
      return
    }
    if (subject.componentId) {
      setSelectedNodeId(subject.componentId)
      setSelectedWireId(null)
      return
    }
    if (subject.netId) {
      const wire = project.wires.find((candidate) => candidate.net === subject.netId)
      if (wire) {
        setSelectedWireId(wire.id)
        setSelectedNodeId(null)
        return
      }
    }
  }, [project.wires])

  const handleDeleteSelected = useCallback(() => {
    try {
      if (selectedWireId) {
        setProject(removeWire(project, selectedWireId))
        setSelectedWireId(null)
        setErrorMessage(null)
        return
      }
      if (!selectedNodeId) return
      setProject(removeComponent(project, selectedNodeId))
      setSelectedNodeId(null)
      setErrorMessage(null)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Could not delete')
    }
  }, [selectedWireId, selectedNodeId, project, setProject])

  useEffect(() => {
    if (selectedWireId && !project.wires.some((w) => w.id === selectedWireId)) {
      setSelectedWireId(null)
    }
  }, [project.wires, selectedWireId])

  const handleRotateSelected = useCallback(
    (deltaDegrees: number) => {
      if (!selectedNodeId) return
      try {
        setProject(rotateComponent(project, selectedNodeId, { deltaDegrees }))
        setErrorMessage(null)
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Could not rotate')
      }
    },
    [selectedNodeId, project, setProject],
  )

  const handlePositionChange = useCallback(
    (x: number, y: number) => {
      if (!selectedNodeId) return
      try {
        setProject(moveComponent(project, selectedNodeId, x, y))
        setErrorMessage(null)
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Could not move')
      }
    },
    [selectedNodeId, project, setProject],
  )

  const handlePinSiteChange = useCallback(
    (terminalId: string, site: BreadboardSite) => {
      if (!selectedNodeId) return
      try {
        setProject(setComponentTerminalSite(project, selectedNodeId, terminalId, site))
        setErrorMessage(null)
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Could not move pin')
      }
    },
    [selectedNodeId, project, setProject],
  )

  const handleWireEndpointHoleChange = useCallback(
    (end: 'from' | 'to', holeLabel: string) => {
      if (!selectedWireId) return
      try {
        setProject(
          setWireBreadboardEndpoint(
            project,
            selectedWireId,
            end,
            parseBreadboardHoleLabel(holeLabel),
          ),
        )
        setErrorMessage(null)
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Could not move wire end')
      }
    },
    [selectedWireId, project, setProject],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedWireId) return
        e.preventDefault()
        handleDeleteSelected()
        return
      }

      if (e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey || e.altKey) return
      if (!selectedNodeId) return
      e.preventDefault()
      const delta = e.shiftKey ? -90 : 90
      handleRotateSelected(delta)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedNodeId, selectedWireId, handleRotateSelected, handleDeleteSelected])

  const isEmpty = project.components.length === 0
  const emptyBenchState: EmptyBenchState =
    isEmpty && (agentWaitingForAnswers || agentRunRecord?.status === 'needs_clarification')
      ? 'needs_input'
      : isEmpty && (agentLoading || isActiveAgentLoopRecord(agentRunRecord))
        ? 'preparing'
        : 'idle'

  if (status === 'loading') {
    return <StudioShell message="Loading your bench…" />
  }

  return (
    <>
    <div className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden lg:hidden" style={{ background: 'var(--bg-base)' }}>
      <DesktopStudioPrompt />
    </div>
    <div className="relative hidden h-[100dvh] min-h-0 flex-col overflow-hidden lg:flex" style={{ background: 'var(--bg-base)' }}>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <StudioToolbar
          projectName={projectTitle(project)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNew={handleNew}
          onLoadExample={handleLoadExample}
          onRename={handleRenameProject}
          onSave={handleSave}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onDeleteSelected={handleDeleteSelected}
          hasSelection={!!selectedNodeId || !!selectedWireId}
          validationResults={validationResults}
          onValidationClick={() => setValidationFlyoutOpen((open) => !open)}
          hasValidationErrors={validationHasErrors}
          onBuild={handleBuild}
          onSimulate={handleSimulate}
          onDeploy={handlePipelinePlaceholder}
          buildDisabled={buildLoading}
          simulateDisabled={simulateLoading || !hasSuccessfulBuildArtifact}
        />

        <ValidationFlyout
          open={validationFlyoutOpen}
          results={validationResults}
          onClose={() => setValidationFlyoutOpen(false)}
          onSelectSubject={(subject) => {
            handleValidationSelectSubject(subject)
            setValidationFlyoutOpen(false)
          }}
        />

        {pipelineNotice && (
          <div
            className="mx-3 mt-3 rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'rgba(15,168,134,0.12)', color: 'var(--leaf)' }}
            role="status"
          >
            {pipelineNotice}
          </div>
        )}

        {errorMessage && (status === 'ready' || status === 'error') && (
          <div
            className="mx-3 mt-3 rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'rgba(214,51,108,0.12)', color: 'var(--accent)' }}
            role="status"
          >
            {errorMessage}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => {
                setErrorMessage(null)
                if (status === 'error') setStatus('ready')
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 gap-0">
            {viewMode === 'code' ? (
              <>
                  <FirmwareWorktreePanel
                    board={project.board}
                    projectName={projectTitle(project)}
                    buildResult={buildResult}
                  selectedPath={selectedFirmwarePath}
                  onSelectPath={setSelectedFirmwarePath}
                />
                <div className="min-h-0 flex-1 overflow-hidden">
                  <FirmwareEditorPanel
                    board={project.board}
                    filePath={selectedFirmwarePath}
                    source={selectedFirmwareContent}
                    readOnly={selectedFirmwareReadOnly}
                    onChange={setFirmwareSource}
                    onReset={
                      selectedFirmwareReadOnly ? undefined : handleResetFirmwareSource
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <ComponentTray
                  onAddPart={handleAddPart}
                  onWireTypeChange={setActiveWireType}
                  activeWireType={activeWireType}
                />
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {isEmpty ? (
                    <EmptyBench
                      state={emptyBenchState}
                      onNew={handleNew}
                      onLoadExample={handleLoadExample}
                    />
                  ) : (
                    <>
                      {viewMode === '2d' ? (
                        <StudioCanvas
                          project={project}
                          activeWireType={activeWireType}
                          selectedNodeId={selectedNodeId}
                          selectedWireId={selectedWireId}
                          validationResults={validationResults}
                          onProjectChange={setProject}
                          onPartDrop={handleDropPart}
                          onWireConnect={handleWireConnect}
                          onSelectionChange={handleSelectionChange}
                          onWireSelectionChange={handleWireSelectionChange}
                          onPlacementError={setErrorMessage}
                        />
                      ) : (
                        <div className="relative h-full min-h-0">
                          <StudioCanvas
                            project={project}
                            activeWireType={activeWireType}
                            selectedNodeId={selectedNodeId}
                            selectedWireId={selectedWireId}
                            validationResults={validationResults}
                            onProjectChange={setProject}
                            onPartDrop={handleDropPart}
                            onWireConnect={() => {}}
                            onSelectionChange={handleSelectionChange}
                            onWireSelectionChange={handleWireSelectionChange}
                            onPlacementError={setErrorMessage}
                          />
                          <Studio3DPlaceholder />
                        </div>
                      )}
                    </>
                  )}
                </div>
                {selectedNodeId && !isEmpty && (
                  <ComponentInspectorPanel
                    project={project}
                    componentId={selectedNodeId}
                    onClose={() => setSelectedNodeId(null)}
                    onRotate={handleRotateSelected}
                    onPositionChange={handlePositionChange}
                    onPinSiteChange={handlePinSiteChange}
                  />
                )}
                {selectedWireId && !selectedNodeId && !isEmpty && (
                  <WireInspectorPanel
                    project={project}
                    wireId={selectedWireId}
                    onClose={() => setSelectedWireId(null)}
                    onEndpointHoleChange={handleWireEndpointHoleChange}
                    onResetRoute={
                      project.wires.some(
                        (wire) =>
                          wire.id === selectedWireId &&
                          (wire.from?.breadboard || wire.to?.breadboard),
                      )
                        ? () => {
                            try {
                              setProject(resetWireRoute(project, selectedWireId))
                              setErrorMessage(null)
                            } catch (error) {
                              setErrorMessage(
                                error instanceof Error
                                  ? error.message
                                  : 'Could not reset wire route',
                              )
                            }
                          }
                        : undefined
                    }
                  />
                )}
              </>
            )}
          </div>
          <AIAssistantPanel
            loading={agentLoading}
            projectChatKey={projectChatKey}
            submittedPrompt={submittedPrompt}
            result={agentResult}
            backendRunRecord={agentRunRecord}
            clarificationSubmitted={agentClarificationSubmitted}
            onSubmit={handleAgentRun}
          />
        </div>

        <PipelineTerminalPanel
          buildResult={buildResult}
          buildLoading={buildLoading}
          simulationResult={simulationResult}
          simulationLoading={simulateLoading}
          open={terminalOpen}
          onOpenChange={setTerminalOpen}
          onClearBuild={() => setBuildResult(null)}
          onClearSimulation={() => setSimulationResult(null)}
        />

        {/* {viewMode === '2d' && !isEmpty && (
          <div
            className="rounded-xl px-4 py-2.5 text-center text-xs font-semibold"
            style={{ background: 'rgba(15,168,134,0.08)', color: 'var(--leaf)' }}
          >
            <strong>Wiring</strong> ({getComponentDefinition(activeWireType).name}): drag from a pin
            to another pin, or drop it onto a breadboard hole to plug in. Click a wire to
            select it; press{' '}
            <kbd className="rounded px-1 py-0.5 text-[10px]" style={{ background: 'var(--bg-elevated)' }}>
              Delete
            </kbd>{' '}
            or toolbar Delete to remove. Press{' '}
            <kbd className="rounded px-1 py-0.5 text-[10px]" style={{ background: 'var(--bg-elevated)' }}>
              Esc
            </kbd>{' '}
            to cancel wire placement.
          </div>
        )} */}
      </div>
    </div>
    </>
  )
}

/**
 * Prompt small-screen Studio visitors to continue on a desktop-sized display.
 */
function DesktopStudioPrompt() {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
      <section
        className="w-full max-w-md rounded-[28px] p-6 text-center"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
        >
          <Monitor size={26} />
        </div>
        <p className="mt-5 text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Open Studio on desktop
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6" style={{ color: 'var(--text-secondary)' }}>
          berry. Studio needs room for the hardware canvas, component tray, code, and AI bench. Move to a desktop-sized screen to keep building.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold"
          style={{
            background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
            color: '#fff',
            boxShadow: '0 12px 28px rgba(214,51,108,0.24)',
          }}
        >
          <ArrowLeft size={16} />
          Back home
        </a>
      </section>
    </main>
  )
}

/**
 * Render a full-screen Studio loading or error shell.
 * @param props Message to show in the shell.
 */
function StudioShell({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm font-semibold"
      style={{ color: 'var(--text-muted)' }}
    >
      {message}
    </div>
  )
}

/**
 * Render the empty bench or AI preparation state.
 * @param props Empty bench actions and optional preparation state.
 */
function EmptyBench({
  state = 'idle',
  onNew,
  onLoadExample,
}: {
  state?: EmptyBenchState
  onNew: () => void
  onLoadExample: () => void
}) {
  if (state !== 'idle') {
    const title = state === 'needs_input' ? 'Waiting on your answer...' : 'Preparing your bench...'
    const description =
      state === 'needs_input'
        ? 'Berry has a question before it places the circuit on the bench.'
        : 'Berry is placing the first parts as soon as the circuit JSON is ready.'

    return (
      <div
        className="flex h-full min-h-[480px] flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center"
        style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)' }}
        role="status"
        aria-live="polite"
      >
        <span className="berry-bench-loading-icon" aria-hidden="true">
          <Clock3 size={22} />
        </span>
        <p className="text-lg font-extrabold tracking-tight">{title}</p>
        <p className="max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-[480px] flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center"
      style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)' }}
    >
      <p className="text-lg font-extrabold tracking-tight">Empty bench</p>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
        Pick a part from the palette, or start from the breadboard + ESP32 template or the LED
        blink example.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNew}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          New project
        </button>
        <button
          type="button"
          onClick={onLoadExample}
          className="rounded-xl px-4 py-2 text-sm font-bold"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          Load example
        </button>
      </div>
    </div>
  )
}
