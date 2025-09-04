/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Enable static exports for better performance
  trailingSlash: true,
  // Optimize images
  images: {
    unoptimized: true,
  },
  // API rewrites for production
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
}

module.exports = nextConfig