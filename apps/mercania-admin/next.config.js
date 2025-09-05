/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ultra-minimal configuration for production build
  reactStrictMode: false,
  swcMinify: false,
  // Disable all experimental features
  experimental: {},
  // Disable webpack optimizations
  webpack: (config) => {
    config.optimization.minimize = false;
    return config;
  },
}

module.exports = nextConfig
