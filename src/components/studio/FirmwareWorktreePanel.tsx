'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileCode2,
  FilePlus2,
  FileOutput,
  Folder,
  FolderOpen,
  FolderPlus,
  Trash2,
  X,
} from 'lucide-react'
import type { BuildResult, FirmwareSourceFiles } from '@/lib/build/types'
import { downloadFirmwareArtifact } from '@/lib/firmware/download'
import { DEFAULT_FIRMWARE_PATH } from '@/lib/firmware/source'
import type { BoardId } from '@/lib/project/types'
import {
  buildFirmwareWorktree,
  type FirmwareWorktreeNode,
  type FirmwareWorktreeFileStatus,
} from '@/lib/firmware/worktree'
import {
  firmwareParentFolders,
  inferFirmwareFolders,
  validateFirmwareSourcePath,
} from '@/lib/firmware/workspace'
import {
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
} from '@/lib/studio/constants'

const STATUS_TINT: Record<FirmwareWorktreeFileStatus, string> = {
  editable: 'var(--text-primary)',
  generated: 'var(--text-secondary)',
  artifact: 'var(--leaf)',
  pending: 'var(--text-muted)',
}

/**
 * Left-rail firmware worktree for the Firmware workspace.
 */
export function FirmwareWorktreePanel({
  board,
  projectName,
  buildResult,
  selectedPath,
  sourceFiles,
  sourceFolders,
  readOnly = false,
  onSelectPath,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
}: {
  board: BoardId
  projectName: string
  buildResult: BuildResult | null
  selectedPath: string
  sourceFiles: FirmwareSourceFiles
  sourceFolders: string[]
  readOnly?: boolean
  onSelectPath: (path: string) => void
  onCreateFile?: (path: string) => void
  onCreateFolder?: (path: string) => void
  onDeleteFile?: (path: string) => void
}) {
  const worktree = useMemo(
    () => buildFirmwareWorktree(board, buildResult, projectName, sourceFiles, sourceFolders),
    [board, buildResult, projectName, sourceFiles, sourceFolders],
  )
  const artifact = buildResult?.ok ? buildResult.artifact : undefined
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    src: true,
    '.pio': Boolean(buildResult?.ok),
    '.pio/build': Boolean(buildResult?.ok),
  })
  const [createKind, setCreateKind] = useState<'file' | 'folder' | null>(null)
  const [newPath, setNewPath] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [selectedNodePath, setSelectedNodePath] = useState(selectedPath)
  const sourceFolderPaths = useMemo(
    () => new Set(['src', ...sourceFolders, ...inferFirmwareFolders(sourceFiles)]),
    [sourceFiles, sourceFolders],
  )
  const selectedCreationFolder = useMemo(() => {
    if (sourceFolderPaths.has(selectedNodePath)) return selectedNodePath
    if (!selectedNodePath.startsWith('src/')) return null
    const parent = selectedNodePath.split('/').slice(0, -1).join('/')
    return sourceFolderPaths.has(parent) ? parent : null
  }, [selectedNodePath, sourceFolderPaths])
  const canDeleteSelectedFile =
    !readOnly &&
    selectedNodePath !== DEFAULT_FIRMWARE_PATH &&
    Object.prototype.hasOwnProperty.call(sourceFiles, selectedNodePath)

  useEffect(() => {
    const selectionStillExists =
      sourceFolderPaths.has(selectedNodePath) ||
      Object.prototype.hasOwnProperty.call(sourceFiles, selectedNodePath)
    if (!selectionStillExists) {
      setSelectedNodePath(selectedPath)
    }
  }, [selectedNodePath, selectedPath, sourceFiles, sourceFolderPaths])

  /**
   * Toggle folder expansion in the worktree.
   * @param path Folder path key.
   */
  const toggleFolder = (path: string) => {
    setExpanded((current) => ({ ...current, [path]: !current[path] }))
  }

  /**
   * Download the latest compiled firmware artifact, when the build cached one.
   */
  const downloadArtifact = () => {
    if (!artifact?.downloadUrl || !artifact.filename) return
    downloadFirmwareArtifact(artifact.downloadUrl, artifact.filename)
  }

  /**
   * Open the inline source-item creator.
   * @param kind Whether the user is creating a file or folder.
   */
  const openCreator = (kind: 'file' | 'folder') => {
    if (!selectedCreationFolder) return
    setCreateKind(kind)
    setNewPath('')
    setCreateError(null)
  }

  /**
   * Close and clear the inline source-item creator.
   */
  const closeCreator = () => {
    setCreateKind(null)
    setNewPath('')
    setCreateError(null)
  }

  /**
   * Confirm and delete the selected custom source file.
   */
  const deleteSelectedFile = () => {
    if (!canDeleteSelectedFile) return
    if (!window.confirm(`Delete ${selectedNodePath}?`)) return
    const parent = selectedNodePath.split('/').slice(0, -1).join('/') || 'src'
    onDeleteFile?.(selectedNodePath)
    setSelectedNodePath(parent)
    closeCreator()
  }

  /**
   * Validate and create a new source file or folder.
   * @param event Inline creator form submission.
   */
  const submitCreator = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!createKind || !selectedCreationFolder) return
    const requestedPath = newPath.trim().startsWith('src/')
      ? newPath
      : `${selectedCreationFolder}/${newPath}`
    const validation = validateFirmwareSourcePath(requestedPath, createKind)
    if (!validation.ok || !validation.path) {
      setCreateError(validation.error ?? 'Choose a valid path inside src.')
      return
    }
    const path = validation.path
    const fileExists = Object.prototype.hasOwnProperty.call(sourceFiles, path)
    const folderExists = sourceFolderPaths.has(path)
    if (fileExists || folderExists) {
      setCreateError('A file or folder already uses that path.')
      return
    }

    setExpanded((current) => ({
      ...current,
      src: true,
      ...Object.fromEntries(firmwareParentFolders(path).map((folder) => [folder, true])),
      ...(createKind === 'folder' ? { [path]: true } : {}),
    }))
    if (createKind === 'file') {
      onCreateFile?.(path)
      setSelectedNodePath(path)
    } else {
      onCreateFolder?.(path)
      setSelectedNodePath(path)
    }
    closeCreator()
  }

  return (
    <aside
      className="flex max-h-full min-h-0 w-[240px] shrink-0 flex-col overflow-hidden rounded-2xl"
      style={{
        minWidth: INSPECTOR_WIDTH_MIN,
        maxWidth: INSPECTOR_WIDTH_MAX,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
      aria-label="Firmware worktree"
    >
      <header
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
            Worktree
          </p>
          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openCreator('file')}
                disabled={!selectedCreationFolder}
                className="rounded-md p-1.5"
                style={{
                  color: selectedCreationFolder
                    ? 'var(--text-secondary)'
                    : 'var(--text-muted)',
                  opacity: selectedCreationFolder ? 1 : 0.45,
                }}
                title={
                  selectedCreationFolder
                    ? `New file in ${selectedCreationFolder}`
                    : 'Select a folder under src'
                }
                aria-label="New firmware file in selected folder"
              >
                <FilePlus2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => openCreator('folder')}
                disabled={!selectedCreationFolder}
                className="rounded-md p-1.5"
                style={{
                  color: selectedCreationFolder
                    ? 'var(--text-secondary)'
                    : 'var(--text-muted)',
                  opacity: selectedCreationFolder ? 1 : 0.45,
                }}
                title={
                  selectedCreationFolder
                    ? `New folder in ${selectedCreationFolder}`
                    : 'Select a folder under src'
                }
                aria-label="New firmware folder in selected folder"
              >
                <FolderPlus size={15} />
              </button>
              <button
                type="button"
                onClick={deleteSelectedFile}
                disabled={!canDeleteSelectedFile}
                className="rounded-md p-1.5"
                style={{
                  color: canDeleteSelectedFile ? 'var(--accent)' : 'var(--text-muted)',
                  opacity: canDeleteSelectedFile ? 1 : 0.45,
                }}
                title={
                  selectedNodePath === DEFAULT_FIRMWARE_PATH
                    ? 'src/main.cpp is required'
                    : canDeleteSelectedFile
                      ? `Delete ${selectedNodePath}`
                      : 'Select a custom source file'
                }
                aria-label="Delete selected firmware file"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {worktree.label}
        </p>
        {artifact?.downloadUrl && artifact.filename && (
          <button
            type="button"
            onClick={downloadArtifact}
            className="mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
            style={{
              background: 'rgba(15,168,134,0.1)',
              border: '1px solid rgba(15,168,134,0.28)',
              color: 'var(--leaf)',
            }}
          >
            <Download size={14} />
            Download firmware
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {createKind && (
          <form
            onSubmit={submitCreator}
            className="mb-2 rounded-xl p-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="firmware-new-path"
                className="text-[11px] font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                New {createKind} in {selectedCreationFolder}
              </label>
              <button
                type="button"
                onClick={closeCreator}
                aria-label="Cancel creating source item"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
            <input
              id="firmware-new-path"
              autoFocus
              value={newPath}
              onChange={(event) => {
                setNewPath(event.target.value)
                setCreateError(null)
              }}
              placeholder={createKind === 'file' ? 'sensor.cpp' : 'drivers'}
              className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${createError ? 'var(--accent)' : 'var(--border)'}`,
                color: 'var(--text-primary)',
              }}
            />
            {createError && (
              <p className="mt-1 text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
                {createError}
              </p>
            )}
            <button
              type="submit"
              className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Create {createKind}
            </button>
          </form>
        )}
        <ul className="space-y-0.5">
          {worktree.nodes.map((node) => (
            <WorktreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              selectedNodePath={selectedNodePath}
              onToggleFolder={toggleFolder}
              onSelectNode={(node) => {
                setSelectedNodePath(node.path)
                if (node.kind === 'file' && node.status !== 'pending') {
                  onSelectPath(node.path)
                }
              }}
              onDownloadArtifact={downloadArtifact}
              canDownloadArtifact={Boolean(artifact?.downloadUrl && artifact.filename)}
            />
          ))}
        </ul>
      </div>
    </aside>
  )
}

/**
 * Render one worktree node and its children recursively.
 * @param props Node render props.
 */
function WorktreeNodeRow({
  node,
  depth,
  expanded,
  selectedNodePath,
  onToggleFolder,
  onSelectNode,
  onDownloadArtifact,
  canDownloadArtifact,
}: {
  node: FirmwareWorktreeNode
  depth: number
  expanded: Record<string, boolean>
  selectedNodePath: string
  onToggleFolder: (path: string) => void
  onSelectNode: (node: FirmwareWorktreeNode) => void
  onDownloadArtifact: () => void
  canDownloadArtifact: boolean
}) {
  const isFolder = node.kind === 'folder'
  const isOpen = expanded[node.path] ?? depth < 1
  const isSelected = node.path === selectedNodePath
  const status = node.status ?? (isFolder ? undefined : 'editable')
  const color = status ? STATUS_TINT[status] : 'var(--text-primary)'

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelectNode(node)
          if (isFolder) {
            onToggleFolder(node.path)
            return
          }
          if (node.status === 'artifact' && canDownloadArtifact) {
            onDownloadArtifact()
            return
          }
          if (node.status === 'pending') return
        }}
        disabled={!isFolder && node.status === 'pending'}
        className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs font-semibold"
        style={{
          paddingLeft: `${8 + depth * 14}px`,
          background: isSelected ? 'rgba(214, 51, 108, 0.12)' : 'transparent',
          color,
        }}
      >
        {isFolder ? (
          isOpen ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />
        ) : (
          <span className="inline-block w-3.5 shrink-0" />
        )}
        <WorktreeIcon node={node} open={isOpen} />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {node.badge && (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: status === 'artifact' ? 'var(--leaf)' : 'var(--text-muted)',
            }}
          >
            {node.badge}
          </span>
        )}
      </button>

      {isFolder && isOpen && node.children && (
        <ul>
          {node.children.map((child) => (
            <WorktreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedNodePath={selectedNodePath}
              onToggleFolder={onToggleFolder}
              onSelectNode={onSelectNode}
              onDownloadArtifact={onDownloadArtifact}
              canDownloadArtifact={canDownloadArtifact}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Pick an icon for a worktree node based on kind and status.
 * @param node Worktree node.
 * @param open Whether a folder is expanded.
 */
function WorktreeIcon({ node, open }: { node: FirmwareWorktreeNode; open: boolean }) {
  if (node.kind === 'folder') {
    return open ? (
      <FolderOpen size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />
    ) : (
      <Folder size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />
    )
  }
  if (node.status === 'artifact') {
    return <FileOutput size={14} className="shrink-0" style={{ color: 'var(--leaf)' }} />
  }
  if (node.path.endsWith('.cpp')) {
    return <FileCode2 size={14} className="shrink-0" />
  }
  return <File size={14} className="shrink-0" />
}
