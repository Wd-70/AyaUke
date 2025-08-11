interface OBSUserState {
  userId: string;
  currentSong: {
    title: string;
    artist: string;
  };
  createdAt: Date;
}

// 전역 상태 - 모듈이 재로드되어도 유지됨
declare global {
  var __obsState__: Map<string, OBSUserState> | undefined;
  var __obsInitialized__: boolean | undefined;
}

// 전역 변수를 사용하여 개발 중 Hot Reload 시에도 상태 유지
const activeOBSUsers = globalThis.__obsState__ ?? new Map<string, OBSUserState>();

if (process.env.NODE_ENV === 'development') {
  globalThis.__obsState__ = activeOBSUsers;
}

// 초기화시 더미 데이터 추가 (안정성을 위해) - 진짜 한 번만
if (!globalThis.__obsInitialized__) {
  if (!activeOBSUsers.has('__dummy__')) {
    activeOBSUsers.set('__dummy__', {
      userId: '__dummy__',
      currentSong: {
        title: 'System Placeholder',
        artist: 'Internal'
      },
      createdAt: new Date()
    });
  }
  
  globalThis.__obsInitialized__ = true;
  console.log('OBS 메모리 상태 초기화 완료');
}

export { activeOBSUsers };
export type { OBSUserState };