/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export configuration for Render
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Disable all experimental features
  experimental: {},
  // Disable webpack optimizations
  webpack: (config) => {
    config.optimization.minimize = false;
    return config;
  },
}

module.exports = nextConfig
