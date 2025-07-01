/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
    }
    return config;
  },
  eslint: {
    // 배포 시 ESLint 오류를 경고로 처리
    ignoreDuringBuilds: false,
  },
  typescript: {
    // 배포 시 TypeScript 오류를 무시하지 않음 (안전성 유지)
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;