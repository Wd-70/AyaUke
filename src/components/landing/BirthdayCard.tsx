'use client';

import { useEffect, useState } from 'react';
import { CakeIcon } from '@heroicons/react/24/outline';

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function daysUntilBirthday(now: number) {
  // KST 날짜를 UTC 달력 값으로 바꾸어 방문자의 시간대와 무관하게 계산한다.
  const kst = new Date(now + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const today = Date.UTC(year, kst.getUTCMonth(), kst.getUTCDate());
  const birthday = Date.UTC(year, 3, 13);
  const nextBirthday = birthday < today ? Date.UTC(year + 1, 3, 13) : birthday;
  return (nextBirthday - today) / DAY_MS;
}

export default function BirthdayCard() {
  // 서버와 최초 클라이언트 렌더는 고정 문구로 맞춘다.
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = Date.now();
      setDays(daysUntilBirthday(now));
      const untilMidnight = DAY_MS - ((now + KST_OFFSET_MS) % DAY_MS);
      timer = setTimeout(update, untilMidnight);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') update();
    };
    update();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-5 rounded-3xl border border-light-primary/20 bg-light-primary/10 px-6 py-6 sm:flex-row sm:justify-between dark:border-dark-primary/20 dark:bg-dark-primary/10">
      <div className="flex items-center gap-4 text-left">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-light-primary/20 text-light-accent-deep dark:bg-dark-primary/20 dark:text-dark-accent">
          <CakeIcon aria-hidden="true" className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xs font-semibold tracking-widest text-light-accent-deep dark:text-dark-accent">생일 · BIRTHDAY</h3>
          <time dateTime="2003-04-13" className="mt-1 block">
            <span className="block font-display text-3xl font-bold tracking-tight text-light-text dark:text-dark-text">4월 13일</span>
            <span className="mt-1 block text-sm text-light-text/70 dark:text-dark-text/70">2003년생</span>
          </time>
        </div>
      </div>
      <p aria-live="polite" aria-atomic="true" className="max-w-48 break-keep text-sm font-medium text-light-text/70 sm:text-right dark:text-dark-text/70">
        {days === null ? '매년 함께 축하하는 날' : days === 0 ? (
          <>오늘은 아야의 생일이에요 <span aria-hidden="true">🎉</span></>
        ) : (
          <>
            <span className="block">다음 생일까지</span>
            <span className="mt-1 block text-xl font-bold tabular-nums text-light-accent-deep dark:text-dark-accent" aria-label={`${days}일 남음`}>D-{days}</span>
          </>
        )}
      </p>
    </div>
  );
}
