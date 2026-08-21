import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Move your account — WSocial',
  description:
    'Move an atproto account between Bluesky, EuroSky, WSocial and any other PDS — in either direction, keeping your handle, DID, posts and followers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
