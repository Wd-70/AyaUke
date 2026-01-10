# 치지직→유튜브 타임라인 변환 기능 구현 계획

## 개요
치지직 채널의 다시보기 영상과 댓글을 수집하고, 유튜브 영상과 매핑하여 시간차를 설정한 후 변환된 타임라인 댓글을 실시간으로 표시하는 기능입니다.

## 핵심 워크플로우

```
1. [채널 수집] 버튼 클릭
   ↓
2. 채널의 모든 영상+댓글 수집 → MongoDB 저장
   ↓
3. 영상 목록 표시 (타임라인 댓글 수 포함)
   ↓
4. 영상 선택 → 세부정보 화면
   ↓
5. 유튜브 URL 입력/수정
   ↓
6. 듀얼 비디오 플레이어 표시 (치지직 영상 사라진 경우 예외 처리)
   ↓
7. 싱크 포인트 설정 → 시간차 자동 계산 및 DB 저장
   ↓
8. 변환된 댓글 자동 표시 (원본/변환 토글)
```

## 주요 요구사항 정리

### 1. 데이터 수집
- ✅ 언제든지 [채널 수집] 버튼으로 재수집 가능
- ✅ 채널 ID는 하드코딩: `abe8aa82baf3d3ef54ad8468ee73e7fc`
- ✅ 영상 목록 + 각 영상의 전체 댓글 수집
- ✅ 타임라인 댓글 자동 감지

### 2. 영상 관리
- ✅ 수집된 영상 목록 표시
- ✅ 영상 선택 → 세부정보 화면
- ✅ 유튜브 URL 입력/수정 필드
- ✅ 시간차(offset) DB 저장

### 3. 비디오 비교
- ✅ 유튜브 URL 입력 시 듀얼 플레이어 표시
- ✅ 치지직 영상 삭제 시 예외 처리
- ✅ 싱크 포인트 설정 UI

### 4. 댓글 변환
- ✅ 시간차 설정 후 자동 변환 표시
- ✅ 원본/변환 댓글 토글 (체크박스 또는 토글 버튼)
- ✅ 변환된 댓글은 DB 저장하지 않음 (매번 실시간 계산)
- ✅ 복사 가능한 텍스트 영역

## MongoDB 스키마 설계

### ChzzkVideo Model
**파일**: `/src/models/ChzzkVideo.ts`

```typescript
{
  videoNo: number (unique, 치지직 비디오 번호)
  videoId: string
  channelId: string (하드코딩)
  channelName: string
  videoTitle: string
  publishDate: string (ISO date)
  duration: number (초 단위)
  readCount: number (조회수)
  thumbnailImageUrl: string
  videoUrl: string

  // 댓글 통계
  totalComments: number
  timelineComments: number
  lastCommentSync: Date

  // 유튜브 매핑 정보 (사용자가 입력)
  youtubeUrl?: string
  youtubeVideoId?: string
  timeOffset?: number (초 단위, youtube시간 - chzzk시간)
  syncSetAt?: Date (시간차 설정 시각)

  // 영상 상태
  isDeleted: boolean (치지직에서 삭제됨)

  createdAt: Date
  updatedAt: Date
}
```

### ChzzkComment Model
**파일**: `/src/models/ChzzkComment.ts`

```typescript
{
  commentId: number (unique)
  videoNo: number
  commentType: string (COMMENT or REPLY)
  parentCommentId?: number

  content: string (원본 텍스트, 줄바꿈 포함)
  authorName: string
  publishedAt: Date

  // 타임라인 관련
  isTimeline: boolean
  extractedTimestamps: string[] (추출된 타임스탬프 목록)

  createdAt: Date
  updatedAt: Date
}
```

**주의**: ConversionSession 모델은 제거 (불필요)

## API Route 설계

### `/api/chzzk-sync/route.ts`

#### GET Actions

**1. `list-videos`** - 영상 목록 조회
```typescript
Query: { page?, limit?, search? }
Response: {
  success: boolean
  data: {
    videos: ChzzkVideo[]
    pagination: { currentPage, totalPages, totalCount }
  }
}
```

**2. `get-video`** - 영상 세부정보 + 댓글 조회
```typescript
Query: { videoNo: number, convertTimestamps?: boolean }
Response: {
  success: boolean
  data: {
    video: ChzzkVideo
    comments: ChzzkComment[]
    convertedComments?: string[] (timeOffset이 설정된 경우)
  }
}
```

#### POST Actions

