import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import RangeTimeline from './RangeTimeline';

it('편집 재생바는 원본 절대 시각을 노출하지 않고 상대 좌표를 사용한다', () => {
  const html = renderToStaticMarkup(React.createElement(RangeTimeline, {
    start: 28_785, end: 29_015, range: { startTime: 28_800, endTime: 28_980 }, current: 28_799,
    timeOrigin: 28_800, disabled: false, onSeek: () => {},
  }));
  expect(html).toContain('min="-15"');
  expect(html).toContain('max="215"');
  expect(html).toContain('value="-1"');
  expect(html).toContain('aria-valuetext="-0:01.0 · 구간 밖 · 시작 전 (제외)"');
  expect(html).toContain('남길 구간');
  expect(html).toContain('보라색: 유지');
  expect(html).not.toContain('28800');
});

it('로드 중이거나 시간 입력이 잘못되면 포함 여부를 확정하지 않는다', () => {
  const props = { start: 0, end: 30, range: { startTime: 10, endTime: 20 }, current: 15, timeOrigin: 10, disabled: false, onSeek: () => {} };
  expect(renderToStaticMarkup(React.createElement(RangeTimeline, { ...props, ready: false }))).toContain('재생 위치 확인 중');
  expect(renderToStaticMarkup(React.createElement(RangeTimeline, { ...props, inputValid: false }))).toContain('시간 입력을 확인해주세요');
});
