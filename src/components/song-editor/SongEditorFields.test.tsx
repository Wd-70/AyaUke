import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SongEditorFields from './SongEditorFields';
import { emptySongFields } from '@/domains/catalog/song-workspace';
vi.mock('@/components/MRSearchPicker', () => ({ default: () => <div>MR search</div> }));
vi.mock('@/components/MRVideoPreview', () => ({ default: () => <div>MR preview</div> }));
const render = (section: string, showDefaultDuration = false) => renderToStaticMarkup(<SongEditorFields section={section} values={emptySongFields()} setValues={() => {}} title="원제" artist="가수" setTitle={() => {}} setArtist={() => {}} tags="" setTags={() => {}} showDefaultDuration={showDefaultDuration} />);
describe('shared song editing fields', () => {
  it('clearly separates display aliases from immutable original identity', () => {
    const html = render('info');
    expect(html).toContain('표시 제목'); expect(html).toContain('표시 가수'); expect(html).toContain('읽기 전용');
    expect(html).toContain('readonly'); expect(html).not.toContain('MR search');
    expect(html).toContain('<details'); expect(html).not.toContain('open=""');
  });
  it('keeps lyrics visible at all breakpoints and warns about public notes', () => {
    const html = render('lyrics');
    expect(html).toContain('<textarea'); expect(html).not.toContain('xl:hidden');
    expect(html).toContain('공개 데이터');
  });
  it('only shows default clip duration for administrator fields, never as a hidden editable public default', () => {
    expect(render('mr')).not.toContain('기본 클립 길이');
    expect(render('mr', true)).toContain('기본 클립 길이');
    expect(render('mr')).toContain('MR search');
  });
});
