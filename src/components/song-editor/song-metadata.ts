export function parseSongTags(value: string) {
  return [...new Set(value.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean))];
}
export function mergeSongTags(existing: string[], draft: string) {
  return [...new Set([...existing, ...parseSongTags(draft)])];
}
export function stepSongKey(value: number | null, direction: -1 | 1) {
  return Math.max(-12, Math.min(12, (value ?? 0) + direction));
}
export function coverPreviewUrl(value: string) {
  try { const url = new URL(value.trim()); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
