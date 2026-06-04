/** Relative pin positions (0–1) keyed by terminal id. */
export type InstancePinLayout = Record<string, { x: number; y: number }>

/**
 * Runtime store of Wokwi-accurate pin layouts per component instance.
 * Updated when Wokwi elements mount and expose pinInfo.
 */
export class PinLayoutRegistry {
  private layouts = new Map<string, InstancePinLayout>()

  /**
   * Merge Wokwi pin positions over any existing layout for an instance.
   * @param instanceId Component instance id.
   * @param layout Terminal id → 0–1 position in the part box.
   */
  merge(instanceId: string, layout: InstancePinLayout): void {
    this.mergeChanged(instanceId, layout)
  }

  /**
   * Fill in catalog baseline coords only for terminals not yet measured by Wokwi.
   * @param instanceId Component instance id.
   * @param layout Catalog fallback positions.
   */
  mergeCatalogBaseline(instanceId: string, layout: InstancePinLayout): void {
    if (Object.keys(layout).length === 0) return
    const prev = this.layouts.get(instanceId) ?? {}
    const additions: InstancePinLayout = {}
    for (const [id, pos] of Object.entries(layout)) {
      if (!prev[id]) additions[id] = pos
    }
    if (Object.keys(additions).length === 0) return
    this.layouts.set(instanceId, { ...prev, ...additions })
  }

  /**
   * Merge pin positions only when at least one coordinate changes.
   * @param instanceId Component instance id.
   * @param layout Terminal id → 0–1 position in the part box.
   * @returns True when the stored layout was updated.
   */
  mergeChanged(instanceId: string, layout: InstancePinLayout): boolean {
    if (Object.keys(layout).length === 0) return false
    const prev = this.layouts.get(instanceId) ?? {}
    let changed = false
    for (const [id, pos] of Object.entries(layout)) {
      const existing = prev[id]
      if (
        !existing ||
        Math.abs(existing.x - pos.x) > 1e-5 ||
        Math.abs(existing.y - pos.y) > 1e-5
      ) {
        changed = true
        break
      }
    }
    if (!changed) return false
    this.layouts.set(instanceId, { ...prev, ...layout })
    return true
  }

  /**
   * Remove a component's layout (e.g. on delete).
   * @param instanceId Component instance id.
   */
  delete(instanceId: string): void {
    this.layouts.delete(instanceId)
  }

  /**
   * Return the stored layout for an instance, if any.
   * @param instanceId Component instance id.
   */
  get(instanceId: string): InstancePinLayout | undefined {
    return this.layouts.get(instanceId)
  }
}
