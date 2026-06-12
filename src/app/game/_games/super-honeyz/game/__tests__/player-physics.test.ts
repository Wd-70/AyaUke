import { describe, it, expect } from 'vitest';
import { Player, Input, World } from '../entities';
import { T } from '../levels';
import { RUN_MAX, WALK_MAX, SPRINT_MAX } from '../constants';

// 평평한 바닥만 있는 테스트 월드
const world: World = {
  tileAt: (_tx, ty) => (ty >= 13 ? T.GROUND : T.EMPTY),
  bumpBlock: () => {},
};

const DT = 1 / 60;
const RIGHT_RUN: Input = { left: false, right: true, run: true, jump: false };
const LEFT_RUN: Input = { left: true, right: false, run: true, jump: false };
const IDLE: Input = { left: false, right: false, run: false, jump: false };

function newPlayer() {
  return new Player(50, 13 * 16 - 14);
}

function run(p: Player, input: Input, frames: number, each?: (i: number) => void) {
  for (let i = 0; i < frames; i++) {
    p.update(DT, input, world);
    each?.(i);
  }
}

describe('즉답형 지상 이동', () => {
  it('가속이 빠르다: 0.3초 내 달리기 최고속도 도달', () => {
    const p = newPlayer();
    let tMax = -1;
    run(p, RIGHT_RUN, 60, (i) => {
      if (tMax < 0 && p.vx >= RUN_MAX - 1) tMax = i / 60;
    });
    expect(tMax).toBeGreaterThanOrEqual(0);
    expect(tMax).toBeLessThan(0.3);
  });

  it('제동이 빠르다: 키를 떼면 0.2초 내 정지 (미끄럼 없음)', () => {
    const p = newPlayer();
    run(p, RIGHT_RUN, 60); // 풀스피드
    let tStop = -1;
    run(p, IDLE, 60, (i) => {
      if (tStop < 0 && p.vx === 0) tStop = i / 60;
    });
    expect(tStop).toBeGreaterThanOrEqual(0);
    expect(tStop).toBeLessThan(0.2);
  });

  it('스키드: 달리기 중 반대 입력 시 완전히 멈출 때까지 보이게 제동 후 반전한다', () => {
    const p = newPlayer();
    run(p, RIGHT_RUN, 60); // 오른쪽 풀스피드
    expect(p.vx).toBeGreaterThan(RUN_MAX - 1);

    let skidFrames = 0;
    let tStop = -1;
    let tRemax = -1;
    run(p, LEFT_RUN, 60 * 2, (i) => {
      if (p.skidding) skidFrames++;
      if (tStop < 0 && p.vx <= 0) tStop = i / 60;
      if (tRemax < 0 && p.vx <= -(RUN_MAX - 1)) tRemax = i / 60;
    });
    expect(skidFrames).toBeGreaterThan(8); // 일반 제동보다 길게, 모션이 보임
    expect(tStop).toBeGreaterThan(0.15); // 즉시 반전 금지 — 충분히 멈춰선 뒤
    expect(tStop).toBeLessThan(0.45);
    expect(tRemax).toBeGreaterThan(tStop); // 정지 후 재가속
    expect(tRemax).toBeLessThan(tStop + 0.3); // 반전 후엔 즉답 가속
  });

  it('스프린트(2단 가속): 풀스피드 유지 시 ~0.5초 뒤 +40% 최고속에 도달한다', () => {
    const p = newPlayer();
    let tRun = -1;
    let tSprint = -1;
    run(p, RIGHT_RUN, 60 * 2, (i) => {
      if (tRun < 0 && p.vx >= RUN_MAX - 1) tRun = i / 60;
      if (tSprint < 0 && p.vx >= SPRINT_MAX - 1) tSprint = i / 60;
    });
    expect(tRun).toBeGreaterThanOrEqual(0); // 기본 최고속은 즉답 (~0.15s)
    expect(tRun).toBeLessThan(0.3);
    expect(tSprint).toBeGreaterThan(tRun + 0.3); // 그 위 +10%는 지속 주행 보상
    expect(tSprint).toBeLessThan(tRun + 0.8); // ~0.5초 추가
    // 멈추면 스프린트는 빠르게 소멸
    run(p, IDLE, 40);
    expect(p.sprint).toBeLessThan(0.2);
  });

  it('스프린트는 점프로 끊기지 않는다 (공중에서 유지)', () => {
    const p = newPlayer();
    run(p, RIGHT_RUN, 60 * 1.5); // 스프린트 풀차지
    expect(p.sprint).toBe(1);
    p.queueJump();
    const JUMP_RIGHT: Input = { left: false, right: true, run: true, jump: true };
    run(p, JUMP_RIGHT, 20); // 공중
    expect(p.grounded).toBe(false);
    expect(p.sprint).toBe(1); // 공중에서 유지
    expect(p.vx).toBeGreaterThan(RUN_MAX); // 스프린트 속도 유지
  });

  it('스키드는 달리기 속도 이상에서만 발생한다', () => {
    const slow = newPlayer();
    const RIGHT_WALK: Input = { left: false, right: true, run: false, jump: false };
    run(slow, RIGHT_WALK, 60 * 2);
    expect(Math.abs(slow.vx)).toBeLessThanOrEqual(WALK_MAX + 1);
    let skid = 0;
    run(slow, { ...RIGHT_WALK, left: true, right: false }, 30, () => {
      if (slow.skidding) skid++;
    });
    expect(skid).toBe(0);
  });
});

