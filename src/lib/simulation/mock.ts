import type { BerryProject, BoardId } from '@/lib/project/types'
import { detectLedBlinkCircuit } from './circuits'
import type {
  SimulateProjectInput,
  SimulationDiagnostic,
  SimulationLogLine,
  SimulationResult,
  SimulationTrace,
} from './types'

/** Thrown when simulation input is missing required artifact metadata. */
export class SimulationInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SimulationInputError'
  }
}

/** Common ESP32 ROM bootloader banner lines for the mock serial log. */
function esp32BootSerialLines(): SimulationLogLine[] {
  return [
    { offsetMs: 5, source: 'serial', text: 'ets Jun  8 2016 00:22:57' },
    { offsetMs: 12, source: 'serial', text: 'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)' },
    { offsetMs: 28, source: 'serial', text: 'configsip: 0, SPIWP:0xee' },
    { offsetMs: 40, source: 'serial', text: 'clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00' },
    { offsetMs: 55, source: 'serial', text: 'mode:DIO, clock div:1' },
    { offsetMs: 72, source: 'serial', text: 'load:0x3fff0018,len:4' },
    { offsetMs: 90, source: 'serial', text: 'load:0x40078000,len:0' },
    { offsetMs: 110, source: 'serial', text: 'entry 0x400805b4' },
  ]
}

/** Common Arduino Uno (ATmega328P) boot banner lines for the mock serial log. */
function arduinoUnoBootSerialLines(): SimulationLogLine[] {
  return [
    { offsetMs: 5, source: 'serial', text: 'avr mega bootloader — ATmega328P' },
    { offsetMs: 12, source: 'serial', text: 'reset:external, fuses lfuse:0xFF hfuse:0xDE efuse:0xFD' },
    { offsetMs: 28, source: 'serial', text: 'sketch start, F_CPU 16000000 Hz' },
  ]
}

/**
 * Human-facing board label used in mock simulator banners.
 * @param board Target board id.
 */
function blinkProfileLabel(board: BoardId): string {
  return board === 'arduino-uno' ? 'Arduino Uno LED blink profile' : 'ESP32 LED blink profile'
}

/**
 * Build deterministic boot + blink serial lines for the mock simulator.
 * @param board Target board id.
 * @param gpioPin Arduino GPIO number driving the LED.
 */
function buildBlinkSerialLogs(board: BoardId, gpioPin: number): SimulationLogLine[] {
  const boot = board === 'arduino-uno' ? arduinoUnoBootSerialLines() : esp32BootSerialLines()
  return [
    { offsetMs: 0, source: 'sim', text: `berry. mock simulator — ${blinkProfileLabel(board)}` },
    ...boot,
    { offsetMs: 150, source: 'serial', text: `GPIO${gpioPin} configured OUTPUT` },
    { offsetMs: 500, source: 'serial', text: `GPIO${gpioPin} HIGH — LED on` },
    { offsetMs: 1000, source: 'serial', text: `GPIO${gpioPin} LOW — LED off` },
    { offsetMs: 1500, source: 'serial', text: `GPIO${gpioPin} HIGH — LED on` },
    { offsetMs: 2000, source: 'serial', text: `GPIO${gpioPin} LOW — LED off` },
  ]
}

/**
 * Build mock GPIO traces for one blink cycle.
 * TODO: Replace with real peripheral timing once GPIO behavior models ship.
 * @param gpioPin Arduino GPIO number driving the LED.
 */
function buildBlinkTraces(gpioPin: number): SimulationTrace[] {
  return [
    { kind: 'gpio', pin: gpioPin, value: 'HIGH', offsetMs: 500 },
    { kind: 'gpio', pin: gpioPin, value: 'LOW', offsetMs: 1000 },
    { kind: 'gpio', pin: gpioPin, value: 'HIGH', offsetMs: 1500 },
    { kind: 'gpio', pin: gpioPin, value: 'LOW', offsetMs: 2000 },
  ]
}

/** Boards the mock simulator can run an LED blink profile on. */
const SIMULATABLE_BOARDS: BoardId[] = ['esp32-devkit-v1', 'arduino-uno']

/**
 * Summarize why a project is not yet supported by the mock simulator.
 * @param project Parsed Berry project graph.
 */
function describeUnsupportedCircuit(project: BerryProject): SimulationDiagnostic[] {
  if (!SIMULATABLE_BOARDS.includes(project.board)) {
    return [
      {
        code: 'sim.unsupported_board',
        severity: 'error',
        message: `Mock simulation currently supports ${SIMULATABLE_BOARDS.join(' and ')} (project board: ${project.board}).`,
      },
    ]
  }

  return [
    {
      code: 'sim.unsupported_circuit',
      severity: 'error',
      message:
        'Mock simulation supports the LED blink demo (MCU + resistor + LED on GPIO) for ESP32 DevKit V1 and Arduino Uno. Add or adjust wiring to match the example circuit.',
    },
  ]
}

