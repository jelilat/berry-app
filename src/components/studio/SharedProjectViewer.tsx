'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink, Eye, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-browser'
import { hasSupabaseBrowserConfig } from '@/lib/auth/config'
import { DEFAULT_FIRMWARE_PATH, createDefaultFirmwareSource } from '@/lib/firmware/source'
import { createFirmwareSourceFiles, inferFirmwareFolders } from '@/lib/firmware/workspace'
import type { FirmwareSourceFiles } from '@/lib/build/types'
import {
  resolveFirmwareWorktreeFileContent,
} from '@/lib/firmware/worktree'
import { loadBerryProjectFromJson } from '@/lib/project/io'
import type { BerryProject, ComponentTypeId, WireTypeId } from '@/lib/project/types'
import type { WireEndpointRef } from '@/lib/project/mutations'
import { loadPublicCloudProject } from '@/lib/projects/cloud-projects'
import { ComponentsOverviewPanel } from './ComponentsOverviewPanel'
import { FirmwareEditorPanel } from './FirmwareEditorPanel'
import { FirmwareWorktreePanel } from './FirmwareWorktreePanel'
import { StudioCanvas } from './StudioCanvas'
import { ViewModeToggle, type StudioViewMode } from './ViewModeToggle'

type SharedViewerStatus = 'loading' | 'ready' | 'unavailable' | 'error'

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
 * Public project shell that exposes project data without any mutation controls.
 * @param props Shared project route identity.
 */
export function SharedProjectViewer({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<SharedViewerStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sharedProject, setSharedProject] = useState<SharedProjectState | null>(null)
  const [viewMode, setViewMode] = useState<StudioViewMode>('visual')
  const [selectedFirmwarePath, setSelectedFirmwarePath] = useState(DEFAULT_FIRMWARE_PATH)

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
          <div className="relative min-h-0 min-w-0 flex-1">
            <StudioCanvas
              project={project}
              activeWireType={'jumper-mm' as WireTypeId}
              selectedNodeId={null}
              selectedWireId={null}
              onProjectChange={ignoreProjectChange}
              onPartDrop={ignorePartDrop}
              onWireConnect={ignoreWireConnect}
              onSelectionChange={ignoreSelection}
              onWireSelectionChange={ignoreSelection}
              readOnly
            />
          </div>
        )}
      </section>

      <footer className="mt-3 flex shrink-0 items-center justify-between gap-3 px-1">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Open-source AI agent for hardware development.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-extrabold"
          style={{ color: 'var(--accent)' }}
        >
          Build with berry.
          <ExternalLink size={13} />
        </Link>
      </footer>
    </main>
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
