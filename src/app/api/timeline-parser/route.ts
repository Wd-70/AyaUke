import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { hasPermission, Permission, UserRole } from '@/lib/permissions';
import dbConnect from '@/shared/db/mongodb';
import { YouTubeComment, YouTubeVideo } from '@/models/YouTubeComment';
import SongDetail from '@/domains/catalog/song.schema';
import mongoose from 'mongoose';

import ParsedTimeline from '@/domains/archive/schemas/parsed-timeline.schema';
import TimelineComment from '@/domains/archive/schemas/timeline-comment.schema';
import { parseChzzkTimelineComments } from '@/domains/archive/chzzk-timeline.service';

// 텍스트 정규화 함수 (공백/특수문자 제거, 소문자 변환)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // 모든 공백 제거
    .replace(/[-_.,!?()[\]{}]/g, '') // 기본 구두점만 제거
    .replace(/[^\w가-힣]/g, ''); // 한글, 영문, 숫자만 유지
}

// Levenshtein distance 계산
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// 개선된 문자열 유사도 계산
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  // 1. 포함 관계 체크 (높은 점수)
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return 0.8 + (shorter.length / longer.length) * 0.2; // 0.8~1.0
  }
  
  // 2. 공통 부분 문자열 찾기
  let commonLength = 0;
  const minLen = Math.min(s1.length, s2.length);
  
  // 시작 부분 공통 문자열
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) {
      commonLength++;
    } else {
      break;
    }
  }
  
  // 끝 부분 공통 문자열
  for (let i = 1; i <= minLen - commonLength; i++) {
    if (s1[s1.length - i] === s2[s2.length - i]) {
      commonLength++;
    } else {
      break;
    }
  }
  
  if (commonLength > 0) {
    const maxLen = Math.max(s1.length, s2.length);
    const similarity = commonLength / maxLen;
    if (similarity >= 0.3) return similarity;
  }
  
  // 3. Levenshtein distance 기반 계산
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - distance) / maxLen);
}


// 아티스트 검색 (아티스트, artistAlias, searchTags)
function searchInArtistFields(song: any, normalizedQuery: string): number {
  const fields = [
    song.artist,
    song.artistAlias,
    ...(song.searchTags || [])
  ].filter(Boolean);
  
  let maxSimilarity = 0;
  let exactMatch = false;
  
  for (const field of fields) {
    const normalizedField = normalizeText(field);
    
    // 1. 완전 일치 체크
    if (normalizedField === normalizedQuery) {
      exactMatch = true;
      maxSimilarity = 1.0;
      break;
    }
    
    // 2. 포함 관계 체크 (양방향)
    if (normalizedField.includes(normalizedQuery) || normalizedQuery.includes(normalizedField)) {
      maxSimilarity = Math.max(maxSimilarity, 0.8);
    }
    
    // 3. 유사도 계산
    const similarity = calculateSimilarity(normalizedQuery, normalizedField);
    maxSimilarity = Math.max(maxSimilarity, similarity);
    
    // 4. 짧은 문자열 특별 처리 (3글자 이하)
    if (normalizedQuery.length <= 3 || normalizedField.length <= 3) {
      if (normalizedField.includes(normalizedQuery) || normalizedQuery.includes(normalizedField)) {
        maxSimilarity = Math.max(maxSimilarity, 0.7);
      }
    }
  }
  
  return maxSimilarity;
}

// 제목 검색 (title, titleAlias, searchTags)
function searchInTitleFields(song: any, normalizedQuery: string): number {
  const fields = [
    song.title,
    song.titleAlias,
    ...(song.searchTags || [])
  ].filter(Boolean);
  
  let maxSimilarity = 0;
  let exactMatch = false;
  
  for (const field of fields) {
    const normalizedField = normalizeText(field);
    
    // 1. 완전 일치 체크
    if (normalizedField === normalizedQuery) {
      exactMatch = true;
      maxSimilarity = 1.0;
      break;
    }
    
    // 2. 포함 관계 체크 (양방향)
    if (normalizedField.includes(normalizedQuery) || normalizedQuery.includes(normalizedField)) {
      maxSimilarity = Math.max(maxSimilarity, 0.8);
    }
    
    // 3. 유사도 계산
    const similarity = calculateSimilarity(normalizedQuery, normalizedField);
    maxSimilarity = Math.max(maxSimilarity, similarity);
    
    // 4. 짧은 문자열 특별 처리 (3글자 이하)
    if (normalizedQuery.length <= 3 || normalizedField.length <= 3) {
      if (normalizedField.includes(normalizedQuery) || normalizedQuery.includes(normalizedField)) {
        maxSimilarity = Math.max(maxSimilarity, 0.7);
      }
    }
  }
  
  return maxSimilarity;
}

// 캐시된 곡 데이터를 사용한 매칭 함수 (DB 요청 최소화)
function matchTimelineWithSongsFromCache(artist: string, title: string, allSongs: any[]) {
  const normalizedArtist = normalizeText(artist);
  const normalizedTitle = normalizeText(title);
  
  console.log(`🔍 캐시 검색: "${artist}" - "${title}"`);
  
  const candidates = [];
  let processedCount = 0;
  
  for (const song of allSongs) {
    const artistSimilarity = searchInArtistFields(song, normalizedArtist);
    const titleSimilarity = searchInTitleFields(song, normalizedTitle);
    
    // 전체 일치율 = (아티스트 유사도 + 제목 유사도) / 2
    const overallSimilarity = (artistSimilarity + titleSimilarity) / 2;
    
    // 높은 유사도 결과만 로그
    if (overallSimilarity > 0.3) {
      console.log(`🎯 매치: "${song.artist}" - "${song.title}" (${(overallSimilarity * 100).toFixed(1)}%)`);
    }
    
    // 최소 임계값 이상인 경우만 후보로 추가
    if (overallSimilarity > 0.1) {
      candidates.push({
        song,
        artistSimilarity,
        titleSimilarity,
        overallSimilarity,
        isExactMatch: overallSimilarity >= 0.95
      });
    }
    
    processedCount++;
  }
  
  console.log(`✅ 캐시 검색 완료: ${candidates.length}개 후보 발견`);
  
  // 일치율 순으로 정렬
  candidates.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
  
  return candidates.slice(0, 10); // 상위 10개만 반환
}

