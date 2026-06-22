'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  animate,
  useInView,
  useReducedMotion,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import {
  MusicalNoteIcon,
  FilmIcon,
  VideoCameraIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useLandingStats } from '@/hooks/useLandingStats';
import { useFollowerCount } from '@/hooks/useFollowerCount';

// 활동 기간 기준일
const DEBUT = new Date('2024-01-21T00:00:00+09:00'); // 실제 데뷔일
const HONEYCHURROS = new Date('2023-09-17T00:00:00+09:00'); // 허니츄러스 방송 첫 등장

function diffYMD(from: Date, to: Date) {
  let y = to.getFullYear() - from.getFullYear();
  let m = to.getMonth() - from.getMonth();
  let d = to.getDate() - from.getDate();
  if (d < 0) {
    m -= 1;
    d += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  const totalDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  return { y, m, d, totalDays };
}

/** "2년 5개월" — 0인 단위(개월/일)는 생략 */
function fmtYMD({ y, m, d }: { y: number; m: number; d: number }) {
  const parts: string[] = [];
  if (y) parts.push(`${y}년`);
  if (m) parts.push(`${m}개월`);
  if (d) parts.push(`${d}일`);
  return parts.length ? parts.join(' ') : '0일';
}

function CountUp({ value, inView }: { value: number; inView: boolean }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  // 폴링으로 값이 갱신될 때 0부터가 아니라 직전 표시값에서 이어지도록
  const fromRef = useRef(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setN(value);
      fromRef.current = value;
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration: 1.6,
      ease: 'easeOut',
      onUpdate: (v) => {
        const f = Math.floor(v);
        setN(f);
        fromRef.current = f;
      },
    });
    return () => controls.stop();
  }, [inView, value, reduce]);
  return <>{n.toLocaleString()}</>;
}

const ITEMS = [
  { key: 'songCount' as const, label: '노래책 수록곡', icon: MusicalNoteIcon, suffix: '곡' },
  { key: 'clipCount' as const, label: '라이브 클립', icon: FilmIcon, suffix: '개' },
  { key: 'vodCount' as const, label: '다시보기', icon: VideoCameraIcon, suffix: '개' },
  { key: 'totalLiveHours' as const, label: '치지직 누적 방송시간', icon: ClockIcon, suffix: '시간' },
  { key: 'followerCount' as const, label: '치지직 팔로워', icon: UserGroupIcon, suffix: '명' },
];

type YMD = { y: number; m: number; d: number; totalDays: number };

/**
 * 활동 기간 플립 카드. 회전을 모션값으로 직접 구동해 각도를 추적하고,
 * 90°(edge-on)에 가까워질수록 테두리 강조 링이 또렷해지게 한다.
 */
