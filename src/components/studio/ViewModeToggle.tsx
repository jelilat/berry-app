'use client'

import type { ReactNode } from 'react'

export type StudioViewMode = '2d' | 'code' | '3d'

/**
 * Studio workspace view switcher. 3D is reserved for a later phase.
 * @param viewMode Active view.
 * @param onChange Called when the user picks a workspace view.
 */
export function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: StudioViewMode
  onChange: (mode: StudioViewMode) => void
}) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      role="group"
      aria-label="Bench view mode"
    >
      <ViewButton active={viewMode === '2d'} onClick={() => onChange('2d')}>
        2D
      </ViewButton>
      <ViewButton active={viewMode === 'code'} onClick={() => onChange('code')}>
        Code
      </ViewButton>
      <ViewButton active={viewMode === '3d'} onClick={() => onChange('3d')}>
        3D
      </ViewButton>
    </div>
  )
}

/**
 * Segmented-control button for one Studio workspace view.
 * @param props Active state and button content.
 */
function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-3 py-1 text-xs font-bold transition-colors"
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
      }}
    >
      {children}
    </button>
  )
}
