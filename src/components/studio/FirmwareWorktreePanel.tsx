'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileCode2,
  FileOutput,
  Folder,
  FolderOpen,
} from 'lucide-react'
import type { BuildResult } from '@/lib/build/types'
import { downloadFirmwareArtifact } from '@/lib/firmware/download'
import type { BoardId } from '@/lib/project/types'
import {
  buildFirmwareWorktree,
  type FirmwareWorktreeNode,
  type FirmwareWorktreeFileStatus,
} from '@/lib/firmware/worktree'
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
 * Left-rail firmware worktree for the Code workspace.
 */
export function FirmwareWorktreePanel({
  board,
  projectName,
  buildResult,
  selectedPath,
  onSelectPath,
}: {
  board: BoardId
  projectName: string
  buildResult: BuildResult | null
  selectedPath: string
  onSelectPath: (path: string) => void
}) {
  const worktree = useMemo(
    () => buildFirmwareWorktree(board, buildResult, projectName),
    [board, buildResult, projectName],
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    src: true,
    '.pio': Boolean(buildResult?.ok),
    '.pio/build': Boolean(buildResult?.ok),
  })

  /**
   * Toggle folder expansion in the worktree.
   * @param path Folder path key.
   */
  const toggleFolder = (path: string) => {
    setExpanded((current) => ({ ...current, [path]: !current[path] }))
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
        <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
          Worktree
        </p>
        <p className="mt-1 truncate text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {worktree.label}
        </p>
        {buildResult?.ok && buildResult.artifact?.downloadUrl && buildResult.artifact.filename && (
          <button
            type="button"
            onClick={() =>
              downloadFirmwareArtifact(
                buildResult.artifact!.downloadUrl!,
                buildResult.artifact!.filename!,
              )
            }
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
        <ul className="space-y-0.5">
          {worktree.nodes.map((node) => (
            <WorktreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggleFolder={toggleFolder}
              onSelectPath={onSelectPath}
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
  selectedPath,
  onToggleFolder,
  onSelectPath,
}: {
  node: FirmwareWorktreeNode
  depth: number
  expanded: Record<string, boolean>
  selectedPath: string
  onToggleFolder: (path: string) => void
  onSelectPath: (path: string) => void
}) {
  const isFolder = node.kind === 'folder'
  const isOpen = expanded[node.path] ?? depth < 1
  const isSelected = !isFolder && node.path === selectedPath
  const status = node.status ?? (isFolder ? undefined : 'editable')
  const color = status ? STATUS_TINT[status] : 'var(--text-primary)'

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (isFolder) {
            onToggleFolder(node.path)
            return
          }
          if (node.status === 'pending') return
          onSelectPath(node.path)
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
              selectedPath={selectedPath}
              onToggleFolder={onToggleFolder}
              onSelectPath={onSelectPath}
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