**1. `sync-channel`** - 채널 전체 수집
```typescript
Body: { force?: boolean } (기존 데이터 덮어쓰기)
Response: {
  success: boolean
  data: {
    totalVideos: number
    newVideos: number
    totalComments: number
    timelineComments: number
  }
}
```

**프로세스**:
1. 치지직 채널 API로 영상 목록 조회
2. 각 영상마다:
   - 기존 DB에 있으면 스킵 (force=true면 업데이트)
   - 댓글 API 호출 (30개씩 페이징, 전체 수집)
   - 타임라인 패턴 감지
   - MongoDB 저장
3. 진행 상황 반환

**2. `update-video`** - 영상 정보 업데이트
```typescript
Body: {
  videoNo: number
  youtubeUrl?: string
  timeOffset?: number
}
Response: {
  success: boolean
  data: { video: ChzzkVideo }
}
```

**3. `check-video-status`** - 치지직 영상 존재 여부 확인
```typescript
Body: { videoNo: number }
Response: {
  success: boolean
  data: {
    exists: boolean
    isAccessible: boolean
  }
}
```

## UI 컴포넌트 설계

### ChzzkYoutubeConverterTab
**파일**: `/src/app/admin/tabs/ChzzkYoutubeConverterTab.tsx`

#### 화면 구성

```
┌────────────────────────────────────────────────────────┐
│ 헤더: 치지직→유튜브 타임라인 변환                        │
│ [채널 수집] [통계]                                       │
│ 통계: 총 X개 영상, 타임라인 댓글 Y개, 매핑 완료 Z개      │
└────────────────────────────────────────────────────────┘

┌─────────────────────┬──────────────────────────────────┐
│ 영상 목록 (왼쪽)     │ 세부정보 (오른쪽)                 │
│                     │                                  │
│ [검색 입력창]        │ (영상 선택 전)                    │
│                     │ "← 왼쪽에서 영상을 선택하세요"    │
│ ☑ [썸네일] 영상1     │                                  │
│   제목...           │ (영상 선택 후)                    │
│   타임라인 15개      │                                  │
│   유튜브: ✓         │ ┌─────────────────────────────┐ │
│                     │ │ 영상 정보                    │ │
│ ☐ [썸네일] 영상2     │ │ • 제목: ...                 │ │
│   제목...           │ │ • 날짜: ...                 │ │
│   타임라인 0개       │ │ • 타임라인 댓글: 15개       │ │
│   유튜브: ✗         │ └─────────────────────────────┘ │
│                     │                                  │
│ ☐ [썸네일] 영상3     │ ┌─────────────────────────────┐ │
│   제목...           │ │ 유튜브 URL                   │ │
│   타임라인 23개      │ │ [입력창] [저장]             │ │
│   유튜브: ✓         │ └─────────────────────────────┘ │
│                     │                                  │
│ ...                 │ ┌──────────┬──────────┐         │
│                     │ │ 치지직    │ 유튜브    │         │
│                     │ │ [플레이어]│ [플레이어]│         │
│ (페이지네이션)       │ │ 1:23:45  │ 1:25:30  │         │
│                     │ └──────────┴──────────┘         │
│                     │ [싱크 포인트 설정] 오프셋: +1:45  │
│                     │                                  │
│                     │ ┌─────────────────────────────┐ │
│                     │ │ 댓글 (원본 ☑ | 변환 ☐)      │ │
│                     │ │ ┌───────────────────────┐   │ │
│                     │ │ │ 0:05:30 곡 시작        │   │ │
│                     │ │ │ 0:08:15 다음 곡       │   │ │
│                     │ │ │ ...                   │   │ │
│                     │ │ └───────────────────────┘   │ │
│                     │ │ [클립보드 복사]             │ │
│                     │ └─────────────────────────────┘ │
└─────────────────────┴──────────────────────────────────┘
```

#### State 관리

```typescript
const AYAUKE_CHANNEL_ID = 'abe8aa82baf3d3ef54ad8468ee73e7fc'

// 영상 목록
const [videos, setVideos] = useState<ChzzkVideo[]>([])
const [selectedVideo, setSelectedVideo] = useState<ChzzkVideo | null>(null)
const [pagination, setPagination] = useState({ page: 1, limit: 20 })

// 세부정보
const [comments, setComments] = useState<ChzzkComment[]>([])
const [youtubeUrl, setYoutubeUrl] = useState('')
const [timeOffset, setTimeOffset] = useState<number | null>(null)

// 비디오 플레이어
const [chzzkCurrentTime, setChzzkCurrentTime] = useState(0)
const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0)
const [videoExists, setVideoExists] = useState(true)

// 댓글 표시 모드
const [showConverted, setShowConverted] = useState(false) // true=변환, false=원본

// UI 상태
const [syncing, setSyncing] = useState(false)
const [loading, setLoading] = useState(false)
```

