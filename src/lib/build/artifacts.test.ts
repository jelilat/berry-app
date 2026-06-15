import { describe, expect, it } from 'vitest'
import { loadBuildArtifact, persistBuildArtifact } from './artifacts'

describe('persistBuildArtifact', () => {
  it('stores and reloads firmware bytes by hash', async () => {
    const hash = 'test-hash-' + Date.now()
    const binary = Buffer.from([0x01, 0x02, 0x03, 0x04])

    const stored = await persistBuildArtifact(
      hash,
      'esp32-devkit-v1',
      binary,
      '.pio/build/esp32dev/firmware.bin',
    )

    expect(stored.filename).toBe('firmware.bin')
    expect(stored.downloadUrl).toContain(encodeURIComponent(hash))

    const loaded = await loadBuildArtifact(hash)
    expect(loaded?.binary.equals(binary)).toBe(true)
    expect(loaded?.filename).toBe('firmware.bin')
  })
})
