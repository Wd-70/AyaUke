import { VIEW_W, VIEW_H, TILE, ROWS, STEP, GRAVITY_FALL, MAX_FALL, WALK_MAX } from './constants';
import { T, LevelData, Spawn, buildWorld11 } from './levels';
import { Player, Enemy, HoneyPot, World, Input, overlap, moveX, moveY } from './entities';
import { loadSheet, drawFrame, SpriteSheet } from './sprites';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface CheesePop {
  x: number;
  y: number;
  vy: number;
  life: number;
}

type GameState = 'title' | 'play' | 'clearAnim' | 'clear' | 'gameover';
type ClearPhase = 'slide' | 'walk' | 'tally';

export class Game implements World {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1; // 표시 해상도 / 내부 좌표(320×240) 배율
  private level!: LevelData;
  private player!: Player;
  private enemies: Enemy[] = [];
  private items: HoneyPot[] = [];
  private pops: CheesePop[] = [];
  private particles: Particle[] = [];
  private pending: Spawn[] = [];
  private camX = 0;
  private state: GameState = 'title';
  private score = 0;
  private cheese = 0;
  private lives = 3;
  private time = 0;
  private timeAcc = 0;
  private deathDelay = 0;
  private elapsed = 0;
  // 파워업/피격 변신 연출 (월드 전체 정지)
  private freeze = 0;
  private transform: 'grow' | 'shrink' | null = null;
  // 클리어 연출
  private clearPhase: ClearPhase = 'slide';
  private flagDrop = 0; // 깃발 하강 진행도 0~1
  private clearHidden = false; // 성에 들어가 플레이어 숨김
  private input: Input = { left: false, right: false, run: false, jump: false };
  private raf = 0;
  private last = 0;
  private acc = 0;
  // 플레이어 스프라이트(동작별) + 걷기/달리기 애니메이션 위상
  private spr: Record<string, SpriteSheet>;
  private walkPhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다');
    this.ctx = ctx;
    this.spr = {
      stand: loadSheet('stand'),
      walk: loadSheet('walk'),
      run: loadSheet('run'),
      prun: loadSheet('prun'),
      jump: loadSheet('jump'),
      skid: loadSheet('skid'),
      death: loadSheet('death'),
    };
    this.reset(true);
  }

  /**
   * 캔버스 내부 해상도를 표시 크기 × DPR로 맞춘다.
   * 텍스트·도형이 최종 해상도에서 래스터되므로 번짐 없이 또렷해진다.
   */
  setSize(cssWidth: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(VIEW_W, Math.floor(cssWidth * dpr));
    const h = Math.floor((w * VIEW_H) / VIEW_W);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scale = w / VIEW_W;
  }

  start() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ── World 구현 ──

  tileAt(tx: number, ty: number): T {
    if (ty < 0 || ty >= ROWS) return T.EMPTY;
    if (tx < 0 || tx >= this.level.width) return T.GROUND; // 좌우 경계 벽
    return this.level.tiles[ty * this.level.width + tx] as T;
  }

  bumpBlock(tx: number, ty: number) {
    const t = this.tileAt(tx, ty);
    if (t === T.Q_COIN) {
      this.setTile(tx, ty, T.USED);
      this.cheese += 1;
      this.score += 200;
      this.pops.push({ x: tx * TILE + 2, y: ty * TILE - 14, vy: -170, life: 0.5 });
    } else if (t === T.Q_POWER) {
      this.setTile(tx, ty, T.USED);
      this.items.push(new HoneyPot(tx * TILE + 2, ty * TILE - 14));
    } else if (t === T.BRICK && this.player.big) {
      this.setTile(tx, ty, T.EMPTY);
      this.score += 50;
      this.burst(tx * TILE + 8, ty * TILE + 8, '#c8581c');
    }
  }

  // ── 내부 로직 ──

  private setTile(tx: number, ty: number, t: T) {
    if (tx < 0 || tx >= this.level.width || ty < 0 || ty >= ROWS) return;
    this.level.tiles[ty * this.level.width + tx] = t;
  }

  private burst(x: number, y: number, color: string) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x,
        y,
        vx: (i % 2 === 0 ? -1 : 1) * (40 + Math.random() * 50),
        vy: -120 - Math.random() * 120,
        life: 0.7,
        color,
      });
    }
  }

  private reset(full: boolean) {
    this.level = buildWorld11();
    this.enemies = [];
    this.items = [];
    this.pops = [];
    this.particles = [];
    this.pending = [...this.level.spawns];
    this.player = new Player(this.level.playerStart.x, this.level.playerStart.y);
    this.camX = 0;
    this.time = this.level.timeLimit;
    this.timeAcc = 0;
    this.deathDelay = 0;
    this.freeze = 0;
    this.transform = null;
    this.clearPhase = 'slide';
    this.flagDrop = 0;
    this.clearHidden = false;
    if (full) {
      this.score = 0;
      this.cheese = 0;
      this.lives = 3;
    }
  }

  private onConfirm() {
    if (this.state === 'title') {
      this.reset(true);
      this.state = 'play';
    } else if (this.state === 'gameover' || this.state === 'clear') {
      this.state = 'title';
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(c)) {
      e.preventDefault();
    }
    switch (c) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyX':
        this.input.run = true;
        break;
      case 'Space':
      case 'KeyZ':
      case 'KeyK':
        this.input.jump = true;
        if (!e.repeat) {
          if (this.state === 'play') this.player.queueJump();
          else this.onConfirm();
        }
        break;
      case 'Enter':
        if (!e.repeat && this.state !== 'play') this.onConfirm();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyX':
        this.input.run = false;
        break;
      case 'Space':
      case 'KeyZ':
      case 'KeyK':
        this.input.jump = false;
        break;
    }
  };

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1; // 탭 비활성 등으로 인한 폭주 방지
    this.acc += dt;
    while (this.acc >= STEP) {
      this.update(STEP);
      this.acc -= STEP;
    }
    this.render();
  };

  private startDeath() {
    if (this.player.dead) return;
    this.player.die();
    this.deathDelay = 2.0;
  }

  private hurtPlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.dead || this.freeze > 0) return;
    if (p.big) {
      // 축소 변신 연출 (월드 정지)
      this.freeze = 0.8;
      this.transform = 'shrink';
    } else {
      this.startDeath();
    }
  }

  private update(dt: number) {
    this.elapsed += dt;

    // 변신 연출 중에는 월드 전체 정지 (원작 스타일)
    if (this.state === 'play' && this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0) {
        if (this.transform === 'grow') this.player.grow();
        else if (this.transform === 'shrink') this.player.shrink();
        this.transform = null;
      }
      return;
    }

    // 연출 오브젝트
    for (const pop of this.pops) {
      pop.y += pop.vy * dt;
      pop.vy += 900 * dt;
      pop.life -= dt;
    }
    this.pops = this.pops.filter((p) => p.life > 0);
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 700 * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.state === 'clearAnim') {
      this.updateClear(dt);
      return;
    }
    if (this.state !== 'play') return;
    const p = this.player;

    // 사망 연출 중
    if (p.dead) {
      p.updateDead(dt);
      this.deathDelay -= dt;
      if (this.deathDelay <= 0) {
        this.lives -= 1;
        if (this.lives <= 0) this.state = 'gameover';
        else this.reset(false);
      }
      return;
    }

    p.update(dt, this.input, this);

    // 걷기 애니메이션 위상 (지상에서 속도에 비례해 진행)
    // 걷기 ~4fps, 달리기 ~8fps — 프레임 변화가 눈에 보이는 속도
    if (p.grounded && Math.abs(p.vx) > 6) {
      this.walkPhase += Math.abs(p.vx) * dt * 0.045;
    } else if (p.grounded) {
      this.walkPhase = 0;
    }

    // 스프린트 풀차지 반짝이 (게이지 UI 대신 발밑 이펙트로만 표현)
    if (p.sprint >= 1 && p.grounded && Math.abs(p.vx) > WALK_MAX && Math.random() < 0.3) {
      this.particles.push({
        x: p.x + p.w / 2 - Math.sign(p.vx) * 5,
        y: p.y + p.h - 2,
        vx: -Math.sign(p.vx) * (20 + Math.random() * 30),
        vy: -30 - Math.random() * 50,
        life: 0.35,
        color: Math.random() < 0.5 ? '#fde68a' : '#ffffff',
      });
    }

    // 카메라 접근 시 적 활성화
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const s = this.pending[i];
      if (s.x * TILE < this.camX + VIEW_W + 64) {
        this.enemies.push(new Enemy(s.type, s.x * TILE + 2, s.y * TILE + 2));
        this.pending.splice(i, 1);
      }
    }

    for (const e of this.enemies) e.update(dt, this);
    for (const it of this.items) it.update(dt, this);

    // 아이템 획득
    for (const it of this.items) {
      if (!it.collected && overlap(p, it)) {
        it.collected = true;
        this.score += 1000;
        this.burst(it.x + 6, it.y + 6, '#f59e0b');
        if (!p.big) {
          // 성장 변신 연출 (월드 정지)
          this.freeze = 0.8;
          this.transform = 'grow';
        }
      }
    }
    this.items = this.items.filter((it) => !it.collected && it.y < ROWS * TILE + 48);

    // 플레이어 ↔ 적
    for (const e of this.enemies) {
      if (e.harmless || !overlap(p, e)) continue;
      const stomping = p.vy > 30 && p.y + p.h - e.y < 10;
      if (e.kind === 'komang' && e.state === 'shell' && !stomping) {
        // 멈춘 등껍질을 옆에서 차기
        e.kick(p.x + p.w / 2);
        this.score += 400;
        continue;
      }
      if (stomping) {
        e.stomp(p.x + p.w / 2);
        p.bounce(this.input.jump);
        this.score += e.kind === 'milk' ? 100 : 200;
      } else if (e.noHurt <= 0) {
        this.hurtPlayer();
      }
    }

    // 슬라이딩 등껍질 ↔ 다른 적
    for (const s of this.enemies) {
      if (s.state !== 'slide') continue;
      for (const e of this.enemies) {
        if (e === s || e.harmless || e.state === 'slide') continue;
        if (overlap(s, e)) {
          e.flipDie();
          this.score += 500;
          this.burst(e.x + 6, e.y + 6, '#fff');
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // 필드 치즈 획득
    {
      const tx0 = Math.floor(p.x / TILE);
      const tx1 = Math.floor((p.x + p.w) / TILE);
      const ty0 = Math.floor(p.y / TILE);
      const ty1 = Math.floor((p.y + p.h) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (this.tileAt(tx, ty) === T.CHEESE) {
            this.setTile(tx, ty, T.EMPTY);
            this.cheese += 1;
            this.score += 200;
            this.burst(tx * TILE + 8, ty * TILE + 8, '#fcd34d');
          }
        }
      }
    }

    // 낙사
    if (p.y > ROWS * TILE + 8) this.startDeath();

    // 타이머 (실시간 1초당 1 — 원작의 0.4s/1은 체감상 너무 빠름)
    this.timeAcc += dt;
    while (this.timeAcc >= 1.0) {
      this.timeAcc -= 1.0;
      if (this.time > 0) {
        this.time -= 1;
        if (this.time === 0) {
          this.startDeath();
          break;
        }
      }
    }

    // 골 깃대 → 클리어 연출 시작
    if (!p.dead && p.x + p.w / 2 >= this.level.flagX * TILE + 8) {
      this.state = 'clearAnim';
      this.clearPhase = 'slide';
      this.flagDrop = 0;
      p.x = this.level.flagX * TILE + 8 - p.w;
      p.vx = 0;
      p.vy = 0;
      // 잡은 높이에 따른 깃대 점수 (원작 스타일)
      const grabY = p.y;
      let pts = 100;
      if (grabY < 5 * TILE) pts = 5000;
      else if (grabY < 7 * TILE) pts = 2000;
      else if (grabY < 9 * TILE) pts = 800;
      else if (grabY < 11 * TILE) pts = 400;
      this.score += pts;
      return;
    }

    // 카메라 (자유 후방 스크롤 — 최신 시리즈 방식)
    this.updateCamera();
  }

  /** 클리어 연출: 깃대 슬라이드 → 깃발 하강 → 성까지 걷기 → 타임 정산 */
  private updateClear(dt: number) {
    const p = this.player;
    this.flagDrop = Math.min(1, this.flagDrop + dt / 0.9);
    if (this.clearPhase === 'slide') {
      p.y += 150 * dt;
      const standY = 12 * TILE - p.h; // 깃대 받침 블록 위
      if (p.y >= standY) {
        p.y = standY;
        if (this.flagDrop >= 1) {
          // 깃대에서 폴짝 뛰어내려 성으로
          this.clearPhase = 'walk';
          p.facing = 1;
          p.vx = 80;
          p.vy = -140;
        }
      }
    } else if (this.clearPhase === 'walk') {
      p.vy = Math.min(p.vy + GRAVITY_FALL * dt, MAX_FALL);
      moveX(p, this, dt);
      moveY(p, this, dt);
      if (p.x >= this.level.castleDoorX) {
        this.clearHidden = true;
        this.clearPhase = 'tally';
      }
    } else {
      // 남은 타임 → 점수 정산
      for (let i = 0; i < 3; i++) {
        if (this.time > 0) {
          this.time -= 1;
          this.score += 20;
        } else {
          this.state = 'clear';
          break;
        }
      }
    }
    this.updateCamera();
  }

  private updateCamera() {
    const p = this.player;
    const target = p.x + p.w / 2 - VIEW_W * 0.45;
    this.camX = Math.max(0, Math.min(target, this.level.width * TILE - VIEW_W));
  }

  // ── 렌더링 ──

  private render() {
    const { ctx } = this;
    // 내부 320×240 좌표계를 실제 해상도로 변환 — 텍스트가 또렷해지는 핵심
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const off = Math.floor(this.camX);

    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 타일
    const tx0 = Math.floor(off / TILE);
    const tx1 = Math.ceil((off + VIEW_W) / TILE);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tileAt(tx, ty);
        if (t !== T.EMPTY) this.drawTile(t, tx * TILE - off, ty * TILE, tx, ty);
      }
    }

    // 깃발 (클리어 시 하강)
    {
      const fx = this.level.flagX * TILE - off;
      if (fx > -24 && fx < VIEW_W + 24) {
        const topY = 3 * TILE + 2;
        const botY = 11 * TILE - 10;
        const fy = topY + (botY - topY) * this.flagDrop;
        ctx.fillStyle = '#e35874';
        ctx.beginPath();
        ctx.moveTo(fx + 7, fy);
        ctx.lineTo(fx - 4, fy + 4);
        ctx.lineTo(fx + 7, fy + 8);
        ctx.fill();
      }
    }

    // 연출/엔티티
    for (const pop of this.pops) this.drawCheese(pop.x - off, pop.y, 12);
    for (const it of this.items) this.drawHoneyPot(it.x - off, it.y);
    for (const e of this.enemies) {
      if (e.x + e.w > off - 16 && e.x < off + VIEW_W + 16) this.drawEnemy(e, off);
    }
    this.drawPlayer(off);
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.floor(pt.x - off), Math.floor(pt.y), 3, 3);
    }

    this.drawHud();

    if (this.state === 'title') {
      this.overlay([
        ['프로젝트 아이 팬게임', 10, '#ffd1e3'],
        ['슈퍼 허니즈', 22, '#ffffff'],
        ['', 10, '#fff'],
        ['←→ 이동 · Z/스페이스 점프 · X/Shift 달리기', 9, '#e5e7eb'],
        ['점프는 길게 누를수록 높이 올라가요!', 9, '#e5e7eb'],
        ['', 10, '#fff'],
        ['Z 또는 Enter 를 눌러 시작', 11, '#fde68a'],
        ['(개발 중 · 적과 아이템은 임시 그래픽)', 8, '#9ca3af'],
      ]);
    } else if (this.state === 'gameover') {
      this.overlay([
        ['GAME OVER', 20, '#f87171'],
        ['', 10, '#fff'],
        [`SCORE ${this.score}`, 11, '#ffffff'],
        ['Z 또는 Enter 로 타이틀', 9, '#e5e7eb'],
      ]);
    } else if (this.state === 'clear') {
      this.overlay([
        ['🧀 COURSE CLEAR! 🧀', 16, '#fde68a'],
        ['', 10, '#fff'],
        [`SCORE ${this.score}`, 12, '#ffffff'],
        [`치즈 ×${this.cheese}`, 10, '#fcd34d'],
        ['', 10, '#fff'],
        ['Z 또는 Enter 로 타이틀', 9, '#e5e7eb'],
      ]);
    }
  }

  private overlay(lines: Array<[string, number, string]>) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    let y = VIEW_H / 2 - lines.reduce((a, l) => a + l[1] + 6, 0) / 2 + 10;
    for (const [text, size, color] of lines) {
      if (text) {
        ctx.font = `bold ${size}px monospace`;
        ctx.fillStyle = color;
        ctx.fillText(text, VIEW_W / 2, y);
      }
      y += size + 6;
    }
    ctx.textAlign = 'left';
  }

  private drawHud() {
    const { ctx } = this;
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, VIEW_W, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SCORE ${String(this.score).padStart(6, '0')}`, 6, 10);
    ctx.fillText(`🧀×${this.cheese}`, 110, 10);
    ctx.fillText('1-1', 165, 10);
    ctx.fillText(`TIME ${String(this.time).padStart(3, '0')}`, 200, 10);
    ctx.fillText(`아야 ×${Math.max(this.lives, 0)}`, 268, 10);
  }

  private drawTile(t: T, x: number, y: number, tx: number, ty: number) {
    const { ctx } = this;
    switch (t) {
      case T.GROUND:
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#7a2e00';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        break;
      case T.BRICK:
        ctx.fillStyle = '#c8581c';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#6b2e0a';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + TILE, y + 8);
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 8, y + 8);
        ctx.stroke();
        break;
      case T.Q_COIN:
      case T.Q_POWER: {
        ctx.fillStyle = '#e8a200';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#7a4a00';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        ctx.fillStyle = '#7a4a00';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('?', x + 5, y + 12);
        break;
      }
      case T.USED:
        ctx.fillStyle = '#8a5a2a';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#5d3a18';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        break;
      case T.PIPE_TL:
      case T.PIPE_TR:
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(x - (t === T.PIPE_TL ? 2 : 0), y, TILE + 2, TILE);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x + (t === T.PIPE_TL ? 0 : 4), y + 2, 4, TILE - 4);
        ctx.strokeStyle = '#14532d';
        ctx.strokeRect(x + 0.5 - (t === T.PIPE_TL ? 2 : 0), y + 0.5, TILE + 1, TILE - 1);
        break;
      case T.PIPE_BL:
      case T.PIPE_BR:
        ctx.fillStyle = '#15803d';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x + (t === T.PIPE_BL ? 2 : 6), y, 3, TILE);
        break;
      case T.BLOCK:
        ctx.fillStyle = '#c87830';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#6b3a10';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        break;
      case T.POLE: {
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(x + 7, y, 2, TILE);
        if (this.tileAt(tx, ty - 1) !== T.POLE) {
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(x + 8, y - 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case T.CASTLE: {
        ctx.fillStyle = '#7c4a22';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#4a2a10';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        // 성 입구
        if (tx === 206 && ty >= 11) {
          ctx.fillStyle = '#1f130a';
          ctx.fillRect(x + 3, y + (ty === 11 ? 4 : 0), TILE - 6, TILE - (ty === 11 ? 4 : 0));
        }
        break;
      }
      case T.CHEESE: {
        const bob = Math.sin(this.elapsed * 5 + tx) * 1.5;
        this.drawCheese(x + 2, y + 3 + bob, 12);
        break;
      }
      default:
        break;
    }
  }

  private drawCheese(x: number, y: number, size: number) {
    const { ctx } = this;
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.moveTo(x, y + size - 2);
    ctx.lineTo(x + size, y + size - 2);
    ctx.lineTo(x + size, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x + size - 5, y + 3, 2, 2);
    ctx.fillRect(x + size - 9, y + size - 6, 2, 2);
  }

  private drawHoneyPot(x: number, y: number) {
    const { ctx } = this;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x, y + 3, 12, 9);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + 1, y, 10, 4);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x + 2, y + 5, 2, 4);
  }

  private drawEnemy(e: Enemy, off: number) {
    const { ctx } = this;
    const x = Math.floor(e.x - off);
    const y = Math.floor(e.y);
    if (e.kind === 'milk') {
      // 우유 (발 달린 우유팩)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x, y, e.w, e.h);
      ctx.strokeStyle = '#94a3b8';
      ctx.strokeRect(x + 0.5, y + 0.5, e.w - 1, e.h - 1);
      if (e.state !== 'squash') {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x, y, e.w, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 2, y + 6, 2, 2);
        ctx.fillRect(x + 8, y + 6, 2, 2);
        const step = Math.floor(this.elapsed * 8) % 2;
        ctx.fillRect(x + (step ? 0 : 2), y + e.h, 3, 2);
        ctx.fillRect(x + (step ? 9 : 7), y + e.h, 3, 2);
      }
    } else {
      // 꼬망이 (거북이)
      const shellOnly = e.state === 'shell' || e.state === 'slide' || e.state === 'flip';
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(x + e.w / 2, y + e.h - 5, 6, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x, y + e.h - 5, e.w, 4);
      ctx.strokeStyle = '#15803d';
      ctx.strokeRect(x + 0.5, y + e.h - 5.5, e.w - 1, 4);
      if (!shellOnly) {
        ctx.fillStyle = '#86efac';
        const hx = e.vx < 0 ? x - 3 : x + e.w - 3;
        ctx.fillRect(hx, y, 6, 6);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(e.vx < 0 ? hx + 1 : hx + 3, y + 2, 2, 2);
      }
    }
  }

  private drawPlayer(off: number) {
    if (this.clearHidden) return;
    const p = this.player;
    const transforming = this.freeze > 0 && this.transform !== null;
    if (!transforming && p.invuln > 0 && Math.floor(this.elapsed * 12) % 2 === 0) return;

    // 변신 연출: 크기를 빠르게 번갈아 보여줌
    let big = p.big;
    if (transforming) {
      const flip = Math.floor(this.elapsed * 12) % 2 === 0;
      big = this.transform === 'grow' ? flip : !flip;
    }
    const { ctx } = this;
    const footX = p.x + p.w / 2 - off;
    const footY = p.y + p.h;
    let faceLeft = p.facing < 0;

    // 상태별 스프라이트 선택 (로드 전에는 아래 도형 폴백)
    const drawH = big ? 30 : 22;
    const speed = Math.abs(p.vx);
    let sheet = this.spr.stand;
    let frame = 0;
    if (p.dead) {
      sheet = this.spr.death; // 정면 포즈 — 반전하지 않음
      faceLeft = false;
    } else if (!p.grounded) {
      sheet = this.spr.jump;
    } else if (p.skidding) {
      sheet = this.spr.skid;
    } else if (speed > 6) {
      // 걷기 / 달리기 / 전력질주(스프린트 풀차지 — SMB3처럼 양팔 벌림)
      if (p.sprint >= 1 && speed > WALK_MAX) sheet = this.spr.prun;
      else if (speed > WALK_MAX + 6) sheet = this.spr.run;
      else sheet = this.spr.walk;
      frame = Math.floor(this.walkPhase) % 4;
    }
    const drew = drawFrame(ctx, sheet, frame, footX, footY, drawH, faceLeft);

    if (!drew) {
      // ── 도형 폴백 ──
      const h = big ? 26 : 14;
      const x = Math.floor(footX - p.w / 2) - 1;
      const y = Math.floor(footY - h);
      const w = p.w + 2;
      if (big) {
        ctx.fillStyle = '#9b6bd3';
        ctx.fillRect(x, y, w, 8);
        ctx.fillStyle = '#ffe8d8';
        ctx.fillRect(x + 1, y + 5, w - 2, 8);
        ctx.fillStyle = '#e35874';
        ctx.fillRect(x, y + 13, w, h - 13);
      } else {
        ctx.fillStyle = '#9b6bd3';
        ctx.fillRect(x, y, w, 5);
        ctx.fillStyle = '#ffe8d8';
        ctx.fillRect(x + 1, y + 3, w - 2, 6);
        ctx.fillStyle = '#e35874';
        ctx.fillRect(x, y + 9, w, h - 9);
      }
      ctx.fillStyle = '#1e293b';
      const eyeY = y + (big ? 8 : 5);
      if (!faceLeft) {
        ctx.fillRect(x + w - 4, eyeY, 2, 2);
        ctx.fillRect(x + w - 8, eyeY, 2, 2);
      } else {
        ctx.fillRect(x + 2, eyeY, 2, 2);
        ctx.fillRect(x + 6, eyeY, 2, 2);
      }
    }

    // 스키드 먼지
    if (p.skidding && p.grounded) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const dustX = faceLeft ? footX - p.w / 2 - 3 : footX + p.w / 2 + 1;
      ctx.fillRect(dustX, footY - 3, 2, 2);
    }
  }
}
