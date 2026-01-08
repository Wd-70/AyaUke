'use client';

import { useState } from 'react';
import { ClockIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

interface TimelineAdjusterTabProps {}

export default function TimelineAdjusterTab({}: TimelineAdjusterTabProps) {
  const [inputText, setInputText] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState(0);
  const [offsetSeconds, setOffsetSeconds] = useState(0);
  const [offsetSign, setOffsetSign] = useState<1 | -1>(1); // 1: 뒤로(늦춤), -1: 앞으로(빠르게)
  const [outputText, setOutputText] = useState('');
  const [adjustmentMode, setAdjustmentMode] = useState<'manual' | 'reference'>('manual');
  const [targetTime, setTargetTime] = useState('');

  // 시간 문자열을 초로 변환
  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      // H:MM:SS 형식
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS 형식
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  // 초를 시간 문자열로 변환
  const secondsToTime = (seconds: number): string => {
    if (seconds < 0) seconds = 0; // 음수 방지
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // 입력 텍스트에서 첫 번째 타임스탬프 추출
  const getFirstTimestamp = () => {
    if (!inputText.trim()) return null;
    
    const lines = inputText.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const timePattern = /^(\d{1,2}:\d{2}(?::\d{2})?)/;
      const match = trimmedLine.match(timePattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  };

  // 기준 시간 기반 오프셋 계산
  const calculateOffsetFromReference = () => {
    const firstTimestamp = getFirstTimestamp();
    if (!firstTimestamp || !targetTime.trim()) return 0;
    
    const refSeconds = timeToSeconds(firstTimestamp);
    const targetSeconds = timeToSeconds(targetTime);
    return targetSeconds - refSeconds;
  };

  // 타임라인 조정 처리
  const adjustTimeline = () => {
    if (!inputText.trim()) {
      setOutputText('');
      return;
    }

    let totalOffsetSeconds: number;
    
    if (adjustmentMode === 'manual') {
      totalOffsetSeconds = offsetSign * (offsetMinutes * 60 + offsetSeconds);
    } else {
      totalOffsetSeconds = calculateOffsetFromReference();
    }
    
    const lines = inputText.split('\n');
    
    const adjustedLines = lines.map(line => {
      const line_trimmed = line.trim();
      if (!line_trimmed) return line_trimmed;

      // 타임스탬프 패턴 찾기 (H:MM:SS 또는 MM:SS)
      const timePattern = /^(\d{1,2}:\d{2}(?::\d{2})?)/;
      const match = line_trimmed.match(timePattern);
      
      if (match) {
        const originalTime = match[1];
        const originalSeconds = timeToSeconds(originalTime);
        const adjustedSeconds = originalSeconds + totalOffsetSeconds;
        const adjustedTime = secondsToTime(adjustedSeconds);
        
        return line_trimmed.replace(originalTime, adjustedTime);
      }
      
      return line_trimmed;
    });

    setOutputText(adjustedLines.join('\n'));
  };

  // 입력 텍스트 변경 시 자동 조정
  const handleInputChange = (value: string) => {
    setInputText(value);
    // 입력이 있고 설정이 되어있는 경우 자동으로 조정
    if (value.trim() && shouldAutoAdjust()) {
      setTimeout(() => adjustTimeline(), 100);
    }
  };

  // 자동 조정 조건 확인
  const shouldAutoAdjust = () => {
    if (adjustmentMode === 'manual') {
      return offsetMinutes !== 0 || offsetSeconds !== 0;
    } else {
      return getFirstTimestamp() !== null && targetTime.trim() !== '';
    }
  };

  // 수동 오프셋 변경 시 자동 조정
  const handleManualOffsetChange = (minutes: number, seconds: number, sign: 1 | -1) => {
    setOffsetMinutes(minutes);
    setOffsetSeconds(seconds);
    setOffsetSign(sign);
    // 입력이 있는 경우 자동으로 조정
    if (inputText.trim()) {
      setTimeout(() => adjustTimeline(), 100);
    }
  };

  // 유튜브 링크에서 시간 추출 (t=123s 또는 &t=123s 형태)
  const extractTimeFromYouTubeUrl = (url: string): string | null => {
    // YouTube URL에서 시간 파라미터 추출
    const timePatterns = [
      /[?&]t=(\d+)s/,           // t=123s
      /[?&]t=(\d+)/,            // t=123
      /[?&]start=(\d+)/,        // start=123
      /#t=(\d+)s/,              // #t=123s
      /#t=(\d+)/,               // #t=123
      /[?&]t=(\d+)m(\d+)s/,     // t=1m23s
      /[?&]t=(\d+)h(\d+)m(\d+)s/, // t=1h2m3s
    ];

    for (const pattern of timePatterns) {
      const match = url.match(pattern);
      if (match) {
        if (pattern.source.includes('h') && match.length >= 4) {
          // 시:분:초 형태
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (pattern.source.includes('m') && match.length >= 3) {
          // 분:초 형태
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
          // 초만 있는 경우
          const totalSeconds = parseInt(match[1]);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          
          if (hours > 0) {
            return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          } else {
            return `${remainingMinutes}:${seconds.toString().padStart(2, '0')}`;
          }
        }
      }
    }
    return null;
  };

  // 시간 형식 유효성 검사
  const isValidTimeFormat = (input: string): boolean => {
    // H:MM:SS 또는 MM:SS 형식 확인
    const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
    return timePattern.test(input);
  };

  // 입력값 필터링 (시간 형식 또는 숫자, 콜론만 허용)
  const filterTimeInput = (input: string): string => {
    // 숫자, 콜론만 허용
    return input.replace(/[^0-9:]/g, '');
  };

  // 목표 시간 변경 및 붙여넣기 처리
  const handleTargetTimeChange = (value: string) => {
    // 유튜브 링크인지 확인 (youtube.com 또는 youtu.be 포함)
    if (value.includes('youtube.com') || value.includes('youtu.be')) {
      const extractedTime = extractTimeFromYouTubeUrl(value);
      if (extractedTime) {
        setTargetTime(extractedTime);
        // 자동 조정 실행
        if (inputText.trim() && getFirstTimestamp()) {
          setTimeout(() => adjustTimeline(), 100);
        }
        return;
      }
    }

    // 일반 텍스트 입력인 경우 시간 형식만 허용
    const filtered = filterTimeInput(value);
    setTargetTime(filtered);
    
    // 입력이 있고 첫 번째 타임스탬프가 있으며 목표 시간이 설정된 경우 자동으로 조정
    if (inputText.trim() && getFirstTimestamp() && filtered.trim()) {
      setTimeout(() => adjustTimeline(), 100);
    }
  };

  // 키 입력 제한 (숫자, 콜론, 백스페이스, 삭제, 방향키만 허용)
  const handleTargetTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'Tab', 'Enter'
    ];
    
    const isNumber = /^[0-9]$/.test(e.key);
    const isColon = e.key === ':';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlV = e.ctrlKey && e.key === 'v'; // Ctrl+V 붙여넣기 허용
    const isCtrlA = e.ctrlKey && e.key === 'a'; // Ctrl+A 전체선택 허용
    
    if (!(isNumber || isColon || isAllowedKey || isCtrlV || isCtrlA)) {
      e.preventDefault();
    }
  };

  // 결과 복사
  const copyToClipboard = () => {
    if (outputText) {
      navigator.clipboard.writeText(outputText);
      alert('결과가 클립보드에 복사되었습니다!');
    }
  };

  // 초기화
  const reset = () => {
    setInputText('');
    setOffsetMinutes(0);
    setOffsetSeconds(0);
    setOffsetSign(1);
    setTargetTime('');
    setOutputText('');
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* 제목 및 설명 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <AdjustmentsHorizontalIcon className="w-8 h-8 text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              타임라인 조정 도구
            </h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            치지직과 유튜브 다시보기 영상의 시작 시간 차이를 보정하기 위한 도구입니다. 
            댓글로 작성한 타임라인을 일괄적으로 앞뒤로 이동시킬 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 입력 섹션 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                타임라인 댓글 입력
              </label>
              <textarea
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="예:&#10;7:13:51 ZUTOMAYO - 감그레이&#10;7:19:15 Official髭男dism - Universe&#10;7:25:14 마크툽 - 시작의 아이"
                className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         font-mono text-sm"
              />
            </div>

            {/* 조정 방식 선택 */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                시간 조정 방식
              </label>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="adjustmentMode"
                    value="manual"
                    checked={adjustmentMode === 'manual'}
                    onChange={(e) => setAdjustmentMode(e.target.value as 'manual' | 'reference')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">수동 조정</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="adjustmentMode"
                    value="reference"
                    checked={adjustmentMode === 'reference'}
                    onChange={(e) => setAdjustmentMode(e.target.value as 'manual' | 'reference')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">기준 시간 계산</span>
                </label>
              </div>

              {adjustmentMode === 'manual' ? (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        방향
                      </label>
                      <select
                        value={offsetSign}
                        onChange={(e) => handleManualOffsetChange(offsetMinutes, offsetSeconds, parseInt(e.target.value) as 1 | -1)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-sm"
                      >
                        <option value={1}>+ 늦춤</option>
                        <option value={-1}>- 빠르게</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        분
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={offsetMinutes}
                        onChange={(e) => handleManualOffsetChange(parseInt(e.target.value) || 0, offsetSeconds, offsetSign)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        초
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={offsetSeconds}
                        onChange={(e) => handleManualOffsetChange(offsetMinutes, parseInt(e.target.value) || 0, offsetSign)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    설정된 시간만큼 모든 타임스탬프를 이동합니다
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        첫 곡 원본 시간 (자동 인식)
                      </label>
                      <input
                        type="text"
                        value={getFirstTimestamp() || ''}
                        readOnly
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded
                                 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-center"
                        placeholder="댓글을 입력하면 자동 인식"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        첫 곡 목표 시간 (또는 YouTube 링크)
                      </label>
                      <input
                        type="text"
                        value={targetTime}
                        onChange={(e) => handleTargetTimeChange(e.target.value)}
                        onKeyDown={handleTargetTimeKeyDown}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                        placeholder="7:15:21 또는 YouTube 링크 붙여넣기"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    첫 번째 곡의 시간차를 계산하여 모든 곡에 동일하게 적용합니다
                    <div className="mt-1 text-green-600 dark:text-green-400">
                      💡 YouTube 링크 붙여넣기 시 시간 자동 추출 (예: ?t=431s → 7:11)
                    </div>
                    {getFirstTimestamp() && targetTime && (
                      <span className="block mt-1 text-blue-600 dark:text-blue-400">
                        계산된 차이: {calculateOffsetFromReference() > 0 ? '+' : ''}{Math.floor(Math.abs(calculateOffsetFromReference()) / 60)}분 {Math.abs(calculateOffsetFromReference()) % 60}초
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={adjustTimeline}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg
                         transition-colors duration-200 font-medium"
              >
                조정 적용
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg
                         transition-colors duration-200"
              >
                초기화
              </button>
            </div>
          </div>

          {/* 출력 섹션 */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  조정된 타임라인
                </label>
                {outputText && (
                  <button
                    onClick={copyToClipboard}
                    className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded
                             transition-colors duration-200"
                  >
                    복사
                  </button>
                )}
              </div>
              <textarea
                value={outputText}
                readOnly
                placeholder="조정된 결과가 여기에 표시됩니다..."
                className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                         font-mono text-sm"
              />
            </div>

            {/* 사용 예시 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                사용 예시
              </h4>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div><strong>수동 조정:</strong></div>
                <div>• 유튜브가 30초 늦게 시작: "- 빠르게" + 30초 설정</div>
                <div>• 치지직이 1분 늦게 시작: "+ 늦춤" + 1분 설정</div>
                <div className="mt-2"><strong>기준 시간 계산:</strong></div>
                <div>• 댓글 입력하면 첫 곡 시간 자동 인식 (예: 7:13:51)</div>
                <div>• 목표 시간 직접 입력 (예: 7:15:21) 또는 YouTube 링크 붙여넣기</div>
                <div>• YouTube 링크 지원 형태: ?t=431s, &t=7m11s, #t=431 등</div>
                <div>• 차이 자동 계산하여 모든 곡에 적용</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}