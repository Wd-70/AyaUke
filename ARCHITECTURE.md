# 아키텍처 가이드

아야 AyaUke 팬사이트의 코드 구조와 작성 규칙. (2026-06 DDD 리팩토링 기준)

## 디렉터리 구조

```
scripts/db/            DB 운영 도구 (읽기 전용 inspect, 로컬 백업) — 앱 번들 외부
src/
├── app/               Next.js App Router (페이지 + API 라우트)
│   └── api/           라우트 핸들러는 얇게: 검증 + 서비스 호출만
├── domains/           바운디드 컨텍스트별 비즈니스 로직
│   ├── catalog/       노래 카탈로그: 시트+Mongo 병합, 곡 상세, 관리자 곡 작업
│   ├── engagement/    좋아요, 플레이리스트, 공유
│   ├── archive/       라이브 클립, 치지직/유튜브 영상·댓글, 타임라인 파싱
│   └── operations/    백업 내보내기, 재계산 잡
├── shared/            컨텍스트 공통 인프라
│   ├── api/           envelope(ok/fail), errors(AppError), handler(withApi)
│   ├── db/mongodb.ts  유일한 connectDB
│   ├── config.ts      env 기반 설정 (시트 ID, 채널 ID)
│   └── utils/         (예정) retryUtils, fetchWithTimeout 등
├── models/            아직 이전하지 않은 모델 (User, UserActivity, YouTubeComment 배럴)
├── lib/               레거시 유틸 — 점진 축소 중 (authOptions, permissions, searchUtils 등)
├── hooks/             TanStack Query 기반 클라이언트 상태 (useLikes, useGlobalPlaylists)
└── components/        UI 컴포넌트
```

## 도메인 모듈 규칙

- `*.schema.ts` — Mongoose 모델. `mongoose.models.X || mongoose.model(...)` 가드 필수 (Next dev 재컴파일 대응).
- `*.service.ts` — 유스케이스. HTTP를 모름. 실패는 `AppError` 하위 클래스를 throw.
- `*.client.ts` — 외부 API 호출 (치지직, 구글시트).
- 순수 로직(파싱, 병합)은 별도 파일로 분리하고 vitest 테스트를 붙인다 (`__tests__/`).
- 다른 도메인의 schema를 직접 import하지 말 것 — 서비스 함수를 통해 사용.

## API 라우트 패턴

모든 신규/수정 라우트는 `withApi`를 사용한다:

```ts
const Body = z.object({ songId: z.string().min(1) });

export const POST = withApi({ schema: Body, auth: 'user' }, async ({ input, session }) => {
  return ok(await likeService.addLike(session!.user.channelId, input.songId));
});
```

- `auth`: `'none'`(기본) | `'user'` | `Permission.X`
- `schema`: GET/DELETE는 searchParams, 그 외는 body를 검증
- 성공 응답: `ok(data)` → `{ success: true, data }`
- 실패: 서비스가 던진 `AppError`가 자동으로 `{ success: false, error: { code, message } }`로 매핑
- 일부 구 라우트(playlists 등)는 훅 호환을 위해 레거시 성공 형태를 유지 중 — 주석에 명시되어 있음

## 클라이언트 상태

- TanStack Query 사용 (`QueryProvider`가 루트에 등록됨, staleTime 30초)
- 좋아요: `useLike(songId)` / `useBulkLikes().loadLikes(songIds)` — 사용자별 캐시 키
- 플레이리스트: `useGlobalPlaylists()` / `useSongPlaylists(songId)`
- 알림은 `useToast()` (`@/components/Toast`) — `alert()` 사용 금지

## 권한

- 역할: `super_admin > song_admin = ayauke_admin > song_editor > user` (`lib/permissions.ts`)
- /admin 진입: 관리자 역할 전체. 탭 노출은 `AdminClient`의 `access` 레벨로 제어
- API는 `withApi({ auth: Permission.X })` 또는 라우트 내 `isSuperAdmin` 검사

## DB 운영 도구

```bash
npm run db:inspect collections          # 컬렉션 목록/크기
npm run db:inspect sample songdetails 3 # 샘플 문서
npm run db:inspect query likes '{"channelId":"..."}' --limit=5
npm run db:inspect schema songvideos    # 필드 빈도 리포트
npm run db:backup                       # 전체 → ./backups/<날짜>/*.jsonl
```

- `inspect`/`backup`은 읽기 전용. 파괴적 스크립트는 `--confirm` 플래그 필수.
- 백업은 절대 DB 안에 저장하지 않는다 (과거 `backups` 컬렉션 방식 폐기).
- 운영 UI: 관리자 패널 → 데이터 유지보수 (백업 다운로드, 재계산).

## 테스트

```bash
npm test          # vitest 전체 실행
```

- 순수 로직만 테스트한다: 타임라인 파싱(`domains/archive/__tests__`), 시트 병합(`domains/catalog/__tests__`), retry 유틸.
- 컴포넌트 테스트/E2E 스위트는 의도적으로 없음 (1인 운영 규모).

## 데이터 정합성

- `likeCount`, `sungCount`, `addedByName` 등은 의도된 비정규화 — 재계산 잡(`domains/operations/recalc.service`)이 정합성 수단이다. 재정규화하지 말 것.
- 데이터 마이그레이션은 라우트 배포와 분리해 `scripts/db/`에서 수동 실행하고, 직전에 `npm run db:backup`.
