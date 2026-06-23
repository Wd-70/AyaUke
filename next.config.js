/** @type {import('next').NextConfig} */
const nextConfig = {
  // dev와 build(프로덕션)의 출력 폴더를 분리한다.
  // 같은 .next를 공유하면, dev 서버가 떠 있는 동안 next build가 .next를
  // 덮어써 매니페스트와 청크가 어긋나고 CSS/청크가 404로 날아간다.
  // (Vercel 배포는 NODE_ENV=production이라 그대로 .next를 사용)
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;