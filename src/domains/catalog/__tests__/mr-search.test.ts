import { describe, expect, it } from 'vitest';
import { addMRCandidate, compactMRLinks, removeMRLink, DDEOK_MR_CHANNEL_ID, hasMRCandidate, isOfficialKoreanKaraoke, MRSearchInput, rankMRCandidates, youtubeMRVideoId, type MRCandidate } from '../mr-search';
const candidate = (videoId = 'abcdefghijk', channelTitle = 'Independent MR', channelId = 'independent'): MRCandidate => ({ videoId, channelTitle, channelId, title: 'Song MR', url: `https://www.youtube.com/watch?v=${videoId}`, thumbnail: '', preferred: false });
describe('MR candidate policy', () => {
  it('preserves representative identity when removing earlier or empty MR rows', () => {
    const links = [{ url: '' }, { url: 'https://youtu.be/abcdefghijk' }, { url: 'https://youtu.be/lmnopqrstuv' }];
    expect(compactMRLinks(links, 2)).toEqual({ mrLinks: links.slice(1), selectedMRIndex: 1 });
    expect(removeMRLink(links, 2, 0)).toEqual({ mrLinks: links.slice(1), selectedMRIndex: 1 });
    expect(removeMRLink(links, 2, 2).selectedMRIndex).toBe(0);
    expect(compactMRLinks([{ url: '' }], 0)).toEqual({ mrLinks: [], selectedMRIndex: 0 });
  });
  it('prioritizes exact Ddeok channel identity, not title or display-name mentions; deduplicates', () => {
    const ordinary = candidate(), preferred = candidate('lmnopqrstuv', 'renamed', DDEOK_MR_CHANNEL_ID);
    const fake = { ...candidate('12345678901', '떡뮤 copy'), title: '떡뮤 Song' };
    expect(rankMRCandidates([ordinary, fake, preferred, preferred], 'Japanese').results.map(c => [c.videoId, c.preferred])).toEqual([
      [preferred.videoId, true], [ordinary.videoId, false], [fake.videoId, false],
    ]);
    expect(rankMRCandidates([ordinary, preferred], 'English').results[0].videoId).toBe(ordinary.videoId);
  });
  it.each(['TJ노래방 공식 유튜브채널', 'TJ KARAOKE', 'TJ media', '금영 노래방 공식 유튜브 채널', 'KY Karaoke', 'KUMYOUNG', '태진미디어'])('excludes official brand channel %s for Korean', name => {
    const result = rankMRCandidates([candidate('abcdefghijk', name), candidate('lmnopqrstuv')], 'Korean');
    expect(result.excludedCount).toBe(1); expect(result.results).toHaveLength(1);
  });
  it('matches official IDs even after renaming, but leaves independent MR and Japanese results alone', () => {
    expect(isOfficialKoreanKaraoke(candidate('abcdefghijk', 'new name', 'UCZUhx8ClCv6paFW7qi3qljg'))).toBe(true);
    expect(isOfficialKoreanKaraoke(candidate('abcdefghijk', 'new name', 'UCDqaUIUSJP5EVMEI178Zfag'))).toBe(true);
    expect(isOfficialKoreanKaraoke(candidate('abcdefghijk', '떡뮤 노래방'))).toBe(false);
    expect(isOfficialKoreanKaraoke({ ...candidate(), title: 'TJ 노래방 번호 안내' } as MRCandidate)).toBe(false);
    expect(rankMRCandidates([candidate('abcdefghijk', 'TJ노래방')], 'Japanese').results).toHaveLength(1);
  });
  it('fills empty rows, does not overwrite existing values, and prevents duplicate YouTube variants', () => {
    const blank = { url: '', label: '', duration: '', skipSeconds: 0 };
    expect(addMRCandidate([blank], candidate())).toEqual([{ url: candidate().url, label: 'Song MR', duration: '', skipSeconds: 0 }]);
    const links = [{ ...blank, url: 'https://youtu.be/abcdefghijk?t=12', skipSeconds: 12 }];
    expect(hasMRCandidate(links, candidate())).toBe(true);
    expect(addMRCandidate(links, candidate())).toBe(links);
    expect(addMRCandidate([{ ...blank, label: 'keep draft' }], candidate())).toHaveLength(2);
    expect(addMRCandidate(links, candidate('lmnopqrstuv'))[0]).toBe(links[0]);
  });
  it('limits additions to 30, but can fill a blank at that limit', () => {
    const links = Array.from({ length: 30 }, () => ({ url: 'https://example.test/mr' }));
    expect(addMRCandidate(links, candidate())).toBe(links);
    links[1].url = ''; expect(addMRCandidate(links, candidate())[1].url).toBe(candidate().url);
  });
  it('rejects malformed inputs and normalizes valid YouTube URLs only', () => {
    expect(MRSearchInput.safeParse({ title: '', artist: 'A' }).success).toBe(false);
    expect(MRSearchInput.safeParse({ title: 'A', artist: 'B', query: 'x'.repeat(501) }).success).toBe(false);
    expect(MRSearchInput.parse({ title: ' A ', artist: 'B' }).language).toBe('');
    expect(youtubeMRVideoId('https://youtube.com/shorts/abcdefghijk')).toBe('abcdefghijk');
    expect(youtubeMRVideoId('https://youtube.com.evil.test/watch?v=abcdefghijk')).toBeNull();
  });
});
