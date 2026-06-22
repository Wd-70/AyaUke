'use client';

import { motion } from 'framer-motion';
import {
  MusicalNoteIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useReveal } from './useReveal';

const CARDS = [
  {
    icon: MusicalNoteIcon,
    title: '노래방송',
    desc: 'J-pop을 즐겨 부르며 폭발적인 가창력을 느낄 수 있어요. 노래를 좋아한다면 지나칠 수 없죠!',
  },
  {
    icon: BoltIcon,
    title: '게임방송',
    desc: '길찾기는 힘들어하지만 피지컬은 최상! (등장인물을 자주 죽이는 건 안비밀)',
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: '저스트채팅',
    desc: '시청자와의 소통을 소중히 여기는 아야와 함께 재미있는 대화를 나눠보세요.',
  },
];

export default function AboutSection() {
  const { reduce, reveal } = useReveal();

  // 카드 stagger 리빌 — reduced-motion이면 이동 없이 즉시
  const cardReveal = {
    hidden: { opacity: 0, y: reduce ? 0 : 28 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.12 },
    }),
  };

  return (
    <section className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          {...reveal()}
          className="mx-auto mb-16 max-w-3xl text-center"
        >
          <h2 className="font-display text-4xl font-bold sm:text-5xl">
            <span className="bg-gradient-to-r from-light-accent to-light-purple bg-clip-text text-transparent dark:from-dark-accent dark:to-dark-secondary">
              아야는 이런 스트리머
            </span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-light-text/65 dark:text-dark-text/65">
            시청자와의 소통을 소중히 여기는 허니즈의 막내,
            <br className="hidden sm:block" />
            생활애교가 흘러넘치는 치지직의 분내담당이자,
            <br className="hidden sm:block" />
            노래할 땐 완전히 다른 모습을 보여주는 허니즈의 메인보컬.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                custom={i}
                variants={cardReveal}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                className="group relative overflow-hidden rounded-3xl border border-light-primary/20 bg-white/55 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-light-accent/40 hover:shadow-purple-glow dark:border-dark-primary/20 dark:bg-gray-800/45 dark:hover:border-dark-accent/40 dark:hover:shadow-pink-glow"
              >
                {/* 호버 시 떠오르는 배경 글로우 */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-light-accent/20 to-light-purple/20 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 dark:from-dark-accent/20 dark:to-dark-secondary/20" />
                <div className="relative">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-light-accent to-light-purple text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 dark:from-dark-primary dark:to-dark-secondary">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-light-text dark:text-dark-text">
                    {card.title}
                  </h3>
                  <p className="leading-relaxed text-light-text/60 dark:text-dark-text/60">
                    {card.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
