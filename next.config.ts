import type { NextConfig } from 'next'

const config: NextConfig = {
  // The migration engine is plain TypeScript with no Next.js coupling, so it can be
  // lifted into the WSocial app later. Nothing here should assume this standalone shell.
  serverExternalPackages: ['@atproto/api', '@atproto/identity'],
}

export default config
