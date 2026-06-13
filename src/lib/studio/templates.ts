import type { LucideIcon } from 'lucide-react'
import { Calculator, Lightbulb, Monitor } from 'lucide-react'

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
    label: 'Blink an LED',
    prompt: 'Build a simple blinking LED',
    icon: Lightbulb,
    kind: 'example',
    examplePath: '/examples/esp32-led-blink.project.json',
    projectName: 'LED blink',
  },
  {
    id: 'calculator',
    label: 'Make a simple calculator',
    prompt: 'Build a simple calculator with buttons and a display',
    icon: Calculator,
    kind: 'example',
    examplePath: '/examples/arduino-calculator.project.json',
    projectName: 'Calculator',
  },
  {
    id: 'max7219-display',
    label: 'Show text on an LED matrix',
    prompt: 'Build a simple message display on a MAX7219 LED matrix',
    icon: Monitor,
    kind: 'example',
    examplePath: '/examples/esp32-max7219-display.project.json',
    projectName: 'MAX7219 display',
  },
]

/**
 * Look up a builder template by id.
 * @param templateId Template id from a chip click.
 */
export function getBuilderTemplate(templateId: string): BuilderTemplate | undefined {
  return BUILDER_TEMPLATES.find((template) => template.id === templateId)
}
