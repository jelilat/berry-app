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
