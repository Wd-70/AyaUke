import { ROWS } from './constants';

// 타일 종류
export enum T {
  EMPTY = 0,
  GROUND,
  BRICK,
  Q_COIN, // ?블록 (치즈)
  Q_POWER, // ?블록 (꿀단지)
  USED,
  PIPE_TL,
  PIPE_TR,
  PIPE_BL,
  PIPE_BR,
  BLOCK, // 계단 블록
  POLE, // 골 깃대
  CHEESE, // 필드 치즈 (코인)
  CASTLE, // 골 성 (장식 — 통과 가능)
}

export function isSolid(t: T): boolean {
  return (
    t === T.GROUND ||
    t === T.BRICK ||
    t === T.Q_COIN ||
    t === T.Q_POWER ||
    t === T.USED ||
    t === T.PIPE_TL ||
    t === T.PIPE_TR ||
    t === T.PIPE_BL ||
    t === T.PIPE_BR ||
    t === T.BLOCK
  );
}

export type SpawnType = 'milk' | 'komang'; // 우유(굼바) / 꼬망이(엉금엉금)

export interface Spawn {
  type: SpawnType;
  x: number; // 타일 좌표
  y: number;
}

export interface LevelData {
  width: number; // 타일 단위
  tiles: Uint8Array; // width * ROWS
  spawns: Spawn[];
  flagX: number; // 깃대 타일 x
  castleDoorX: number; // 클리어 연출에서 플레이어가 사라지는 지점 (px)
  playerStart: { x: number; y: number }; // 픽셀 좌표
  timeLimit: number;
}

/**
 * 월드 1-1 (마리오 1 근사 재현).
 * 정확한 원본 좌표와는 약간 다를 수 있음 — 추후 충실도 보정 패스 예정.
 */
export function buildWorld11(): LevelData {
  const W = 212;
  const tiles = new Uint8Array(W * ROWS);

  const set = (x: number, y: number, t: T) => {
    if (x >= 0 && x < W && y >= 0 && y < ROWS) tiles[y * W + x] = t;
  };
  const ground = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x++) {
      set(x, 13, T.GROUND);
      set(x, 14, T.GROUND);
    }
  };
  const brickRow = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) set(x, y, T.BRICK);
  };
  const pipe = (x: number, h: number) => {
    const top = 13 - h;
    set(x, top, T.PIPE_TL);
    set(x + 1, top, T.PIPE_TR);
    for (let y = top + 1; y < 13; y++) {
      set(x, y, T.PIPE_BL);
      set(x + 1, y, T.PIPE_BR);
    }
  };
  const stairUp = (x0: number, h: number) => {
    for (let i = 0; i < h; i++) for (let j = 0; j <= i; j++) set(x0 + i, 12 - j, T.BLOCK);
  };
  const stairDown = (x0: number, h: number) => {
    for (let i = 0; i < h; i++) for (let j = 0; j < h - i; j++) set(x0 + i, 12 - j, T.BLOCK);
  };

  // 지형 (구덩이: 69-70, 86-88, 153-154)
  ground(0, 68);
  ground(71, 85);
  ground(89, 152);
  ground(155, W - 1);

  // 도입부 ?블록 구간
  set(16, 9, T.Q_COIN);
  set(20, 9, T.BRICK);
  set(21, 9, T.Q_POWER);
  set(22, 9, T.BRICK);
  set(23, 9, T.Q_COIN);
  set(24, 9, T.BRICK);
  set(22, 5, T.Q_COIN);

  // 파이프 4개
  pipe(28, 2);
  pipe(38, 3);
  pipe(46, 4);
  pipe(57, 4);

  // 첫 구덩이 다음 브릭 구간
  set(77, 9, T.BRICK);
  set(78, 9, T.Q_POWER);
  set(79, 9, T.BRICK);
  brickRow(80, 87, 5);

  // 중반부
  brickRow(91, 93, 5);
  set(94, 5, T.Q_COIN);
  set(94, 9, T.BRICK);
  set(100, 9, T.BRICK);
  set(101, 9, T.BRICK);
  set(106, 9, T.Q_COIN);
  set(109, 9, T.Q_COIN);
  set(112, 9, T.Q_COIN);
  set(109, 5, T.Q_POWER);
  set(118, 9, T.BRICK);
  brickRow(121, 123, 5);

  // 계단 구간
  stairUp(134, 4);
  stairDown(140, 4);
  stairUp(148, 4);
  for (let j = 0; j < 4; j++) set(152, 12 - j, T.BLOCK); // 구덩이 앞 2칸 폭 정상
  stairDown(155, 4);

  // 후반 파이프 + 마지막 계단
  pipe(163, 2);
  set(168, 9, T.BRICK);
  set(169, 9, T.Q_COIN);
  set(170, 9, T.BRICK);
  pipe(179, 2);
  stairUp(181, 8);
  for (let j = 0; j < 8; j++) set(189, 12 - j, T.BLOCK); // 정상 2칸 폭

  // 골 깃대
  const flagX = 198;
  set(flagX, 12, T.BLOCK);
  for (let y = 3; y < 12; y++) set(flagX, y, T.POLE);

  // 골 성 (장식 타일 — 클리어 연출에서 걸어 들어감)
  for (let x = 203; x <= 209; x++) set(x, 12, T.CASTLE);
  for (let x = 204; x <= 208; x++) set(x, 11, T.CASTLE);
  for (let x = 205; x <= 207; x++) set(x, 10, T.CASTLE);
  set(206, 9, T.CASTLE);

  // 필드 치즈
  const cheese: Array<[number, number]> = [
    [32, 9], [33, 9], [34, 9],
    [69, 9], [70, 9],
    [81, 2], [83, 2], [85, 2],
    [153, 9], [154, 9],
    [191, 4], [192, 4], [193, 4],
  ];
  for (const [x, y] of cheese) set(x, y, T.CHEESE);

  // 적 배치
  const spawns: Spawn[] = [
    { type: 'milk', x: 22, y: 12 },
    { type: 'milk', x: 40, y: 12 },
    { type: 'milk', x: 51, y: 12 },
    { type: 'milk', x: 53, y: 12 },
    { type: 'milk', x: 80, y: 12 },
    { type: 'milk', x: 82, y: 12 },
    { type: 'milk', x: 97, y: 12 },
    { type: 'milk', x: 99, y: 12 },
    { type: 'komang', x: 107, y: 12 },
    { type: 'milk', x: 114, y: 12 },
    { type: 'milk', x: 116, y: 12 },
    { type: 'milk', x: 124, y: 12 },
    { type: 'milk', x: 126, y: 12 },
    { type: 'milk', x: 170, y: 12 },
    { type: 'komang', x: 175, y: 12 },
  ];

  return {
    width: W,
    tiles,
    spawns,
    flagX,
    castleDoorX: 206 * 16,
    playerStart: { x: 40, y: 13 * 16 - 14 },
    timeLimit: 300,
  };
}
