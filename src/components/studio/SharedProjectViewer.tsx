'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, Loader2, LockKeyhole } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-browser'
import { hasSupabaseBrowserConfig } from '@/lib/auth/config'
import { DEFAULT_FIRMWARE_PATH, createDefaultFirmwareSource } from '@/lib/firmware/source'
import { createFirmwareSourceFiles, inferFirmwareFolders } from '@/lib/firmware/workspace'
import type { FirmwareSourceFiles } from '@/lib/build/types'
import {
  resolveFirmwareWorktreeFileContent,
} from '@/lib/firmware/worktree'
import { loadBerryProjectFromJson } from '@/lib/project/io'
import type {
  BerryProject,
  BreadboardSite,
  ComponentTypeId,
  WireTypeId,
} from '@/lib/project/types'
import type { WireEndpointRef } from '@/lib/project/mutations'
import {
  loadPublicCloudProject,
  upsertCloudUserProject,
} from '@/lib/projects/cloud-projects'
import { LoginPromptModal } from '@/components/home/LoginPromptModal'
import { ComponentInspectorPanel } from './ComponentInspectorPanel'
import { ComponentsOverviewPanel } from './ComponentsOverviewPanel'
import { FirmwareEditorPanel } from './FirmwareEditorPanel'
import { FirmwareWorktreePanel } from './FirmwareWorktreePanel'
import { StudioCanvas } from './StudioCanvas'
import { ViewModeToggle, type StudioViewMode } from './ViewModeToggle'

type SharedViewerStatus = 'loading' | 'ready' | 'unavailable' | 'error'
type RemixStatus = 'idle' | 'creating'

interface SharedProjectState {
  project: BerryProject
  firmwareFiles: FirmwareSourceFiles
}

/**
 * Ignore a project mutation attempted by the read-only canvas.
 * @param _project Unused project value.
 */
function ignoreProjectChange(_project: BerryProject): void {}

/**
 * Ignore a component drop attempted by the read-only canvas.
 * @param _type Unused component type.
 * @param _x Unused x coordinate.
 * @param _y Unused y coordinate.
 */
function ignorePartDrop(_type: ComponentTypeId, _x: number, _y: number): void {}

/**
 * Ignore a wire connection attempted by the read-only canvas.
 * @param _from Unused wire source.
 * @param _to Unused wire destination.
 * @param _points Unused wire route.
 */
function ignoreWireConnect(
  _from: WireEndpointRef,
  _to: WireEndpointRef,
  _points: { x: number; y: number; z: number }[],
): void {}

/**
 * Ignore a selection attempted by the read-only canvas.
 * @param _id Unused selected id.
 */
function ignoreSelection(_id: string | null): void {}

/**
 * Ignore a rotation attempted by the read-only inspector.
 * @param _deltaDegrees Unused rotation delta.
 */
function ignoreRotation(_deltaDegrees: number): void {}

/**
 * Ignore a position change attempted by the read-only inspector.
 * @param _x Unused x coordinate.
 * @param _y Unused y coordinate.
 */
function ignorePositionChange(_x: number, _y: number): void {}

/**
 * Ignore a pin placement change attempted by the read-only inspector.
 * @param _terminalId Unused component terminal.
 * @param _site Unused breadboard site.
 */
function ignorePinSiteChange(_terminalId: string, _site: BreadboardSite): void {}

/**
 * Create an independently owned project graph from a shared snapshot.
 * @param project Shared source project.
 */
