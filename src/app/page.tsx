import { BuilderHome } from '@/components/home/BuilderHome'

export const metadata = {
  title: 'berry. | Build',
  description: 'Start a hardware project with AI-guided wiring, code, and debugging.',
}

/**
 * App entry: builder home with sidebar, prompt, and reference templates.
 */
export default function HomePage() {
  return <BuilderHome />
}
