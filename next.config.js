/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'livecloud-thumb.akamaized.net',
        pathname: '/chzzk/**',
      },
      {
        protocol: 'https',
        hostname: 'nng-phinf.pstatic.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'video-phinf.pstatic.net',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        aggregateTimeout: 1000,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
        ],
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;