// 타임라인 데이터와 노래 DB 매칭
async function matchTimelineWithSongs(artist: string, title: string) {
  await dbConnect();
  
  const normalizedArtist = normalizeText(artist);
  const normalizedTitle = normalizeText(title);
  
  // 기본 로그만 유지
  console.log(`🔍 검색 시작: "${artist}" - "${title}"`);
  
  // 모든 곡 또는 활성+상태없는 곡 가져오기
  let allSongs = await SongDetail.find({ 
    $or: [
      { status: 'active' },
      { status: { $exists: false } },
      { status: null }
    ]
  }).lean();
  
  // 검색 대상이 적다면 모든 곡을 대상으로 검색
  if (allSongs.length < 100) {
    allSongs = await SongDetail.find({}).lean();
  }
  
  console.log(`🔍 검색 대상 곡 수: ${allSongs.length}개`);
  
  const candidates = [];
  let processedCount = 0;
  
  for (const song of allSongs) {
    const artistSimilarity = searchInArtistFields(song, normalizedArtist);
    const titleSimilarity = searchInTitleFields(song, normalizedTitle);
    
    // 전체 일치율 = (아티스트 유사도 + 제목 유사도) / 2
    const overallSimilarity = (artistSimilarity + titleSimilarity) / 2;
    
    // 높은 유사도 결과만 로그
    if (overallSimilarity > 0.3) {
      console.log(`🎯 매치: "${song.artist}" - "${song.title}" (${(overallSimilarity * 100).toFixed(1)}%)`);
    }
    
    // 최소 임계값 이상인 경우만 후보로 추가 (임계값 낮춤)
    if (overallSimilarity > 0.1) {
      candidates.push({
        song,
        artistSimilarity,
        titleSimilarity,
        overallSimilarity,
        isExactMatch: overallSimilarity >= 0.95
      });
    }
    
    processedCount++;
  }
  
  console.log(`✅ 검색 완료: ${candidates.length}개 후보 발견`);
  
  // 일치율 순으로 정렬
  candidates.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
  
  return candidates.slice(0, 10); // 상위 10개만 반환
}

// 시간 파라미터를 초로 변환하는 함수 (콜론 형태 우선 처리)
function parseTimeToSeconds(timeParam: string): number {
  // 콜론 형태 처리 (최우선)
  // h:m:s 형식 (예: 1:23:45)
  const colonHmsMatch = timeParam.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (colonHmsMatch) {
    const hours = parseInt(colonHmsMatch[1]);
    const minutes = parseInt(colonHmsMatch[2]);
    const seconds = parseInt(colonHmsMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // m:s 형식 (예: 23:45)
  const colonMsMatch = timeParam.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMsMatch) {
    const minutes = parseInt(colonMsMatch[1]);
    const seconds = parseInt(colonMsMatch[2]);
    return minutes * 60 + seconds;
  }
  
  // 숫자만 있는 경우 (초)
  if (/^\d+$/.test(timeParam)) {
    return parseInt(timeParam);
  }
  
  // h:m:s 형식 (예: 1h23m45s)
  const hmsMatch = timeParam.match(/(\d+)h(\d+)m(\d+)s/);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1]);
    const minutes = parseInt(hmsMatch[2]);
    const seconds = parseInt(hmsMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // m:s 형식 (예: 23m45s)
  const msMatch = timeParam.match(/(\d+)m(\d+)s/);
  if (msMatch) {
    const minutes = parseInt(msMatch[1]);
    const seconds = parseInt(msMatch[2]);
    return minutes * 60 + seconds;
  }
  
  // h:m 형식 (예: 1h23m)
  const hmMatch = timeParam.match(/(\d+)h(\d+)m/);
  if (hmMatch) {
    const hours = parseInt(hmMatch[1]);
    const minutes = parseInt(hmMatch[2]);
    return hours * 3600 + minutes * 60;
  }
  
  // m 형식 (예: 23m)
  const mMatch = timeParam.match(/(\d+)m/);
  if (mMatch) {
    const minutes = parseInt(mMatch[1]);
    return minutes * 60;
  }
  
  // s 형식 (예: 45s)
  const sMatch = timeParam.match(/(\d+)s/);
  if (sMatch) {
    return parseInt(sMatch[1]);
  }
  
  return 0;
}

// 개선된 HTML 엔티티 디코딩 함수
function decodeHtmlEntities(text: string): string {
  // 기본 HTML 엔티티 매핑
  const namedEntities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™'
  };
  
  return text
    // 1. 숫자 형태의 HTML 엔티티 디코딩 (&#39; → ')
    .replace(/&#(\d+);/g, (match, code) => {
      try {
        return String.fromCharCode(parseInt(code, 10));
      } catch (e) {
        return match; // 변환 실패 시 원본 반환
      }
    })
    // 2. 16진수 형태의 HTML 엔티티 디코딩 (&#x27; → ')
    .replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
      try {
        return String.fromCharCode(parseInt(code, 16));
      } catch (e) {
        return match; // 변환 실패 시 원본 반환
      }
    })
    // 3. 이름 기반 HTML 엔티티 디코딩
    .replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, (entity) => {
      return namedEntities[entity] || entity;
    });
}

// 음악 컨텐츠 여부 판단 함수 (모든 것 포함)
function isMusicContent(text: string): boolean {
  // 완전히 빈 텍스트나 의미없는 기호만 제외
  if (!text || text.trim() === '' || /^[?!.~\s]*$/.test(text)) {
    return false;
  }
  
  // 그 외 모든 내용 포함
  return true;
}

// 범용 타임라인 파싱 함수 - 모든 타임스탬프 패턴을 캐치
function splitCommentByTimestamps(decodedHtml: string) {
  console.log('🔍 범용 타임라인 파싱 시작...');
  
  const results = [];
  let baseVideoUrl = '';
  
  // 첫 번째 유튜브 링크에서 기본 URL 추출
  const linkMatch = decodedHtml.match(/<a[^>]*href="([^"]*youtube[^"]*)"[^>]*>/);
  if (linkMatch) {
    baseVideoUrl = linkMatch[1].replace(/[?&]t=\d+/, '').replace(/[?&]$/, '');
  }
  
  // 1단계: 모든 타임스탬프 링크를 찾고 주변 텍스트 추출
  const allTimestampPattern = /<a[^>]*>(\d{1,2}:\d{2}(?::\d{2})?)<\/a>/g;
  let match;
  const timestampPositions = [];
  
  while ((match = allTimestampPattern.exec(decodedHtml)) !== null) {
    timestampPositions.push({
      timeText: match[1],
      timeSeconds: parseTimeToSeconds(match[1]),
      startPos: match.index,
      endPos: match.index + match[0].length,
      fullMatch: match[0]
    });
  }
  
  console.log(`🕐 총 ${timestampPositions.length}개 타임스탬프 발견`);
  
  // 2단계: 각 타임스탬프 주변의 컨텍스트 추출
  timestampPositions.forEach((timestamp, index) => {
    // 현재 타임스탬프 이후부터 다음 타임스탬프 전까지의 텍스트
    const nextStartPos = index < timestampPositions.length - 1 ? 
                        timestampPositions[index + 1].startPos : 
                        decodedHtml.length;
    
    const contextText = decodedHtml.substring(timestamp.endPos, nextStartPos);
    
    // 텍스트 정리 및 추출
    let cleanText = contextText
      .replace(/<br\s*\/?>/gi, ' ')  // <br> 태그를 공백으로
      .replace(/<[^>]*>/g, ' ')      // 모든 HTML 태그 제거
      .replace(/\s+/g, ' ')          // 연속 공백을 하나로
      .trim();
    
    // 특수 마커나 브래킷 정보 제거
    cleanText = cleanText
      .replace(/^[🎵🪻]\s*/, '')     // 이모지 마커 제거
      .replace(/^\[.*?\]\s*/, '')     // 브래킷 정보 제거 ([저챗], [노래타임] 등)
      .replace(/^\s*-\s*/, '')        // 시작 대시 제거
      .replace(/^\s*~\s*/, '')        // 시작 틸드 제거
      .trim();
    
    // VS 패턴 처리 - "곡1 VS 시간 곡2" 형태를 분리
    const vsMatch = cleanText.match(/^(.*?)\s+VS\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(.*?)$/);
    if (vsMatch) {
      // VS 앞부분만 현재 타임스탬프에 연결
      cleanText = vsMatch[1].trim();
    }
    
    // 빈 텍스트나 너무 짧은 텍스트 스킵
    if (!cleanText || cleanText.length < 2) {
      return;
    }
    
    // 음악 관련 여부 판단
    const isLikelyMusic = isMusicContent(cleanText);
    
    if (isLikelyMusic) {
      results.push({
        timeText: timestamp.timeText,
        timeSeconds: timestamp.timeSeconds,
        content: cleanText,
        baseVideoUrl,
        source: 'general'
      });
      console.log(`🎶 발견: ${timestamp.timeText} → "${cleanText}"`);
    } else {
      console.log(`❌ 제외: ${timestamp.timeText} → "${cleanText.substring(0, 50)}..."`);
    }
  });
  
  // 시간순 정렬
  results.sort((a, b) => a.timeSeconds - b.timeSeconds);
  console.log(`📍 총 ${results.length}개 음악 항목 발견`);
  
  return results;
}

