import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RankReady — AI Blog Engine for Real Estate Agents',
  description: 'AI-powered blog post generator that finds SEO gaps in your service area, writes in your voice, and publishes to GoHighLevel.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
