/**
 * @deprecated 새 코드는 '@/domains/catalog/*'를 사용하세요.
 * 기존 import 경로 호환을 위한 re-export 심 — 점진적 이전 후 삭제 예정.
 */
export { getAllSongs as fetchSongsFromSheet } from '@/domains/catalog/song.service';
export { fetchRawSongsFromSheet, parseSheetData, getErrorMessage } from '@/domains/catalog/sheets.client';
export { fetchSongDetailsFromMongo } from '@/domains/catalog/song.repository';
export { mergeSongsData } from '@/domains/catalog/merge';
