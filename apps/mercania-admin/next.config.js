/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Disable image optimization
  images: {
    unoptimized: true,
  },
  // API rewrites
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
  // Disable PostCSS for production
  experimental: {
    esmExternals: false,
  },
  // Webpack configuration to fix build issues
  webpack: (config, { isServer }) => {
    // Fix for PostCSS issues
    config.resolve.alias = {
      ...config.resolve.alias,
      'postcss': false,
    };
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
