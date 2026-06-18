import { describe, expect, it } from "vitest";
import { breadboardHole, parseBreadboardHoleLabel } from "./breadboard";
import { parseBerryProject, validateProjectGraph } from "./io";
import { findHoleOccupancyConflicts } from "./breadboard-nets";
import {
  addComponent,
  buildDefaultWirePoints,
  connectTerminals,
  createEmptyProject,
  findNetForTerminal,
  removeWire,
  createStarterProject,
  moveComponent,
  removeComponent,
  rerouteWiresForComponent,
  rotateComponent,
  setComponentTerminalSite,
  anchorWireRoutePoints,
  resolveWireTerminalRefs,
  setWireBreadboardEndpoint,
  uniqueId,
  wireHasBreadboardEndpoint,
} from "./mutations";
import type { BerryProject } from "./types";

function minimalProject(): BerryProject {
  return parseBerryProject({
    version: 1,
    board: "esp32-devkit-v1",
    metadata: { name: "test" },
    components: [
      {
        id: "esp32_1",
        type: "esp32-devkit-v1",
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
      },
      {
        id: "led_1",
        type: "led-5mm",
        transform: { position: { x: 0.3, y: 0.1, z: 0 } },
      },
    ],
    nets: [],
    wires: [],
  });
}

function breadboardProject(): BerryProject {
  return parseBerryProject({
    version: 1,
    board: "esp32-devkit-v1",
    metadata: { name: "test" },
    components: [
      {
        id: "breadboard_1",
        type: "breadboard-full",
        transform: { position: { x: 0.1, y: 0.1, z: 0 } },
      },
      {
        id: "led_1",
        type: "led-5mm",
        transform: { position: { x: 0.9, y: 0.9, z: 0 } },
      },
    ],
    nets: [],
    wires: [],
  });
}

describe("uniqueId", () => {
  it("avoids collisions", () => {
    const existing = new Set(["led_1", "led_2"]);
    expect(uniqueId("led", existing)).toBe("led_3");
  });
});

describe("createEmptyProject", () => {
  it("returns valid empty graph", () => {
    const p = createEmptyProject();
    expect(p.components).toHaveLength(0);
    expect(p.board).toBe("esp32-devkit-v1");
  });
});

describe("createStarterProject", () => {
  it("includes breadboard and esp32", () => {
    const p = createStarterProject();
    expect(p.components.map((c) => c.type)).toEqual([
      "breadboard-full",
      "esp32-devkit-v1",
    ]);
  });

  it("places every ESP32 leg on a distinct breadboard hole", () => {
    const p = createStarterProject();
    expect(findHoleOccupancyConflicts(p, "breadboard_1")).toEqual([]);
    expect(() => validateProjectGraph(p)).not.toThrow();
  });

  it("allows wiring after load", () => {
    const p = connectTerminals(
      createStarterProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "esp32_1", terminalId: "IO12" },
    );
    expect(p.wires).toHaveLength(1);
  });
});

describe("addComponent", () => {
  it("appends an instance at the requested position", () => {
    const p = addComponent(createEmptyProject(), "led-5mm", {
      x: 0.21,
      y: 0.15,
    });
    expect(p.components).toHaveLength(1);
    expect(p.components[0].transform.position.x).toBeCloseTo(0.21, 5);
    expect(p.components[0].transform.position.y).toBeCloseTo(0.15, 5);
  });

  it("rejects wire template types", () => {
    expect(() => addComponent(createEmptyProject(), "jumper-mm")).toThrow(
      /wire type/,
    );
  });
});

describe("moveComponent", () => {
  it("updates position", () => {
    const p = moveComponent(minimalProject(), "led_1", 0.5, 0.4);
    const led = p.components.find((c) => c.id === "led_1")!;
    expect(led.transform.position.x).toBeCloseTo(0.5, 5);
    expect(led.transform.position.y).toBeCloseTo(0.4, 5);
  });
});

