import { getComponentDefinition } from '@/lib/project/catalog'
import type { BerryProject, ComponentInstance } from '@/lib/project/types'
import { xy } from '@/lib/project/vec3'
import {
  terminalRelativePositions,
  terminalScenePositionFromRel,
} from '@/lib/project/terminal-layout'
import type { InstancePinLayout, PinLayoutRegistry } from '@/lib/studio/pin-layout-registry'
import { SCENE_SCALE } from '@/lib/studio/constants'
import { catalogSceneSize } from '@/lib/studio/scene-size'
import { getWokwiVisual, wokwiBaselinePinLayout } from '@/lib/studio/wokwi-map'
import { pinLayoutInContainer } from '@/lib/studio/wokwi-pin-position'

/**
 * Catalog fallback pin layout (0–1 in unrotated part box).
 * Visual wiring uses Wokwi pinInfo via {@link PinLayoutRegistry} when available.
 * @param instance Placed component.
 */
export function catalogTerminalLayout(
  instance: ComponentInstance,
): InstancePinLayout {
  const def = getComponentDefinition(instance.type)
  const terminalIds = def.terminals.map((t) => t.id)
  const visual = getWokwiVisual(instance.type)
  const native = wokwiBaselinePinLayout(instance.type, terminalIds)
  if (native && visual) {
    const scene = catalogSceneSize(instance.type)
    return pinLayoutInContainer(
      native,
      scene.w * SCENE_SCALE,
      scene.h * SCENE_SCALE,
      visual.nativeWidth,
      visual.nativeHeight,
    )
  }
  return terminalRelativePositions(def.terminals, instance.type)
}

/**
 * Resolved visual pin layout: catalog baseline with Wokwi pinInfo overrides.
 * @param instance Placed component.
 * @param registry Runtime Wokwi pin layouts.
 */
export function visualTerminalLayout(
  instance: ComponentInstance,
  registry: PinLayoutRegistry,
): InstancePinLayout {
  const catalog = catalogTerminalLayout(instance)
  const wokwi = registry.get(instance.id)
  if (!wokwi) return catalog
  return { ...catalog, ...wokwi }
}

/**
 * Bench (scene) position of one terminal using the visual pin layout.
 * @param project Berry project.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on that component.
 * @param registry Runtime Wokwi pin layouts.
 */
export function terminalBenchPosition(
  project: BerryProject,
  componentId: string,
  terminalId: string,
  registry: PinLayoutRegistry,
  positionOverride?: { x: number; y: number },
): { x: number; y: number } | null {
  const inst = project.components.find((c) => c.id === componentId)
  if (!inst) return null
  const layout = visualTerminalLayout(inst, registry)
  const rel = layout[terminalId]
  if (!rel) return null
  const pos = positionOverride ?? xy(inst.transform.position)
  const rotationZ = inst.transform.rotation?.z ?? 0
  return terminalScenePositionFromRel(pos.x, pos.y, inst.type, rel, rotationZ)
}

/**
 * Canvas pixel position of one terminal (React Flow / wire overlay space).
 * @param project Berry project.
 * @param componentId Component instance id.
 * @param terminalId Terminal id on that component.
 * @param scale Pixels per scene unit.
 * @param registry Runtime Wokwi pin layouts.
 */
export function terminalCanvasPosition(
  project: BerryProject,
  componentId: string,
  terminalId: string,
  scale: number,
  registry: PinLayoutRegistry,
  positionOverride?: { x: number; y: number },
): { x: number; y: number } | null {
  const bench = terminalBenchPosition(
    project,
    componentId,
    terminalId,
    registry,
    positionOverride,
  )
  if (!bench) return null
  return { x: bench.x * scale, y: bench.y * scale }
}