describe('공중 제어 / 모던 조작감', () => {
  const JUMP_RIGHT: Input = { left: false, right: true, run: true, jump: true };
  const JUMP_LEFT: Input = { left: true, right: false, run: true, jump: true };

  it('공중에서 반대 방향으로 자유롭게 전환된다 (스키드 래치 없이 즉시)', () => {
    const p = newPlayer();
    run(p, RIGHT_RUN, 60); // 오른쪽 풀스피드
    p.queueJump();
    run(p, JUMP_RIGHT, 2); // 점프
    expect(p.grounded).toBe(false);
    expect(p.vx).toBeGreaterThan(0);
    let flipped = -1;
    run(p, JUMP_LEFT, 30, (i) => {
      if (flipped < 0 && p.vx < 0) flipped = i;
    });
    expect(flipped).toBeGreaterThanOrEqual(0);
    expect(flipped).toBeLessThan(15); // 0.25초 내 방향 반전 — 자유로운 공중 제어
    expect(p.skidding).toBe(false); // 공중에선 스키드 없음
  });

  it('에이펙스 모디파이어: 점프 정점 부근(|vy|<APEX_WINDOW)에서 체공이 길어진다', () => {
    const JUMP_HOLD: Input = { left: false, right: false, run: false, jump: true };
    const p = newPlayer();
    run(p, IDLE, 5); // 바닥에 안착
    p.queueJump();
    let apexFrames = 0;
    let airborne = false;
    run(p, JUMP_HOLD, 120, () => {
      if (!p.grounded) airborne = true;
      if (!p.grounded && Math.abs(p.vy) < 46) apexFrames++;
    });
    expect(airborne).toBe(true);
    expect(apexFrames).toBeGreaterThanOrEqual(6); // 정점 부근에 눈에 띄게 머무름 (미적용 시 ~3프레임)
  });

  it('코너 보정: 머리가 블록 모서리에 살짝 걸리면 옆으로 밀려 통과한다', () => {
    const ceilWorld: World = {
      tileAt: (tx, ty) => {
        if (ty >= 13) return T.GROUND;
        if (ty <= 4 && tx >= 4) return T.BRICK; // 천장 (바닥 y=80)
        return T.EMPTY;
      },
      bumpBlock: () => {},
    };
    // 머리(폭 56~66)의 오른쪽 2px만 타일4(64~)에 걸치고, 상승하면 천장(ty=4)에 닿는 위치
    const p = new Player(64 - 8, 80);
    p.vy = -200; // 상승 중
    const xBefore = p.x;
    p.update(DT, IDLE, ceilWorld);
    expect(p.x).toBeLessThan(xBefore); // 왼쪽으로 밀려 보정됨
    expect(p.vy).toBeLessThan(0); // 머리받고 멈추지 않고 계속 상승
  });
});