#### 주요 기능 구현

**1. 채널 수집**
```typescript
const handleSyncChannel = async () => {
  setSyncing(true)
  const response = await fetch('/api/chzzk-sync', {
    method: 'POST',
    body: JSON.stringify({ action: 'sync-channel' })
  })
  const result = await response.json()
  // 결과 다이얼로그 표시
  await loadVideos() // 목록 새로고침
}
```

**2. 영상 선택**
```typescript
const handleSelectVideo = async (video: ChzzkVideo) => {
  setSelectedVideo(video)
  setYoutubeUrl(video.youtubeUrl || '')
  setTimeOffset(video.timeOffset || null)

  // 댓글 로드
  const response = await fetch(
    `/api/chzzk-sync?action=get-video&videoNo=${video.videoNo}`
  )
  const result = await response.json()
  setComments(result.data.comments)

  // 영상 존재 여부 확인
  checkVideoStatus(video.videoNo)
}
```

**3. 유튜브 URL 저장**
```typescript
const handleSaveYoutubeUrl = async () => {
  const response = await fetch('/api/chzzk-sync', {
    method: 'POST',
    body: JSON.stringify({
      action: 'update-video',
      videoNo: selectedVideo.videoNo,
      youtubeUrl
    })
  })
  // 영상 정보 업데이트
}
```

**4. 싱크 포인트 설정**
```typescript
const handleSetSyncPoint = async () => {
  const offset = youtubeCurrentTime - chzzkCurrentTime
  setTimeOffset(offset)

  // DB에 저장
  await fetch('/api/chzzk-sync', {
    method: 'POST',
    body: JSON.stringify({
      action: 'update-video',
      videoNo: selectedVideo.videoNo,
      timeOffset: offset
    })
  })

  // 자동으로 변환 모드로 전환
  setShowConverted(true)
}
```

**5. 댓글 변환 표시**
```typescript
const displayComments = useMemo(() => {
  if (!showConverted || timeOffset === null) {
    // 원본 댓글
    return comments.filter(c => c.isTimeline)
  }

  // 변환된 댓글 (실시간 계산)
  return comments
    .filter(c => c.isTimeline)
    .map(comment => {
      let converted = comment.content
      comment.extractedTimestamps.forEach(timestamp => {
        const seconds = parseTimeToSeconds(timestamp)
        const newSeconds = seconds + timeOffset
        const newTimestamp = formatSeconds(newSeconds)
        converted = converted.replace(timestamp, newTimestamp)
      })
      return converted
    })
}, [comments, showConverted, timeOffset])
```

**6. 치지직 영상 삭제 처리**
```typescript
const checkVideoStatus = async (videoNo: number) => {
  const response = await fetch('/api/chzzk-sync', {
    method: 'POST',
    body: JSON.stringify({
      action: 'check-video-status',
      videoNo
    })
  })
  const result = await response.json()
  setVideoExists(result.data.exists)

  if (!result.data.exists) {
    // 치지직 플레이어 숨기고 안내 메시지 표시
    alert('이 영상은 치지직에서 삭제되었습니다.')
  }
}
```

## 타임스탬프 변환 로직

### 유틸리티 함수 (API 라우트 내부)

```typescript
// 기존 함수 재사용
function parseTimeToSeconds(timeStr: string): number {
  // /src/app/api/timeline-parser/route.ts:341-404 참조
  // 구현 내용 동일
}

function formatSeconds(seconds: number): string {
  // 구현 내용 동일
}

// 타임스탬프 추출 정규식 (YouTube와 동일)
const TIMELINE_PATTERNS = [
  /(\d{1,2}):(\d{2}):(\d{2})/g,
  /(\d{1,2}):(\d{2})/g,
  /(\d{1,2})분(\d{2})초/g,
  // ...
]

function isTimelineComment(content: string): boolean {
  return TIMELINE_PATTERNS.some(pattern => pattern.test(content))
}

function extractTimestamps(content: string): string[] {
  const timestamps: string[] = []
  // 우선순위 순서로 패턴 체크
  // 중복 제거
  return [...new Set(timestamps)]
}
```

## 구현 순서

