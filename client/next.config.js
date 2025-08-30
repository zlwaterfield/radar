/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3003',
  },
  async redirects() {
    return [
      {
        source: '/settings',
        destination: '/settings/notifications',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3003'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
