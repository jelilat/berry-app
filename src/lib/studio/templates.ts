import type { LucideIcon } from 'lucide-react'
import { Fan, Lightbulb, RotateCw, TrafficCone } from 'lucide-react'

/** How a starter chip loads its underlying project graph. */
export type BuilderTemplateKind = 'example' | 'starter'

/** One suggested build chip on the builder home screen. */
export interface BuilderTemplate {
  id: string
  label: string
  prompt: string
  icon: LucideIcon
  kind: BuilderTemplateKind
  /** Public path for example JSON when `kind` is `example`. */
  examplePath?: string
  /** Default project title when bootstrapping a starter layout. */
  projectName: string
}

/** Reference builds available without signing in. */
export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: 'blink-led',
    label: 'LED heartbeat',
    prompt: 'Build an ESP32 LED blink circuit',
    icon: Lightbulb,
    kind: 'example',
    examplePath: '/examples/esp32-led-blink.project.json',
    projectName: 'ESP32 LED blink',
  },
  {
    id: 'traffic-light',
    label: 'RGB signal sequence',
    prompt: 'Build a three-LED traffic light sequence',
    icon: TrafficCone,
    kind: 'starter',
    projectName: 'Traffic light starter',
  },
  {
    id: 'servo-sweep',
    label: 'Servo sweep arc',
    prompt: 'Build a servo sweep demo on ESP32',
    icon: RotateCw,
    kind: 'starter',
    projectName: 'Servo sweep starter',
  },
  {
    id: 'spin-motor',
    label: 'PWM motor spin',
    prompt: 'Build a DC motor spin demo with PWM control',
    icon: Fan,
    kind: 'starter',
    projectName: 'DC motor starter',
  },
]

/**
 * Look up a builder template by id.
 * @param templateId Template id from a chip click.
 */
export function getBuilderTemplate(templateId: string): BuilderTemplate | undefined {
  return BUILDER_TEMPLATES.find((template) => template.id === templateId)
}
