import type { BoardId } from '@/lib/project/types'

/** Canonical firmware file path for the first Phase 3 browser editor. */
export const DEFAULT_FIRMWARE_PATH = 'src/main.cpp'

/**
 * Return starter Arduino-framework firmware for the selected board.
 * @param board Target board for the current project.
 */
export function createDefaultFirmwareSource(board: BoardId): string {
  const baudRate = board === 'esp32-devkit-v1' ? 115200 : 9600

  return `#include <Arduino.h>

void setup() {
  Serial.begin(${baudRate});
}

void loop() {
}
`
}

/**
 * Return a simple blink sketch for the existing ESP32 LED example.
 */
export function createEsp32BlinkFirmwareSource(): string {
  return `#include <Arduino.h>

const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`
}

/**
 * Normalize firmware source for lightweight semantic comparisons.
 * @param source Firmware source text.
 */
function normalizeFirmwareSource(source: string): string {
  return source.replace(/\r\n/g, '\n').trim()
}

/**
 * Remove generated comments and whitespace-only lines before classifying a sketch.
 * @param source Firmware source text.
 */
function stripNonBehavioralFirmwareLines(source: string): string[] {
  return normalizeFirmwareSource(source)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'))
}

/**
 * True when non-comment firmware lines are only the Arduino include, Serial setup, and optional idle delay.
 * @param lines Non-comment, trimmed firmware source lines.
 */
function isArduinoIdleSkeleton(lines: string[]): boolean {
  const allowedLines = new Set([
    '#include <Arduino.h>',
    'void setup() {',
    'Serial.begin(115200);',
    'Serial.begin(9600);',
    '}',
    'void loop() {',
    'delay(1000);',
  ])

  return lines.length > 0 && lines.every((line) => allowedLines.has(line))
}

/**
 * True when source matches berry.'s board-specific starter firmware.
 * @param source Firmware source text.
 */
export function isDefaultFirmwareSource(source: string): boolean {
  const normalized = normalizeFirmwareSource(source)
  return (
    normalized === normalizeFirmwareSource(createDefaultFirmwareSource('esp32-devkit-v1')) ||
    normalized === normalizeFirmwareSource(createDefaultFirmwareSource('arduino-uno')) ||
    isArduinoIdleSkeleton(stripNonBehavioralFirmwareLines(source))
  )
}

/**
 * True when source is only an Arduino skeleton with optional Serial/delay calls.
 * @param source Firmware source text.
 */
export function isEmptyGeneratedFirmwareSource(source: string): boolean {
  if (!normalizeFirmwareSource(source)) return true
  return isArduinoIdleSkeleton(stripNonBehavioralFirmwareLines(source))
}

/**
 * True when the current firmware looks user/agent-authored enough to protect from empty overwrites.
 * @param source Firmware source text.
 */
export function hasMeaningfulFirmwareSource(source: string): boolean {
  return normalizeFirmwareSource(source).length > 0 && !isEmptyGeneratedFirmwareSource(source)
}

/**
 * True when an incoming firmware update should be ignored to avoid erasing real code.
 * @param currentSource Existing editable firmware source.
 * @param incomingSource Proposed replacement firmware source.
 */
export function shouldPreserveExistingFirmwareSource(
  currentSource: string,
  incomingSource: string,
): boolean {
  if (normalizeFirmwareSource(currentSource) === normalizeFirmwareSource(incomingSource)) {
    return false
  }
  return hasMeaningfulFirmwareSource(currentSource) && isEmptyGeneratedFirmwareSource(incomingSource)
}
