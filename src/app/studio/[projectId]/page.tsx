import { redirect } from 'next/navigation'

/**
 * Legacy saved Studio URL retained for old links.
 * @param props Dynamic route params.
 */
export default function StudioProjectRedirectPage({
  params,
}: {
  params: { projectId: string }
}) {
  redirect(`/bench/${params.projectId}`)
}
