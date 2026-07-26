import { SharedProjectViewer } from '@/components/studio/SharedProjectViewer'

export const runtime = 'edge'

export const metadata = {
  title: 'Shared project | berry.',
  description: 'View a hardware project shared from berry.',
}

/**
 * Public, view-only project route.
 * @param props Dynamic project id route params.
 */
export default function SharedProjectPage({
  params,
}: {
  params: { projectId: string }
}) {
  return <SharedProjectViewer projectId={params.projectId} />
}
