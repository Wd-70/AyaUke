import { Metadata } from 'next';
import SuggestionsClient from './SuggestionsClient';

export const metadata: Metadata = {
  title: "아야 AyaUke - 노래 추천소",
  description: "시청자들이 함께 만들어가는 노래 추천 공간입니다. 원하는 노래를 추천하고, 다른 시청자들과 함께 곡 정보를 완성해보세요.",
};

// 페이지 캐싱 비활성화 (실시간 추천 데이터)
export const revalidate = 0;

export default async function SuggestionsPage() {
  return <SuggestionsClient />;
}