import type { BuildResult } from '@/lib/build/types'
import { resolvePlatformioIni } from '@/lib/build/platformio-ini'
import { serializeBerryProject } from '@/lib/project/io'
import type { BerryProject, BoardId } from '@/lib/project/types'
import { DEFAULT_FIRMWARE_PATH } from './source'

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
 * Build the virtual PlatformIO worktree shown in Studio Code view.
 * @param board Active project board profile.
 * @param buildResult Latest build result, if any.
 * @param projectName Optional project label for the tree root.
 */
export function buildFirmwareWorktree(
  board: BoardId,
  buildResult: BuildResult | null,
  projectName?: string,
): FirmwareWorktree {
  const artifact = buildResult?.ok ? buildResult.artifact : undefined
  const artifactBadge =
    artifact?.binarySizeBytes !== undefined
      ? formatFirmwareFileSize(artifact.binarySizeBytes)
      : undefined

  const pioNodes: FirmwareWorktreeNode[] = artifact?.binaryPath
    ? [artifactBranch(artifact.binaryPath, artifactBadge)]
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
      {
        id: 'src',
        name: 'src',
        path: 'src',
        kind: 'folder',
        children: [
          {
            id: DEFAULT_FIRMWARE_PATH,
            name: 'main.cpp',
            path: DEFAULT_FIRMWARE_PATH,
            kind: 'file',
            status: 'editable',
          },
        ],
      },
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
): string | null {
  if (path === PROJECT_JSON_PATH) return serializeBerryProject(project)
  if (path === DEFAULT_FIRMWARE_PATH) return mainCpp
  if (path === 'platformio.ini') return resolvePlatformioIni(board)

  const artifact = buildResult?.ok ? buildResult.artifact : undefined
  if (artifact?.binaryPath === path) {
    const size =
      artifact.binarySizeBytes !== undefined
        ? formatFirmwareFileSize(artifact.binarySizeBytes)
        : 'unknown size'
    const downloadLine = artifact.downloadUrl
      ? `# Download: ${artifact.downloadUrl}`
      : '# Download: run Build to cache firmware'
    return `# Firmware artifact (compiled locally)
# Path: ${artifact.binaryPath}
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
  return path === DEFAULT_FIRMWARE_PATH
}

/**
 * True when the worktree file should open as read-only preview text.
 * @param path Worktree file path.
 */
export function isPreviewFirmwareWorktreePath(path: string): boolean {
  return path === PROJECT_JSON_PATH || path === 'platformio.ini' || path.includes('.pio/build/')
}
