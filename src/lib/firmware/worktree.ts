import type { BuildResult } from '@/lib/build/types'
import { BOARD_PIO_CONFIG, resolvePlatformioIni } from '@/lib/build/platformio-ini'
import { serializeBerryProject } from '@/lib/project/io'
import type { BerryProject, BoardId } from '@/lib/project/types'
import { DEFAULT_FIRMWARE_PATH } from './source'
import {
  FIRMWARE_SOURCE_ROOT,
  inferFirmwareFolders,
  validateFirmwareSourcePath,
} from './workspace'

/** Read-only worktree path for the current Berry project graph. */
export const PROJECT_JSON_PATH = 'project.json'

/** Worktree entry kind for the firmware file tree. */
export type FirmwareWorktreeNodeKind = 'folder' | 'file'

/** How a worktree file is produced in the Studio build pipeline. */
export type FirmwareWorktreeFileStatus = 'editable' | 'generated' | 'artifact' | 'pending'

/** One node in the virtual firmware worktree. */
export interface FirmwareWorktreeNode {
  id: string
  name: string
  path: string
  kind: FirmwareWorktreeNodeKind
  status?: FirmwareWorktreeFileStatus
  badge?: string
  children?: FirmwareWorktreeNode[]
}

/** Root metadata for the firmware worktree panel. */
export interface FirmwareWorktree {
  label: string
  nodes: FirmwareWorktreeNode[]
}

/**
 * Find a direct child folder or create it when it does not exist.
 * @param parent Parent worktree folder.
 * @param name Folder segment name.
 * @param path Full project-relative folder path.
 */
function ensureSourceFolder(
  parent: FirmwareWorktreeNode,
  name: string,
  path: string,
): FirmwareWorktreeNode {
  const existing = parent.children?.find(
    (node) => node.kind === 'folder' && node.name === name,
  )
  if (existing) return existing
  const folder: FirmwareWorktreeNode = {
    id: path,
    name,
    path,
    kind: 'folder',
    children: [],
  }
  parent.children = [...(parent.children ?? []), folder]
  return folder
}

/**
 * Build the editable `src` branch from explicit folders and source files.
 * @param sourceFiles Firmware files keyed by project-relative path.
 * @param sourceFolders Explicit source folders, including empty folders.
 */
function buildSourceBranch(
  sourceFiles: Record<string, string>,
  sourceFolders: string[],
): FirmwareWorktreeNode {
  const root: FirmwareWorktreeNode = {
    id: FIRMWARE_SOURCE_ROOT,
    name: FIRMWARE_SOURCE_ROOT,
    path: FIRMWARE_SOURCE_ROOT,
    kind: 'folder',
    children: [],
  }
  const folderPaths = Array.from(
    new Set([...sourceFolders, ...inferFirmwareFolders(sourceFiles)]),
  ).sort()

  for (const folderPath of folderPaths) {
    const validation = validateFirmwareSourcePath(folderPath, 'folder')
    if (!validation.ok || !validation.path) continue
    const segments = validation.path.split('/').slice(1)
    let parent = root
    for (let index = 0; index < segments.length; index += 1) {
      const path = [FIRMWARE_SOURCE_ROOT, ...segments.slice(0, index + 1)].join('/')
      parent = ensureSourceFolder(parent, segments[index]!, path)
    }
  }

  for (const path of Object.keys(sourceFiles).sort()) {
    const validation = validateFirmwareSourcePath(path, 'file')
    if (!validation.ok || !validation.path) continue
    const segments = validation.path.split('/').slice(1)
    const fileName = segments.pop()
    if (!fileName) continue
    let parent = root
    for (let index = 0; index < segments.length; index += 1) {
      const folderPath = [FIRMWARE_SOURCE_ROOT, ...segments.slice(0, index + 1)].join('/')
      parent = ensureSourceFolder(parent, segments[index]!, folderPath)
    }
    parent.children = [
      ...(parent.children ?? []),
      {
        id: validation.path,
        name: fileName,
        path: validation.path,
        kind: 'file',
        status: 'editable',
      },
    ]
  }

  return root
}

/**
 * Format byte size for compact worktree badges.
 * @param bytes File size in bytes.
 */
export function formatFirmwareFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Split a firmware artifact path into nested folder nodes ending in a file leaf.
 * @param artifactPath Relative PlatformIO artifact path.
 * @param badge Optional size badge for the artifact file.
 */
function artifactBranch(artifactPath: string, badge?: string): FirmwareWorktreeNode {
  const segments = artifactPath.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName) {
    return {
      id: artifactPath,
      name: artifactPath,
      path: artifactPath,
      kind: 'file',
      status: 'artifact',
      badge,
    }
  }

  let path = ''
  let node: FirmwareWorktreeNode = {
    id: artifactPath,
    name: fileName,
    path: artifactPath,
    kind: 'file',
    status: 'artifact',
    badge,
  }

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    path = segments.slice(0, index + 1).join('/')
    node = {
      id: path,
      name: segments[index]!,
      path,
      kind: 'folder',
      children: [node],
    }
  }

  return node
}

