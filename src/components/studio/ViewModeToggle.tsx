'use client'

import type { ReactNode } from 'react'

/**
 * 2D / 3D bench view switcher. 3D is reserved for a later phase.
 * @param viewMode Active view.
 * @param onChange Called when the user picks 2D or 3D.
 */
export function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: '2d' | '3d'
  onChange: (mode: '2d' | '3d') => void
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
      <ViewButton active={viewMode === '3d'} onClick={() => onChange('3d')}>
        3D
      </ViewButton>
    </div>
  )
}

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
