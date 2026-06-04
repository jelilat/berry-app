/** Wokwi simulator connect / hover green (pin rings, selection). */
export const WOKWI_CONNECT_GREEN = "#28e070";

/** Dashed selection outline around a selected Wokwi part. */
export const WOKWI_SELECTION_OUTLINE = `1px dashed ${WOKWI_CONNECT_GREEN}`;

export type WokwiPinRingState = "idle" | "hover" | "source" | "target";

/**
 * Visual styles for a Wokwi-style pin connect ring.
 * @param state Hover, wire source, or wire drop target.
 */
export function wokwiPinRingStyle(state: WokwiPinRingState): {
  size: number;
  background: string;
  border: string;
  boxShadow?: string;
} {
  switch (state) {
    case "source":
    case "target":
      return {
        size: 14,
        background: WOKWI_CONNECT_GREEN,
        border: `2px solid ${WOKWI_CONNECT_GREEN}`,
        boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
      };
    case "hover":
      return {
        size: 12,
        background: "rgba(255,255,255,0.92)",
        border: `2.5px solid ${WOKWI_CONNECT_GREEN}`,
        boxShadow: `0 0 0 1px rgba(40,224,112,0.35)`,
      };
    default:
      return {
        size: 10,
        background: "transparent",
        border: "none",
      };
  }
}
