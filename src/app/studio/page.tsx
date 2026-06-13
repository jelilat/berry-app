import { redirect } from 'next/navigation'

/**
 * Legacy Studio URL retained for old links.
 */
export default function StudioRedirectPage() {
  redirect('/bench')
}
