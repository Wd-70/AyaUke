'use client';

import { createContext } from 'react';

// 타임라인/다이얼로그 선택과 무관하게 곡 단위 변경을 공유한다.
export const SongDurationContext = createContext<(songId: string, duration: number) => void>(() => {});