// 기본 비디오 URL 추출
function extractBaseVideoUrl(timelines: any[]) {
  const linkTimeline = timelines.find(t => t.type === 'link' && t.url);
  if (linkTimeline) {
    return linkTimeline.url.replace(/[?&]t=\d+/, '').replace(/[?&]$/, '');
  }
  return '';
}

// 완전히 새로운 타임라인 파싱 함수
function parseTimelineComment(htmlText: string, videoTitle: string) {
  console.log(`🔍 원본 댓글 파싱 시작...`);
  
  // HTML 엔티티 디코딩
  const decodedHtml = decodeHtmlEntities(htmlText);
  
  // 1단계: 타임스탬프 기준으로 댓글을 완전히 분할
  const sections = splitCommentByTimestamps(decodedHtml);
  
  if (sections.length === 0) {
    console.log(`❌ 타임스탬프가 발견되지 않음`);
    return [];
  }
  
  console.log(`📊 총 ${sections.length}개 구간으로 분할됨`);
  
  // 2단계: 각 분할된 구간을 개별적으로 파싱 (원본 댓글은 더 이상 보지 않음)
  const rawMatches = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    console.log(`\n🔄 구간 ${i + 1} 개별 파싱: ${section.timeText}`);
    console.log(`📝 구간 내용: "${section.content}"`);
    
    // 3단계: 분할된 구간만 사용하여 곡 정보 파싱
    const songInfo = parseSongInfo(section.content);
    const isRelevant = songInfo.artist !== '알 수 없음';
    
    rawMatches.push({
      url: section.baseVideoUrl || '', // 구간에서 추출된 비디오 URL 사용
      timeSeconds: section.timeSeconds,
      timeText: section.timeText,
      sectionText: section.content,
      artist: songInfo.artist,
      songTitle: songInfo.songTitle,
      isRelevant: isRelevant
    });
    
    console.log(`${isRelevant ? '✅' : '⚠️'} 구간 파싱 완료: ${section.timeText} - ${songInfo.artist} - ${songInfo.songTitle}`);
  }
  
  console.log(`📊 총 ${rawMatches.length}개 유효한 곡 발견`);

  // 시간순 정렬
  rawMatches.sort((a, b) => a.timeSeconds - b.timeSeconds);

  // 기본 비디오 URL 추출 (t 파라미터 제거)
  const baseVideoUrl = rawMatches.length > 0 ? 
    rawMatches[0].url.replace(/[?&]t=\d+/, '').replace(/[?&]$/, '') : '';

  // 날짜 추출
  const dateInfo = extractDateFromTitle(videoTitle);

  // 결과 배열 초기화
  const songEntries = [];

  // 각 곡 정보와 시작/종료 시간 계산
  for (let i = 0; i < rawMatches.length; i++) {
    const current = rawMatches[i];
    const next = rawMatches[i + 1];
    
    const liveClip = {
      videoUrl: baseVideoUrl,
      artist: current.artist,
      songTitle: current.songTitle,
      startTimeSeconds: current.timeSeconds,
      endTimeSeconds: next ? next.timeSeconds : null,
      duration: next ? (next.timeSeconds - current.timeSeconds) : null,
      uploadedDate: dateInfo.date,
      originalDateString: dateInfo.originalString,
      isRelevant: current.isRelevant
    };
    
    songEntries.push(liveClip);
  }

  return songEntries;
}

// 곡 정보 파싱 함수 (아티스트와 곡명 분리)
function parseSongInfo(songText: string) {
  const cleanText = songText.trim();
  
  // 다양한 구분자로 분리 시도
  const separators = [' - ', ' – ', ' — ', ' | ', ' / '];
  
  for (const separator of separators) {
    if (cleanText.includes(separator)) {
      const parts = cleanText.split(separator);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        return {
          artist: parts[0].trim(),
          songTitle: parts.slice(1).join(separator).trim()
        };
      }
    }
  }
  
  // 구분자가 없는 경우, 전체를 곡명으로 처리
  return {
    artist: '알 수 없음',
    songTitle: cleanText
  };
}

