import type { BoardId } from '@/lib/project/types'

/** PlatformIO board metadata Berry needs for generated firmware projects. */
interface PlatformioBoardProfile {
  environment: string
  board: string
  framework: 'arduino'
  monitorSpeed: number
  platform: string
  artifactRelative: string
}

/** Board-to-PlatformIO mapping for Berry's currently supported MCUs. */
export const BOARD_PIO_CONFIG: Record<BoardId, PlatformioBoardProfile> = {
  'esp32-devkit-v1': {
    environment: 'esp32dev',
    board: 'esp32dev',
    framework: 'arduino',
    monitorSpeed: 115200,
    platform: 'espressif32',
    artifactRelative: '.pio/build/esp32dev/firmware.bin',
  },
  'arduino-uno': {
    environment: 'uno',
    board: 'uno',
    framework: 'arduino',
    monitorSpeed: 9600,
    platform: 'atmelavr',
    artifactRelative: '.pio/build/uno/firmware.hex',
  },
}

/**
 * Resolve the PlatformIO environment id for a Berry board.
 * @param board Berry board id.
 */
export function resolvePlatformioEnvironment(board: BoardId): string {
  return BOARD_PIO_CONFIG[board].environment
}

/**
 * Generate a minimal PlatformIO config for the selected board.
 * @param board Berry board id.
 */
export function resolvePlatformioIni(board: BoardId, override?: string): string {
  if (override?.trim()) return override
  const profile = BOARD_PIO_CONFIG[board]
  return `[env:${profile.environment}]
platform = ${profile.platform}
board = ${profile.board}
framework = ${profile.framework}
monitor_speed = ${profile.monitorSpeed}
`
}
