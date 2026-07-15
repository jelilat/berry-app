'use client'

import type { ReactNode } from 'react'

export type StudioViewMode = 'visual' | 'components' | 'firmware'

/**
 * Studio workspace view switcher for the beginner build flow.
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
      <ViewButton active={viewMode === 'visual'} onClick={() => onChange('visual')}>
        Visual
      </ViewButton>
      <ViewButton active={viewMode === 'components'} onClick={() => onChange('components')}>
        Components
      </ViewButton>
      <ViewButton active={viewMode === 'firmware'} onClick={() => onChange('firmware')}>
        Firmware
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
