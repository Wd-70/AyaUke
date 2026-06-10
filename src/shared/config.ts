import { z } from 'zod';

/**
 * 앱 전역 설정. 하드코딩되어 있던 값들을 한 곳에 모으고 env로 덮어쓸 수 있게 한다.
 * 기본값은 기존 코드에 박혀 있던 운영 값과 동일하므로 env 미설정 시에도 동작이 변하지 않는다.
 *
 * env 변수 (모두 선택):
 *   GOOGLE_SHEET_ID                 노래책 구글 시트 ID
 *   SUPER_ADMIN_CHANNEL_IDS         쉼표 구분 치지직 채널 ID 목록
 *   AYAUKE_ADMIN_CHANNEL_IDS        쉼표 구분 치지직 채널 ID 목록
 *   HONEYZ_CHANNEL_IDS              쉼표 구분 치지직 채널 ID 목록 (칭호 자동 부여)
 */

const csv = (defaults: string[]) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v.split(',').map((s) => s.trim()).filter(Boolean)
        : defaults,
    );

const ConfigSchema = z.object({
  googleSheetId: z.string().default('1g-hVYnHn20XkS2HLAzOI9UcOnNHNtz1H-1g1MgVXTAc'),
  superAdminChannelIds: csv(['d6017f757614569add71b0bc83a81382' /* 개발자 */]),
  ayaukeAdminChannelIds: csv(['abe8aa82baf3d3ef54ad8468ee73e7fc' /* 아야우케 */]),
  honeyzChannelIds: csv([
    'abe8aa82baf3d3ef54ad8468ee73e7fc', // 아야
    '798e100206987b59805cfb75f927e965', // 디디디용
    'b82e8bc2505e37156b2d1140ba1fc05c', // 담유이
    'c0d9723cbb75dc223c6aa8a9d4f56002', // 허니츄러스
    'bd07973b6021d72512240c01a386d5c9', // 망내
    '65a53076fe1a39636082dd6dba8b8a4b', // 오화요
    'd6017f757614569add71b0bc83a81382', // 테스트
  ]),
});

export const config = ConfigSchema.parse({
  googleSheetId: process.env.GOOGLE_SHEET_ID || undefined,
  superAdminChannelIds: process.env.SUPER_ADMIN_CHANNEL_IDS,
  ayaukeAdminChannelIds: process.env.AYAUKE_ADMIN_CHANNEL_IDS,
  honeyzChannelIds: process.env.HONEYZ_CHANNEL_IDS,
});
