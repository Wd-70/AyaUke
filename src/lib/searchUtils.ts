// 한글 초성 배열
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 한글 중성 배열
const JUNGSUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];

// 한글 종성 배열
const JONGSUNG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 키보드 입력 순서에 따른 조합형 중성 매핑
// 첫 번째 입력 중성 → 가능한 조합 중성들
const JUNGSUNG_KEYBOARD_MAP: Record<string, string[]> = {
  'ㅗ': ['ㅘ', 'ㅙ', 'ㅚ'], // ㅗ + ㅏ = ㅘ, ㅗ + ㅐ = ㅙ, ㅗ + ㅣ = ㅚ
  'ㅜ': ['ㅝ', 'ㅞ', 'ㅟ'], // ㅜ + ㅓ = ㅝ, ㅜ + ㅔ = ㅞ, ㅜ + ㅣ = ㅟ
  'ㅡ': ['ㅢ'], // ㅡ + ㅣ = ㅢ
};

// 한영 키보드 매핑 (한글 → 영어)
const KOR_TO_ENG_MAP: Record<string, string> = {
  // 자음
  'ㄱ': 'r', 'ㄲ': 'R', 'ㄴ': 's', 'ㄷ': 'e', 'ㄸ': 'E',
  'ㄹ': 'f', 'ㅁ': 'a', 'ㅂ': 'q', 'ㅃ': 'Q', 'ㅅ': 't',
  'ㅆ': 'T', 'ㅇ': 'd', 'ㅈ': 'w', 'ㅉ': 'W', 'ㅊ': 'c',
  'ㅋ': 'z', 'ㅌ': 'x', 'ㅍ': 'v', 'ㅎ': 'g',
  // 모음
  'ㅏ': 'k', 'ㅐ': 'o', 'ㅑ': 'i', 'ㅒ': 'O', 'ㅓ': 'j',
  'ㅔ': 'p', 'ㅕ': 'u', 'ㅖ': 'P', 'ㅗ': 'h', 'ㅘ': 'hk',
  'ㅙ': 'ho', 'ㅚ': 'hl', 'ㅛ': 'y', 'ㅜ': 'n', 'ㅝ': 'nj',
  'ㅞ': 'np', 'ㅟ': 'nl', 'ㅠ': 'b', 'ㅡ': 'm', 'ㅢ': 'ml',
  'ㅣ': 'l'
};

// 한영 키보드 매핑 (영어 → 한글)
const ENG_TO_KOR_MAP: Record<string, string> = {
  // 영어 → 한글 (위 매핑의 역방향)
  'r': 'ㄱ', 'R': 'ㄲ', 's': 'ㄴ', 'e': 'ㄷ', 'E': 'ㄸ',
  'f': 'ㄹ', 'a': 'ㅁ', 'q': 'ㅂ', 'Q': 'ㅃ', 't': 'ㅅ',
  'T': 'ㅆ', 'd': 'ㅇ', 'w': 'ㅈ', 'W': 'ㅉ', 'c': 'ㅊ',
  'z': 'ㅋ', 'x': 'ㅌ', 'v': 'ㅍ', 'g': 'ㅎ',
  'k': 'ㅏ', 'o': 'ㅐ', 'i': 'ㅑ', 'O': 'ㅒ', 'j': 'ㅓ',
  'p': 'ㅔ', 'u': 'ㅕ', 'P': 'ㅖ', 'h': 'ㅗ', 'y': 'ㅛ',
  'n': 'ㅜ', 'b': 'ㅠ', 'm': 'ㅡ', 'l': 'ㅣ'
};

/**
 * 자모음을 완성형 한글로 조합
 */
