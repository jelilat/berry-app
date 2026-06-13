'use client'

import { useEffect, useState } from 'react'

/** Rotating hardware ideas shown as an animated typewriter hint. */
const PROMPT_HINTS = [
  'an automated trash can that opens when someone walks up',
  'a rain detector that warns me before the window gets wet',
  'a human sensor that turns lights on when the room is occupied',
  'a plant monitor that tells me when the soil is dry',
  'a garage parking helper with distance lights',
  'a desk reminder that blinks when it is time to stand',
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
      <span style={{ color: 'var(--text-muted)' }}>Ask Pip for </span>
      <span style={{ color: 'var(--text-secondary)' }}>{displayText}</span>
      <span
        className="ml-0.5 inline-block h-[1.1em] w-[2px] align-[-0.12em] animate-pulse"
        style={{ background: 'var(--accent)' }}
      />
    </div>
  )
}
