// Watchpack 에러 억제
if (process.env.NODE_ENV === 'development') {
  require('./watchpack-ignore');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // WSL에서 Windows 파일시스템 사용 시 캐시 디렉토리를 /tmp로 변경
  distDir: process.env.NODE_ENV === 'development' ? '/tmp/.next' : '.next',
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 3000,
        aggregateTimeout: 1000,
        ignored: [
          '**/node_modules/**', 
          '**/.git/**', 
          '**/.next/**',
          '/mnt/g/**',  // 존재하지 않는 드라이브 무시
          '/mnt/h/**',
          '/mnt/i/**',
          '/mnt/j/**',
          '/mnt/k/**',
          '/mnt/l/**',
          '/mnt/m/**',
          '/mnt/n/**',
          '/mnt/o/**',
          '/mnt/p/**',
          '/mnt/q/**',
          '/mnt/r/**',
          '/mnt/s/**',
          '/mnt/t/**',
          '/mnt/u/**',
          '/mnt/v/**',
          '/mnt/w/**',
          '/mnt/x/**',
          '/mnt/y/**',
          '/mnt/z/**',
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