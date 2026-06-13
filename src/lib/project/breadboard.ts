/**
 * Breadboard hole grid, tie groups (shared copper), and site formatting.
 * Standard full breadboard: 60 columns, rows a–e (top) / f–j (bottom), 5-hole column tie strips.
 */

/** Column count on the main tie area. */
export const BREADBOARD_COLUMNS = 60

/** Row letters above the center trench. */
export const BREADBOARD_ROWS_TOP = ['a', 'b', 'c', 'd', 'e'] as const

/** Row letters below the center trench. */
export const BREADBOARD_ROWS_BOTTOM = ['f', 'g', 'h', 'i', 'j'] as const

export type BreadboardRowId =
  | (typeof BREADBOARD_ROWS_TOP)[number]
  | (typeof BREADBOARD_ROWS_BOTTOM)[number]

export type BreadboardBlock = 'top' | 'bottom'

/** One main-area breadboard hole (not power rail). */
export interface BreadboardHoleSite {
  kind: 'hole'
  block: BreadboardBlock
  row: BreadboardRowId
  column: number
}

/** Power rail hole (+ or − strip along top/bottom edge). */
export interface BreadboardRailSite {
  kind: 'rail'
  edge: 'top' | 'bottom'
  polarity: 'positive' | 'negative'
  column: number
}

export type BreadboardSite = BreadboardHoleSite | BreadboardRailSite

/**
 * Maps each part terminal id to a hole/rail on the parent breadboard.
 */
export interface BreadboardPlacement {
  sites: Record<string, BreadboardSite>
}

const ALL_ROWS: readonly BreadboardRowId[] = [
  ...BREADBOARD_ROWS_TOP,
  ...BREADBOARD_ROWS_BOTTOM,
]

/**
 * Whether a row letter belongs to the top block (above the trench).
 * @param row Breadboard row id.
 */
export function rowToBlock(row: BreadboardRowId): BreadboardBlock {
  return (BREADBOARD_ROWS_TOP as readonly string[]).includes(row) ? 'top' : 'bottom'
}

/**
 * Validate and normalize a column index (1–60).
 * @param column User or JSON column number.
 */
export function normalizeColumn(column: number): number {
  const c = Math.round(column)
  if (c < 1 || c > BREADBOARD_COLUMNS) {
    throw new Error(`Breadboard column must be 1–${BREADBOARD_COLUMNS}, got ${column}`)
  }
  return c
}

/**
 * Validate a row letter for the breadboard grid.
 * @param row Row id string.
 */
export function parseBreadboardRow(row: string): BreadboardRowId {
  const r = row.toLowerCase() as BreadboardRowId
  if (!(ALL_ROWS as readonly string[]).includes(r)) {
    throw new Error(`Invalid breadboard row: ${row}`)
  }
  return r
}

/**
 * Parse a breadboard site from JSON (hole or rail).
 * @param value Raw site object.
 * @param path Error path prefix.
 */
export function parseBreadboardSite(value: unknown, path: string): BreadboardSite {
  if (!value || typeof value !== 'object') {
    throw new Error(`${path} must be an object`)
  }
  const o = value as Record<string, unknown>
  const kind = o.kind
  if (kind === 'hole') {
    const row = parseBreadboardRow(String(o.row ?? ''))
    const block =
      o.block === 'top' || o.block === 'bottom'
        ? o.block
        : rowToBlock(row)
    return {
      kind: 'hole',
      block,
      row,
      column: normalizeColumn(Number(o.column)),
    }
  }
  if (kind === 'rail') {
    if (o.edge !== 'top' && o.edge !== 'bottom') {
      throw new Error(`${path}.edge must be "top" or "bottom"`)
    }
    if (o.polarity !== 'positive' && o.polarity !== 'negative') {
      throw new Error(`${path}.polarity must be "positive" or "negative"`)
    }
    return {
      kind: 'rail',
      edge: o.edge,
      polarity: o.polarity,
      column: normalizeColumn(Number(o.column)),
    }
  }
  throw new Error(`${path}.kind must be "hole" or "rail"`)
}

