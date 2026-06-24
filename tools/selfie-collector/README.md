# 방종셀카 수집기 (크롬 확장)

X / 네이버 팬카페에서 방종셀카 이미지를 **로컬 dev 서버**로 수집해 아카이빙하고,
개발용 DOM 인벤토리를 로컬에 저장(셀렉터 튜닝)하는 보조/인스펙터 도구.

`chrome.scripting.executeScript({ allFrames: true })` 로 **모든 프레임(카페 본문 iframe 포함)**에서
스캔/덤프를 실행한다. (선언적 content script 미사용 — 그래서 권한이 적용된 페이지에서만 동작)

## 사전 준비
1. 로컬 dev 서버: `npm run dev` (http://localhost:3000)
2. 브라우저에서 http://localhost:3000 에 **관리자 계정 로그인** (수집/덤프 엔드포인트는 관리자 + 로컬 전용)

## 설치 (압축 해제 로드)
1. `chrome://extensions` → **개발자 모드** 켜기
2. **압축해제된 확장 프로그램 로드** → 이 폴더(`tools/selfie-collector`) 선택
   - 코드 수정 후에는 확장 카드의 **새로고침**을 눌러 갱신

## 사용
- **본문 스캔**: 셀카 게시물에서 본문 첨부 이미지만 후보로 잡는다(카페는 본문 컨테이너 + pstatic 첨부 호스트). 확인 후 **선택 수집**.
- **개발용 덤프**: 현재 페이지의 모든 이미지 {주소·호스트·크기·조상 class} + 후보 컨테이너 HTML + 날짜 후보를
  `POST /api/admin/selfie/debug` 로 보내 `selfie-archive/_debug/<타임스탬프>.json` 에 저장한다.
  저장 경로가 클립보드에 복사되니 Claude에게 알려주면, 그 덤프를 읽어 카페 셀렉터/날짜를 정확히 맞춘다.
- **선택 수집**: 선택한 게시물 이미지를 로그인 컨텍스트에서 fetch → base64 → `/api/admin/selfie/ingest`.
  이미지가 `selfie-archive/<날짜>/` 에 저장되고 SelfiePost에 기록(작성일 KST 기준 분류).

## 분석 (수집 후)
- 수집 이미지는 `selfie-archive/<날짜>/*.jpg`. Claude가 읽어 채팅 닉네임을 추출하고
  `node scripts/selfie/record-attendees.mjs --date=YYYY-MM-DD --names="닉1,닉2,..."` 로 날짜별 참석자 기록.

## 메모
- 현재는 **카페 우선**. X는 기본 스캔만 들어가 있고, 타임라인 전체 자동 스크롤 수집은 다음 단계.
- 카페 글의 정확한 본문 셀렉터/날짜 위치는 **개발용 덤프**로 확인해 반영한다.
- 운영(Vercel) 서버에는 파일을 쓸 수 없어 수집/덤프는 로컬에서만 동작한다.
