/** @type {import('next').NextConfig} */
const nextConfig = {
  // WSL에서 Windows 파일시스템 사용 시 캐시 디렉토리를 /tmp로 변경
  distDir: process.env.NODE_ENV === 'development' ? '/tmp/.next' : '.next',
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 3000,
        aggregateTimeout: 1000,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
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