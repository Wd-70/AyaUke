import {
  TILE,
  ROWS,
  WALK_MAX,
  RUN_MAX,
  SPRINT_MAX,
  SPRINT_CHARGE_TIME,
  SPRINT_DECAY_TIME,
  ACCEL,
  AIR_ACCEL,
  AIR_TURN_ACCEL,
  DECEL,
  SKID_DECEL,
  APEX_WINDOW,
  APEX_GRAVITY_MULT,
  CORNER_CORRECT,
  GRAVITY_RISE,
  GRAVITY_FALL,
  MAX_FALL,
  JUMP_VEL,
  JUMP_SPEED_BONUS,
  JUMP_CUT,
  COYOTE_TIME,
  JUMP_BUFFER,
  STOMP_BOUNCE,
  STOMP_BOUNCE_HOLD,
  SHELL_SPEED,
} from './constants';
import { T, isSolid, SpawnType } from './levels';

export interface Input {
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
}

/** 엔티티가 월드에 접근할 때 쓰는 최소 인터페이스 (Game이 구현) */
export interface World {
  tileAt(tx: number, ty: number): T;
  bumpBlock(tx: number, ty: number): void;
}

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

export function overlap(a: Body, b: Body): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** X축 이동 + 타일 충돌. 벽에 부딪히면 true */
export function moveX(b: Body, world: World, dt: number): boolean {
  b.x += b.vx * dt;
  const ty0 = Math.floor(b.y / TILE);
  const ty1 = Math.floor((b.y + b.h - 0.01) / TILE);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (isSolid(world.tileAt(tx, ty))) {
        b.x = tx * TILE - b.w - 0.01;
        return true;
      }
    }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (isSolid(world.tileAt(tx, ty))) {
        b.x = (tx + 1) * TILE + 0.01;
        return true;
      }
    }
  }
  return false;
}

/** Y축 이동 + 타일 충돌. 바닥 착지 여부와 머리받은 타일을 반환 */
export function moveY(
  b: Body,
  world: World,
  dt: number,
): { ground: boolean; ceil: { tx: number; ty: number } | null } {
  b.y += b.vy * dt;
  const tx0 = Math.floor(b.x / TILE);
  const tx1 = Math.floor((b.x + b.w - 0.01) / TILE);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (isSolid(world.tileAt(tx, ty))) {
        b.y = ty * TILE - b.h - 0.001;
        b.vy = 0;
        return { ground: true, ceil: null };
      }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / TILE);
    // 가장 깊이 겹친 타일을 머리받기 대상으로 (모서리 스침 방지)
    let best: { tx: number; ty: number } | null = null;
    let bestOverlap = -1;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (isSolid(world.tileAt(tx, ty))) {
        const o = Math.min(b.x + b.w, (tx + 1) * TILE) - Math.max(b.x, tx * TILE);
        if (o > bestOverlap) {
          bestOverlap = o;
          best = { tx, ty };
        }
      }
    }
    if (best) {
      b.y = (best.ty + 1) * TILE + 0.001;
      b.vy = 0;
      return { ground: false, ceil: best };
    }
  }
  return { ground: false, ceil: null };
}

function approach(v: number, target: number, amount: number): number {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}

export class Player implements Body {
  w = 10;
  h = 14;
  vx = 0;
  vy = 0;
  facing = 1;
  grounded = false;
  skidding = false;
  big = false;
  invuln = 0;
  dead = false;
  /** 스프린트 차지 (0~1): 풀스피드 달리기를 지속하면 차고, 찬 만큼 최고속이 +10%까지 상승 */
  sprint = 0;
  /** 스키드 진행 래치: 한번 시작되면 완전히 멈출 때까지 제동 유지 */
  private skidLatched = false;
  private coyote = 0;
  private jumpBuf = 0;
  private jumpCutDone = true;

  constructor(
    public x: number,
    public y: number,
  ) {}

  queueJump() {
    this.jumpBuf = JUMP_BUFFER;
  }

  grow() {
    if (!this.big) {
      this.big = true;
      this.y -= 12;
      this.h = 26;
    }
  }

  shrink() {
    this.big = false;
    this.h = 14;
    this.y += 12;
    this.invuln = 2;
  }

  /** 적 밟기 반동 — 점프 버튼을 누르고 있으면 점프와 동일한 높이 */
  bounce(holdJump: boolean) {
    this.vy = -(holdJump ? STOMP_BOUNCE_HOLD : STOMP_BOUNCE);
    this.jumpCutDone = !holdJump;
  }

