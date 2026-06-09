/** Severity level for a validation finding. */
export type ValidationSeverity = 'error' | 'warning' | 'info'

/** Stable machine-readable validation rule id. */
export type ValidationCode =
  | 'net.power_ground_short'
  | 'net.voltage_mismatch'
  | 'net.incompatible_pin_kinds'
  | 'net.i2c_pair_mismatch'
  | 'net.uart_pair_mismatch'
  | 'component.led_no_resistor'
  | 'component.unpowered'
  | 'component.floating_input'

/** Optional entity anchors for Studio overlays and filtering. */
export interface ValidationSubject {
  netId?: string
  wireId?: string
  componentId?: string
  terminalId?: string
}

/** One validation finding from the rule engine. */
export interface ValidationResult {
  code: ValidationCode
  severity: ValidationSeverity
  message: string
  subject?: ValidationSubject
}
