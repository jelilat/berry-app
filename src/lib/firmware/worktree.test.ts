import { describe, expect, it } from 'vitest'
import { DEFAULT_FIRMWARE_PATH } from './source'
import {
  buildFirmwareWorktree,
  formatFirmwareFileSize,
  isEditableFirmwareWorktreePath,
  type FirmwareWorktreeNode,
} from './worktree'

describe('buildFirmwareWorktree', () => {
  it('includes editable source and generated platformio.ini', () => {
    const tree = buildFirmwareWorktree('esp32-devkit-v1', null, 'ESP32 blink')

    expect(tree.label).toBe('ESP32 blink')
    expect(tree.nodes.some((node) => node.path === 'platformio.ini')).toBe(true)
    expect(
      tree.nodes
        .find((node) => node.path === 'src')
        ?.children?.some((node) => node.path === DEFAULT_FIRMWARE_PATH),
    ).toBe(true)
  })

  it('shows artifact path and size after a successful build', () => {
    const tree = buildFirmwareWorktree('esp32-devkit-v1', {
      ok: true,
      backend: 'mock',
      diagnostics: [],
      artifact: {
        board: 'esp32-devkit-v1',
        firmwareHash: 'abc',
        files: ['src/main.cpp', 'platformio.ini'],
        binaryPath: '.pio/build/esp32dev/firmware.bin',
        binarySizeBytes: 240_208,
        createdAt: '2026-06-10T00:00:00.000Z',
      },
    })

    const pio = tree.nodes.find((node) => node.path === '.pio')
    const artifactPath = findNodeByPath(pio, '.pio/build/esp32dev/firmware.bin')
    expect(artifactPath?.status).toBe('artifact')
    expect(artifactPath?.badge).toBe('235 KB')
  })
})

describe('formatFirmwareFileSize', () => {
  it('formats kilobytes for firmware binaries', () => {
    expect(formatFirmwareFileSize(240_208)).toBe('235 KB')
  })
})

describe('isEditableFirmwareWorktreePath', () => {
  it('allows editing only src/main.cpp', () => {
    expect(isEditableFirmwareWorktreePath(DEFAULT_FIRMWARE_PATH)).toBe(true)
    expect(isEditableFirmwareWorktreePath('platformio.ini')).toBe(false)
  })
})

/**
 * Depth-first search for a worktree node by path.
 * @param node Root node or undefined.
 * @param path Target path.
 */
function findNodeByPath(
  node: FirmwareWorktreeNode | undefined,
  path: string,
): FirmwareWorktreeNode | undefined {
  if (!node) return undefined
  if (node.path === path) return node
  for (const child of node.children ?? []) {
    const found = findNodeByPath(child, path)
    if (found) return found
  }
  return undefined
}
