'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  INSPECTOR_WIDTH_DEFAULT,
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
} from './constants'
import { clampInspectorWidth, loadInspectorWidth, saveInspectorWidth } from './storage'

/**
 * Horizontal resize for a right-docked panel (drag the left edge to change width).
 * @param options Min/max bounds and whether to persist width in localStorage.
 */
export function useInspectorResizableWidth(options?: {
  min?: number
  max?: number
  persist?: boolean
}) {
  const min = options?.min ?? INSPECTOR_WIDTH_MIN
  const max = options?.max ?? INSPECTOR_WIDTH_MAX
  const persist = options?.persist !== false
  const [width, setWidth] = useState(INSPECTOR_WIDTH_DEFAULT)
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    setWidth(loadInspectorWidth())
  }, [])

  /**
   * Start a pointer-driven resize from the panel's left edge.
   */
  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthRef.current
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return
        const delta = startX - ev.clientX
        const next = clampInspectorWidth(
          Math.min(max, Math.max(min, startWidth + delta)),
        )
        setWidth(next)
      }

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return
        target.releasePointerCapture(e.pointerId)
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (persist) saveInspectorWidth(widthRef.current)
      }

      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
    },
    [min, max, persist],
  )

  return { width, onResizePointerDown }
}