describe("setComponentTerminalSite", () => {
  it("moves one flexible terminal to a manually entered breadboard hole", () => {
    const p = parseBerryProject({
      version: 1,
      board: "esp32-devkit-v1",
      metadata: { name: "manual holes" },
      components: [
        {
          id: "breadboard_1",
          type: "breadboard-full",
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        },
        {
          id: "res_1",
          type: "resistor-220",
          parent: "breadboard_1",
          transform: { position: { x: 0.12, y: 0.12, z: 0 } },
          placement: {
            sites: {
              pin1: { kind: "hole", block: "top", row: "a", column: 30 },
              pin2: { kind: "hole", block: "bottom", row: "j", column: 30 },
            },
          },
        },
      ],
      nets: [],
      wires: [],
    });

    const next = setComponentTerminalSite(
      p,
      "res_1",
      "pin2",
      parseBreadboardHoleLabel("c30"),
    );

    const resistor = next.components.find((c) => c.id === "res_1")!;
    expect(resistor.placement?.sites.pin1).toEqual(breadboardHole("a", 30));
    expect(resistor.placement?.sites.pin2).toEqual(breadboardHole("c", 30));
  });

  it("updates net endpoint site metadata when a connected pin moves", () => {
    const p = parseBerryProject({
      version: 1,
      board: "esp32-devkit-v1",
      metadata: { name: "net site sync" },
      components: [
        {
          id: "breadboard_1",
          type: "breadboard-full",
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        },
        {
          id: "res_1",
          type: "resistor-220",
          parent: "breadboard_1",
          transform: { position: { x: 0.12, y: 0.12, z: 0 } },
          placement: {
            sites: {
              pin1: { kind: "hole", block: "top", row: "a", column: 30 },
              pin2: { kind: "hole", block: "bottom", row: "j", column: 30 },
            },
          },
        },
        {
          id: "led_1",
          type: "led-5mm",
          parent: "breadboard_1",
          transform: { position: { x: 0.18, y: 0.12, z: 0 } },
          placement: {
            sites: {
              anode: { kind: "hole", block: "top", row: "b", column: 30 },
              cathode: { kind: "hole", block: "bottom", row: "i", column: 30 },
            },
          },
        },
      ],
      nets: [
        {
          id: "net_1",
          terminals: [
            {
              component: "res_1",
              terminal: "pin1",
              site: { kind: "hole", block: "top", row: "a", column: 30 },
            },
            {
              component: "led_1",
              terminal: "anode",
              site: { kind: "hole", block: "top", row: "b", column: 30 },
            },
          ],
        },
      ],
      wires: [
        {
          id: "wire_1",
          net: "net_1",
          from: { component: "res_1", terminal: "pin1" },
          to: { component: "led_1", terminal: "anode" },
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 0.1, y: 0.1, z: 0 },
          ],
        },
      ],
    });

    const next = setComponentTerminalSite(
      p,
      "res_1",
      "pin1",
      breadboardHole("c", 30),
    );
    const netTerminal = next.nets[0].terminals.find(
      (t) => t.component === "res_1",
    )!;

    expect(netTerminal.site).toEqual(breadboardHole("c", 30));
    expect(next.wires[0].points).not.toEqual(p.wires[0].points);
  });

  it("rejects manual hole edits for fixed microcontroller pin spacing", () => {
    const p = createStarterProject();

    expect(() =>
      setComponentTerminalSite(p, "esp32_1", "VIN", breadboardHole("a", 30)),
    ).toThrow(/fixed pin spacing/);
  });

  it("moves one LED terminal to a manually entered breadboard hole", () => {
    const p = parseBerryProject({
      version: 1,
      board: "esp32-devkit-v1",
      metadata: { name: "led holes" },
      components: [
        {
          id: "breadboard_1",
          type: "breadboard-full",
          transform: { position: { x: 0.1, y: 0.1, z: 0 } },
        },
        {
          id: "led_1",
          type: "led-5mm",
          parent: "breadboard_1",
          transform: { position: { x: 0.22, y: 0.12, z: 0 } },
          placement: {
            sites: {
              anode: { kind: "hole", block: "top", row: "a", column: 46 },
              cathode: { kind: "hole", block: "top", row: "e", column: 46 },
            },
          },
        },
      ],
      nets: [],
      wires: [],
    });

    const next = setComponentTerminalSite(
      p,
      "led_1",
      "anode",
      parseBreadboardHoleLabel("a47"),
    );

    const led = next.components.find((c) => c.id === "led_1")!;
    expect(led.placement?.sites.anode).toEqual(breadboardHole("a", 47));
    expect(led.placement?.sites.cathode).toEqual(breadboardHole("e", 46));
  });
});

describe("rotateComponent", () => {
  it("adds 90 degrees on z and preserves center", () => {
    const p = rotateComponent(minimalProject(), "esp32_1");
    const esp = p.components.find((c) => c.id === "esp32_1")!;
    expect(esp.transform.rotation?.z).toBe(90);
  });
});

describe("removeComponent", () => {
  it("removes component and dependent nets", () => {
    let p = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
    );
    p = removeComponent(p, "led_1");
    expect(p.components).toHaveLength(1);
    expect(p.nets).toHaveLength(0);
    expect(p.wires).toHaveLength(0);
  });

  it("cascades to child components", () => {
    const p = createStarterProject();
    const removed = removeComponent(p, "breadboard_1");
    expect(removed.components).toHaveLength(0);
  });
});

