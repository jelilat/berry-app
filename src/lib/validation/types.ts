/** Severity level for a validation finding. */
export type ValidationSeverity = 'error' | 'warning' | 'info'

/** Stable machine-readable validation rule id. */
export type ValidationCode =
  | 'net.power_ground_short'
  | 'net.voltage_mismatch'
  | 'component.led_no_resistor'

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
