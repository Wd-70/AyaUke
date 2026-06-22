// (HeroV2(client)에서만 사용 — 별도 'use client' 불필요. MotionValue prop 직렬화 경고 회피)
import { useMemo } from 'react';
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

const NOTES = ['♪', '♫', '♬', '♩'];

function rngFrom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

interface Floaty {
  left: number;
  top: number;
  size: number;
  bob: number;
  delay: number;
  dur: number;
  char: string;
  rot: number;
}

function makeFloaty(seed: number, count: number, sizeMin: number, sizeRange: number): Floaty[] {
  const rnd = rngFrom(seed);
  return Array.from({ length: count }, () => ({
    left: 3 + rnd() * 94,
    top: 6 + rnd() * 84,
    size: sizeMin + rnd() * sizeRange,
    bob: 10 + rnd() * 18,
    delay: rnd() * 4,
    dur: 5 + rnd() * 4,
    char: NOTES[Math.floor(rnd() * NOTES.length)],
    rot: 5 + rnd() * 7,
  }));
}

/** 부유(floating) 깊이 계층 — 자체 마우스 패럴랙스 + 제자리 부유 */
function FloatTier({
  mx,
  my,
  parallax,
  opacity,
  blurPx,
  particles,
  reduce,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  parallax: number;
  opacity: number;
  blurPx: number;
  particles: Floaty[];
  reduce: boolean;
}) {
  const x = useSpring(useTransform(mx, (v) => (reduce ? 0 : v * parallax)), { stiffness: 70, damping: 20 });
  const y = useSpring(useTransform(my, (v) => (reduce ? 0 : v * parallax)), { stiffness: 70, damping: 20 });
  return (
    <motion.div
      style={{ x, y, opacity, filter: blurPx ? `blur(${blurPx}px)` : undefined }}
      className="absolute inset-0 text-light-accent dark:text-dark-accent"
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute select-none font-bold"
          style={{ left: `${p.left}%`, top: `${p.top}%`, fontSize: p.size }}
          animate={reduce ? {} : { y: [-p.bob, p.bob, -p.bob], rotate: [-p.rot, p.rot, -p.rot] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {p.char}
        </motion.span>
      ))}
    </motion.div>
  );
}

/** 상승(rising) 레이어 — 아래에서 떠올라 페이드아웃(루프 이음새 마스킹) */
function RisingLayer({ reduce }: { reduce: boolean }) {
  const notes = useMemo(() => {
    const rnd = rngFrom(7777);
    return Array.from({ length: 12 }, () => ({
      left: 4 + rnd() * 92,
      size: 16 + rnd() * 22,
      dur: 13 + rnd() * 9,
      delay: rnd() * 14, // 위상 분산 — 항상 몇 개가 떠 있도록
      drift: (rnd() - 0.5) * 70,
      peak: 0.16 + rnd() * 0.12,
      char: NOTES[Math.floor(rnd() * NOTES.length)],
    }));
  }, []);

  if (reduce) return null;

  return (
    <div className="absolute inset-0 text-light-accent dark:text-dark-accent">
      {notes.map((p, i) => (
        <motion.span
          key={i}
          className="absolute bottom-[-8%] select-none font-bold"
          style={{ left: `${p.left}%`, fontSize: p.size }}
          initial={{ y: 0, x: 0, opacity: 0, rotate: -8 }}
          animate={{ y: '-118vh', x: p.drift, opacity: [0, p.peak, p.peak, 0], rotate: 8 }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
            opacity: { duration: p.dur, delay: p.delay, repeat: Infinity, times: [0, 0.15, 0.8, 1] },
          }}
        >
          {p.char}
        </motion.span>
      ))}
    </div>
  );
}

/**
 * 히어로 앰비언트 음표 — 은은한 부유 깊이 필드(마우스 패럴랙스) + 천천히 떠오르는 상승 레이어.
 * 기존 정적 블롭 라이트를 대체하는 분위기 레이어.
 */
export default function NoteParticles({ mx, my }: { mx: MotionValue<number>; my: MotionValue<number> }) {
  const reduce = useReducedMotion() ?? false;

  const far = useMemo(() => makeFloaty(1111, 4, 44, 30), []);
  const mid = useMemo(() => makeFloaty(2222, 4, 26, 18), []);
  const near = useMemo(() => makeFloaty(3333, 4, 16, 12), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <FloatTier mx={mx} my={my} parallax={9} opacity={0.08} blurPx={2} particles={far} reduce={reduce} />
      <FloatTier mx={mx} my={my} parallax={20} opacity={0.14} blurPx={0.6} particles={mid} reduce={reduce} />
      <FloatTier mx={mx} my={my} parallax={34} opacity={0.24} blurPx={0} particles={near} reduce={reduce} />
      <RisingLayer reduce={reduce} />
    </div>
  );
}