describe("connectTerminals", () => {
  it("creates net and wire with default points", () => {
    const p = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
    );
    expect(p.nets).toHaveLength(1);
    expect(p.nets[0].terminals).toHaveLength(2);
    expect(p.wires).toHaveLength(1);
    expect(p.wires[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it("extends existing net when one terminal is already connected", () => {
    let p = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
    );
    p = addComponent(p, "resistor-220", { x: 0.2, y: 0.1, id: "res_1" });
    p = connectTerminals(
      p,
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "res_1", terminalId: "pin1" },
    );
    expect(p.nets).toHaveLength(1);
    expect(p.nets[0].terminals).toHaveLength(3);
    expect(p.wires).toHaveLength(2);
  });

  it("stores jumper connector metadata on the wire", () => {
    const p = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
      {
        color: "orange",
        connectors: { start: "female", end: "female" },
      },
    );
    expect(p.wires[0].color).toBe("orange");
    expect(p.wires[0].connectors).toEqual({ start: "female", end: "female" });
  });

  it("orients M–F connectors when connecting pin to breadboard first", () => {
    const p = connectTerminals(
      breadboardProject(),
      { componentId: "led_1", terminalId: "anode" },
      { breadboardId: "breadboard_1", site: breadboardHole("a", 30) },
      { connectors: { start: "male", end: "female" } },
    );
    expect(p.wires[0].connectors).toEqual({ start: "female", end: "male" });
  });

  it("rejects same-gender connections for the selected jumper", () => {
    expect(() =>
      connectTerminals(
        minimalProject(),
        { componentId: "esp32_1", terminalId: "IO13" },
        { componentId: "led_1", terminalId: "anode" },
        { connectors: { start: "male", end: "male" } },
      ),
    ).toThrow(/F–F/);
  });

  it("rejects M–M when connecting a male component pin to a breadboard hole", () => {
    expect(() =>
      connectTerminals(
        breadboardProject(),
        { componentId: "led_1", terminalId: "anode" },
        { breadboardId: "breadboard_1", site: breadboardHole("a", 30) },
        { connectors: { start: "male", end: "male" } },
      ),
    ).toThrow(/M–F/);
  });

  it("stores visual wire endpoints for rerouting", () => {
    const p = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
    );

    expect(p.wires[0].from).toEqual({ component: "esp32_1", terminal: "IO13" });
    expect(p.wires[0].to).toEqual({ component: "led_1", terminal: "anode" });
  });

  it("reroutes visual wires when a connected component moves", () => {
    const wired = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
    );
    const before = wired.wires[0].points;
    const moved = moveComponent(wired, "led_1", 0.5, 0.3);
    const rerouted = rerouteWiresForComponent(moved, "led_1");

    expect(rerouted.wires[0].points).not.toEqual(before);
    expect(rerouted.wires[0].points.at(-1)?.x).toBeGreaterThan(0.5);
  });
});

describe("wire route helpers", () => {
  it("detects breadboard endpoints on a wire", () => {
    const wired = connectTerminals(
      breadboardProject(),
      { breadboardId: "breadboard_1", site: breadboardHole("a", 10) },
      { breadboardId: "breadboard_1", site: breadboardHole("j", 30) },
    );
    expect(wireHasBreadboardEndpoint(wired.wires[0])).toBe(true);
  });

  it("anchors ends but keeps interior bend points", () => {
    const wired = connectTerminals(
      breadboardProject(),
      { breadboardId: "breadboard_1", site: breadboardHole("a", 10) },
      { breadboardId: "breadboard_1", site: breadboardHole("j", 30) },
    );
    const refs = resolveWireTerminalRefs(wired, wired.wires[0]);
    expect(refs).not.toBeNull();

    const bends = [
      { x: 0, y: 0, z: 0 },
      { x: 0.05, y: 0.02, z: 0 },
      { x: 0.1, y: 0.1, z: 0 },
    ];
    const anchored = anchorWireRoutePoints(wired, refs![0], refs![1], bends);

    expect(anchored).toHaveLength(3);
    expect(anchored[1]).toEqual({ x: 0.05, y: 0.02, z: 0 });
    expect(anchored[0].x).not.toBe(0);
    expect(anchored[2].x).not.toBe(0.1);
  });
});