/**
 * True when the source contains the minimal Arduino blink behavior for the detected pin.
 * This is intentionally conservative until real firmware execution ships.
 * @param source Firmware source for `src/main.cpp`.
 * @param gpioPin Arduino GPIO number driving the LED.
 */
function sourceLooksLikeBlinkFirmware(source: string, gpioPin: number): boolean {
  const escapedPin = String(gpioPin).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const aliasMatches = [
    ...source.matchAll(
      new RegExp(`\\b(?:constexpr\\s+)?(?:int|const\\s+int)\\s+([A-Z0-9_]*LED[A-Z0-9_]*PIN)\\s*=\\s*${escapedPin}\\b`, 'g'),
    ),
  ]
  const pinAliases = aliasMatches
    .map((match) => match[1])
    .filter((alias): alias is string => Boolean(alias))
  const pinTokenPattern = `(?:${escapedPin}|${pinAliases.join('|') || 'LED_PIN'})`
  const declaresPinAlias = pinAliases.length > 0
  const allowsDirectPin = new RegExp(`\\b(?:pinMode|digitalWrite)\\s*\\(\\s*${escapedPin}\\b`).test(source)
  const usesSupportedPin = declaresPinAlias || allowsDirectPin

  return (
    usesSupportedPin &&
    new RegExp(`\\bpinMode\\s*\\(\\s*${pinTokenPattern}\\s*,\\s*OUTPUT\\s*\\)`).test(source) &&
    new RegExp(`\\bdigitalWrite\\s*\\(\\s*${pinTokenPattern}\\s*,\\s*HIGH\\s*\\)`).test(source) &&
    new RegExp(`\\bdigitalWrite\\s*\\(\\s*${pinTokenPattern}\\s*,\\s*LOW\\s*\\)`).test(source) &&
    /\bdelay\s*\(\s*\d+\s*\)/.test(source)
  )
}

/**
 * Run the mock firmware simulator for a validated project and build artifact.
 * Deterministic serial logs and GPIO traces; no real MCU emulation.
 * @param input Project graph plus firmware hash from a successful build.
 * @throws {SimulationInputError} When firmware hash is missing.
 */
export function simulateProject(input: SimulateProjectInput): SimulationResult {
  const firmwareHash = input.artifact.firmwareHash?.trim()
  if (!firmwareHash) {
    throw new SimulationInputError('Simulation requires a firmwareHash from a successful build.')
  }

  const circuit = detectLedBlinkCircuit(input.project)

  if (!circuit) {
    const errors = describeUnsupportedCircuit(input.project)
    return {
      status: 'unsupported',
      firmwareHash,
      logs: [
        {
          offsetMs: 0,
          source: 'sim',
          text: 'berry. mock simulator — circuit profile not supported',
        },
        {
          offsetMs: 8,
          source: 'sim',
          text: errors[0]?.message ?? 'Circuit not supported by mock simulation.',
        },
      ],
      errors,
    }
  }

  if (!sourceLooksLikeBlinkFirmware(input.files['src/main.cpp'], circuit.gpioPin)) {
    return {
      status: 'unsupported',
      firmwareHash,
      logs: [
        {
          offsetMs: 0,
          source: 'sim',
          text: 'berry. mock simulator — firmware profile not supported',
        },
        {
          offsetMs: 8,
          source: 'sim',
          text:
            'Mock simulation can only pass Arduino blink firmware that configures the detected LED GPIO and toggles it HIGH/LOW with delay().',
        },
      ],
      errors: [
        {
          code: 'sim.unsupported_firmware',
          severity: 'error',
          message:
            'Mock simulation did not find supported blink behavior in src/main.cpp.',
        },
      ],
    }
  }

  // TODO: Model UART, I2C, and ADC peripherals from firmware source and graph.
  // TODO: Execute compiled firmware bytecode instead of scripted GPIO blink traces.

  const logs = buildBlinkSerialLogs(circuit.board, circuit.gpioPin)
  const traces = buildBlinkTraces(circuit.gpioPin)

  return {
    status: 'passed',
    firmwareHash,
    logs,
    traces,
    errors: [
      {
        code: 'sim.blink_pass',
        severity: 'info',
        message: `Mock blink simulation passed on GPIO${circuit.gpioPin} for LED ${circuit.ledComponentId}.`,
      },
    ],
  }
}
