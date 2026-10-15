import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RangeControls from './RangeControls';

describe('구간 편집 표시', () => {
  const value = { startTime: 28_798, endTime: 28_980.5 };
  it('사용자 입력과 경계 표시는 음수를 포함한 클립 상대 시간이다', () => {
    const html = renderToStaticMarkup(React.createElement(RangeControls, {
      value, timeOrigin: 28_800.5, onChange: () => {},
    }));
    expect(html).toContain('클립 기준');
    expect(html).toContain('-0:02.5');
    expect(html).toContain('3:00.0');
    expect(html).toContain('value="-0:02.5"');
    expect(html).toContain('value="3:00.0"');
    expect(html).not.toContain('28798');
    expect(html).not.toContain('28980.5');
    expect(html).not.toContain('원본 기준 초');
  });
  it('관리자 편집기는 기존 원본 기준을 유지한다', () => {
    const html = renderToStaticMarkup(React.createElement(RangeControls, { value, onChange: () => {} }));
    expect(html).toContain('원본 기준 초');
    expect(html).toContain('value="28798"');
    expect(html).toContain('value="28980.5"');
  });
  it('시작이 종료를 넘으면 양쪽 경계 미리 듣기를 비활성화한다', () => {
    const html = renderToStaticMarkup(React.createElement(RangeControls, {
      value: { startTime: value.endTime + 1, endTime: value.endTime },
      onChange: () => {}, preview: () => {},
    }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>시작부터 10초 듣기<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>끝 직전 10초 듣기<\/button>/);
  });
  it('모바일 선택은 종료부터 표시하되 양쪽 조정 단위는 동일하다', () => {
    const html = renderToStaticMarkup(React.createElement(RangeControls, {
      value, onChange: () => {}, compact: true, timeOrigin: value.startTime,
      preview: () => {}, previewContext: () => {},
    }));
    expect(html).toContain('aria-label="조정할 경계"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>끝 조정/);
    expect(html).toContain('hidden sm:block');
    expect(html).toContain('0.5초 앞당기기');
    expect(html).toContain('5초 앞당기기');
    expect(html.match(/<option value="30"/g)).toHaveLength(2);
    expect(html).toContain('시작 경계 전후 듣기');
    expect(html).toContain('종료 경계 전후 듣기');
  });
  it('플레이어 준비 전에는 경계 전후 듣기도 사용할 수 없다', () => {
    const html = renderToStaticMarkup(React.createElement(RangeControls, { value, onChange: () => {}, previewContext: () => {} }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>시작 경계 전후 듣기<\/button>/);
  });
});
