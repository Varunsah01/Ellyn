const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'subsnacks.sirv.com',
      },
    ],
  },
}

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress Sentry CLI output during builds
  silent: !process.env.CI,

  // Upload source maps to Sentry for readable stack traces
  widenClientFileUpload: true,

  // Automatically instrument React components for performance
  reactComponentAnnotation: {
    enabled: true,
  },

  // Hide source maps from client bundle (security)
  hideSourceMaps: true,

  // Disable automatic Sentry release creation in local dev
  disableLogger: true,

  // Tree-shake Sentry debug code in production
  automaticVercelMonitors: true,
})
