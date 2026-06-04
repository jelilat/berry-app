'use client'

import { createElement, useEffect, useRef, useState, type ReactElement } from 'react'
import '@wokwi/elements'
import type { ComponentTypeId } from '@/lib/project/types'
import {
  getWokwiVisual,
  pinLayoutFromWokwiElement,
  type WokwiPartVisual,
} from '@/lib/studio/wokwi-map'
import { wokwiElementNativeSize } from '@/lib/studio/wokwi-element-size'
import { pinLayoutInContainer } from '@/lib/studio/wokwi-pin-position'

let wokwiLoaded = false

/**
 * Register Wokwi custom elements once in the browser.
 */
async function ensureWokwiElements(): Promise<void> {
  if (wokwiLoaded || typeof window === 'undefined') return
  await import('@wokwi/elements')
  wokwiLoaded = true
}

/** Props for rendering a catalog part with its Wokwi skin. */
export interface WokwiPartProps {
  type: ComponentTypeId
  width: number
  height: number
  className?: string
  /** When true, scale the element to fill the container. */
  fit?: boolean
  onPinLayout?: (layout: Record<string, { x: number; y: number }>, visual: WokwiPartVisual) => void
}

/**
 * Render a Wokwi web component for a berry catalog type.
 * Calls onPinLayout when pin positions are available from pinInfo.
 */
export function WokwiPart({ type, width, height, className, fit = true, onPinLayout }: WokwiPartProps) {
  const visual = getWokwiVisual(type)
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [nativeSize, setNativeSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureWokwiElements().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !visual || !hostRef.current || !onPinLayout) return

    let cancelled = false
    let unbind: (() => void) | undefined

    const tryBind = () => {
      if (cancelled || !hostRef.current) return
      const el = hostRef.current.querySelector(visual.tag) as
        | (HTMLElement & { pinInfo?: { name: string; x: number; y: number }[] })
        | null
      if (!el?.pinInfo?.length) {
        requestAnimationFrame(tryBind)
        return
      }

      const terminalIds = Object.keys(visual.pinMap)
      const apply = () => {
        if (cancelled) return
        const native = wokwiElementNativeSize(el, visual.nativeWidth, visual.nativeHeight)
        setNativeSize(native)
        const raw = pinLayoutFromWokwiElement(el, visual, terminalIds)
        const layout = pinLayoutInContainer(raw, width, height, native.width, native.height)
        if (Object.keys(layout).length > 0) onPinLayout(layout, visual)
      }

      apply()
      el.addEventListener('pininfo-change', apply)
      unbind = () => el.removeEventListener('pininfo-change', apply)
    }

    tryBind()
    return () => {
      cancelled = true
      unbind?.()
    }
  }, [ready, visual, onPinLayout, type, width, height, fit])

  if (!visual || !ready) {
    return (
      <div
        className={className}
        style={{ width, height }}
        aria-hidden
      />
    )
  }

  const artW = nativeSize?.width ?? visual.nativeWidth
  const artH = nativeSize?.height ?? visual.nativeHeight
  const scale = fit ? Math.min(width / artW, height / artH) : 1

  const props = visual.props ?? {}
  const element = createWokwiElement(visual.tag, props)

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: artW,
          height: artH,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {element}
      </div>
    </div>
  )
}

/**
 * Create a Wokwi custom element for the given tag and attributes.
 * @param tag Wokwi element tag name.
 * @param props Attribute key/value pairs (HTML attributes, not React style).
 */
function createWokwiElement(
  tag: WokwiPartVisual['tag'],
  props: Record<string, string | boolean | number>,
): ReactElement {
  const attrs: Record<string, string> = {}
  for (const [key, value] of Object.entries(props)) {
    attrs[key] = String(value)
  }
  return createElement(tag, attrs)
}