// 초를 HH:MM:SS 또는 MM:SS 형식으로 변환
function formatSeconds(seconds: number): string {
  // Handle negative timestamps - clamp to 0:00
  // Negative values occur when YouTube video starts before Chzzk video (negative timeOffset)
  // Clamping to 0:00 provides clearest user experience
  if (seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}



// 노래 데이터베이스에서 매칭 찾기
async function findSongMatches(artist: string, songTitle: string) {
  try {
    // 활성 상태인 곡들만 검색
    const songs = await SongDetail.find({ 
      status: { $in: ['active', 'pending'] } 
    }).lean();
    
    const normalizedInputArtist = normalizeText(artist);
    const normalizedInputTitle = normalizeText(songTitle);
    
    const matches = [];
    
    for (const song of songs) {
      // 기본 아티스트/제목 매칭
      const artistSimilarity = calculateSimilarity(normalizedInputArtist, normalizeText(song.artist));
      const titleSimilarity = calculateSimilarity(normalizedInputTitle, normalizeText(song.title));
      
      // 별칭이 있는 경우 별칭도 확인
      let bestArtistSimilarity = artistSimilarity;
      let bestTitleSimilarity = titleSimilarity;
      
      if (song.artistAlias) {
        const aliasSimilarity = calculateSimilarity(normalizedInputArtist, normalizeText(song.artistAlias));
        bestArtistSimilarity = Math.max(bestArtistSimilarity, aliasSimilarity);
      }
      
      if (song.titleAlias) {
        const aliasSimilarity = calculateSimilarity(normalizedInputTitle, normalizeText(song.titleAlias));
        bestTitleSimilarity = Math.max(bestTitleSimilarity, aliasSimilarity);
      }
      
      // 검색 태그도 확인
      if (song.searchTags && song.searchTags.length > 0) {
        for (const tag of song.searchTags) {
          const tagArtistSimilarity = calculateSimilarity(normalizedInputArtist, normalizeText(tag));
          const tagTitleSimilarity = calculateSimilarity(normalizedInputTitle, normalizeText(tag));
          bestArtistSimilarity = Math.max(bestArtistSimilarity, tagArtistSimilarity);
          bestTitleSimilarity = Math.max(bestTitleSimilarity, tagTitleSimilarity);
        }
      }
      
      // 종합 점수 계산 (아티스트 40%, 제목 60%)
      const overallConfidence = (bestArtistSimilarity * 0.4) + (bestTitleSimilarity * 0.6);
      
      // 최소 신뢰도 기준 (0.6 이상만 후보로 선정)
      if (overallConfidence >= 0.6) {
        matches.push({
          songId: song._id.toString(),
          title: song.title,
          artist: song.artist,
          confidence: overallConfidence,
          artistSimilarity: bestArtistSimilarity,
          titleSimilarity: bestTitleSimilarity,
          matchedField: bestArtistSimilarity > artistSimilarity || bestTitleSimilarity > titleSimilarity ? 'alias' : 'main'
        });
      }
    }
    
    // 신뢰도 순으로 정렬하고 상위 5개만 반환
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
      
  } catch (error) {
    console.error('노래 매칭 중 오류:', error);
    return [];
  }
}

// 최적 매칭 선택 (가장 높은 신뢰도)
async function getBestSongMatch(artist: string, songTitle: string) {
  const matches = await findSongMatches(artist, songTitle);
  
  if (matches.length === 0) return null;
  
  const bestMatch = matches[0];
  
  // 신뢰도가 0.8 이상일 때만 자동 매칭으로 처리
  if (bestMatch.confidence >= 0.8) {
    return {
      songId: bestMatch.songId,
      title: bestMatch.title,
      artist: bestMatch.artist,
      confidence: bestMatch.confidence
    };
  }
  
  return null;
}

// 비디오 제목에서 날짜 추출 (개선된 버전)
function extractDateFromTitle(title: string): { date: Date | null, originalString: string | null } {
  // 25.06.01 형식 패턴 (YY.MM.DD)
  const shortYearPattern = /(\d{2})\.(\d{1,2})\.(\d{1,2})/;
  const shortYearMatch = title.match(shortYearPattern);
  
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]);
    const month = parseInt(shortYearMatch[2]);
    const day = parseInt(shortYearMatch[3]);
    
    // 2000년대로 가정 (25 -> 2025)
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    
    try {
      const date = new Date(fullYear, month - 1, day);
      return {
        date: date,
        originalString: shortYearMatch[0]
      };
    } catch (error) {
      console.error('날짜 파싱 오류:', error);
    }
  }

  // 다른 날짜 형식들
  const datePatterns = [
    {
      pattern: /(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/,  // 2024.03.15, 2024-03-15
      parser: (match: RegExpMatchArray) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    },
    {
      pattern: /(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})/,  // 03.15.2024
      parser: (match: RegExpMatchArray) => new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]))
    },
    {
      pattern: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,       // 2024년 3월 15일
      parser: (match: RegExpMatchArray) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    }
  ];

  for (const { pattern, parser } of datePatterns) {
    const match = title.match(pattern);
    if (match) {
      try {
        const date = parser(match);
        return {
          date: date,
          originalString: match[0]
        };
      } catch (error) {
        console.error('날짜 파싱 오류:', error);
      }
    }
  }

  return { date: null, originalString: null };
}

/**
 * 곡 매칭 업데이트 파이프라인.
 * 곡에 기본 클립 길이(clipDuration)가 있으면 종료시간을 시작+기본길이로 자동 설정한다.
 * 단, 시간 검증 완료(isTimeVerified) 항목은 수동 조정으로 간주하고 건드리지 않는다.
 */