  die() {
    this.dead = true;
    this.vx = 0;
    this.vy = -330;
  }

  updateDead(dt: number) {
    this.vy = Math.min(this.vy + GRAVITY_FALL * 0.6 * dt, MAX_FALL * 1.5);
    this.y += this.vy * dt;
  }

  update(dt: number, input: Input, world: World) {
    if (this.invuln > 0) this.invuln -= dt;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;

    const speed = Math.abs(this.vx);

    // 스프린트 차지: 풀스피드 달리기(방향 일치)를 지속하면 0.5초에 걸쳐 충전.
    // 공중에선 유지(점프로 안 끊김), 지상에서 조건이 깨지면 빠르게 소멸.
    const sprintCond =
      input.run && dir !== 0 && dir === Math.sign(this.vx) && speed >= RUN_MAX - 4;
    if (sprintCond) {
      this.sprint = Math.min(1, this.sprint + dt / SPRINT_CHARGE_TIME);
    } else if (this.grounded) {
      this.sprint = Math.max(0, this.sprint - dt / SPRINT_DECAY_TIME);
    }

    // 찬 만큼 최고속이 RUN_MAX → SPRINT_MAX 로 부드럽게 상승 (원작 대시 비율 +40%)
    const runMax = RUN_MAX + (SPRINT_MAX - RUN_MAX) * this.sprint;
    const max = input.run ? runMax : WALK_MAX;
    const groundAccel = ACCEL;

    this.skidding = false;
    const reversing = this.vx !== 0 && dir !== 0 && Math.sign(this.vx) !== dir;
    if (this.grounded) {
      if (dir === 0) {
        this.vx = approach(this.vx, 0, DECEL * dt);
        this.skidLatched = false;
      } else if (reversing && (this.skidLatched || speed > WALK_MAX + 4)) {
        // 달리기 중 반대 입력 → 스키드: 한번 시작되면 완전히 멈출 때까지 제동(보이게).
        // 멈춰서 vx=0이 되면 다음 프레임엔 reversing이 풀려 아래에서 반대로 가속.
        this.skidLatched = true;
        this.vx = approach(this.vx, 0, SKID_DECEL * dt);
        this.skidding = true;
      } else if (Math.abs(this.vx) <= max || reversing) {
        // 같은 방향 가속, 또는 저속에서의 즉각 방향 전환
        this.skidLatched = false;
        this.vx = approach(this.vx, dir * max, groundAccel * dt);
      }
    } else if (dir !== 0) {
      // 자유로운 공중 제어 (모던 방식): 반대로 꺾을 땐 강한 가속으로 즉시 전환
      const accel = reversing ? AIR_TURN_ACCEL : AIR_ACCEL;
      if (reversing || Math.abs(this.vx) <= max) {
        this.vx = approach(this.vx, dir * max, accel * dt);
      }
    }
    // 최고 속도 초과분(달리기 해제 등)은 부드럽게 감속
    if (Math.abs(this.vx) > max) this.vx = approach(this.vx, Math.sign(this.vx) * max, DECEL * dt);

    // 점프: 코요테 타임 + 점프 버퍼
    this.coyote = this.grounded ? COYOTE_TIME : this.coyote - dt;
    this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -(JUMP_VEL + (JUMP_SPEED_BONUS * Math.abs(this.vx)) / RUN_MAX);
      this.coyote = 0;
      this.jumpBuf = 0;
      this.grounded = false;
      this.jumpCutDone = false;
    }
    // 가변 점프: 상승 중 버튼을 떼면 상승을 컷
    if (!input.jump && this.vy < 0 && !this.jumpCutDone) {
      this.vy *= JUMP_CUT;
      this.jumpCutDone = true;
    }
    // 중력 (정점 부근에서는 에이펙스 모디파이어로 약화 → 체공감)
    let g = this.vy < 0 && input.jump && !this.jumpCutDone ? GRAVITY_RISE : GRAVITY_FALL;
    if (!this.grounded && Math.abs(this.vy) < APEX_WINDOW) g *= APEX_GRAVITY_MULT;
    this.vy = Math.min(this.vy + g * dt, MAX_FALL);

