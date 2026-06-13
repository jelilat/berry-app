import { StudioApp } from '@/components/studio/StudioApp'

export const metadata = {
  title: 'berry. | Bench',
  description: '2D hardware bench: place parts, wire pins, generate firmware, build, and simulate.',
}

/**
 * Bench route: client-side hardware workbench.
 */
export default function BenchPage() {
  return <StudioApp />
}
