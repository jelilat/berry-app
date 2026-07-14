'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  INSPECTOR_WIDTH_DEFAULT,
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_MIN,
  INSPECTOR_WIDTH_STORAGE_KEY,
} from './constants'

interface ResizableWidthOptions {
  min?: number
  max?: number
  defaultWidth?: number
  storageKey?: string
  persist?: boolean
}

/**
 * Horizontal resize for a right-docked panel (drag the left edge to change width).
 * @param options Min/max bounds and whether to persist width in localStorage.
 */
export function useRightDockedResizableWidth(options?: ResizableWidthOptions) {
  const min = options?.min ?? INSPECTOR_WIDTH_MIN
  const max = options?.max ?? INSPECTOR_WIDTH_MAX
  const defaultWidth = options?.defaultWidth ?? INSPECTOR_WIDTH_DEFAULT
  const storageKey = options?.storageKey ?? INSPECTOR_WIDTH_STORAGE_KEY
  const persist = options?.persist !== false
  const [width, setWidth] = useState(defaultWidth)
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    setWidth(loadResizableWidth(storageKey, defaultWidth, min, max))
  }, [defaultWidth, max, min, storageKey])

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
        const next = clampResizableWidth(startWidth + delta, min, max)
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
        if (persist) saveResizableWidth(storageKey, widthRef.current, min, max)
      }

      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
    },
    [max, min, persist, storageKey],
  )

  return { width, onResizePointerDown }
}

/**
 * Horizontal resize for the legacy inspector panels.
 * @param options Min/max bounds and whether to persist width in localStorage.
 */
export function useInspectorResizableWidth(options?: ResizableWidthOptions) {
  return useRightDockedResizableWidth(options)
}

/**
 * Clamp a resizable panel width to its allowed bounds.
 * @param width Raw width in pixels.
 * @param min Minimum allowed width.
 * @param max Maximum allowed width.
 */
function clampResizableWidth(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width))
}

/**
 * Load a persisted resizable panel width, or a default when missing.
 * @param storageKey localStorage key for the panel.
 * @param defaultWidth Fallback width.
 * @param min Minimum allowed width.
 * @param max Maximum allowed width.
 */
function loadResizableWidth(
  storageKey: string,
  defaultWidth: number,
  min: number,
  max: number,
): number {
  if (typeof window === 'undefined') return defaultWidth
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return defaultWidth
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return defaultWidth
  return clampResizableWidth(parsed, min, max)
}

/**
 * Persist a resizable panel width.
 * @param storageKey localStorage key for the panel.
 * @param width Width in pixels.
 * @param min Minimum allowed width.
 * @param max Maximum allowed width.
 */
function saveResizableWidth(
  storageKey: string,
  width: number,
  min: number,
  max: number,
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, String(clampResizableWidth(width, min, max)))
}
