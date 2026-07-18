'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  type MotionValue,
} from 'framer-motion';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import NoteParticles from './NoteParticles';
import LiveStatusPill from './LiveStatusPill';
import { useLiveStatus } from '@/hooks/useLiveStatus';

const CHZZK_LIVE = 'https://chzzk.naver.com/live/abe8aa82baf3d3ef54ad8468ee73e7fc';

const TAGS = ['노래방송', '게임방송', '저스트채팅', 'ISFP'];

const titleContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};
const titleWord = {
  hidden: { y: '110%', opacity: 0 },
  show: {
    y: '0%',
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 320, damping: 26 },
  },
};

/** 마우스 위치(−0.5~0.5)를 레이어별 배율로 매핑한 패럴랙스 X/Y */
function useParallax(mx: MotionValue<number>, my: MotionValue<number>, amount: number) {
  const x = useSpring(useTransform(mx, (v) => v * amount), { stiffness: 120, damping: 20 });
  const y = useSpring(useTransform(my, (v) => v * amount), { stiffness: 120, damping: 20 });
  return { x, y };
}

export default function HeroV2() {
  const reduce = useReducedMotion();
  // reduced-motion이면 타이틀 단어가 슬라이드업하지 않고 페이드만
  const wordVariants = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.01 } } }
    : titleWord;
  const sectionRef = useRef<HTMLElement>(null);
  const { data: live } = useLiveStatus();
  const isLive = !!live?.isLive;

  // 마우스 패럴랙스 + 커서 스포트라이트
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const cursorX = useMotionValue(-1000);
  const cursorY = useMotionValue(-1000);
  const onMouseMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const r = sectionRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
    cursorX.set(e.clientX - r.left);
    cursorY.set(e.clientY - r.top);
  };
  // 커서를 부드럽게 따라오는 브랜드 스포트라이트(중심을 커서에 맞추려 -320 오프셋)
  const spotX = useSpring(useTransform(cursorX, (v) => v - 320), { stiffness: 150, damping: 28 });
  const spotY = useSpring(useTransform(cursorY, (v) => v - 320), { stiffness: 150, damping: 28 });
  // 포트레이트는 커서 쪽으로 살짝 "고개를 돌리는" 3D 틸트 — 방문자를 바라보는 의도.
  const rotY = useSpring(useTransform(mx, (v) => (reduce ? 0 : v * 8)), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(my, (v) => (reduce ? 0 : v * -6)), { stiffness: 120, damping: 18 });
  // 배경은 반대로(앞으로 다가오는 캐릭터와 분리되는 깊이감) 커서를 따라간다.
  const bgBlob = useParallax(mx, my, reduce ? 0 : 30);

  // 스크롤 패럴랙스(아래로 내릴수록 캐릭터 살짝 위로+페이드)
  const { scrollY } = useScroll();
  const portraitY = useTransform(scrollY, [0, 500], [0, reduce ? 0 : -60]);
  const contentOpacity = useTransform(scrollY, [0, 360], [1, reduce ? 1 : 0.25]);

  return (
    <section
      ref={sectionRef}
      onMouseMove={onMouseMove}
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 pt-24 pb-16 sm:px-6"
    >
      {/* ── 배경 레이어 (옅은 브랜드 메시 + 미세 블롭 — 앰비언스는 음표/스포트라이트가 담당) ── */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-light-primary/8 via-transparent to-transparent dark:from-dark-primary/8" />
        <motion.div style={bgBlob} className="absolute inset-0">
          <div className="absolute -top-20 left-[12%] h-[34rem] w-[34rem] rounded-full bg-light-accent/15 blur-3xl dark:bg-dark-accent/8 animate-blob" />
          <div className="absolute bottom-[-6rem] right-[10%] h-[32rem] w-[32rem] rounded-full bg-light-purple/15 blur-3xl dark:bg-dark-secondary/8 animate-blob animation-delay-4000" />
        </motion.div>
        {/* 비네팅 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.06)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      {/* 커서를 따라오는 브랜드 스포트라이트 (인터랙티브 앰비언트 라이트).
          라이트/다크 분리 — 다크는 어두운 배경 위에서 좁아 보여 더 넓고 밝게. */}
      {!reduce && (
        <motion.div
          aria-hidden
          style={{ x: spotX, y: spotY }}
          className="pointer-events-none absolute left-0 top-0 z-[1] h-[640px] w-[640px]"
        >
          {/* 라이트 */}
          <div
            className="absolute inset-0 rounded-full dark:hidden"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(227,139,255,0.20), rgba(161,113,213,0.10) 38%, transparent 65%)',
            }}
          />
          {/* 다크 — 넓은 범위 유지 + 밝기는 중간값(0.26/0.14) */}
          <div
            className="absolute -inset-28 hidden rounded-full dark:block"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(227,139,255,0.26), rgba(152,117,187,0.14) 40%, transparent 78%)',
            }}
          />
        </motion.div>
      )}

      {/* 앰비언트 음표 필드 (깊이 패럴랙스) — 배경 위, 콘텐츠 아래 */}
      <div className="absolute inset-0 z-[5]">
        <NoteParticles mx={mx} my={my} />
      </div>

      <motion.div style={{ opacity: contentOpacity }} className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        {/* 라이브 상태 */}
        <div className="mb-7">
          <LiveStatusPill />
        </div>

        {/* 캐릭터 포트레이트 (시네마틱) — 커서를 향해 3D로 고개를 돌린다 */}
        <div className="relative mb-9 [perspective:900px]">
          <motion.div
            style={{ y: portraitY, rotateX: rotX, rotateY: rotY }}
            className="relative mx-auto h-56 w-56 [transform-style:preserve-3d] sm:h-72 sm:w-72"
          >
            {/* 회전하는 그라데이션 후광 */}
            <motion.div
              aria-hidden
              className="absolute -inset-6 rounded-full opacity-40 blur-2xl"
              style={{
                backgroundImage:
                  'conic-gradient(from 0deg, #E38BFF, #A171D5, #F9D891, #E38BFF)',
              }}
              animate={reduce ? {} : { rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-white/40 shadow-2xl backdrop-blur-sm dark:border-white/10">
              {/* LCP 이미지 — priority로 프리로드, next/image가 표시 크기로 리사이즈·최적화.
                  라이트/다크 둘 다 above-the-fold라 모두 priority. */}
              <Image
                src="/profile1.png"
                alt="아야 AyaUke"
                fill
                sizes="(min-width: 640px) 288px, 224px"
                priority
                className="object-cover dark:hidden"
              />
              <Image
                src="/profile2-large.png"
                alt="아야 AyaUke"
                fill
                sizes="(min-width: 640px) 288px, 224px"
                priority
                className="hidden object-cover dark:block"
                style={{ transform: 'scale(1.11) translate(-6px, 1px)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        {/* 키네틱 타이틀 */}
        <motion.h1
          variants={titleContainer}
          initial="hidden"
          animate="show"
          className="font-display break-keep text-5xl font-extrabold leading-[1.05] sm:text-7xl"
        >
          <span className="inline-block overflow-hidden align-bottom">
            <motion.span variants={wordVariants} className="inline-block bg-gradient-to-r from-light-title-1 via-light-title-2 to-light-title-3 bg-clip-text text-transparent dark:from-dark-accent dark:via-dark-secondary dark:to-dark-primary">
              아야
            </motion.span>
          </span>{' '}
          <span className="inline-block overflow-hidden align-bottom">
            <motion.span variants={wordVariants} className="inline-block text-light-text dark:text-dark-text">
              AyaUke
            </motion.span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.5 }}
          className="mt-5 max-w-2xl break-keep text-lg text-light-text/70 dark:text-dark-text/70 sm:text-xl"
        >
          허니즈의 메인보컬, 생활애교가 흘러넘치는 치지직의 분내담당
        </motion.p>

        {/* 태그 칩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.65 }}
          className="mt-6 flex flex-wrap justify-center gap-2"
        >
          {TAGS.map((t) => (
            <span
              key={t}
              className="rounded-full border border-light-primary/30 bg-light-primary/10 px-3 py-1 text-sm font-medium text-light-text/70 dark:border-dark-primary/30 dark:bg-dark-primary/15 dark:text-dark-text/70"
            >
              {t}
            </span>
          ))}
        </motion.div>

        {/* 듀얼 CTA (라이브 상태에 따라 1순위 변경) */}
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.8 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          {isLive ? (
            <>
              <a
                href={CHZZK_LIVE}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 rounded-2xl bg-red-500 px-9 py-4 text-lg font-bold text-white shadow-[0_10px_40px_-8px_rgba(239,68,68,0.7)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_50px_-8px_rgba(239,68,68,0.85)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent-deep dark:focus-visible:outline-dark-accent"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                지금 LIVE 보기
              </a>
              <Link
                href="/songbook"
                className="inline-flex items-center gap-2 rounded-2xl border border-light-primary/30 bg-white/40 px-8 py-4 text-lg font-semibold text-light-text backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent-deep dark:border-dark-primary/30 dark:bg-gray-800/40 dark:text-dark-text dark:hover:bg-gray-800/60 dark:focus-visible:outline-dark-accent"
              >
                <MusicalNoteIcon className="h-5 w-5" />
                노래책 둘러보기
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/songbook"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-9 py-4 text-lg font-bold text-white shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-purple-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent-deep dark:from-dark-primary dark:to-dark-secondary dark:hover:shadow-pink-glow dark:focus-visible:outline-dark-accent"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <MusicalNoteIcon className="relative h-5 w-5" />
                <span className="relative">노래책 둘러보기</span>
              </Link>
              <a
                href={CHZZK_LIVE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-light-primary/30 bg-white/40 px-8 py-4 text-lg font-semibold text-light-text backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent-deep dark:border-dark-primary/30 dark:bg-gray-800/40 dark:text-dark-text dark:hover:bg-gray-800/60 dark:focus-visible:outline-dark-accent"
              >
                방송 보러가기
              </a>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* 스크롤 유도 */}
      {!reduce && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 1.2 }, y: { duration: 1.8, repeat: Infinity } }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-light-text/40 dark:text-dark-text/40"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      )}
    </section>
  );
}
