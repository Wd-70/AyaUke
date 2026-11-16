import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { coverPreviewUrl, mergeSongTags, parseSongTags, stepSongKey } from './song-metadata';
import { CoverImageField, KeyAdjustmentControl, LanguageSelector, SongTagInput } from './SongMetadataControls';
describe('song metadata input controls', () => {
  it('keeps compact tag chips above a separate input row', () => {
    const html = renderToStaticMarkup(<SongTagInput value="JPOP, 발라드" onChange={() => {}} />);
    expect(html.indexOf('</ul>')).toBeLessThan(html.indexOf('<input'));
    expect(html).toContain('flex h-7');
    expect(html).toContain('JPOP 태그 삭제');
  });
  it('normalizes pasted tags and deduplicates drafts before saving', () => {
    expect(parseSongTags(' 발라드, JPOP，발라드\n 애니 ')).toEqual(['발라드', 'JPOP', '애니']);
    expect(mergeSongTags(['발라드'], '발라드, 새 태그')).toEqual(['발라드', '새 태그']);
    expect(parseSongTags(' , ，\n ')).toEqual([]);
  });
  it('steps key adjustments while preserving unset vs original-key and respecting boundaries', () => {
    expect(stepSongKey(null, 1)).toBe(1); expect(stepSongKey(null, -1)).toBe(-1);
    expect(stepSongKey(-1, 1)).toBe(0);
    expect(stepSongKey(12, 1)).toBe(12); expect(stepSongKey(-12, -1)).toBe(-12);
    const html = renderToStaticMarkup(<KeyAdjustmentControl value={0} onChange={() => {}} />);
    expect(html).toContain('원본키'); expect(html).toContain('value="0"'); expect(html).toContain('키 내리기');
    expect(renderToStaticMarkup(<KeyAdjustmentControl value={null} onChange={() => {}} />)).toContain('키 조절 없음');
  });
  it('shows all language choices including Other and explicit unset', () => {
    const html = renderToStaticMarkup(<LanguageSelector value="Japanese" onChange={() => {}} />);
    for (const text of ['한국어', '일본어', '영어', '중국어', '기타', '미설정']) expect(html).toContain(text);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
  it('only previews http(s) URLs and keeps unsupported URLs out of the image source', () => {
    expect(coverPreviewUrl(' https://example.test/cover.png ')).toBe('https://example.test/cover.png');
    for (const value of ['', 'javascript:alert(1)', 'data:image/png;base64,x', 'ftp://example.test/a']) expect(coverPreviewUrl(value)).toBeNull();
    expect(renderToStaticMarkup(<CoverImageField value="https://example.test/cover.png" onChange={() => {}} />)).toContain('alt="커버 이미지 미리보기"');
    expect(renderToStaticMarkup(<CoverImageField value="javascript:alert(1)" onChange={() => {}} />)).not.toContain('<img');
  });
});