function combineHangulJamo(jamos: string): string {
  let result = '';
  let i = 0;
  
  while (i < jamos.length) {
    const char = jamos[i];
    
    // 초성인지 확인
    const chosungIndex = CHOSUNG.indexOf(char);
    if (chosungIndex !== -1) {
      const chosung = char;
      let jungsung = '';
      let jongsung = '';
      
      // 다음 글자가 중성인지 확인
      if (i + 1 < jamos.length) {
        const nextChar = jamos[i + 1];
        const jungsungIndex = JUNGSUNG.indexOf(nextChar);
        if (jungsungIndex !== -1) {
          jungsung = nextChar;
          i++; // 중성 소비
          
          // 그 다음 글자가 종성인지 확인
          if (i + 1 < jamos.length) {
            const thirdChar = jamos[i + 1];
            const jongsungIndex = JONGSUNG.indexOf(thirdChar);
            if (jongsungIndex !== -1 && thirdChar !== '') {
              jongsung = thirdChar;
              i++; // 종성 소비
            }
          }
          
          // 완성형 한글 생성
          const chosungIdx = CHOSUNG.indexOf(chosung);
          const jungsungIdx = JUNGSUNG.indexOf(jungsung);
          const jongsungIdx = JONGSUNG.indexOf(jongsung);
          
          if (chosungIdx !== -1 && jungsungIdx !== -1 && jongsungIdx !== -1) {
            const code = 0xAC00 + (chosungIdx * 21 * 28) + (jungsungIdx * 28) + jongsungIdx;
            result += String.fromCharCode(code);
          } else {
            result += chosung + jungsung + jongsung;
          }
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    i++;
  }
  
  return result;
}

/**
 * 영어 텍스트를 한글로 변환 (한영 전환 실수 대응)
 */
export function convertEngToKor(text: string): string {
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    // 2글자 조합 확인 (복합 모음용)
    if (nextChar) {
      const twoChar = char + nextChar;
      if (twoChar === 'hk') { result += 'ㅘ'; i += 2; continue; }
      if (twoChar === 'ho') { result += 'ㅙ'; i += 2; continue; }
      if (twoChar === 'hl') { result += 'ㅚ'; i += 2; continue; }
      if (twoChar === 'nj') { result += 'ㅝ'; i += 2; continue; }
      if (twoChar === 'np') { result += 'ㅞ'; i += 2; continue; }
      if (twoChar === 'nl') { result += 'ㅟ'; i += 2; continue; }
      if (twoChar === 'ml') { result += 'ㅢ'; i += 2; continue; }
    }
    
    // 1글자 변환
    const korChar = ENG_TO_KOR_MAP[char];
    if (korChar) {
      result += korChar;
    } else {
      result += char; // 변환할 수 없는 문자는 그대로
    }
    i++;
  }
  
  // 자모음을 완성형 한글로 조합
  return combineHangulJamo(result);
}

/**
 * 한글 텍스트를 영어로 변환 (완성형 한글을 자모음으로 분해해서 변환)
 */
export function convertKorToEng(text: string): string {
  let result = '';
  
  for (const char of text) {
    // 완성형 한글인 경우 분해해서 변환
    const decomposed = decomposeHangul(char);
    if (decomposed) {
      const engChosung = KOR_TO_ENG_MAP[decomposed.chosung] || '';
      const engJungsung = KOR_TO_ENG_MAP[decomposed.jungsung] || '';
      const engJongsung = decomposed.jongsung ? (KOR_TO_ENG_MAP[decomposed.jongsung] || '') : '';
      result += engChosung + engJungsung + engJongsung;
    } else {
      // 자음/모음인 경우 직접 변환
      const engChar = KOR_TO_ENG_MAP[char];
      if (engChar) {
        result += engChar;
      } else {
        result += char; // 변환할 수 없는 문자는 그대로
      }
    }
  }
  
  return result;
}

/**
 * 영어 오타를 위한 단순 변환 (완성형 조합 없이)
 */
export function convertEngToKorSimple(text: string): string {
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    // 2글자 조합 확인 (복합 모음용)
    if (nextChar) {
      const twoChar = char + nextChar;
      if (twoChar === 'hk') { result += 'ㅘ'; i += 2; continue; }
      if (twoChar === 'ho') { result += 'ㅙ'; i += 2; continue; }
      if (twoChar === 'hl') { result += 'ㅚ'; i += 2; continue; }
      if (twoChar === 'nj') { result += 'ㅝ'; i += 2; continue; }
      if (twoChar === 'np') { result += 'ㅞ'; i += 2; continue; }
      if (twoChar === 'nl') { result += 'ㅟ'; i += 2; continue; }
      if (twoChar === 'ml') { result += 'ㅢ'; i += 2; continue; }
    }
    
    // 1글자 변환
    const korChar = ENG_TO_KOR_MAP[char];
    if (korChar) {
      result += korChar;
    } else {
      result += char; // 변환할 수 없는 문자는 그대로
    }
    i++;
  }
  
  // 완성형 조합 없이 자모음 그대로 반환
  return result;
}

/**
 * 검색 중성이 타겟 중성과 매칭되는지 확인 (키보드 입력 순서 기반)
 */
function isJungsungMatch(searchJungsung: string, targetJungsung: string): boolean {
  // 완전 일치
  if (searchJungsung === targetJungsung) return true;
  
  // 키보드 입력 순서에 따른 조합 중성 매칭
  // 예: 검색어 'ㅗ'가 타겟 'ㅘ'과 매칭되는지 확인 (ㅗ+ㅏ=ㅘ 순서)
  const possibleCombinations = JUNGSUNG_KEYBOARD_MAP[searchJungsung];
  if (possibleCombinations && possibleCombinations.includes(targetJungsung)) {
    return true;
  }
  
  return false;
}

/**
 * 한글 문자를 초성, 중성, 종성으로 분해
 */
export function decomposeHangul(char: string): { chosung: string; jungsung: string; jongsung: string } | null {
  const code = char.charCodeAt(0);
  
  // 한글 완성형 범위 (가 ~ 힣)
  if (code >= 0xAC00 && code <= 0xD7A3) {
    const base = code - 0xAC00;
    const chosungIndex = Math.floor(base / (21 * 28));
    const jungsungIndex = Math.floor((base % (21 * 28)) / 28);
    const jongsungIndex = base % 28;
    
    return {
      chosung: CHOSUNG[chosungIndex],
      jungsung: JUNGSUNG[jungsungIndex],
      jongsung: JONGSUNG[jongsungIndex]
    };
  }
  
  return null;
}

/**
 * 텍스트에서 초성만 추출
 */
export function extractChosung(text: string): string {
  return text.split('').map(char => {
    const decomposed = decomposeHangul(char);
    return decomposed ? decomposed.chosung : char;
  }).join('');
}

/**
 * 텍스트에서 초성+중성+종성 추출 (완전한 글자 매칭)
 */
export function extractFullDecomposed(text: string): string {
  return text.split('').map(char => {
    const decomposed = decomposeHangul(char);
    if (decomposed) {
      return decomposed.chosung + decomposed.jungsung + decomposed.jongsung;
    }
    return char;
  }).join('');
}

/**
 * 부분 글자 매칭 (미완성 글자 및 초성 지원)
 * 검색어의 각 글자가 타겟의 앞부분과 매칭되는지 확인
 */
export function isPartialKoreanMatch(searchTerm: string, targetText: string): boolean {
  const searchChars = searchTerm.split('');
  const targetChars = targetText.split('');
  
  // 검색어가 타겟보다 길면 매칭 불가
  if (searchChars.length > targetChars.length) return false;
  
  for (let i = 0; i < targetChars.length - searchChars.length + 1; i++) {
    let isMatch = true;
    
    for (let j = 0; j < searchChars.length; j++) {
      const searchChar = searchChars[j];
      const targetChar = targetChars[i + j];
      
      // 완전 일치하면 다음으로
      if (searchChar === targetChar) continue;
      
      // 검색어가 초성인지 확인
      if (CHOSUNG.includes(searchChar)) {
        // 초성이므로 타겟 글자의 초성과 비교
        const targetDecomposed = decomposeHangul(targetChar);
        if (targetDecomposed && targetDecomposed.chosung === searchChar) {
          continue; // 초성 매칭 성공
        } else {
          isMatch = false;
          break;
        }
      }
      
      // 한글 완성형 글자인 경우 부분 매칭 확인
      const searchDecomposed = decomposeHangul(searchChar);
      const targetDecomposed = decomposeHangul(targetChar);
      
      if (searchDecomposed && targetDecomposed) {
        // 초성이 다르면 매칭 실패
        if (searchDecomposed.chosung !== targetDecomposed.chosung) {
          isMatch = false;
          break;
        }
        
        // 중성 매칭 확인 (조합형 중성 지원)
        if (!isJungsungMatch(searchDecomposed.jungsung, targetDecomposed.jungsung)) {
          isMatch = false;
          break;
        }
        
        // 검색어에 종성이 있는데 다르면 매칭 실패
        if (searchDecomposed.jongsung && 
            searchDecomposed.jongsung !== targetDecomposed.jongsung) {
          isMatch = false;
          break;
        }
        
        // 검색어에 종성이 없으면 부분 매칭으로 간주 (예: "악도" vs "악동")
      } else {
        // 한글이 아닌 경우 완전 일치만 허용
        isMatch = false;
        break;
      }
    }
    
    if (isMatch) return true;
  }
  
  return false;
}

/**
 * 띄어쓰기를 제거하고 소문자로 변환
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

/**
 * 검색어가 초성만으로 이루어져 있는지 확인
 */
function isChosungOnly(text: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(text);
}


/**
 * 한글 검색어가 타겟 텍스트와 매칭되는지 확인
 * - 띄어쓰기 무시
 * - 초성/중성 부분 매칭 지원
 * - 검색어 타입에 따른 우선순위 적용
 */
export function isKoreanMatch(searchTerm: string, targetText: string): boolean {
  if (!searchTerm || !targetText) return false;
  
  const normalizedSearch = normalizeText(searchTerm);
  const normalizedTarget = normalizeText(targetText);
  
  // 1. 완전 텍스트 매칭 (최우선 - 띄어쓰기 무시)
  if (normalizedTarget.includes(normalizedSearch)) {
    return true;
  }
  
  // 2. 초성만으로 이루어진 검색어의 경우 초성 매칭만 수행
  if (isChosungOnly(normalizedSearch)) {
    const targetChosung = extractChosung(normalizedTarget);
    return targetChosung.includes(normalizedSearch);
  }
  
  // 3. 초성과 완성형 글자가 섞인 경우 (예: "악ㄷ") 또는 완성된 글자만 있는 경우
  // 모두 부분 매칭 함수로 처리 (초성 지원 포함)
  return isPartialKoreanMatch(normalizedSearch, normalizedTarget);
}

/**
 * 영문/숫자 검색 (띄어쓰기 무시)
 */
export function isEnglishMatch(searchTerm: string, targetText: string): boolean {
  if (!searchTerm || !targetText) return false;
  
  const normalizedSearch = normalizeText(searchTerm);
  const normalizedTarget = normalizeText(targetText);
  
  return normalizedTarget.includes(normalizedSearch);
}

/**
 * 통합 검색 함수 (한영 변환 지원)
 */
export function isTextMatch(searchTerm: string, targetText: string): boolean {
  if (!searchTerm || !targetText) return false;
  
  // 1. 원본 텍스트로 검색
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(searchTerm)) {
    // 한글 검색
    if (isKoreanMatch(searchTerm, targetText)) return true;
  } else {
    // 영문 검색
    if (isEnglishMatch(searchTerm, targetText)) return true;
  }
  
  // 2. 한영 변환해서 검색
  try {
    // 영어로 입력된 경우 → 한글로 변환해서 검색 (단순 매칭)
    if (/^[a-zA-Z]+$/.test(searchTerm)) {
      const convertedToKorSimple = convertEngToKorSimple(searchTerm);
      if (convertedToKorSimple !== searchTerm) {
        // 타겟 텍스트를 영어로 변환해서 단순 비교
        const targetConvertedToEng = convertKorToEng(targetText);
        if (isEnglishMatch(searchTerm, targetConvertedToEng)) {
          return true;
        }
      }
    }
    
    // 한글로 입력된 경우 → 영어로 변환해서 검색  
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(searchTerm)) {
      const convertedToEng = convertKorToEng(searchTerm);
      if (convertedToEng !== searchTerm) {
        // 타겟 텍스트도 한글이면 영어로 변환해서 비교
        if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(targetText)) {
          const targetConvertedToEng = convertKorToEng(targetText);
          if (isEnglishMatch(convertedToEng, targetConvertedToEng)) {
            return true;
          }
        }
        // 타겟이 영어면 직접 비교
        if (isEnglishMatch(convertedToEng, targetText)) {
          return true;
        }
      }
    }
  } catch {
    // 변환 실패 시 무시하고 원본 검색 결과 사용
  }
  
  return false;
}