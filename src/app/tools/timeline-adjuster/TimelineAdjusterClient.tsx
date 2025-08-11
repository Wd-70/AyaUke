'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ClockIcon, 
  AdjustmentsHorizontalIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

export default function TimelineAdjusterClient() {
  const [inputText, setInputText] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState(0);
  const [offsetSeconds, setOffsetSeconds] = useState(0);
  const [offsetSign, setOffsetSign] = useState<1 | -1>(1);
  const [outputText, setOutputText] = useState('');
  const [adjustmentMode, setAdjustmentMode] = useState<'manual' | 'reference'>('reference'); // 기본값을 reference로 변경
  const [targetTime, setTargetTime] = useState('');

  // 시간 문자열을 초로 변환
  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  // 초를 시간 문자열로 변환
  const secondsToTime = (seconds: number): string => {
    if (seconds < 0) seconds = 0;
    
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

  // 유튜브 링크에서 시간 추출
  const extractTimeFromYouTubeUrl = (url: string): string | null => {
    const timePatterns = [
      /[?&]t=(\d+)s/,
      /[?&]t=(\d+)/,
      /[?&]start=(\d+)/,
      /#t=(\d+)s/,
      /#t=(\d+)/,
      /[?&]t=(\d+)m(\d+)s/,
      /[?&]t=(\d+)h(\d+)m(\d+)s/,
    ];

    for (const pattern of timePatterns) {
      const match = url.match(pattern);
      if (match) {
        if (pattern.source.includes('h') && match.length >= 4) {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (pattern.source.includes('m') && match.length >= 3) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
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

  // 기준 시간 기반 오프셋 계산
  const calculateOffsetFromReference = () => {
    const firstTimestamp = getFirstTimestamp();
    if (!firstTimestamp || !targetTime.trim()) return 0;
    
    const refSeconds = timeToSeconds(firstTimestamp);
    const targetSeconds = timeToSeconds(targetTime);
    return targetSeconds - refSeconds;
  };

  // 타임라인 조정 처리 (실시간)
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

  // 실시간 조정 처리
  useEffect(() => {
    adjustTimeline();
  }, [inputText, offsetMinutes, offsetSeconds, offsetSign, adjustmentMode, targetTime]);

  // 입력값 필터링
  const filterTimeInput = (input: string): string => {
    return input.replace(/[^0-9:]/g, '');
  };

  // 목표 시간 변경 및 붙여넣기 처리
  const handleTargetTimeChange = (value: string) => {
    if (value.includes('youtube.com') || value.includes('youtu.be')) {
      const extractedTime = extractTimeFromYouTubeUrl(value);
      if (extractedTime) {
        setTargetTime(extractedTime);
        return;
      }
    }

    const filtered = filterTimeInput(value);
    setTargetTime(filtered);
  };

  // 키 입력 제한
  const handleTargetTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'Tab', 'Enter'
    ];
    
    const isNumber = /^[0-9]$/.test(e.key);
    const isColon = e.key === ':';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlV = e.ctrlKey && e.key === 'v';
    const isCtrlA = e.ctrlKey && e.key === 'a';
    
    if (!(isNumber || isColon || isAllowedKey || isCtrlV || isCtrlA)) {
      e.preventDefault();
    }
  };

  // 결과 복사
  const copyToClipboard = async () => {
    if (outputText) {
      try {
        await navigator.clipboard.writeText(outputText);
        // 간단한 피드백 표시
        const button = document.querySelector('#copy-button') as HTMLButtonElement;
        if (button) {
          const originalText = button.innerHTML;
          button.innerHTML = '✓ 복사됨!';
          button.className = button.className.replace('bg-green-500', 'bg-blue-500');
          setTimeout(() => {
            button.innerHTML = originalText;
            button.className = button.className.replace('bg-blue-500', 'bg-green-500');
          }, 2000);
        }
      } catch (err) {
        alert('복사에 실패했습니다. 브라우저가 클립보드 접근을 지원하지 않을 수 있습니다.');
      }
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

  // 현재 차이 계산 결과
  const currentOffset = adjustmentMode === 'manual' 
    ? offsetSign * (offsetMinutes * 60 + offsetSeconds)
    : calculateOffsetFromReference();

  return (
    <div>
      <div className="pb-12">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 섹션 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple rounded-xl">
                <AdjustmentsHorizontalIcon className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-light-accent to-light-purple dark:from-dark-accent dark:to-dark-purple bg-clip-text text-transparent">
                타임라인 조정 도구
              </h1>
            </div>
            <p className="text-lg text-light-text/70 dark:text-dark-text/70 max-w-2xl mx-auto">
              치지직과 유튜브 다시보기 영상의 시작 시간 차이를 쉽게 보정할 수 있는 도구입니다
            </p>
          </motion.div>

          {/* 메인 콘텐츠 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* 입력 섹션 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              {/* 타임라인 댓글 입력 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <ClockIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
                    타임라인 댓글 입력
                  </h3>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="예시:&#10;7:13:51 ZUTOMAYO - 감그레이&#10;7:19:15 Official髭男dism - Universe&#10;7:25:14 마크툽 - 시작의 아이"
                  className="w-full h-48 p-4 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white/90 dark:bg-gray-700/90 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent
                           font-mono text-sm resize-none transition-all duration-200"
                />
              </div>

              {/* 조정 방식 선택 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <SparklesIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
                    조정 방식
                  </h3>
                </div>
                
                {/* 모드 선택 */}
                <div className="flex gap-4 mb-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="adjustmentMode"
                      value="reference"
                      checked={adjustmentMode === 'reference'}
                      onChange={(e) => setAdjustmentMode(e.target.value as 'manual' | 'reference')}
                      className="mr-3 w-4 h-4 text-light-accent dark:text-dark-accent"
                    />
                    <span className="text-light-text dark:text-dark-text font-medium">기준 시간 계산</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="adjustmentMode"
                      value="manual"
                      checked={adjustmentMode === 'manual'}
                      onChange={(e) => setAdjustmentMode(e.target.value as 'manual' | 'reference')}
                      className="mr-3 w-4 h-4 text-light-accent dark:text-dark-accent"
                    />
                    <span className="text-light-text dark:text-dark-text font-medium">수동 조정</span>
                  </label>
                </div>

                {/* 기준 시간 계산 모드 */}
                {adjustmentMode === 'reference' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                          첫 곡 원본 시간 (자동 인식)
                        </label>
                        <input
                          type="text"
                          value={getFirstTimestamp() || ''}
                          readOnly
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                   bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-center font-mono
                                   cursor-not-allowed"
                          placeholder="댓글을 입력하면 자동 인식"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                          첫 곡 목표 시간
                        </label>
                        <input
                          type="text"
                          value={targetTime}
                          onChange={(e) => handleTargetTimeChange(e.target.value)}
                          onKeyDown={handleTargetTimeKeyDown}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono
                                   focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent
                                   transition-all duration-200"
                          placeholder="7:15:21 또는 YouTube 링크"
                        />
                      </div>
                    </div>
                    
                    {/* 계산 결과 표시 */}
                    {getFirstTimestamp() && targetTime && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 
                                 rounded-lg p-4 border border-blue-200 dark:border-blue-700"
                      >
                        <div className="text-center">
                          <span className="text-blue-800 dark:text-blue-200 font-semibold">
                            계산된 차이: {currentOffset > 0 ? '+' : ''}{Math.floor(Math.abs(currentOffset) / 60)}분 {Math.abs(currentOffset) % 60}초
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* 수동 조정 모드 */}
                {adjustmentMode === 'manual' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-3 gap-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                        방향
                      </label>
                      <select
                        value={offsetSign}
                        onChange={(e) => setOffsetSign(parseInt(e.target.value) as 1 | -1)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center
                                 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent
                                 transition-all duration-200"
                      >
                        <option value={1}>+ 늦춤</option>
                        <option value={-1}>- 빠르게</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                        분
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={offsetMinutes}
                        onChange={(e) => setOffsetMinutes(parseInt(e.target.value) || 0)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center
                                 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent
                                 transition-all duration-200"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-light-text/70 dark:text-dark-text/70 mb-2">
                        초
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={offsetSeconds}
                        onChange={(e) => setOffsetSeconds(parseInt(e.target.value) || 0)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center
                                 focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:border-transparent
                                 transition-all duration-200"
                        placeholder="0"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* 출력 섹션 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              {/* 결과 출력 */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DocumentDuplicateIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                    <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
                      조정된 타임라인
                    </h3>
                  </div>
                  {outputText && (
                    <button
                      id="copy-button"
                      onClick={copyToClipboard}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg
                               transition-all duration-200 transform hover:scale-105 text-sm font-medium
                               shadow-lg hover:shadow-xl"
                    >
                      📋 복사
                    </button>
                  )}
                </div>
                <textarea
                  value={outputText}
                  readOnly
                  placeholder="조정된 결과가 실시간으로 여기에 표시됩니다..."
                  className="w-full h-48 p-4 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                           font-mono text-sm resize-none cursor-text"
                />
              </div>

              {/* 사용 가이드 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 
                            rounded-xl p-6 border border-blue-200 dark:border-blue-700 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                    사용 가이드
                  </h3>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                  <div><strong>🎯 기준 시간 계산 (추천):</strong></div>
                  <div>• 타임라인 댓글을 붙여넣으면 첫 곡 시간 자동 인식</div>
                  <div>• 목표 시간 입력 또는 YouTube 링크 붙여넠기</div>
                  <div>• 차이가 자동 계산되어 모든 곡에 실시간 적용</div>
                  
                  <div className="mt-3"><strong>⚙️ 수동 조정:</strong></div>
                  <div>• 정확한 시간 차이를 알고 있을 때 사용</div>
                  <div>• 방향(늦춤/빠르게)과 시간을 직접 설정</div>
                  
                  <div className="mt-3"><strong>🔗 YouTube 링크 지원:</strong></div>
                  <div>• ?t=431s, &t=7m11s, #t=431 등 다양한 형식</div>
                </div>
              </div>

              {/* 초기화 버튼 */}
              <div className="flex justify-center">
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg
                           transition-all duration-200 transform hover:scale-105 font-medium
                           shadow-lg hover:shadow-xl"
                >
                  🔄 전체 초기화
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}