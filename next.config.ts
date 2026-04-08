import type { NextConfig } from 'next'

const isCapacitorBuild = process.env.BUILD_TARGET === 'capacitor'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isCapacitorBuild
    ? {
        output: 'export',
        images: {
          unoptimized: true,
        },
      }
    : {}),
}

export default nextConfig
