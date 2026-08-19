/**
 * 클립 재생 수 집계의 클라이언트 측 중복 방지.
 *
 * 재생 수가 의미 있는 데이터가 되려면 (1) 곡을 실제로 어느 정도 들었을 때만,
 * (2) 같은 곡을 짧은 시간 안에 반복해도 한 번만 세어야 한다.
 * (1)은 ClipPlayer가 재생 위치로 판단하고, (2)를 여기서 브라우저별 쿨다운으로 처리한다.
 *
 * 목적은 "무의미한 연속 반복"만 막는 것. 사용자가 많지 않으니 시간당 1회 정도는 집계해도
 * 충분하다 — 밤새 반복 재생이 한 곡을 수백으로 부풀리는 것만 방지하면 된다.
 */
const KEY = 'clipPlay.counted';
const COOLDOWN_MS = 60 * 60 * 1000; // 1시간

type CountedMap = Record<string, number>;

function read(): CountedMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CountedMap) : {};
  } catch {
    return {};
  }
}

/**
 * 지금 이 클립의 재생 수를 집계해도 되는지 판단하고, 허용 시 기록한다.
 * 쿨다운(6시간) 안에 이미 셌으면 false. localStorage 불가 환경은 그냥 허용(true).
 */
export function markClipCounted(clipId: string): boolean {
  try {
    const now = Date.now();
    const map = read();
    // 만료 항목 정리 (무한 증가 방지)
    for (const k of Object.keys(map)) {
      if (now - map[k] > COOLDOWN_MS) delete map[k];
    }
    const last = map[clipId];
    if (last && now - last < COOLDOWN_MS) {
      localStorage.setItem(KEY, JSON.stringify(map)); // 정리된 상태 저장
      return false;
    }
    map[clipId] = now;
    localStorage.setItem(KEY, JSON.stringify(map));
    return true;
  } catch {
    return true;
  }
}