function createRemixedProject(project: BerryProject): BerryProject {
  const now = new Date().toISOString()
  const sourceName = project.metadata.name.trim() || 'Untitled project'
  return {
    ...project,
    metadata: {
      ...project.metadata,
      name: `${sourceName} remix`,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Public project shell that exposes project data without any mutation controls.
 * @param props Shared project route identity.
 */
export function SharedProjectViewer({ projectId }: { projectId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const remixStartedRef = useRef(false)
  const [status, setStatus] = useState<SharedViewerStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sharedProject, setSharedProject] = useState<SharedProjectState | null>(null)
  const [viewMode, setViewMode] = useState<StudioViewMode>('visual')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedFirmwarePath, setSelectedFirmwarePath] = useState(DEFAULT_FIRMWARE_PATH)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [remixStatus, setRemixStatus] = useState<RemixStatus>('idle')
  const [remixError, setRemixError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) {
      setSignedIn(false)
      return
    }

    let mounted = true
    const supabase = createSupabaseBrowserClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data.user))
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSignedIn(Boolean(session?.user))
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let mounted = true

    /**
     * Resolve the shared snapshot without requiring an authenticated session.
     */
    async function loadSharedProject(): Promise<void> {
      if (!hasSupabaseBrowserConfig()) {
        setErrorMessage('Public project sharing is not configured for this deployment')
        setStatus('error')
        return
      }

      try {
        const entry = await loadPublicCloudProject(
          createSupabaseBrowserClient(),
          projectId,
        )
        if (!mounted) return
        if (!entry) {
          setStatus('unavailable')
          return
        }
        const project = loadBerryProjectFromJson(entry.projectJson)
        const mainCpp =
            entry.firmwareFiles?.[DEFAULT_FIRMWARE_PATH] ??
            createDefaultFirmwareSource(project.board)
        setSharedProject({
          project,
          firmwareFiles: createFirmwareSourceFiles(mainCpp, entry.firmwareFiles ?? {}),
        })
        setStatus('ready')
      } catch (error) {
        if (!mounted) return
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not open this shared project',
        )
        setStatus('error')
      }
    }

    void loadSharedProject()
    return () => {
      mounted = false
    }
  }, [projectId])

  /**
   * Insert the shared project as a new project owned by the signed-in viewer.
   */
  const createRemix = useCallback(async (): Promise<void> => {
    if (!sharedProject || remixStatus === 'creating' || remixStartedRef.current) return
    remixStartedRef.current = true
    setRemixStatus('creating')
    setRemixError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        remixStartedRef.current = false
        setRemixStatus('idle')
        setSignedIn(false)
        setLoginOpen(true)
        return
      }
      const entry = await upsertCloudUserProject(
        supabase,
        createRemixedProject(sharedProject.project),
        sharedProject.firmwareFiles,
      )
      router.push(`/bench/${entry.id}`)
    } catch (error) {
      remixStartedRef.current = false
      setRemixStatus('idle')
      setRemixError(
        error instanceof Error ? error.message : 'Could not create your project copy',
      )
    }
  }, [remixStatus, router, sharedProject])

  /**
   * Gate project remixing behind authentication.
   */
  const handleRemix = useCallback((): void => {
    setRemixError(null)
    if (!signedIn) {
      setLoginOpen(true)
      return
    }
    void createRemix()
  }, [createRemix, signedIn])

  useEffect(() => {
    if (searchParams.get('remix') !== '1' || signedIn === null) return
    if (!signedIn) {
      setLoginOpen(true)
      return
    }
    if (sharedProject) void createRemix()
  }, [createRemix, searchParams, sharedProject, signedIn])

  /**
   * Start Google authentication and return to this shared project to finish remixing.
   */
  const handleGoogleSignIn = useCallback(async (): Promise<void> => {
    const next = `/share/${encodeURIComponent(projectId)}?remix=1`
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw error
  }, [projectId])

  /**
   * Send an email sign-in link that returns to this shared project to finish remixing.
   * @param email Viewer email address.
   */
  const handleEmailSignIn = useCallback(async (email: string): Promise<void> => {
    const next = `/share/${encodeURIComponent(projectId)}?remix=1`
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) throw error
  }, [projectId])

  if (status === 'loading') {
    return <SharedProjectMessage title="Opening shared project…" />
  }

  if (status === 'unavailable') {
    return (
      <SharedProjectMessage
        title="This project isn’t available"
        message="The owner may have turned off sharing, or the link may be incorrect."
      />
    )
  }

  if (status === 'error' || !sharedProject) {
    return (
      <SharedProjectMessage
        title="Couldn’t open this project"
        message={errorMessage ?? 'Please try this link again.'}
      />
    )
  }

  const { project, firmwareFiles } = sharedProject
  const firmwareSource = firmwareFiles[DEFAULT_FIRMWARE_PATH]
  const selectedFirmwareContent =
    resolveFirmwareWorktreeFileContent(
      selectedFirmwarePath,
      project,
      project.board,
      firmwareSource,
      null,
      firmwareFiles,
    ) ?? firmwareSource
  const projectName = project.metadata.name.trim() || 'Untitled project'

  return (
    <main
      className="flex h-[100dvh] min-h-0 flex-col overflow-hidden p-3 sm:p-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <header
        className="mb-3 flex shrink-0 flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="berry. home">
          <Image src="/berry-logo.svg" alt="" width={82} height={28} className="h-7 w-auto" />
        </Link>
        <span className="hidden h-6 w-px sm:block" style={{ background: 'var(--border)' }} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-black" style={{ color: 'var(--text-primary)' }}>
            {projectName}
          </h1>
          <p
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            <Eye size={13} />
            Shared project
          </p>
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        <RemixButton
          onClick={handleRemix}
          creating={remixStatus === 'creating'}
          compact
        />
        <div
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold"
          style={{
            background: 'rgba(15,168,134,0.09)',
            border: '1px solid rgba(15,168,134,0.24)',
            color: 'var(--leaf)',
          }}
        >
          <LockKeyhole size={13} />
          View only
        </div>
      </header>

      {remixError && (
        <p
          className="mb-3 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
          role="alert"
        >
          {remixError}
        </p>
      )}

      <section className="flex min-h-0 flex-1 gap-3">
        {viewMode === 'firmware' ? (
          <>
            <FirmwareWorktreePanel
              board={project.board}
              projectName={projectName}
              buildResult={null}
              selectedPath={selectedFirmwarePath}
              sourceFiles={firmwareFiles}
              sourceFolders={inferFirmwareFolders(firmwareFiles)}
              readOnly
              onSelectPath={setSelectedFirmwarePath}
            />
            <div className="min-h-0 min-w-0 flex-1">
              <FirmwareEditorPanel
                board={project.board}
                filePath={selectedFirmwarePath}
                source={selectedFirmwareContent}
                readOnly
                onChange={() => {}}
              />
            </div>
          </>
        ) : viewMode === 'components' ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl">
            <ComponentsOverviewPanel project={project} />
          </div>
        ) : (
          <>
            <div className="relative min-h-0 min-w-0 flex-1">
              <StudioCanvas
                project={project}
                activeWireType={'jumper-mm' as WireTypeId}
                selectedNodeId={selectedNodeId}
                selectedWireId={null}
                onProjectChange={ignoreProjectChange}
                onPartDrop={ignorePartDrop}
                onWireConnect={ignoreWireConnect}
                onSelectionChange={setSelectedNodeId}
                onWireSelectionChange={ignoreSelection}
                readOnly
              />
            </div>
            {selectedNodeId && (
              <ComponentInspectorPanel
                project={project}
                componentId={selectedNodeId}
                onClose={() => setSelectedNodeId(null)}
                onRotate={ignoreRotation}
                onPositionChange={ignorePositionChange}
                onPinSiteChange={ignorePinSiteChange}
                readOnly
                footer={
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                      Make this project your own
                    </p>
                    <p
                      className="mt-1 text-[11px] font-medium leading-4"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {signedIn
                        ? 'Create an editable copy with its wiring and firmware.'
                        : 'Sign up or sign in to edit its wiring, components, and firmware.'}
                    </p>
                    <div className="mt-3">
                      <RemixButton
                        onClick={handleRemix}
                        creating={remixStatus === 'creating'}
                      />
                    </div>
                  </div>
                }
              />
            )}
          </>
        )}
      </section>

      <footer className="mt-3 flex shrink-0 items-center justify-between gap-3 px-1">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Open-source AI agent for hardware development.
        </p>
        <p className="text-xs font-extrabold" style={{ color: 'var(--accent)' }}>
          {signedIn ? 'Ready to make it your own.' : 'Sign up or sign in to build with berry.'}
        </p>
      </footer>

      <LoginPromptModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={handleEmailSignIn}
        title="Sign up or sign in to remix"
        description="Create an account to make an editable copy of this project. The original stays unchanged."
      />
    </main>
  )
}