/**
 * Parse {@link BreadboardPlacement} from JSON.
 * @param value Raw placement object.
 * @param path Error path prefix.
 */
export function parseBreadboardPlacement(value: unknown, path: string): BreadboardPlacement {
  if (!value || typeof value !== 'object') {
    throw new Error(`${path} must be an object`)
  }
  const o = value as Record<string, unknown>
  const sitesRaw = o.sites
  if (!sitesRaw || typeof sitesRaw !== 'object' || Array.isArray(sitesRaw)) {
    throw new Error(`${path}.sites must be an object`)
  }
  const sites: Record<string, BreadboardSite> = {}
  for (const [terminalId, siteVal] of Object.entries(sitesRaw)) {
    sites[terminalId] = parseBreadboardSite(siteVal, `${path}.sites.${terminalId}`)
  }
  return { sites }
}

/**
 * Stable key for holes that share copper (same column within a 5-row block).
 * @param site Hole site on the main grid.
 */
export function breadboardHoleTieKey(site: BreadboardHoleSite): string {
  return `hole:${site.block}:${site.column}`
}

/**
 * Stable key for power-rail connectivity (full strip per polarity on an edge).
 * @param site Rail site.
 */
export function breadboardRailTieKey(site: BreadboardRailSite): string {
  return `rail:${site.edge}:${site.polarity}`
}

/**
 * Equipotential key for any breadboard site (hole tie strip or rail).
 * @param site Hole or rail site.
 */
export function breadboardTieKey(site: BreadboardSite): string {
  return site.kind === 'hole' ? breadboardHoleTieKey(site) : breadboardRailTieKey(site)
}

/**
 * True when two sites share the same copper on the breadboard.
 * @param a First site.
 * @param b Second site.
 */
export function sitesShareTie(a: BreadboardSite, b: BreadboardSite): boolean {
  return breadboardTieKey(a) === breadboardTieKey(b)
}

/**
 * Human-readable label for UI (e.g. `e10↑`, `+ rail col 5`).
 * @param site Hole or rail site.
 */
export function formatBreadboardSite(site: BreadboardSite): string {
  if (site.kind === 'rail') {
    const sign = site.polarity === 'positive' ? '+' : '−'
    return `${sign} rail ${site.edge} · col ${site.column}`
  }
  const trench = site.block === 'top' ? '↑' : '↓'
  return `${site.row}${site.column}${trench}`
}

/**
 * Build a main-area hole site with block inferred from row when omitted.
 * @param row Row letter.
 * @param column Column 1–60.
 * @param block Optional block override.
 */
export function breadboardHole(
  row: BreadboardRowId,
  column: number,
  block?: BreadboardBlock,
): BreadboardHoleSite {
  return {
    kind: 'hole',
    block: block ?? rowToBlock(row),
    row,
    column: normalizeColumn(column),
  }
}

/**
 * Parse a compact main-grid hole label such as `a30` or `J7`.
 * @param value User-entered breadboard hole label.
 * @throws When the label is not a valid main-grid hole.
 */
export function parseBreadboardHoleLabel(value: string): BreadboardHoleSite {
  const trimmed = value.trim().toLowerCase()
  const match = /^([a-j])\s*(\d{1,2})$/.exec(trimmed)
  if (!match) {
    throw new Error(`Breadboard hole must look like a30 or j7, got ${value}`)
  }
  return breadboardHole(parseBreadboardRow(match[1]), Number(match[2]))
}

/**
 * Offset a hole by column delta on the same row (clamped to 1–60).
 * @param site Starting hole.
 * @param columnDelta Columns to move (can be negative).
 */
export function offsetHoleColumn(
  site: BreadboardHoleSite,
  columnDelta: number,
): BreadboardHoleSite {
  return breadboardHole(site.row, site.column + columnDelta, site.block)
}
