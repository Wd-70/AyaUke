// 곡(SongDetail _id) → 타이밍 파일(레포 루트 기준 경로): 가사 lyrics.json, 효과 cues.json.
// 로컬 타이밍 편집기의 저장 API가 이 목록에 있는 파일만 쓴다(임의 경로 쓰기 방지).
export const TIMING_FILES: Record<string, { lyrics: string; cues?: string }> = {
  '68610d4b042fb27d04542791': {
    lyrics: 'src/components/mv/works/samurai-heart/lyrics.json',
    cues: 'src/components/mv/works/samurai-heart/cues.json',
  },
  '68610d51042fb27d04542823': {
    lyrics: 'src/components/mv/works/katappo/lyrics.json',
    cues: 'src/components/mv/works/katappo/cues.json',
  },
};