/**
 * Primary shared-project action for creating an authenticated editable copy.
 * @param props Click behavior, pending state, and compact header styling.
 */
function RemixButton({
  onClick,
  creating,
  compact = false,
}: {
  onClick: () => void
  creating: boolean
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={creating}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-extrabold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 ${
        compact ? 'h-9 px-3 text-xs' : 'h-10 w-full px-4 text-sm'
      }`}
      style={{
        background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
        boxShadow: '0 10px 24px rgba(214,51,108,0.2)',
      }}
    >
      {creating && <Loader2 size={15} className="animate-spin" />}
      {creating ? 'Creating copy…' : 'Remix in berry.'}
    </button>
  )
}

/**
 * Centered loading, unavailable, or error state for a shared project route.
 * @param props State heading and optional supporting message.
 */
function SharedProjectMessage({
  title,
  message,
}: {
  title: string
  message?: string
}) {
  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center p-5"
      style={{ background: 'var(--bg-base)' }}
    >
      <section
        className="w-full max-w-md rounded-[28px] p-7 text-center"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <Image
          src="/berry-logo.svg"
          alt="berry."
          width={106}
          height={36}
          className="mx-auto h-9 w-auto"
        />
        <h1 className="mt-5 text-xl font-black" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {message && (
          <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
        )}
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Go to berry.
        </Link>
      </section>
    </main>
  )
}
