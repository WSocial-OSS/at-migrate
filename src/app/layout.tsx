import type { Metadata } from 'next'
import { Inter_Tight } from 'next/font/google'
import './globals.css'

// wsocial.news sets everything in Inter Tight; next/font self-hosts it at build
// time so there is no third-party request at runtime.
const interTight = Inter_Tight({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter-tight',
})

export const metadata: Metadata = {
  title: 'Move your account — W',
  description:
    'Move an atproto account between Bluesky, EuroSky, W and any other PDS — in either direction, keeping your handle, DID, posts and followers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={interTight.variable}>
      <body>{children}</body>
    </html>
  )
}
