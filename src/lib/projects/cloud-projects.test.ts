import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  loadCloudProjectShareState,
  loadPublicCloudProject,
  setCloudProjectSharing,
} from './cloud-projects'

/**
 * Cast a narrow test double to the Supabase client interface.
 * @param value Partial client behavior used by one test.
 */
function asSupabaseClient(value: unknown): SupabaseClient {
  return value as SupabaseClient
}

describe('cloud project sharing', () => {
  it('loads a shared project through the public RPC', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'project-1',
        name: 'Weather station',
        board: 'esp32-devkit-v1',
        updated_at: '2026-07-25T12:00:00.000Z',
        project_json: { version: 1 },
        firmware_files: { 'src/main.cpp': 'void setup() {}' },
      },
      error: null,
    })
    const rpc = vi.fn().mockReturnValue({ maybeSingle })

    const project = await loadPublicCloudProject(
      asSupabaseClient({ rpc }),
      'project-1',
    )

    expect(rpc).toHaveBeenCalledWith('get_shared_project', {
      project_id: 'project-1',
    })
    expect(project).toMatchObject({
      id: 'project-1',
      name: 'Weather station',
      firmwareFiles: { 'src/main.cpp': 'void setup() {}' },
    })
  })

  it('returns null when a project is not publicly available', async () => {
    const rpc = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    await expect(
      loadPublicCloudProject(asSupabaseClient({ rpc }), 'private-project'),
    ).resolves.toBeNull()
  })

  it('reads and revokes owner-controlled sharing state', async () => {
    const readChain = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { is_shared: true, shared_at: '2026-07-25T12:00:00.000Z' },
        error: null,
      }),
    }
    readChain.select.mockReturnValue(readChain)
    readChain.eq.mockReturnValue(readChain)

    const readState = await loadCloudProjectShareState(
      asSupabaseClient({ from: vi.fn().mockReturnValue(readChain) }),
      'project-1',
    )

    expect(readState).toEqual({
      isShared: true,
      sharedAt: '2026-07-25T12:00:00.000Z',
    })

    const updateChain = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { is_shared: false, shared_at: null },
        error: null,
      }),
    }
    updateChain.update.mockReturnValue(updateChain)
    updateChain.eq.mockReturnValue(updateChain)
    updateChain.select.mockReturnValue(updateChain)

    const revoked = await setCloudProjectSharing(
      asSupabaseClient({ from: vi.fn().mockReturnValue(updateChain) }),
      'project-1',
      false,
    )

    expect(updateChain.update).toHaveBeenCalledWith({
      is_shared: false,
      shared_at: null,
    })
    expect(revoked).toEqual({ isShared: false, sharedAt: null })
  })
})
