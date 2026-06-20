import { describe, expect, it } from "vitest";
import { getComponentDefinition, isWireTemplate, listCatalog } from "./catalog";
import type { ComponentTypeId } from "./types";

describe("component catalog", () => {
  it("listCatalog returns 16 parts", () => {
    expect(listCatalog()).toHaveLength(16);
  });

  it("getComponentDefinition returns ESP32 with full DevKit header", () => {
    const def = getComponentDefinition("esp32-devkit-v1");
    expect(def.id).toBe("esp32-devkit-v1");
    expect(def.group).toBe("microcontrollers");
    expect(def.terminals).toHaveLength(30);
    expect(def.terminals.map((t) => t.id)).toContain("IO27");
    expect(def.terminals.map((t) => t.id)).toContain("RX0");
    expect(def.terminals.map((t) => t.id)).toContain("3V3");
  });

  it("jumper wire templates are not placeable parts", () => {
    expect(isWireTemplate("jumper-mm")).toBe(true);
    expect(
      getComponentDefinition("jumper-mm").wireTemplate?.connectors,
    ).toEqual({
      start: "male",
      end: "male",
    });
  });

  it("returns a placeholder definition for unsupported hosted components", () => {
    const unsupportedType = "hc-sr501" as ComponentTypeId;
    const def = getComponentDefinition(unsupportedType);

    expect(def.name).toBe("hc-sr501 (unsupported)");
    expect(def.group).toBe("unsupported");
    expect(def.terminals).toEqual([]);
    expect(isWireTemplate(unsupportedType)).toBe(false);
  });
});
