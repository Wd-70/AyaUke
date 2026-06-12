// 화면/타일 기본 단위
export const TILE = 16;
export const VIEW_W = 320;
export const VIEW_H = 240;
export const ROWS = 15;
export const STEP = 1 / 60; // 고정 타임스텝

// ── 플레이어 물리 (px/s 기준) ──
// 모던 플랫포머(셀레스트/모던 마리오) 기준의 "즉답형" 튜닝.
// 핵심: 가속·제동 거리가 짧아 입력 즉시 반응 → 미끄럽거나 무거운 느낌 제거.
// (SMB3식 P게이지 시스템은 조작감을 해쳐서 제거했음)
export const WALK_MAX = 96;
export const RUN_MAX = 175; // 달리기 기본 최고속 (여기까지는 0.15초 만에 즉답 도달)
export const ACCEL = 1200; // 0→걷기 0.08s, 0→달리기 0.15s — 즉답
export const DECEL = 1500; // 키를 떼면 ~0.1s 내 정지 — 미끄럼 제거

// 스프린트(2단 가속): 풀스피드 달리기를 지속하면 최고속이 상승.
// SMB3→NSMB로 이어지는 시리즈 전통(P대시/전력질주). 원작 SMB3의
// 걷기:달리기:대시 = 0x18:0x28:0x38 = 3:5:7 비율을 따라 대시 = 달리기 ×7/5 (+40%).
// 기본 즉답성은 그대로 두고, "계속 달리면 더 빨라진다"는 고점만 얹는다.
// 게이지 UI 없음. 풀충전 시 양팔 벌린 전력질주 모션(prun) + 반짝이로만 표현.
export const SPRINT_MAX = 245; // RUN_MAX(175) × 7/5 — SMB3 원작 대시 비율
export const SPRINT_CHARGE_TIME = 0.5; // 달리기 최고속 도달 후 → 스프린트까지 (체감 ~1초)
export const SPRINT_DECAY_TIME = 0.35; // 지상에서 조건이 깨지면 빠르게 소멸 (공중에선 유지)

// 공중 제어 (모던 방식: 자유로운 방향 전환)
export const AIR_ACCEL = 1000;
export const AIR_TURN_ACCEL = 2000; // 공중 반대 전환은 더욱 즉각적으로

// 스키드(달리기 중 반대 입력): 래치되어 완전히 멈출 때까지 제동 후 반전.
// 일반 제동보다 약해 "끼익-" 하는 모션이 보이는 구간을 만든다 (~0.25s).
export const SKID_DECEL = 700;

// 에이펙스 모디파이어: 점프 정점(수직속도 ≈ 0) 부근에서 중력을 줄여 체공감 부여
export const APEX_WINDOW = 46; // |vy| 가 이 값 이하이면 정점 부근
export const APEX_GRAVITY_MULT = 0.5;

// 코너 보정: 상승 중 블록 모서리에 머리가 살짝 걸리면 옆으로 밀어 통과시킴
export const CORNER_CORRECT = 5; // 최대 보정 픽셀

export const GRAVITY_RISE = 1250; // 점프 버튼 유지 + 상승 중 — 가볍고 빠른 상승
export const GRAVITY_FALL = 2900; // 그 외 — 빠른 낙하가 최신 조작감의 핵심
export const MAX_FALL = 300;
export const JUMP_VEL = 408;
export const JUMP_SPEED_BONUS = 48; // 달리기 속도에 비례한 추가 점프력
export const JUMP_CUT = 0.45; // 버튼을 떼는 순간 상승 속도 컷 비율
export const COYOTE_TIME = 0.08; // 발판에서 떨어진 뒤에도 점프 허용
export const JUMP_BUFFER = 0.12; // 착지 직전 점프 입력 기억

export const STOMP_BOUNCE = 245; // 적 밟기 반동
export const STOMP_BOUNCE_HOLD = 392; // 점프 버튼 누른 채 밟으면 높은 반동

export const SHELL_SPEED = 230; // 꼬망이 등껍질 슬라이드 속도