/**
 * Resolve the virtual worktree path builders should see for a compiled artifact.
 * @param artifact Build artifact metadata from the latest successful build.
 */
function artifactWorktreePath(artifact: NonNullable<BuildResult['artifact']>): string {
  return BOARD_PIO_CONFIG[artifact.board].artifactRelative
}

/**
 * Build the virtual PlatformIO worktree shown in Studio Firmware view.
 * @param board Active project board profile.
 * @param buildResult Latest build result, if any.
 * @param projectName Optional project label for the tree root.
 */
export function buildFirmwareWorktree(
  board: BoardId,
  buildResult: BuildResult | null,
  projectName?: string,
  sourceFiles: Record<string, string> = { [DEFAULT_FIRMWARE_PATH]: '' },
  sourceFolders: string[] = [],
): FirmwareWorktree {
  const artifact = buildResult?.ok ? buildResult.artifact : undefined
  const artifactBadge =
    artifact?.binarySizeBytes !== undefined
      ? formatFirmwareFileSize(artifact.binarySizeBytes)
      : undefined

  const pioNodes: FirmwareWorktreeNode[] = artifact
    ? [artifactBranch(artifactWorktreePath(artifact), artifactBadge)]
    : [
        {
          id: '.pio/build',
          name: 'build',
          path: '.pio/build',
          kind: 'folder',
          status: 'pending',
          children: [
            {
              id: '.pio/build/firmware-pending',
              name: 'firmware.bin',
              path: '.pio/build/…/firmware.bin',
              kind: 'file',
              status: 'pending',
              badge: 'Build',
            },
          ],
        },
      ]

  return {
    label: projectName?.trim() || 'firmware',
    nodes: [
      {
        id: PROJECT_JSON_PATH,
        name: PROJECT_JSON_PATH,
        path: PROJECT_JSON_PATH,
        kind: 'file',
        status: 'generated',
        badge: 'Graph',
      },
      {
        id: 'platformio.ini',
        name: 'platformio.ini',
        path: 'platformio.ini',
        kind: 'file',
        status: 'generated',
        badge: board,
      },
      buildSourceBranch(sourceFiles, sourceFolders),
      {
        id: '.pio',
        name: '.pio',
        path: '.pio',
        kind: 'folder',
        children: pioNodes,
      },
    ],
  }
}

/**
 * Resolve display content for a selected worktree file path.
 * @param path Worktree file path.
 * @param project Current Berry project graph.
 * @param board Active board for generated ini content.
 * @param mainCpp Current editable firmware source.
 * @param buildResult Latest build result for artifact metadata.
 */
export function resolveFirmwareWorktreeFileContent(
  path: string,
  project: BerryProject,
  board: BoardId,
  mainCpp: string,
  buildResult?: BuildResult | null,
  sourceFiles: Record<string, string> = {},
): string | null {
  if (path === PROJECT_JSON_PATH) return serializeBerryProject(project)
  if (path === DEFAULT_FIRMWARE_PATH) return mainCpp
  if (typeof sourceFiles[path] === 'string') return sourceFiles[path]
  if (path === 'platformio.ini') return resolvePlatformioIni(board)

  const artifact = buildResult?.ok ? buildResult.artifact : undefined
  if (artifact && artifactWorktreePath(artifact) === path) {
    const size =
      artifact.binarySizeBytes !== undefined
        ? formatFirmwareFileSize(artifact.binarySizeBytes)
        : 'unknown size'
    const downloadLine = artifact.downloadUrl
      ? `# Download: ${artifact.downloadUrl}`
      : '# Download: run Build to cache firmware'
    return `# Firmware artifact (compiled locally)
# File: ${artifactWorktreePath(artifact).split('/').pop() ?? 'firmware'}
# Worktree: ${artifactWorktreePath(artifact)}
# Board: ${artifact.board}
# Size: ${size}
# Hash: ${artifact.firmwareHash}
# Built: ${artifact.createdAt}
${downloadLine}
`
  }

  if (path.includes('firmware-pending') || path.includes('…')) {
    return `# Firmware artifact

# Run Build to compile firmware.bin / firmware.hex.
# The binary is generated under .pio/build/ during compile.
`
  }

  return null
}

/**
 * True when the selected worktree file can be edited in the code editor.
 * @param path Worktree file path.
 */
export function isEditableFirmwareWorktreePath(path: string): boolean {
  const validation = validateFirmwareSourcePath(path, 'file')
  return validation.ok && validation.path === path
}

/**
 * True when the worktree file should open as read-only preview text.
 * @param path Worktree file path.
 */
export function isPreviewFirmwareWorktreePath(path: string): boolean {
  return path === PROJECT_JSON_PATH || path === 'platformio.ini' || path.includes('.pio/build/')
}