    if (moveX(this, world, dt)) this.vx = 0;
    const rising = this.vy < 0;
    const yBefore = this.y;
    const vyBefore = this.vy;
    const res = moveY(this, world, dt);
    this.grounded = res.ground;
    if (res.ceil) {
      // 코너 보정: 머리가 블록 모서리에 살짝 걸렸을 뿐이면 옆으로 밀어 통과시킨다.
      const nudge = rising ? this.cornerNudge(world, res.ceil.ty) : 0;
      if (nudge !== 0) {
        this.x += nudge;
        this.y = yBefore + vyBefore * dt; // 멈추지 않고 계속 상승
        this.vy = vyBefore;
      } else {
        world.bumpBlock(res.ceil.tx, res.ceil.ty);
      }
    }
  }

  /**
   * 상승 중 머리받기 시, 좌우로 최대 CORNER_CORRECT 픽셀 밀면 천장(headRow)을
   * 비껴갈 수 있는지 검사해 필요한 이동량(±px)을 반환. 불가하면 0.
   */
  private cornerNudge(world: World, headRow: number): number {
    const blockedAt = (x: number) => {
      const tx0 = Math.floor(x / TILE);
      const tx1 = Math.floor((x + this.w - 0.01) / TILE);
      for (let tx = tx0; tx <= tx1; tx++) if (isSolid(world.tileAt(tx, headRow))) return true;
      return false;
    };
    if (!blockedAt(this.x)) return 0;
    for (let d = 1; d <= CORNER_CORRECT; d++) {
      if (!blockedAt(this.x + d)) return d;
      if (!blockedAt(this.x - d)) return -d;
    }
    return 0;
  }
}

export type EnemyState = 'walk' | 'squash' | 'shell' | 'slide' | 'flip';

export class Enemy implements Body {
  w = 12;
  h = 12;
  vx = -28;
  vy = 0;
  state: EnemyState = 'walk';
  timer = 0;
  noHurt = 0; // 등껍질을 찬 직후 잠깐의 무해 시간
  dead = false;

  constructor(
    public kind: SpawnType,
    public x: number,
    public y: number,
  ) {
    if (kind === 'komang') this.h = 14;
  }

  get harmless(): boolean {
    return this.dead || this.state === 'squash' || this.state === 'flip';
  }

  update(dt: number, world: World) {
    if (this.noHurt > 0) this.noHurt -= dt;
    switch (this.state) {
      case 'walk':
      case 'slide': {
        this.vy = Math.min(this.vy + GRAVITY_FALL * dt, MAX_FALL);
        if (moveX(this, world, dt)) this.vx = -this.vx;
        moveY(this, world, dt);
        break;
      }
      case 'shell': {
        this.vx = 0;
        this.vy = Math.min(this.vy + GRAVITY_FALL * dt, MAX_FALL);
        moveY(this, world, dt);
        break;
      }
      case 'squash': {
        this.timer -= dt;
        if (this.timer <= 0) this.dead = true;
        break;
      }
      case 'flip': {
        // 충돌 무시하고 화면 밖으로 낙하
        this.vy += GRAVITY_FALL * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        break;
      }
    }
    if (this.y > ROWS * TILE + 48) this.dead = true;
  }

  /** px: 플레이어 중심 x (등껍질 차는 방향 결정용) */
  stomp(px: number) {
    if (this.kind === 'milk') {
      this.state = 'squash';
      this.timer = 0.45;
      this.y += this.h - 6;
      this.h = 6;
    } else {
      if (this.state === 'walk') {
        this.state = 'shell';
        this.y += this.h - 12;
        this.h = 12;
        this.vx = 0;
      } else if (this.state === 'slide') {
        this.state = 'shell';
        this.vx = 0;
      } else if (this.state === 'shell') {
        this.kick(px);
      }
    }
  }

  kick(px: number) {
    this.state = 'slide';
    this.vx = SHELL_SPEED * (px < this.x + this.w / 2 ? 1 : -1);
    this.noHurt = 0.25;
  }

  flipDie() {
    this.state = 'flip';
    this.vx = 40;
    this.vy = -200;
  }
}

/** 꿀단지 — 슈퍼버섯 포지션 파워업 */
export class HoneyPot implements Body {
  w = 12;
  h = 12;
  vx = 45;
  vy = -80; // 블록에서 살짝 튀어나오는 연출
  collected = false;

  constructor(
    public x: number,
    public y: number,
  ) {}

  update(dt: number, world: World) {
    this.vy = Math.min(this.vy + GRAVITY_FALL * dt, MAX_FALL);
    if (moveX(this, world, dt)) this.vx = -this.vx;
    moveY(this, world, dt);
  }
}
