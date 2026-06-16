/** User-facing copy for unavailable AI build requests. */
export const AI_COMING_SOON_TITLE = 'Pip is warming up'

/** User-facing body for unavailable AI build requests. */
export const AI_COMING_SOON_MESSAGE =
  'Custom AI hardware builds are coming soon. For now, try the LED blink example while the rest of the bench gets finished.'

/**
 * True when the prompt targets the currently supported LED blink demo.
 * @param prompt User-entered AI build request.
 */
export function isLedBlinkPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase()
  const mentionsLed =
    /\bleds?\b/.test(normalized) ||
    normalized.includes('light emitting diode') ||
    /\blights?\b/.test(normalized)
  const mentionsBlink =
    /\bblink(?:ing|s)?\b/.test(normalized) ||
    /\bflash(?:ing|es)?\b/.test(normalized) ||
    /\btoggle(?:s|d|ing)?\b/.test(normalized)

  return mentionsLed && mentionsBlink
}
