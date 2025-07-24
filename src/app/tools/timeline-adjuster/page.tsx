import TimelineAdjusterClient from './TimelineAdjusterClient';

export const metadata = {
  title: '타임라인 조정 도구 - 아야 팬사이트',
  description: '치지직과 유튜브 다시보기 영상의 시간 차이를 보정하는 도구입니다.',
};

export default function TimelineAdjusterPage() {
  return <TimelineAdjusterClient />;
}