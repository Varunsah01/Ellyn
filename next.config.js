const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    domains: ["logo.clearbit.com", "api.brandfetch.io"],
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
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only run the Sentry plugin if an auth token is provided to avoid build errors in Vercel.
  dryRun: !process.env.SENTRY_AUTH_TOKEN,

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
