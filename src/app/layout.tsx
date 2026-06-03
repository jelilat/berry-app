import type { Metadata } from 'next'
import { JetBrains_Mono, Manrope } from 'next/font/google'
import './globals.css'
import { brand } from '@/lib/brand'

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  metadataBase: new URL('https://app.berry.studio'),
  title: 'berry. | AI Agent for Hardware Development',
  description: brand.description,
  icons: { icon: brand.assets.icon },
  openGraph: {
    title: 'berry. | AI Agent for Hardware Development',
    description: brand.description,
    images: [{ url: brand.assets.logo, width: 1024, height: 1024, alt: 'berry. logo' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} font-sans`}>{children}</body>
    </html>
  )
}
