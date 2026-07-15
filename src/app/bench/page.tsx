import { StudioApp } from '@/components/studio/StudioApp'

export const metadata = {
  title: 'berry. | Bench',
  description: 'Visual hardware bench: place parts, review components, generate firmware, build, and simulate.',
}

/**
 * Bench route: client-side hardware workbench.
 */
export default function BenchPage() {
  return <StudioApp />
}