describe("connectTerminals to a breadboard hole", () => {
  it("connects a component terminal straight into a breadboard hole", () => {
    const p = connectTerminals(
      breadboardProject(),
      { componentId: "led_1", terminalId: "anode" },
      { breadboardId: "breadboard_1", site: breadboardHole("a", 30) },
    );

    expect(p.nets).toHaveLength(1);
    expect(p.nets[0].terminals).toContainEqual({
      breadboard: "breadboard_1",
      site: breadboardHole("a", 30),
    });
    expect(p.wires[0].to).toEqual({
      breadboard: "breadboard_1",
      site: breadboardHole("a", 30),
    });
    expect(p.wires[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it("round-trips a breadboard-hole wire through JSON parsing", () => {
    const p = connectTerminals(
      breadboardProject(),
      { componentId: "led_1", terminalId: "anode" },
      { breadboardId: "breadboard_1", site: breadboardHole("a", 30) },
    );
    const reparsed = parseBerryProject(JSON.parse(JSON.stringify(p)));
    expect(reparsed.wires[0].to).toEqual({
      breadboard: "breadboard_1",
      site: breadboardHole("a", 30),
    });
  });

  it("reroutes a breadboard-hole wire when the breadboard moves", () => {
    const wired = connectTerminals(
      breadboardProject(),
      { componentId: "led_1", terminalId: "anode" },
      { breadboardId: "breadboard_1", site: breadboardHole("a", 30) },
    );
    const before = wired.wires[0].points;
    const moved = moveComponent(wired, "breadboard_1", 0.6, 0.5);
    const rerouted = rerouteWiresForComponent(moved, "breadboard_1");

    expect(rerouted.wires[0].points).not.toEqual(before);
  });

  it("moves a breadboard wire end via manual hole entry", () => {
    const wired = connectTerminals(
      breadboardProject(),
      { breadboardId: "breadboard_1", site: breadboardHole("a", 10) },
      { breadboardId: "breadboard_1", site: breadboardHole("j", 30) },
      { connectors: { start: "male", end: "male" } },
    );
    const next = setWireBreadboardEndpoint(
      wired,
      wired.wires[0].id,
      "from",
      breadboardHole("c", 12),
    );

    expect(next.wires[0].from?.site).toEqual(breadboardHole("c", 12));
    expect(next.nets[0].terminals).toContainEqual({
      breadboard: "breadboard_1",
      site: breadboardHole("c", 12),
    });
    expect(next.wires[0].points).not.toEqual(wired.wires[0].points);
  });

  it("removes a breadboard-hole wire and frees its endpoints", () => {
    const wired = connectTerminals(
      breadboardProject(),
      { componentId: "led_1", terminalId: "anode" },
      { breadboardId: "breadboard_1", site: breadboardHole("a", 30) },
    );
    const next = removeWire(wired, wired.wires[0].id);
    expect(next.wires).toHaveLength(0);
    expect(next.nets).toHaveLength(0);
  });
});

describe("removeWire", () => {
  it("removes wire, net, and frees both terminals", () => {
    const wired = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
    );
    const wireId = wired.wires[0].id;
    const next = removeWire(wired, wireId);

    expect(next.wires).toHaveLength(0);
    expect(next.nets).toHaveLength(0);
    expect(
      findNetForTerminal(next, { componentId: "esp32_1", terminalId: "IO13" }),
    ).toBeUndefined();
    expect(
      findNetForTerminal(next, { componentId: "led_1", terminalId: "anode" }),
    ).toBeUndefined();
  });

  it("keeps net when another wire still uses the terminals", () => {
    let p = connectTerminals(
      minimalProject(),
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "led_1", terminalId: "anode" },
    );
    p = addComponent(p, "resistor-220", { x: 0.2, y: 0.1, id: "res_1" });
    p = connectTerminals(
      p,
      { componentId: "esp32_1", terminalId: "IO13" },
      { componentId: "res_1", terminalId: "pin1" },
    );
    const removeId = p.wires.find(
      (w) => w.from?.terminal === "anode" || w.to?.terminal === "anode",
    )!.id;

    const next = removeWire(p, removeId);

    expect(next.wires).toHaveLength(1);
    expect(next.nets).toHaveLength(1);
    expect(next.nets[0].terminals).toHaveLength(2);
    expect(
      findNetForTerminal(next, { componentId: "esp32_1", terminalId: "IO13" }),
    ).toBeDefined();
    expect(
      findNetForTerminal(next, { componentId: "res_1", terminalId: "pin1" }),
    ).toBeDefined();
    expect(
      findNetForTerminal(next, { componentId: "led_1", terminalId: "anode" }),
    ).toBeUndefined();
  });
});

describe("buildDefaultWirePoints", () => {
  it("returns two z=0 points", () => {
    const pts = buildDefaultWirePoints(
      minimalProject(),
      {
        componentId: "esp32_1",
        terminalId: "IO13",
      },
      {
        componentId: "led_1",
        terminalId: "anode",
      },
    );
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts.every((p) => p.z === 0)).toBe(true);
  });
});