function buildMatchUpdatePipeline(
  matchedSong: { songId: string; title: string; artist: string; confidence: number },
  clipDuration?: number | null,
) {
  const setStage: Record<string, unknown> = { matchedSong, updatedAt: new Date() };

  if (clipDuration && clipDuration > 0) {
    setStage.endTimeSeconds = {
      $cond: [
        { $eq: ['$isTimeVerified', true] },
        '$endTimeSeconds',
        { $add: ['$startTimeSeconds', clipDuration] },
      ],
    };
    setStage.duration = {
      $cond: [{ $eq: ['$isTimeVerified', true] }, '$duration', clipDuration],
    };
  }

  return [{ $set: setStage }];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role as UserRole, Permission.SONGS_EDIT)) {
      return NextResponse.json(
        { success: false, error: '편집 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await dbConnect();

    const body = await request.json();
    const { action, itemId, isRelevant, isExcluded, skipProcessed = true } = body;

    switch (action) {
      case 'parse-chzzk-timeline-comments': {
        // 치지직 타임라인 댓글 → ParsedTimeline (이미 수집된 chzzkcomments 사용)
        console.log('🔄 치지직 타임라인 댓글 파싱 시작...');

        const chzzkResult = await parseChzzkTimelineComments({
          videoNo: body.videoNo ? Number(body.videoNo) : undefined,
        });

        console.log(
          `✅ 치지직 파싱 완료: 댓글 ${chzzkResult.processedComments}개 → ${chzzkResult.createdItems}개 생성, ` +
          `중복 스킵 ${chzzkResult.skippedExisting}개`,
        );

        return NextResponse.json({
          success: true,
          data: chzzkResult,
          message: `치지직 타임라인 파싱 완료: ${chzzkResult.createdItems}개 생성 (중복 ${chzzkResult.skippedExisting}개 스킵)`,
        });
      }

      case 'reprocess-timeline-comments':
        // 기존 데이터를 개선된 멀티라인 파싱 방식으로 업데이트
        console.log('🔄 기존 파싱된 타임라인 데이터를 개선된 방식으로 업데이트 시작...');
        
        // 모든 타임라인 댓글 조회 (처리완료 여부 무관)
        const allTimelineComments = await YouTubeComment.find({ 
          isTimeline: true 
        });

        console.log(`📝 총 ${allTimelineComments.length}개 타임라인 댓글 발견`);

        let reprocessedCount = 0;
        let dataUpdatedCount = 0;
        let newItemsCount = 0;

        for (const comment of allTimelineComments) {
          try {
            // 비디오 정보 조회
            const video = await YouTubeVideo.findOne({ videoId: comment.videoId });
            if (!video) continue;

            console.log(`🔍 재처리 중: ${comment.commentId}`);
            
            const hasHtmlLinks = comment.textContent.includes('<a ');
            
            if (hasHtmlLinks) {
              // 댓글 원문 정규화 저장 (commentId 기준 한 벌)
              await TimelineComment.updateOne(
                { commentId: comment.commentId },
                {
                  $set: {
                    platform: 'youtube',
                    text: comment.textContent,
                    author: comment.authorName,
                    publishedAt: comment.publishedAt,
                  },
                },
                { upsert: true }
              );

              // 개선된 멀티라인 타임라인 댓글 파싱
              const liveClips = parseTimelineComment(comment.textContent, video.title);

              if (liveClips.length > 0) {
                // 이 댓글에서 기존에 파싱된 타임라인들 조회
                const existingTimelines = await ParsedTimeline.find({
                  commentId: comment.commentId
                });

                // 기존 파싱 결과와 새 파싱 결과 비교
                console.log(`🔍 새로 파싱된 클립 개수: ${liveClips.length}개`);
                console.log(`🔍 기존 타임라인 개수: ${existingTimelines.length}개`);
                
                for (const clipData of liveClips) {
                  console.log(`🔍 새 클립 - 시작시간: ${clipData.startTimeSeconds}초, 아티스트: ${clipData.artist}, 곡명: ${clipData.songTitle}`);
                  
                  // 먼저 startTimeSeconds로 매칭 시도
                  let existingClip = existingTimelines.find(
                    timeline => timeline.startTimeSeconds === clipData.startTimeSeconds
                  );
                  
                  // startTimeSeconds로 매칭되지 않는 경우, 아티스트-곡명으로 매칭 시도
                  if (!existingClip) {
                    existingClip = existingTimelines.find(
                      timeline => timeline.artist === clipData.artist && timeline.songTitle === clipData.songTitle
                    );
                    if (existingClip) {
                      console.log(`🔄 아티스트-곡명으로 매칭됨: ${existingClip.artist} - ${existingClip.songTitle} (기존 시간: ${existingClip.startTimeSeconds}초 → 새 시간: ${clipData.startTimeSeconds}초)`);
                    }
                  } else {
                    console.log(`✅ 시작시간으로 매칭됨: ${clipData.startTimeSeconds}초`);
                  }

                  if (existingClip) {
                    // 기존 데이터를 새로운 파싱 결과로 업데이트
                    const updateData: any = {
                      artist: clipData.artist,
                      songTitle: clipData.songTitle,
                      startTimeSeconds: clipData.startTimeSeconds, // 수정된 시작시간도 업데이트
                      endTimeSeconds: clipData.endTimeSeconds,
                      duration: clipData.duration,
                      isRelevant: clipData.isRelevant,
                      // originalComment는 TimelineComment로 정규화(commentId 참조). 항목엔 미저장.
                      updatedAt: new Date()
                    };

                    // 댓글 작성자 정보가 없는 경우에만 추가
                    if (!existingClip.commentAuthor) {
                      updateData.commentAuthor = comment.authorName;
                      updateData.commentId = comment.commentId;
                      updateData.commentPublishedAt = comment.publishedAt;
                    }

                    await ParsedTimeline.updateOne(
                      { _id: existingClip._id },
                      updateData
                    );

                    dataUpdatedCount++;
                    console.log(`🔄 업데이트됨: ${clipData.startTimeSeconds}초 - ${clipData.artist} - ${clipData.songTitle}`);
                  } else {
                    // 새로운 데이터는 생성하지 않음 (기존 데이터 업데이트만)
                    console.log(`⏭️ 새로운 타임라인 발견했지만 생성하지 않음: ${clipData.startTimeSeconds}초 - ${clipData.artist} - ${clipData.songTitle}`);
                  }
                }
              }
              
              reprocessedCount++;
            }
          } catch (error) {
            console.error(`댓글 재처리 오류 (${comment.commentId}):`, error);
          }
        }

        return NextResponse.json({
          success: true,
          message: `기존 데이터 업데이트 완료: ${reprocessedCount}개 댓글 처리, ${dataUpdatedCount}개 기존 데이터 업데이트 (새로운 데이터 생성 없음)`,
          data: { reprocessedCount, dataUpdatedCount, newItemsSkipped: newItemsCount }
        });

      case 'parse-timeline-comments':
        console.log(`🔄 타임라인 댓글 파싱 시작... (처리완료 댓글 스킵: ${skipProcessed ? '예' : '아니오'})`);
        
        // 타임라인 댓글 조회 (skipProcessed 옵션에 따라 필터링)
        const queryFilter: any = { isTimeline: true };
        if (skipProcessed) {
          queryFilter.isProcessed = { $ne: true }; // isProcessed가 true가 아닌 것들만
        }
        
        const timelineComments = await YouTubeComment.find(queryFilter);
        
        console.log(`📝 총 ${timelineComments.length}개 타임라인 댓글 발견`);
        
        // 이미 파싱된 commentId 목록 조회
        const existingCommentIds = await ParsedTimeline.distinct('commentId');
        console.log(`📊 기존에 파싱된 댓글: ${existingCommentIds.length}개`);
        
        // 새로운 댓글과 최근에 업데이트된 댓글 필터링 (최근 7일 이내 업데이트된 댓글 재처리)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const newTimelineComments = timelineComments.filter(comment => {
          const isNotProcessed = !existingCommentIds.includes(comment.commentId);
          const isRecentlyUpdated = comment.updatedAt && new Date(comment.updatedAt) > sevenDaysAgo;
          
          if (skipProcessed) {
            // skipProcessed가 true면 이미 DB 쿼리에서 필터링했으므로 추가 필터링 불필요
            return isNotProcessed || isRecentlyUpdated;
          } else {
            // skipProcessed가 false면 모든 댓글 처리 (처리완료 여부 무관)
            return isNotProcessed || isRecentlyUpdated;
          }
        });

        console.log(`📝 새로 처리할 댓글: ${newTimelineComments.length}개`);
        console.log(`   - 완전히 새로운 댓글: ${timelineComments.filter(c => !existingCommentIds.includes(c.commentId)).length}개`);
        console.log(`   - 최근 업데이트된 댓글: ${timelineComments.filter(c => existingCommentIds.includes(c.commentId) && c.updatedAt && new Date(c.updatedAt) > sevenDaysAgo).length}개`);

        if (newTimelineComments.length === 0) {
          return NextResponse.json({
            success: true,
            message: '새로 파싱할 타임라인 댓글이 없습니다.',
            data: { newComments: 0, totalComments: timelineComments.length }
          });
        }

        // 처음 몇 개 댓글의 샘플 출력
        console.log('\n📋 첫 3개 댓글 샘플:');
        for (let i = 0; i < Math.min(3, newTimelineComments.length); i++) {
          const sample = newTimelineComments[i];
          console.log(`\n샘플 ${i + 1} (${sample.commentId}):`);
          console.log(`내용: ${sample.textContent.substring(0, 300)}`);
          console.log(`HTML 링크 포함: ${sample.textContent.includes('<a ')}`);
          console.log(`YouTube 링크 포함: ${sample.textContent.includes('youtube.com')}`);
        }

        let processedCount = 0;
        let totalLiveClips = 0;

        for (const comment of newTimelineComments) {
          try {
            // 비디오 정보 조회
            const video = await YouTubeVideo.findOne({ videoId: comment.videoId });
            if (!video) continue;

            // 디버그: 댓글 내용 확인
            console.log(`\n🔍 댓글 내용 (${comment.commentId}):`);
            console.log(comment.textContent.substring(0, 200) + '...');
            
            // HTML 링크가 있는지 확인
            const hasHtmlLinks = comment.textContent.includes('<a ');
            console.log(`HTML 링크 포함: ${hasHtmlLinks}`);
            
            if (hasHtmlLinks) {
              // 댓글 원문은 TimelineComment(commentId 기준 한 벌)로 정규화 저장
              await TimelineComment.updateOne(
                { commentId: comment.commentId },
                {
                  $set: {
                    platform: 'youtube',
                    text: comment.textContent,
                    author: comment.authorName,
                    publishedAt: comment.publishedAt,
                  },
                },
                { upsert: true }
              );

              // 타임라인 댓글 파싱
              const liveClips = parseTimelineComment(comment.textContent, video.title);
              console.log(`파싱 결과: ${liveClips.length}개 클립`);
              
              if (liveClips.length > 0) {
                console.log(`🎵 ${video.title}에서 ${liveClips.length}개 곡 발견`);
                
                for (const clipData of liveClips) {
                  const clipId = `${comment.commentId}_${clipData.startTimeSeconds}`;
                  
                  // 기존 파싱된 타임라인이 있는지 확인 (videoId + startTimeSeconds ±10초 범위로)
                  const existingClip = await ParsedTimeline.findOne({
                    videoId: comment.videoId,
                    startTimeSeconds: {
                      $gte: clipData.startTimeSeconds - 10,
                      $lte: clipData.startTimeSeconds + 10
                    }
                  });

                  if (existingClip) {
                    // 기존 데이터가 있으면 스킵
                    console.log(`⏭️ 스킵 (기존 데이터 존재): ${clipData.artist} - ${clipData.songTitle} (${formatSeconds(clipData.startTimeSeconds)}, 기존: ${formatSeconds(existingClip.startTimeSeconds)})`);
                  } else {
                    // 새로운 데이터 생성
                    const parsedTimeline = new ParsedTimeline({
                      id: clipId,
                      videoId: comment.videoId,
                      videoTitle: video.title,
                      uploadedDate: clipData.uploadedDate || video.publishedAt,
                      originalDateString: clipData.originalDateString,
                      artist: clipData.artist,
                      songTitle: clipData.songTitle,
                      videoUrl: clipData.videoUrl,
                      startTimeSeconds: clipData.startTimeSeconds,
                      endTimeSeconds: clipData.endTimeSeconds,
                      duration: clipData.duration,
                      // originalComment는 TimelineComment로 정규화(commentId 참조). 항목엔 미저장.
                      commentAuthor: comment.authorName,
                      commentId: comment.commentId,
                      commentPublishedAt: comment.publishedAt,
                      isRelevant: clipData.isRelevant,
                      isExcluded: false
                    });

                    await parsedTimeline.save();
                    totalLiveClips++;
                    
                    console.log(`💾 새로 저장: ${clipData.artist} - ${clipData.songTitle} (${formatSeconds(clipData.startTimeSeconds)}${clipData.endTimeSeconds ? ` ~ ${formatSeconds(clipData.endTimeSeconds)}` : ''}) ${clipData.isRelevant ? '[관련성 있음]' : '[관련성 없음]'}`);
                  }
                }
              }
              
              // 댓글을 처리완료로 표시
              await YouTubeComment.updateOne(
                { commentId: comment.commentId },
                { 
                  isProcessed: true,
                  processedAt: new Date(),
                  processedBy: 'timeline-parser'
                }
              );
              
              processedCount++;
            } else {
              console.log(`❌ HTML 링크 없음, 건너뜀`);
            }
          } catch (error) {
            console.error(`댓글 파싱 오류 (${comment.commentId}):`, error);
          }
        }

        // 통계 계산
        const totalVideos = await YouTubeVideo.countDocuments();
        const totalTimelineComments = await YouTubeComment.countDocuments({ isTimeline: true });
        const allParsedTimelines = await ParsedTimeline.find()
          .select(
            '-originalComment -createdAt -updatedAt -videoPublishedAt -verifiedBy -verifiedAt -verificationNotes -__v'
          )
          .sort({ uploadedDate: -1, startTimeSeconds: 1 })
          .allowDiskUse(true)
          .lean();
        const relevantClips = allParsedTimelines.filter(clip => clip.isRelevant && !clip.isExcluded).length;
        const matchedClips = allParsedTimelines.filter(clip => clip.matchedSong).length;
        
        // 고유 곡 수 계산
        const uniqueSongsSet = new Set();
        allParsedTimelines.forEach(clip => {
          uniqueSongsSet.add(`${clip.artist}_${clip.songTitle}`);
        });

        const stats = {
          totalVideos,
          totalTimelineComments,
          parsedItems: allParsedTimelines.length,
          relevantItems: relevantClips,
          matchedSongs: matchedClips,
          uniqueSongs: uniqueSongsSet.size
        };

        console.log(`✅ 타임라인 파싱 완료: ${processedCount}개 댓글에서 ${totalLiveClips}개 파싱된 타임라인 생성`);

        return NextResponse.json({
          success: true,
          data: {
            items: allParsedTimelines,
            stats
          },
          message: `타임라인 파싱 완료: ${totalLiveClips}개 파싱된 타임라인 생성`
        });

      case 'update-item-relevance':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        await ParsedTimeline.updateOne(
          { id: itemId },
          { 
            isRelevant: isRelevant,
            updatedAt: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: '관련성 상태가 업데이트되었습니다.'
        });

      case 'update-item-exclusion':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        await ParsedTimeline.updateOne(
          { id: itemId },
          { 
            isExcluded: isExcluded,
            updatedAt: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: '제외 상태가 업데이트되었습니다.'
        });

      case 'find-song-matches':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        const parsedTimeline = await ParsedTimeline.findOne({ id: itemId });
        if (!parsedTimeline) {
          return NextResponse.json(
            { success: false, error: '파싱된 타임라인을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }

        const songMatches = await findSongMatches(parsedTimeline.artist, parsedTimeline.songTitle);
        
        return NextResponse.json({
          success: true,
          data: {
            parsedTimeline: {
              id: parsedTimeline.id,
              artist: parsedTimeline.artist,
              songTitle: parsedTimeline.songTitle
            },
            matches: songMatches
          }
        });

      case 'assign-song-match':
        const { songId, confidence } = body;
        
        if (!itemId || !songId) {
          return NextResponse.json(
            { success: false, error: 'itemId와 songId가 필요합니다.' },
            { status: 400 }
          );
        }

        // 선택된 곡 정보 조회
        const selectedSong = await SongDetail.findById(songId);
        if (!selectedSong) {
          return NextResponse.json(
            { success: false, error: '선택된 곡을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }

        await ParsedTimeline.updateOne(
          { id: itemId },
          buildMatchUpdatePipeline(
            {
              songId: selectedSong._id.toString(),
              title: selectedSong.title,
              artist: selectedSong.artist,
              confidence: confidence || 1.0, // 수동 매칭은 기본적으로 100% 신뢰도
            },
            selectedSong.clipDuration,
          )
        );

        return NextResponse.json({
          success: true,
          message: '곡 매칭이 완료되었습니다.'
        });

      case 'remove-song-match':
        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        await ParsedTimeline.updateOne(
          { id: itemId },
          { 
            $unset: { matchedSong: "" },
            updatedAt: new Date()
          }
        );

        return NextResponse.json({
          success: true,
          message: '곡 매칭이 해제되었습니다.'
        });

      case 'update-live-clip':
        const { artist, songTitle, startTimeSeconds, endTimeSeconds, customDescription, specialTags } = body;

        if (!itemId) {
          return NextResponse.json(
            { success: false, error: 'itemId가 필요합니다.' },
            { status: 400 }
          );
        }

        const updateFields: any = { updatedAt: new Date() };

        if (artist !== undefined) updateFields.artist = artist.trim();
        if (songTitle !== undefined) updateFields.songTitle = songTitle.trim();
        if (startTimeSeconds !== undefined) updateFields.startTimeSeconds = startTimeSeconds;
        if (endTimeSeconds !== undefined) updateFields.endTimeSeconds = endTimeSeconds;
        if (customDescription !== undefined) updateFields.customDescription = customDescription;
        if (specialTags !== undefined) updateFields.specialTags = Array.isArray(specialTags) ? specialTags : [];

        // 지속 시간 재계산 (종료 시간이 있는 경우)
        if (endTimeSeconds !== undefined && startTimeSeconds !== undefined) {
          updateFields.duration = endTimeSeconds > startTimeSeconds ? endTimeSeconds - startTimeSeconds : null;
        }

        await ParsedTimeline.updateOne(
          { id: itemId },
          updateFields
        );

        return NextResponse.json({
          success: true,
          message: '파싱된 타임라인 정보가 업데이트되었습니다.'
        });

      case 'search-song-matches':
        const { searchArtist, searchTitle } = body;
        
        if (!searchArtist || !searchTitle) {
          return NextResponse.json(
            { success: false, error: 'searchArtist와 searchTitle이 필요합니다.' },
            { status: 400 }
          );
        }

        try {
          const candidates = await matchTimelineWithSongs(searchArtist, searchTitle);
          
          return NextResponse.json({
            success: true,
            data: {
              query: { artist: searchArtist, title: searchTitle },
              candidates: candidates || []
            }
          });
        } catch (error) {
          console.error('곡 검색 오류:', error);
          return NextResponse.json(
            { success: false, error: '곡 검색 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }

      case 'match-timeline-song':
        const { timelineId, songId: matchSongId, confidence: matchConfidence } = body;
        
        if (!timelineId) {
          return NextResponse.json(
            { success: false, error: 'timelineId가 필요합니다.' },
            { status: 400 }
          );
        }

        try {
          let matchInfo: { title: string; artist: string } | null = null;

          if (matchSongId) {
            // 곡 매칭
            const matchedSong = await SongDetail.findById(matchSongId);
            if (!matchedSong) {
              return NextResponse.json(
                { success: false, error: '해당 곡을 찾을 수 없습니다.' },
                { status: 404 }
              );
            }

            await ParsedTimeline.updateOne(
              { id: timelineId },
              buildMatchUpdatePipeline(
                {
                  songId: matchedSong._id.toString(),
                  title: matchedSong.title,
                  artist: matchedSong.artist,
                  confidence: matchConfidence || 0.9,
                },
                matchedSong.clipDuration,
              )
            );
            matchInfo = { title: matchedSong.title, artist: matchedSong.artist };
          } else {
            // 매칭 해제
            await ParsedTimeline.updateOne(
              { id: timelineId },
              { $unset: { matchedSong: "" }, $set: { updatedAt: new Date() } }
            );
          }

          return NextResponse.json({
            success: true,
            message: matchSongId ? '곡이 매칭되었습니다.' : '곡 매칭이 해제되었습니다.',
            data: { matchInfo }
          });
        } catch (error) {
          console.error('곡 매칭 오류:', error);
          return NextResponse.json(
            { success: false, error: '곡 매칭 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }

      case 'batch-search-matches':
        console.log('🔍 전체 타임라인 일괄 검색 시작...');
        
        try {
          // 매칭되지 않은 모든 타임라인 항목 조회
          const unmatchedTimelines = await ParsedTimeline.find({
            isRelevant: true,
            isExcluded: false,
            matchedSong: { $exists: false }
          }).sort({ uploadedDate: -1, startTimeSeconds: 1 });

          console.log(`📊 매칭되지 않은 타임라인 항목: ${unmatchedTimelines.length}개`);

          if (unmatchedTimelines.length === 0) {
            return NextResponse.json({
              success: true,
              message: '매칭되지 않은 타임라인 항목이 없습니다.',
              data: { processed: 0, matched: 0, results: [] }
            });
          }

          // 모든 곡 데이터를 한 번에 로드 (캐싱용)
          const allSongs = await SongDetail.find({ 
            $or: [
              { status: 'active' },
              { status: { $exists: false } },
              { status: null }
            ]
          }).lean();

          // 검색 대상이 적다면 모든 곡을 대상으로 검색
          if (allSongs.length < 100) {
            const allSongsNoFilter = await SongDetail.find({}).lean();
            allSongs.push(...allSongsNoFilter);
          }

          console.log(`🎵 검색 대상 곡 수: ${allSongs.length}개`);

          const results = [];
          let matchedCount = 0;

          // 각 타임라인 항목에 대해 검색 수행
          for (const timeline of unmatchedTimelines) {
            console.log(`🔍 검색 중: "${timeline.artist}" - "${timeline.songTitle}"`);
            
            const candidates = await matchTimelineWithSongsFromCache(
              timeline.artist, 
              timeline.songTitle, 
              allSongs
            );

            // 자동 매칭 조건: 95% 이상 유사도의 후보가 있는 경우
            const exactMatch = candidates.find(c => c.overallSimilarity >= 0.95);
            
            let matchResult = null;
            if (exactMatch) {
              // 자동 매칭 수행 (곡에 기본 클립 길이가 있으면 종료시간 자동 설정)
              await ParsedTimeline.updateOne(
                { _id: timeline._id },
                buildMatchUpdatePipeline(
                  {
                    songId: exactMatch.song._id.toString(),
                    title: exactMatch.song.title,
                    artist: exactMatch.song.artist,
                    confidence: exactMatch.overallSimilarity,
                  },
                  exactMatch.song.clipDuration,
                )
              );

              matchResult = {
                songId: exactMatch.song._id.toString(),
                title: exactMatch.song.title,
                artist: exactMatch.song.artist,
                confidence: exactMatch.overallSimilarity
              };
              matchedCount++;
              console.log(`✅ 자동 매칭: "${timeline.artist}" - "${timeline.songTitle}" → "${exactMatch.song.artist}" - "${exactMatch.song.title}" (${(exactMatch.overallSimilarity * 100).toFixed(1)}%)`);
            }

            results.push({
              timelineId: timeline.id,
              timelineItem: {
                artist: timeline.artist,
                songTitle: timeline.songTitle,
                timeText: formatSeconds(timeline.startTimeSeconds),
                videoTitle: timeline.videoTitle
              },
              candidates: candidates.slice(0, 5), // 상위 5개만 저장
              autoMatched: !!exactMatch,
              matchResult
            });
          }

          console.log(`✅ 일괄 검색 완료: ${unmatchedTimelines.length}개 처리, ${matchedCount}개 자동 매칭`);

          return NextResponse.json({
            success: true,
            message: `일괄 검색 완료: ${unmatchedTimelines.length}개 처리, ${matchedCount}개 자동 매칭`,
            data: {
              processed: unmatchedTimelines.length,
              matched: matchedCount,
              results
            }
          });

        } catch (error) {
          console.error('일괄 검색 오류:', error);
          return NextResponse.json(
            { success: false, error: '일괄 검색 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }

      case 'update-time-verification':
        const { timelineId: verifyTimelineId, isVerified, verificationNotes } = body;
        
        if (!verifyTimelineId) {
          return NextResponse.json(
            { success: false, error: 'timelineId가 필요합니다.' },
            { status: 400 }
          );
        }

        try {
          const updateData: any = { updatedAt: new Date() };
          
          if (isVerified) {
            updateData.isTimeVerified = true;
            updateData.verifiedBy = session?.user?.name || session?.user?.channelId || 'Unknown';
            updateData.verifiedAt = new Date();
            if (verificationNotes) {
              updateData.verificationNotes = verificationNotes;
            }
          } else {
            updateData.isTimeVerified = false;
            updateData.$unset = { 
              verifiedBy: "",
              verifiedAt: "",
              verificationNotes: ""
            };
          }

          await ParsedTimeline.updateOne(
            { id: verifyTimelineId },
            updateData
          );

          return NextResponse.json({
            success: true,
            message: `시간 검증이 ${isVerified ? '완료' : '해제'}되었습니다.`,
            data: {
              isTimeVerified: isVerified,
              verifiedBy: isVerified ? (session?.user?.name || session?.user?.channelId || 'Unknown') : null,
              verifiedAt: isVerified ? new Date() : null
            }
          });

        } catch (error) {
          console.error('시간 검증 업데이트 오류:', error);
          return NextResponse.json(
            { success: false, error: '시간 검증 업데이트 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { success: false, error: '올바르지 않은 action입니다.' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('타임라인 파서 API 오류:', error);
    
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role as UserRole, Permission.SONGS_VIEW)) {
      return NextResponse.json(
        { success: false, error: '권한이 필요합니다.' },
        { status: 403 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'parse-chzzk-timeline-stream': {
        // 치지직 타임라인 파싱 — SSE로 진행 상황 스트리밍
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const sendEvent = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            try {
              const parseResult = await parseChzzkTimelineComments({
                onProgress: (progress) => sendEvent('progress', progress),
              });
              sendEvent('complete', {
                ...parseResult,
                message: `치지직 타임라인 파싱 완료: ${parseResult.createdItems}개 생성 (중복 ${parseResult.skippedExisting}개 스킵)`,
              });
            } catch (error) {
              sendEvent('error', { error: error instanceof Error ? error.message : String(error) });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      case 'get-parsed-items': {
        // 목록에는 originalComment(댓글 HTML 전문, 상세에서 lazy-load) + 목록/전역작업
        // 미사용 필드를 제외해 페이로드를 줄인다.
        // allowDiskUse: 인덱스 생성 전/예외 상황에서도 32MB 정렬 제한에 걸리지 않도록
        const listSelect =
          '-originalComment -createdAt -updatedAt -videoPublishedAt -verifiedBy -verifiedAt -verificationNotes -__v';

        // offset/limit가 오면 청크 단위로 반환(클라이언트 점진 로딩용). 없으면 전체 반환(레거시).
        const limitParam = searchParams.get('limit');
        if (limitParam) {
          const limit = Math.min(Math.max(parseInt(limitParam, 10) || 0, 1), 3000);
          const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

          const [chunk, total] = await Promise.all([
            ParsedTimeline.find()
              .select(listSelect)
              .sort({ uploadedDate: -1, startTimeSeconds: 1 })
              .skip(offset)
              .limit(limit)
              .allowDiskUse(true)
              .lean(),
            // 총 개수는 첫 청크에서만 (이후 중복 카운트 방지)
            offset === 0 ? ParsedTimeline.estimatedDocumentCount() : Promise.resolve(undefined),
          ]);

          return NextResponse.json({
            success: true,
            data: chunk,
            offset,
            limit,
            ...(total !== undefined ? { total } : {}),
          });
        }

        const items = await ParsedTimeline.find()
          .select(listSelect)
          .sort({ uploadedDate: -1, startTimeSeconds: 1 })
          .allowDiskUse(true)
          .lean();

        return NextResponse.json({
          success: true,
          data: items
        });
      }

      case 'get-item-comment': {
        // 상세 보기에서 선택된 단일 항목의 댓글 원문만 조회 (목록 경량화 보완)
        // 정규화 저장소(TimelineComment, commentId 기준)를 우선 조회하고,
        // 아직 마이그레이션되지 않은 기존 항목은 originalComment로 폴백한다.
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'id가 필요합니다.' },
            { status: 400 }
          );
        }

        const item = await ParsedTimeline.findOne({ id })
          .select('id commentId originalComment')
          .lean();

        if (!item) {
          return NextResponse.json(
            { success: false, error: '항목을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }

        let text = item.originalComment ?? '';
        if (item.commentId) {
          const normalized = await TimelineComment.findOne({ commentId: item.commentId })
            .select('text')
            .lean();
          if (normalized?.text) text = normalized.text;
        }

        return NextResponse.json({
          success: true,
          data: { id: item.id, originalComment: text }
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: '올바르지 않은 action입니다.' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('타임라인 파서 GET API 오류:', error);
    
    return NextResponse.json(
      { success: false, error: '데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}