### Phase 1: 데이터 레이어 (2-3시간)
1. ✅ MongoDB 모델 생성
   - `/src/models/ChzzkVideo.ts`
   - `/src/models/ChzzkComment.ts`

2. ✅ API 라우트 기본 구조
   - `/src/app/api/chzzk-sync/route.ts` 생성
   - GET actions: list-videos, get-video
   - POST actions: sync-channel, update-video, check-video-status

3. ✅ 치지직 API 연동
   - 채널 영상 목록 API
   - 댓글 수집 API (페이징)
   - 타임라인 패턴 감지

### Phase 2: UI 기본 구조 (2-3시간)
4. ✅ ChzzkYoutubeConverterTab 컴포넌트 생성
   - 듀얼 패널 레이아웃
   - 영상 목록 (왼쪽)
   - 세부정보 (오른쪽)

5. ✅ 영상 목록 기능
   - [채널 수집] 버튼
   - 영상 목록 표시 (썸네일, 제목, 타임라인 수, 유튜브 매핑 상태)
   - 검색 기능
   - 페이지네이션

### Phase 3: 비디오 비교 (2-3시간)
6. ✅ 세부정보 화면
   - 영상 정보 표시
   - 유튜브 URL 입력/저장
   - 듀얼 비디오 플레이어
     - 치지직: iframe 또는 직접 플레이어
     - 유튜브: react-youtube
   - 싱크 포인트 설정 UI

7. ✅ 싱크 기능
   - 현재 시간 추적
   - 오프셋 계산
   - DB 저장

### Phase 4: 댓글 변환 (1-2시간)
8. ✅ 댓글 표시
   - 원본/변환 토글
   - 타임라인 댓글 필터링
   - 실시간 타임스탬프 변환
   - 복사 버튼

9. ✅ AdminClient 통합
   - `/src/app/admin/AdminClient.tsx` 수정
   - 새 탭 추가

### Phase 5: 테스트 및 개선 (1-2시간)
10. ✅ 예외 처리
    - 치지직 영상 삭제 처리
    - 댓글 없는 영상
    - API 오류 처리

11. ✅ UX 개선
    - 로딩 상태
    - 에러 메시지
    - 진행 상황 표시

## 핵심 파일 목록

### 생성할 파일
1. `/src/models/ChzzkVideo.ts`
2. `/src/models/ChzzkComment.ts`
3. `/src/app/api/chzzk-sync/route.ts`
4. `/src/app/admin/tabs/ChzzkYoutubeConverterTab.tsx`

### 수정할 파일
1. `/src/app/admin/AdminClient.tsx` - 새 탭 추가

## 검증 계획

### 기능 검증
- [ ] 채널 수집 (영상+댓글 일괄)
- [ ] 영상 목록 표시 및 검색
- [ ] 영상 선택 → 세부정보
- [ ] 유튜브 URL 저장
- [ ] 듀얼 플레이어 작동
- [ ] 싱크 포인트 설정 → DB 저장
- [ ] 원본/변환 댓글 토글
- [ ] 타임스탬프 변환 정확도
- [ ] 클립보드 복사

### Edge Cases
- [ ] 치지직 영상 삭제 처리
- [ ] 타임라인 댓글 없는 영상
- [ ] 유튜브 URL 없는 상태
- [ ] 시간차 미설정 상태
- [ ] 음수 오프셋

### UI/UX
- [ ] 반응형 디자인
- [ ] 다크모드
- [ ] 로딩 상태
- [ ] 에러 피드백

## 기술적 고려사항

### 채널 수집 최적화
- 배치 처리: 3-5개 영상씩 동시 처리
- 딜레이: 각 API 호출 간 100-200ms 대기
- 진행 상황: 실시간 피드백

### 비디오 플레이어
- 치지직: iframe 임베드 또는 video.js
- 유튜브: react-youtube (이미 설치됨)
- 시간 동기화: 각 플레이어의 onStateChange, onProgress 이벤트

### 성능
- 변환된 댓글은 useMemo로 캐싱
- 영상 목록 가상 스크롤 (필요 시)
- 댓글 목록 페이징 (100개 이상 시)

### 데이터 일관성
- timeOffset 변경 시 자동으로 변환 모드로 전환
- 유튜브 URL 변경 시 timeOffset 초기화 여부 확인

## 예상 작업 시간
- Phase 1: 2-3시간
- Phase 2: 2-3시간
- Phase 3: 2-3시간
- Phase 4: 1-2시간
- Phase 5: 1-2시간
- **총 예상**: 8-13시간
