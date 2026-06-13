'use client'

import { useEffect, useState } from 'react'

/** Rotating hardware ideas shown as an animated typewriter hint. */
const PROMPT_HINTS = [
  'soil probe that pings my phone when the herb bed dries out',
  'HC-SR04 that maps distance to a piezo beep rate on GPIO',
  'cap-touch pad that fades a warm desk lamp over I2C',
  'NeoPixel strip that tracks room humidity from a BME280',
  'pan-tilt bracket that follows a bright spot with two servos',
  'rotary encoder that scrolls Wi-Fi names on a 128×64 OLED',
  'lid switch that logs every time the enclosure opens',
  'stepper stage that sketches a berry on the breadboard at boot',
] as const

const TYPE_MS = 38
const DELETE_MS = 16
const HOLD_MS = 2600
const BETWEEN_MS = 420

/**
 * Animated typewriter overlay for the builder prompt when the field is empty.
 * @param props Whether the hint should render over the textarea.
 */
export function TypingPromptHint({ visible }: { visible: boolean }) {
  const [hintIndex, setHintIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!visible) return

    const fullText = PROMPT_HINTS[hintIndex]!
    let timer: ReturnType<typeof setTimeout>

    if (!deleting && displayText.length < fullText.length) {
      timer = setTimeout(() => {
        setDisplayText(fullText.slice(0, displayText.length + 1))
      }, TYPE_MS)
      return () => clearTimeout(timer)
    }

    if (!deleting && displayText.length === fullText.length) {
      timer = setTimeout(() => setDeleting(true), HOLD_MS)
      return () => clearTimeout(timer)
    }

    if (deleting && displayText.length > 0) {
      timer = setTimeout(() => {
        setDisplayText(fullText.slice(0, displayText.length - 1))
      }, DELETE_MS)
      return () => clearTimeout(timer)
    }

    if (deleting && displayText.length === 0) {
      timer = setTimeout(() => {
        setDeleting(false)
        setHintIndex((current) => (current + 1) % PROMPT_HINTS.length)
      }, BETWEEN_MS)
      return () => clearTimeout(timer)
    }

    return undefined
  }, [deleting, displayText, hintIndex, visible])

  useEffect(() => {
    if (visible) return
    setDisplayText('')
    setDeleting(false)
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-4 top-4 select-none text-lg font-medium leading-7"
      aria-hidden="true"
    >
      <span style={{ color: 'var(--text-muted)' }}>Ask Berry for </span>
      <span style={{ color: 'var(--text-secondary)' }}>{displayText}</span>
      <span
        className="ml-0.5 inline-block h-[1.1em] w-[2px] align-[-0.12em] animate-pulse"
        style={{ background: 'var(--accent)' }}
      />
    </div>
  )
}
