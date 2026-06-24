import type { ComponentTypeId } from "@/lib/project/types";

/** Approximate physical size in millimeters for inspector display. */
export interface PhysicalDimensionsMm {
  width: number;
  height: number;
  depth: number;
}

/**
 * Catalog footprint sizes for the component inspector (mm).
 * Scene layout uses separate scene units; these are builder-facing dimensions.
 */
export const PHYSICAL_DIMENSIONS_MM: Partial<
  Record<ComponentTypeId, PhysicalDimensionsMm>
> = {
  "breadboard-full": { width: 165, height: 55, depth: 10 },
  "esp32-devkit-v1": { width: 51.4, height: 28.5, depth: 15 },
  "arduino-uno": { width: 68.6, height: 53.4, depth: 15 },
  "led-5mm": { width: 5, height: 5, depth: 8 },
  "resistor-220": { width: 6, height: 2, depth: 2 },
  "resistor-1k": { width: 6, height: 2, depth: 2 },
  "resistor-2k": { width: 6, height: 2, depth: 2 },
  "push-button": { width: 12, height: 12, depth: 8 },
  "pushbutton-6mm": { width: 6, height: 6, depth: 5 },
  "membrane-keypad-4x4": { width: 70, height: 85, depth: 1 },
  "hc-sr04": { width: 45, height: 20, depth: 15 },
  "pir-motion-sensor-hc-sr501": { width: 32, height: 24, depth: 18 },
  bme280: { width: 20, height: 20, depth: 3 },
  dht22: { width: 15.1, height: 30.9, depth: 6 },
  ds18b20: { width: 5, height: 18, depth: 5 },
  "photoresistor-sensor": { width: 45, height: 15, depth: 8 },
  "ntc-temperature-sensor": { width: 35, height: 14, depth: 8 },
  "mq2-gas-sensor": { width: 36.2, height: 16.6, depth: 20 },
  "small-sound-sensor": { width: 35.2, height: 13.3, depth: 10 },
  "big-sound-sensor": { width: 37.1, height: 13.3, depth: 10 },
  "flame-sensor": { width: 52.9, height: 16.3, depth: 10 },
  "heart-beat-sensor": { width: 23.4, height: 20.9, depth: 12 },
  "tilt-switch": { width: 23.4, height: 14.7, depth: 10 },
  mpu6050: { width: 21.6, height: 16.2, depth: 4 },
  "servo-sg90": { width: 23, height: 12, depth: 27 },
  "analog-joystick": { width: 27.2, height: 31.8, depth: 18 },
  "rotary-encoder-ky-040": { width: 30.8, height: 18.6, depth: 20 },
  "dip-switch-8": { width: 20, height: 10, depth: 5 },
  "slide-switch": { width: 8.5, height: 9.2, depth: 5 },
  potentiometer: { width: 20, height: 20, depth: 12 },
  "slide-potentiometer": { width: 55, height: 29, depth: 10 },
  "ir-receiver": { width: 8, height: 18, depth: 6 },
  "ir-remote": { width: 38, height: 86, depth: 8 },
  "rotary-dialer": { width: 76, height: 76, depth: 12 },
  "relay-module": { width: 50, height: 26, depth: 20 },
  "ks2e-relay": { width: 20, height: 10, depth: 12 },
  "stepper-motor": { width: 43, height: 48, depth: 20 },
  "a4988-stepper-driver": { width: 20, height: 15, depth: 8 },
  "biaxial-stepper": { width: 56, height: 67.5, depth: 20 },
  "lcd-1602-i2c": { width: 80, height: 36, depth: 12 },
  "lcd-2004-i2c": { width: 98, height: 60, depth: 12 },
  "ssd1306-oled": { width: 27, height: 27, depth: 4 },
  "grove-oled-sh1107": { width: 20, height: 20, depth: 4 },
  "ili9341-tft": { width: 50, height: 86, depth: 5 },
  "nokia-5110": { width: 45, height: 45, depth: 5 },
  "tm1637-7segment": { width: 42, height: 24, depth: 8 },
  "single-7segment": { width: 20, height: 28, depth: 8 },
  "max7219-led-matrix": { width: 32, height: 32, depth: 8 },
  "led-bar-graph": { width: 10.1, height: 25.5, depth: 5 },
  neopixel: { width: 5.7, height: 5, depth: 2 },
  "neopixel-matrix": { width: 40, height: 40, depth: 5 },
  "led-ring": { width: 66, height: 66, depth: 5 },
  "led-strip": { width: 80, height: 10, depth: 3 },
  "rgb-led": { width: 5, height: 5, depth: 8 },
  buzzer: { width: 17, height: 20, depth: 10 },
  "microsd-card": { width: 24, height: 24, depth: 3 },
  "ds1307-rtc": { width: 25.8, height: 22.2, depth: 8 },
  "hx711-load-cell-amp": { width: 34, height: 20, depth: 6 },
  "74hc595-shift-register": { width: 19.3, height: 6.4, depth: 4 },
  "74hc165-shift-register": { width: 19.3, height: 6.4, depth: 4 },
  nlsf595: { width: 19.3, height: 6.4, depth: 4 },
  "clock-generator": { width: 20, height: 14, depth: 5 },
  "logic-analyzer": { width: 45, height: 18, depth: 5 },
};

/**
 * Resolve physical dimensions for a catalog type, with a small default fallback.
 * @param type Catalog component type id.
 */
export function getPhysicalDimensionsMm(
  type: ComponentTypeId,
): PhysicalDimensionsMm {
  return (
    PHYSICAL_DIMENSIONS_MM[type] ?? {
      width: 10,
      height: 10,
      depth: 5,
    }
  );
}
