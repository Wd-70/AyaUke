const fs = require('fs');

// 시간 파라미터를 초로 변환하는 함수 (route.ts에서 복사)
function parseTimeToSeconds(timeParam) {
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
  
  return 0;
}

// HTML 엔티티 디코딩 함수
function decodeHtmlEntities(text) {
  const namedEntities = {
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
        return match;
      }
    })
    // 2. 16진수 형태의 HTML 엔티티 디코딩 (&#x27; → ')
    .replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
      try {
        return String.fromCharCode(parseInt(code, 16));
      } catch (e) {
        return match;
      }
    })
    // 3. 이름 기반 HTML 엔티티 디코딩
    .replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, (entity) => {
      return namedEntities[entity] || entity;
    });
}

// 음악 컨텐츠 여부 판단 함수 (모든 것 포함)
function isMusicContent(text) {
  // 완전히 빈 텍스트나 의미없는 기호만 제외
  if (!text || text.trim() === '' || /^[?!.~\s]*$/.test(text)) {
    return false;
  }
  
  // 그 외 모든 내용 포함
  return true;
}

// 범용 타임라인 파싱 함수 - 모든 타임스탬프 패턴을 캐치
function splitCommentByTimestamps(decodedHtml) {
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

// 곡 정보 파싱 함수 (간단화)
function parseSongInfo(content) {
  // 아티스트 - 곡명 패턴 찾기
  const patterns = [
    /^([^-]+)\s*-\s*(.+)$/,  // 아티스트 - 곡명
    /^(.+?)\s*-\s*(.+)$/,    // 일반적인 패턴
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        artist: match[1].trim(),
        songTitle: match[2].trim()
      };
    }
  }
  
  return {
    artist: '알 수 없음',
    songTitle: content
  };
}

// 메인 테스트 함수
function testTimelineParser() {
  console.log('🚀 범용 타임라인 파서 테스트 시작\n');
  
  // 테스트 데이터 읽기
  const testData = fs.readFileSync('./test_data.txt', 'utf8');
  
  // HTML 엔티티 디코딩
  const decodedHtml = decodeHtmlEntities(testData);
  console.log('✅ HTML 엔티티 디코딩 완료\n');
  
  // 타임스탬프 기준 분할
  const sections = splitCommentByTimestamps(decodedHtml);
  
  console.log('\n📊 파싱 결과:');
  console.log('='.repeat(80));
  
  // 각 구간 파싱
  const results = [];
  sections.forEach((section, index) => {
    const songInfo = parseSongInfo(section.content);
    const isRelevant = songInfo.artist !== '알 수 없음';
    
    const result = {
      index: index + 1,
      timeText: section.timeText,
      timeSeconds: section.timeSeconds,
      content: section.content,
      artist: songInfo.artist,
      songTitle: songInfo.songTitle,
      isRelevant
    };
    
    results.push(result);
    
    console.log(`${isRelevant ? '🎵' : '📝'} ${result.index}. ${result.timeText} (${result.timeSeconds}초)`);
    console.log(`   아티스트: ${result.artist}`);
    console.log(`   곡명: ${result.songTitle}`);
    console.log(`   원본: "${result.content.substring(0, 80)}..."`);
    console.log('');
  });
  
  // 요약 출력
  const songCount = results.filter(r => r.isRelevant).length;
  console.log('📈 요약:');
  console.log(`   전체 구간: ${results.length}개`);
  console.log(`   노래 구간: ${songCount}개`);
  console.log(`   기타 구간: ${results.length - songCount}개`);
  
  return results;
}

// 테스트 실행
try {
  testTimelineParser();
} catch (error) {
  console.error('❌ 테스트 실행 중 오류:', error);
}