'use client'

import { Cable, Cpu, PackageCheck } from 'lucide-react'
import { getComponentDefinition, getWireTemplate } from '@/lib/project/catalog'
import type { BerryProject, ComponentTypeId, WireTypeId } from '@/lib/project/types'
import { getWokwiVisual } from '@/lib/studio/wokwi-map'
import { WokwiPart } from './WokwiPart'
import { FallbackPartArt } from './FallbackPartArt'

interface ComponentSummary {
  type: ComponentTypeId
  name: string
  quantity: number
  terminalCount: number
}

interface WireSummary {
  type: WireTypeId
  name: string
  quantity: number
  colors: string[]
}

/**
 * Summarize placed components by catalog type.
 * @param project Berry project to summarize.
 */
function componentSummaries(project: BerryProject): ComponentSummary[] {
  const counts = new Map<ComponentTypeId, number>()
  for (const component of project.components) {
    counts.set(component.type, (counts.get(component.type) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([type, quantity]) => {
      const definition = getComponentDefinition(type)
      return {
        type,
        name: definition.name,
        quantity,
        terminalCount: definition.terminals.length,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Summarize visual jumper wires by connector type and color.
 * @param project Berry project to summarize.
 */
function wireSummaries(project: BerryProject): WireSummary[] {
  const summaries = new Map<WireTypeId, { quantity: number; colors: Set<string> }>()
  for (const wire of project.wires) {
    const type = wire.type ?? 'jumper-mm'
    const current = summaries.get(type) ?? { quantity: 0, colors: new Set<string>() }
    current.quantity += 1
    if (wire.color) current.colors.add(wire.color)
    summaries.set(type, current)
  }

  return [...summaries.entries()].map(([type, summary]) => ({
    type,
    name: getComponentDefinition(type).name,
    quantity: summary.quantity,
    colors: [...summary.colors],
  }))
}

/**
 * Render a stable visual preview for a component inventory card.
 * @param props Catalog type and display size.
 */
function ComponentPreview({
  type,
  size,
}: {
  type: ComponentTypeId
  size: { width: number; height: number }
}) {
  const hasWokwiVisual = Boolean(getWokwiVisual(type))

  return (
    <div className="flex h-[124px] items-center justify-center overflow-hidden rounded-lg" style={{ background: 'var(--bg-base)' }}>
      {hasWokwiVisual ? (
        <WokwiPart type={type} width={size.width} height={size.height} fit />
      ) : (
        <FallbackPartArt type={type} size={Math.min(size.width, size.height)} />
      )}
    </div>
  )
}

/**
 * Choose a compact preview box for a catalog part.
 * @param type Component catalog id.
 */
function previewSize(type: ComponentTypeId): { width: number; height: number } {
  if (type === 'breadboard-full') return { width: 220, height: 88 }
  if (type === 'arduino-uno') return { width: 190, height: 146 }
  if (type === 'esp32-devkit-v1') return { width: 92, height: 122 }
  if (type.includes('lcd') || type.includes('display') || type.includes('oled')) return { width: 170, height: 92 }
  return { width: 132, height: 104 }
}

/**
 * Visual inventory of the actual parts used in the current project.
 * @param props Current Berry project.
 */
export function ComponentsOverviewPanel({ project }: { project: BerryProject }) {
  const components = componentSummaries(project)
  const wires = wireSummaries(project)
  const totalComponents = project.components.length
  const totalWires = project.wires.length

  return (
    <section className="h-full min-h-0 overflow-auto px-6 py-5" style={{ background: 'var(--bg-base)' }} aria-label="Project components">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
              Project components
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Parts used in this build
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Metric icon={PackageCheck} label="Components" value={totalComponents} />
            <Metric icon={Cable} label="Jumpers" value={totalWires} />
            <Metric icon={Cpu} label="Board" value={project.board === 'arduino-uno' ? 'Uno' : 'ESP32'} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {components.map((component) => (
            <article
              key={component.type}
              className="overflow-hidden rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
            >
              <ComponentPreview type={component.type} size={previewSize(component.type)} />
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    {component.name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {component.terminalCount > 0 ? `${component.terminalCount} pins` : 'Board surface'}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold"
                  style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
                >
                  x{component.quantity}
                </span>
              </div>
            </article>
          ))}
        </div>

        {wires.length > 0 && (
          <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
              <Cable size={16} />
              Jumpers and connections
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {wires.map((wire) => (
                <WireCard key={wire.type} wire={wire} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Compact metric pill in the components overview header.
 * @param props Icon, label, and metric value.
 */
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PackageCheck
  label: string
  value: number | string
}) {
  return (
    <div
      className="flex h-11 items-center gap-2 rounded-lg px-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <Icon size={15} style={{ color: 'var(--accent)' }} />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="text-sm font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
      </div>
    </div>
  )
}

/**
 * Render one grouped jumper summary.
 * @param props Wire summary to display.
 */
function WireCard({ wire }: { wire: WireSummary }) {
  const template = getWireTemplate(wire.type)

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {wire.name}
        </p>
        <span className="text-xs font-extrabold" style={{ color: 'var(--accent)' }}>
          x{wire.quantity}
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        {template.connectors.start.toUpperCase()} to {template.connectors.end.toUpperCase()}
      </p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--bg-elevated)' }}>
        {(wire.colors.length > 0 ? wire.colors : [template.defaultColor]).map((color) => (
          <span key={color} className="min-w-5 flex-1" style={{ background: color }} />
        ))}
      </div>
    </div>
  )
}
