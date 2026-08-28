/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@grandxl/api-client', '@grandxl/types', '@grandxl/utils', '@grandxl/ui', '@grandxl/validators'],
  images: {
    domains: ['res.cloudinary.com'],
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // CI's `validate` job already runs `pnpm turbo type-check` before this build,
  // so re-running tsc during `next build` is duplicate work (~30-60s wasted per
  // deploy). Skip it here; a type error still fails the pipeline at the earlier
  // stage before Docker ever builds.
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
