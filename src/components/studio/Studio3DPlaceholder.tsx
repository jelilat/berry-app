'use client'

/**
 * Placeholder shown when the user selects 3D view (Phase 7).
 */
export function Studio3DPlaceholder() {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center backdrop-blur-sm"
      style={{ background: 'rgba(245,243,239,0.92)' }}
    >
      <div
        className="rounded-2xl px-6 py-5"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <p className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          3D bench coming next
        </p>
        <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
          Phase 7 adds a React Three Fiber view on the same project JSON. For now, build and wire
          your circuit in 2D — nets and wires carry over when 3D ships.
        </p>
        <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
          Switch back to 2D to keep editing.
        </p>
      </div>
    </div>
  )
}
