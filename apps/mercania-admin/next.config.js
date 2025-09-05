/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimal configuration for production build
  reactStrictMode: false,
  swcMinify: true,
  // Disable all experimental features
  experimental: {},
  // Basic webpack config
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        buffer: false,
        process: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
