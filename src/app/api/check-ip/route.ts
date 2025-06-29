import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 외부 IP 확인 서비스들
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip',
      'https://api.myip.com'
    ];

    const results = [];

    for (const service of ipServices) {
      try {
        const response = await fetch(service);
        const data = await response.json();
        results.push({
          service,
          ip: data.ip || data.origin,
          success: true
        });
      } catch (error) {
        results.push({
          service,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    // 요청 헤더에서 IP 정보도 수집
    const headers = {
      'x-forwarded-for': process.env.VERCEL_FORWARDED_FOR || 'not available',
      'x-real-ip': process.env.VERCEL_X_REAL_IP || 'not available',
      'x-vercel-ip-country': process.env.VERCEL_IP_COUNTRY || 'not available',
      'x-vercel-ip-region': process.env.VERCEL_IP_REGION || 'not available'
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown',
      ipCheckResults: results,
      vercelHeaders: headers,
      message: 'Vercel 배포 환경의 IP 정보'
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}