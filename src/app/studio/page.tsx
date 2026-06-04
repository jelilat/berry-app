import { StudioApp } from '@/components/studio/StudioApp'

export const metadata = {
  title: 'berry. | Studio',
  description: '2D hardware bench — place parts, wire pins, export project JSON.',
}

/**
 * Studio route: client-side schematic editor.
 */
export default function StudioPage() {
  return <StudioApp />
}
