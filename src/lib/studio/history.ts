import { useCallback, useState } from 'react'
import type { BerryProject } from '@/lib/project/types'

const MAX_HISTORY = 50

/**
 * Undo/redo stack for immutable {@link BerryProject} updates in Studio.
 * @param initialProject Starting project state.
 */
export function useProjectHistory(initialProject: BerryProject) {
  const [project, setProjectState] = useState(initialProject)
  const [past, setPast] = useState<BerryProject[]>([])
  const [future, setFuture] = useState<BerryProject[]>([])

  /**
   * Apply a new project snapshot and push the previous state onto the undo stack.
   * @param next Next project (validated by caller).
   */
  const setProject = useCallback((next: BerryProject) => {
    setProjectState((current) => {
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), current])
      setFuture([])
      return next
    })
  }, [])

  /** Replace project without recording history (load/import). */
  const resetProject = useCallback((next: BerryProject) => {
    setPast([])
    setFuture([])
    setProjectState(next)
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      setProjectState((current) => {
        setFuture((f) => [current, ...f])
        return previous
      })
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const [next, ...rest] = f
      setProjectState((current) => {
        setPast((p) => [...p, current])
        return next
      })
      return rest
    })
  }, [])

  return {
    project,
    setProject,
    resetProject,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
