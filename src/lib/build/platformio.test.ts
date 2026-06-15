import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeBuildFiles } from './platformio'
import type { FirmwareSourceFiles } from './types'

describe('writeBuildFiles', () => {
  it('creates src/main.cpp under the build directory', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'berry-build-test-'))
    const files: FirmwareSourceFiles = {
      'src/main.cpp': '#include <Arduino.h>\n\nvoid setup() {}\nvoid loop() {}\n',
    }

    await writeBuildFiles(rootDir, files, 'esp32-devkit-v1')

    const mainCpp = await readFile(path.join(rootDir, 'src', 'main.cpp'), 'utf8')
    const platformioIni = await readFile(path.join(rootDir, 'platformio.ini'), 'utf8')

    expect(mainCpp).toBe(files['src/main.cpp'])
    expect(platformioIni).toContain('[env:esp32dev]')
  })
})
