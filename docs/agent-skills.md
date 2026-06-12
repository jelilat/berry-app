# Berry agent skills

This guide is the practical hardware context for Berry's AI agents. The architecture is in [agent-architecture.md](./agent-architecture.md); this file teaches agents how to choose safe parts, terminals, and wiring patterns.

## Hard rules

- Do not edit `project.json` directly.
- Use Berry tools for all project mutations.
- Circuit designer output must include executable `toolCalls`, not only prose in `toolPlan`.
- Every `toolCalls[]` item must include all schema fields; set unused fields to `null`.
- Use catalog ids and terminal ids exactly as defined by the app.
- Keep 2D Studio coordinates `z: 0`.
- Always include current-limiting resistors for LEDs.
- Run validation before build.
- Generate wiring instructions from the final validated graph.
- Deploy is coming soon; do not claim hardware flashing is available.

## Supported flows

Berry can build an LED blink on two first-class boards:

```txt
ESP32 DevKit V1 + 220 ohm resistor + 5mm LED blink
Arduino Uno    + 220 ohm resistor + 5mm LED blink
```

### Board selection rules

- If the user names ESP32, use `esp32-devkit-v1`.
- If the user names Arduino Uno, use `arduino-uno`.
- If no board is specified for a simple LED blink, default to `esp32-devkit-v1` and record the assumption.
- If the request depends on board-specific capabilities (analog channels, wireless, 3.3 V vs 5 V logic), ask which board to use.

### ESP32 DevKit V1 LED blink

Use:

- board: `esp32-devkit-v1`
- MCU component: `esp32-devkit-v1`
- breadboard: `breadboard-full`
- LED: `led-5mm`
- resistor: `resistor-220`
- signal GPIO: `IO13`
- ground: `GND_R`
- serial baud: `115200`

Safe connection pattern:

```txt
Add esp32_1 before breadboard_1 so the dev board stays beside the breadboard.
esp32_1.IO13 -> resistor_1.pin1
resistor_1.pin2 -> led_1.anode
led_1.cathode -> esp32_1.GND_R
```

### Arduino Uno LED blink

Use:

- board: `arduino-uno`
- MCU component: `arduino-uno`
- breadboard: `breadboard-full`
- LED: `led-5mm`
- resistor: `resistor-220`
- safe signal pin: `D13` (Arduino digital pin 13, also the onboard LED pin)
- ground: `GND`
- serial baud: `9600`

Safe connection pattern:

```txt
Add arduino_1 before breadboard_1 so the dev board stays beside the breadboard.
arduino_1.D13 -> resistor_1.pin1
resistor_1.pin2 -> led_1.anode
led_1.cathode -> arduino_1.GND
```

Firmware behavior (both boards):

- configure the mapped LED GPIO as `OUTPUT`
- write `HIGH`
- delay `500`
- write `LOW`
- delay `500`

## Catalog ids

Microcontrollers:

- `esp32-devkit-v1`
- `arduino-uno`

Breadboards:

- `breadboard-full`

Passives:

- `led-5mm`
- `resistor-220`
- `resistor-1k`
- `resistor-2k`

Inputs:

- `push-button`

Sensors:

- `hc-sr04`
- `bme280`

Actuators:

- `servo-sg90`

Displays:

- `lcd-1602-i2c`

## Common clarification triggers

Ask the user when:

- the board is unspecified and there is no obvious default
- the sensor/module is unspecified
- the desired output is ambiguous, such as serial vs LCD vs wireless
- external power or motor voltage matters
- the request needs parts not in the current catalog
- the request would require deploy/flashing

Do not ask when:

- the user asks for an ESP32 blinking LED
- a safe default is obvious and can be recorded as an assumption
- the question is only about visual placement coordinates

## Validation repair patterns

LED without resistor:

- insert `resistor-220` in series between GPIO and LED anode

Power and ground short:

- remove the net tying a `power_out` terminal to ground
- check breadboard tie placement for accidental same-row shorts

Active outputs share one net:

- do not tie two GPIO outputs together
- choose one GPIO source per signal net

Unpowered module:

- connect module `VCC` or `VIN` to a compatible board power output
- connect module `GND` to board ground

I2C pairing:

- SDA nets should connect SDA-capable terminals
- SCL nets should connect SCL-capable terminals

Button floating:

- add a pull-up or pull-down reference
- avoid leaving a GPIO only connected to one side of a switch

## Wiring guide expectations

A final guide should include:

- parts list
- board target
- pin-by-pin wiring
- LED polarity notes
- resistor safety note
- expected firmware behavior
- serial monitor baud rate
- validation warnings, if any
- Deploy coming soon note
