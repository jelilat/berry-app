import { StudioApp } from '@/components/studio/StudioApp'

export const metadata = {
  title: 'berry. | Bench',
  description: '2D hardware bench: place parts, wire pins, generate firmware, build, and simulate.',
}

/**
 * Saved cloud bench route: opens the project identified by the URL.
 * @param props Dynamic route params.
 */
export default function BenchProjectPage({
  params,
}: {
  params: { projectId: string }
}) {
  return <StudioApp projectId={params.projectId} />
}
