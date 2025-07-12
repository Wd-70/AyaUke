# Vercel 배포 가이드

## 필수 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수들을 설정해야 합니다:

### 1. NextAuth 설정
```
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-production-secret-key-here
```

### 2. 데이터베이스
```
MONGODB_URI=mongodb+srv://your-mongodb-connection-string
```

### 3. 네이버 OAuth (치지직 로그인)
```
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
```

### 4. Google Sheets API
```
NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key
```

### 5. 선택적 API 키들
```
CHZZK_CLIENT_ID=your_chzzk_client_id
CHZZK_CLIENT_SECRET=your_chzzk_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_API_KEY_2=your_youtube_api_key_2
YOUTUBE_API_KEY_3=your_youtube_api_key_3
```

## 네이버 개발자 센터 설정

배포 후 네이버 개발자 센터에서 다음을 업데이트해야 합니다:

1. **서비스 URL**: `https://your-domain.vercel.app`
2. **Callback URL**: `https://your-domain.vercel.app/api/auth/callback/naver`

## 배포 순서

1. Vercel에서 환경 변수 설정
2. 코드를 푸시하여 배포 트리거
3. 네이버 개발자 센터에서 콜백 URL 업데이트
4. 로그인 기능 테스트

## 주의사항

- `NEXTAUTH_SECRET`은 운영 환경에서 강력한 랜덤 키를 사용하세요
- 모든 API 키는 안전하게 보관하고 공유하지 마세요
- MongoDB 연결 문자열에는 적절한 네트워크 액세스 설정이 필요합니다