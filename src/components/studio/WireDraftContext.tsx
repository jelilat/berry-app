'use client'

import { createContext, useContext } from 'react'
import type { WireDraftState } from '@/lib/studio/wire-draft'

const WireDraftContext = createContext<WireDraftState | null>(null)

/**
 * Provides live wire-drag state to bench nodes without rebuilding React Flow nodes.
 * @param draft Active wire drag, if any.
 * @param children Canvas subtree.
 */
export function WireDraftProvider({
  draft,
  children,
}: {
  draft: WireDraftState | null
  children: React.ReactNode
}) {
  return <WireDraftContext.Provider value={draft}>{children}</WireDraftContext.Provider>
}

/**
 * Read the in-progress wire drag for pin highlight rendering.
 */
export function useWireDraft(): WireDraftState | null {
  return useContext(WireDraftContext)
}
