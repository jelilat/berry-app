# Berry project format

Berry projects are **3D-native JSON**: every position, wire point, and rotation uses `{ x, y, z }`. The 2D Studio reads and writes **only `x` and `y`**; keep `z: 0` (and `rotation.x/y: 0`) until 3D view ships.

## Top-level shape

```json
{
  "version": 1,
  "board": "esp32-devkit-v1",
  "metadata": {
    "name": "My circuit",
    "description": "Optional"
  },
  "components": [],
  "nets": [],
  "wires": []
}
```

| Field | Purpose |
|-------|---------|
| `version` | Schema version (`1` only for now) |
| `board` | Target MCU board for codegen / deploy |
| `metadata` | Human-facing project info |
| `components` | Placed parts with 3D transforms |
| `nets` | Electrical connections (what is tied together) |
| `wires` | Visual wire polylines in scene space (optional but recommended for Studio) |

## Coordinates

- **Type:** `Vec3` → `{ "x": number, "y": number, "z": number }`
- **2D Studio:** use `x`, `y`; set `z` to `0`
- **Units:** scene units (consistent per project). Three.js-friendly; treat 1 unit ≈ 1 cm unless you calibrate otherwise
- **Rotation:** Euler degrees on `transform.rotation` (`x`, `y`, `z`). 2D view primarily uses `rotation.z`

## Component instance

```json
{
  "id": "esp32_1",
  "type": "esp32-devkit-v1",
  "transform": {
    "position": { "x": 0.04, "y": 0.02, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": 1
  },
  "parent": "breadboard_1",
  "anchor": "slot-center"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Unique instance id |
| `type` | yes | Catalog id (`esp32-devkit-v1`, `led-5mm`, …) |
| `transform` | yes | `position` required; `rotation` / `scale` optional |
| `parent` | no | Parent component id (e.g. part snapped to breadboard) |
| `anchor` | no | Named attach point on parent (layout-specific) |

Electrical connectivity is **not** stored on the component body — use `nets`.

## Net (electrical)

A **net** is one shared electrical connection — like a copper island on a breadboard where every hole is the same node. Any terminals listed on that net are **electrically tied together** (same voltage, connected for current).

Berry uses nets for validation (“is this wiring allowed?”), firmware codegen (“which GPIO drives this sensor?”), and simulation — not for drawing. Use `wires` for how the line looks on screen.

A net is one equipotential node shared by multiple terminals.

```json
{
  "id": "net_power_3v3",
  "terminals": [
    { "component": "esp32_1", "terminal": "3V3" },
    { "component": "sensor_1", "terminal": "VCC" }
  ]
}
```

Validation, simulation, and codegen read **nets**, not wire geometry.

## Wire (visual + net link)

Wires are 3D polylines for rendering. Each wire belongs to exactly one net.

```json
{
  "id": "wire_1",
  "net": "net_trig",
  "color": "yellow",
  "points": [
    { "x": 0.12, "y": 0.04, "z": 0 },
    { "x": 0.18, "y": 0.04, "z": 0 },
    { "x": 0.18, "y": 0.09, "z": 0 }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Unique wire id |
| `net` | yes | References `nets[].id` |
| `color` | no | Studio palette name or hex |
| `points` | yes | At least 2 points; path in scene space |

2D routing: vary `x`/`y` along the polyline; keep all `z` at `0`.

## Component catalog (separate from project file)

Catalog entries describe part **types** (terminals, electrical kinds). Projects only reference `type` ids.

Terminal kinds include: `power_in`, `power_out`, `ground`, `gpio`, `analog_in`, `i2c_sda`, `i2c_scl`, `uart_tx`, `uart_rx`, `passive`, etc.

See `src/lib/project/catalog.ts` for shipped definitions.

## Board profile

`board` selects pin capabilities for the MCU instance (GPIO names, default I2C pins, voltage). See `src/lib/project/boards.ts`.

## Example files

- `examples/esp32-led-blink.project.json` — minimal 3D project
- Load/parse via `src/lib/project/io.ts`

## Phase mapping

| Phase | Uses |
|-------|------|
| 0 | This schema + catalog + import/export |
| 1 | 2D Studio edits `transform.position.x/y`, `wires[].points` |
| 2 | Rules engine reads `nets` + catalog terminal kinds |
| 3–5 | Codegen / sim / deploy from `board` + `nets` |
| 7 | 3D view uses full `transform` + wire `z` without schema changes |