function PeriodFlipCard({
  debut,
  honey,
  delay,
}: {
  debut: YMD;
  honey: YMD;
  delay: number;
}) {
  const reduce = useReducedMotion();
  const rotate = useMotionValue(0);
  // 0(정면) → 1(90°, 모서리). 가장 가까운 정면(0/180/360)으로부터의 거리.
  const edge = useTransform(rotate, (r) => {
    const a = ((r % 360) + 360) % 360;
    const dist = Math.min(a, Math.abs(a - 180), 360 - a);
    return Math.min(dist / 90, 1);
  });
  // 정면 근처에선 잠잠하다가 90°로 갈수록 빠르게 또렷해지도록 가속
  const ringOpacity = useTransform(edge, (e) => Math.pow(e, 1.4));

  const flipTo = (deg: number) => {
    if (reduce) {
      rotate.set(deg);
      return;
    }
    animate(rotate, deg, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay }}
      onHoverStart={() => flipTo(180)}
      onHoverEnd={() => flipTo(0)}
      className="group/flip relative [perspective:1600px]"
    >
      <motion.div
        style={{ rotateY: rotate }}
        className="relative h-full min-h-[212px] w-full [transform-style:preserve-3d]"
      >
        {/* 앞면 — 데뷔 기준. 정지 시엔 다른 카드와 동일한 base, 회전(호버) 시엔 불투명+그림자로
            떠올라 실루엣이 또렷하게 읽히도록 한다. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-light-primary/30 bg-white/60 p-6 text-center shadow-lg shadow-light-primary/10 backdrop-blur-sm transition-[border-color,box-shadow] duration-300 [backface-visibility:hidden] group-hover/flip:border-light-accent/40 group-hover/flip:bg-white group-hover/flip:backdrop-blur-none group-hover/flip:shadow-2xl dark:border-dark-primary/25 dark:bg-gray-800/40 dark:shadow-black/20 dark:group-hover/flip:border-dark-accent/40 dark:group-hover/flip:bg-gray-800 dark:group-hover/flip:shadow-pink-glow">
          <ArrowPathIcon className="absolute right-4 top-4 h-4 w-4 text-light-text/25 dark:text-dark-text/30" />
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-light-accent to-light-purple text-white shadow-lg dark:from-dark-primary dark:to-dark-secondary">
            <CalendarDaysIcon className="h-6 w-6" />
          </div>
          <div className="font-display text-2xl font-extrabold tracking-tight text-light-text dark:text-dark-text sm:text-3xl">
            {fmtYMD(debut)}
          </div>
          <div className="mt-1.5 text-base font-bold text-light-accent dark:text-dark-accent">
            총 {debut.totalDays.toLocaleString()}일
          </div>
          <div className="mt-2 text-xs font-medium text-light-text/55 dark:text-dark-text/55">
            2024.01.21 데뷔 · 활동 기간
          </div>
          {/* 90°로 갈수록 또렷해지는 강조 테두리 */}
          <motion.div
            style={{ opacity: ringOpacity }}
            className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-light-accent dark:border-dark-accent"
          />
        </div>

        {/* 뒷면 — 허니츄러스 첫 등장 기준 (그라데이션 필) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-light-accent to-light-purple p-6 text-center text-white shadow-xl transition-shadow duration-300 [backface-visibility:hidden] [transform:rotateY(180deg)] group-hover/flip:shadow-purple-glow dark:from-dark-primary dark:to-dark-secondary dark:group-hover/flip:shadow-pink-glow">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <span className="absolute left-4 top-4 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
            그 시작
          </span>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm">
            <SparklesIcon className="h-6 w-6" />
          </div>
          <div className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {fmtYMD(honey)}
          </div>
          <div className="mt-1.5 text-base font-bold text-white/90">
            총 {honey.totalDays.toLocaleString()}일
          </div>
          <div className="mt-2 text-xs font-medium text-white/80">
            2023.09.17 허니츄러스 방송에 첫 등장
          </div>
          {/* 90°로 갈수록 또렷해지는 강조 테두리 */}
          <motion.div
            style={{ opacity: ringOpacity }}
            className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-white/80"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function NumbersSection() {
  const { data } = useLandingStats();
  // 팔로워만 1분 폴링으로 실시간성 부여 (나머지는 5분 캐시 유지)
  const { data: liveFollower } = useFollowerCount();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const debut = diffYMD(DEBUT, new Date());
  const honey = diffYMD(HONEYCHURROS, new Date());

  return (
    <section className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="font-display text-4xl font-bold sm:text-5xl">
            <span className="bg-gradient-to-r from-light-accent to-light-purple bg-clip-text text-transparent dark:from-dark-accent dark:to-dark-secondary">
              아야의 발자취
            </span>
          </h2>
          <p className="mt-4 text-lg text-light-text/60 dark:text-dark-text/60">
            노래와 방송으로 채워온 시간들
          </p>
        </motion.div>

        <div ref={ref} className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          {ITEMS.map((item, i) => {
            const value =
              item.key === 'followerCount'
                ? liveFollower ?? data?.followerCount ?? 0
                : data?.[item.key] ?? 0;
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-light-primary/30 bg-white/60 p-8 text-center shadow-lg shadow-light-primary/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-light-accent/40 hover:shadow-purple-glow dark:border-dark-primary/25 dark:bg-gray-800/40 dark:shadow-black/20 dark:hover:border-dark-accent/40 dark:hover:shadow-pink-glow"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-light-accent to-light-purple text-white shadow-lg dark:from-dark-primary dark:to-dark-secondary">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="font-display text-4xl font-extrabold tracking-tight text-light-text dark:text-dark-text sm:text-5xl">
                  <CountUp value={value} inView={inView} />
                  <span className="ml-1 text-xl font-bold text-light-accent dark:text-dark-accent">
                    {item.suffix}
                  </span>
                </div>
                <div className="mt-3 text-sm font-medium text-light-text/60 dark:text-dark-text/60">
                  {item.label}
                </div>
              </motion.div>
            );
          })}

          {/* 활동 기간 — 호버 시 뒤집혀 허니츄러스 첫 등장 기준으로 전환 */}
          <PeriodFlipCard debut={debut} honey={honey} delay={ITEMS.length * 0.08} />
        </div>
      </div>
    </section>
  );
}
