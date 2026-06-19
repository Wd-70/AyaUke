# 아야 AyaUke 비공식 팬사이트

HONEYZ의 메인 보컬, 노래를 사랑하는 버튜버 아야 AyaUke의 비공식 팬사이트입니다.

## ✨ 특징

- 🎵 **노래책**: 구글 시트와 연동된 실시간 노래 목록
- 🌙 **다크 모드**: 라이트/다크 테마 지원
- 📱 **반응형**: 모든 디바이스에서 완벽한 경험
- 🎨 **아름다운 디자인**: 현대적이고 세련된 UI/UX

## 🚀 시작하기

### 요구사항

- Node.js 18+ 
- npm, yarn, pnpm 또는 bun

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하세요.

### 서브도메인 테스트

노래책 페이지는 서브도메인으로 접근할 수 있습니다:

- 메인 사이트: `http://localhost:3000`
- 노래책: `http://songbook.localhost:3000`

로컬에서 서브도메인 테스트를 위해 `/etc/hosts` 파일에 다음을 추가하세요:

```
127.0.0.1 songbook.localhost
```

## 🎵 구글 시트 연동

노래책 데이터는 구글 시트와 연동됩니다. 

**현재 상태**: API 키가 설정되지 않으면 오류 메시지 표시

**구글 시트 연동하기:**
1. `GOOGLE_SHEETS_SETUP.md` 파일의 상세 가이드 참고
2. Google Sheets API 키 생성
3. `.env.local` 파일에 API 키 추가:

```env
NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY=your_actual_api_key_here
```

**시트 구조**: 시스템이 자동으로 컬럼을 감지합니다
- 제목, 아티스트 (필수)
- 언어, 장르, MR링크, 태그 등 (선택)
- 한글/영어/일본어 자동 언어 감지

## 🛠️ 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **애니메이션**: Framer Motion
- **아이콘**: Heroicons
- **배포**: Vercel 권장

## 📁 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 루트 레이아웃
│   ├── page.tsx           # 메인 페이지
│   └── songbook/          # 노래책 페이지
├── components/            # 재사용 가능한 컴포넌트
├── contexts/              # React 컨텍스트
├── hooks/                 # 커스텀 훅
├── lib/                   # 유틸리티 함수
└── types/                 # TypeScript 타입 정의
```

## 🎨 디자인 시스템

### 색상 팔레트

**라이트 모드:**
- Primary: `#D1AFE3` (연보라)
- Secondary: `#F9D891` (노랑 포인트)
- Accent: `#E38BFF` (밝은 보라)
- Purple: `#A171D5` (중간 보라)

**다크 모드:**
- Primary: `#E35874` (핑크/빨강 포인트)
- Secondary: `#9875BB` (보라)
- Accent: `#E38BFF` (밝은 보라)
- Purple: `#A171D5` (중간 보라)

### 폰트

- **본문**: Inter
- **제목**: Poppins

## 🔧 개발

### 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트 검사
npm run lint
```

### 환경 변수

```env
# Google Sheets API
NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY=your_api_key

# 기타 API 키들...
```

## 📱 기능

### 메인 페이지
- 히어로 섹션 (캐릭터 소개, Live 표시)
- 방송 미리보기 (예정 방송, 최근 하이라이트)
- 주요 콘텐츠 (대표 노래, 게임, 클립)

### 노래책 페이지
- 실시간 구글 시트 연동
- 고급 검색 및 필터링
- 언어별/장르별/난이도별 분류
- MR 링크 바로 재생

### 알림 기능
- 방송 시작 알림
- 사운드 알림 (on/off)
- 브라우저 네이티브 알림

## 🚀 배포

### Vercel (권장)

1. GitHub에 코드 푸시
2. [Vercel](https://vercel.com)에서 프로젝트 연결
3. 환경 변수 설정
4. 자동 배포 완료

### 서브도메인 설정

프로덕션에서 서브도메인을 사용하려면 DNS 설정이 필요합니다:

```
# DNS 레코드 예시
A    @              -> your-server-ip
A    songbook       -> your-server-ip
CNAME www          -> yourdomain.com
```

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/amazing-feature`)
3. Commit your Changes (`git commit -m 'Add some amazing feature'`)
4. Push to the Branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

