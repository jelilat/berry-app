'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { listCatalogGrouped } from '@/lib/project/catalog-groups'
import { hasWokwiVisual } from '@/lib/studio/wokwi-map'
import type { ComponentTypeId } from '@/lib/project/types'
import { FallbackPartArt } from './FallbackPartArt'
import { WokwiPart } from './WokwiPart'

/**
 * Grouped visual component palette — click a part to place it, or a wire to pick jumper style.
 * @param onAddPart Callback when a placeable part is chosen.
 * @param activeWireType Currently selected wire template, if any.
 */
export function ComponentTray({
  onAddPart,
  activeWireType,
}: {
  onAddPart: (type: ComponentTypeId) => void
  activeWireType: ComponentTypeId | null
}) {
  const sections = listCatalogGrouped().filter((section) => section.group !== 'wires')
  const totalParts = sections.reduce((n, s) => n + s.parts.length, 0)
  const [query, setQuery] = useState('')

  const filtered = sections
    .map((section) => ({
      ...section,
      parts: section.parts.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((section) => section.parts.length > 0)

  return (
    <aside
      className="flex w-[296px] shrink-0 flex-col overflow-hidden border-r"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      <div className="border-b px-3 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Components
          </p>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
          >
            {totalParts}
          </span>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="search"
            placeholder="Search components…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs font-medium outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {filtered.map((section) => (
          <div key={section.group} className="mb-4">
            <p
              className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {section.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {section.parts.map((part) => (
                <PartCard
                  key={part.id}
                  type={part.id}
                  name={part.name}
                  isWire={false}
                  isActiveWire={activeWireType === part.id}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-berry-component', part.id)
                    event.dataTransfer.setData('text/plain', part.id)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() =>
                    onAddPart(part.id)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

/**
 * Single visual part or wire card in the component palette.
 */
function PartCard({
  type,
  name,
  isWire,
  isActiveWire,
  onDragStart,
  onClick,
}: {
  type: ComponentTypeId
  name: string
  isWire: boolean
  isActiveWire: boolean
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void
  onClick: () => void
}) {
  const hasWokwi = hasWokwiVisual(type)

  return (
    <button
      type="button"
      draggable={!isWire}
      onDragStart={onDragStart}
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: isActiveWire ? 'rgba(15,168,134,0.1)' : 'var(--bg-elevated)',
        border: isActiveWire
          ? '1px solid rgba(15,168,134,0.45)'
          : '1px solid var(--border)',
      }}
      title={`Add ${name}`}
    >
      <div
        className="flex h-[72px] w-full items-center justify-center overflow-hidden rounded-lg"
        style={{ background: 'linear-gradient(180deg, #faf9f7 0%, #f0ede8 100%)' }}
      >
        {hasWokwi ? (
          <WokwiPart type={type} width={88} height={64} fit />
        ) : (
          <FallbackPartArt type={type} size={72} />
        )}
      </div>
      <span
        className="line-clamp-2 text-[10px] font-semibold leading-tight group-hover:text-[var(--accent)]"
        style={{ color: isActiveWire ? 'var(--leaf)' : 'var(--text-secondary)' }}
      >
        {name}
      </span>
    </button>
  )
}
