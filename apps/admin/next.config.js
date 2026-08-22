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
}

module.exports = nextConfig
