import React from 'react';

interface ConversionHealthScoreProps {
  score: number; // 0-100
  totalVideos: number;
  convertedVideos: number;
}

export default function ConversionHealthScore({
  score,
  totalVideos,
  convertedVideos
}: ConversionHealthScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    if (score >= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '매우 우수';
    if (score >= 50) return '양호';
    if (score >= 30) return '보통';
    return '주의 필요';
  };

  return (
    <div className="bg-gradient-to-br from-light-primary/20 to-light-accent/20 dark:from-dark-primary/20 dark:to-dark-accent/20 rounded-xl p-6 border border-light-primary/20 dark:border-dark-primary/20">
      <div className="text-center">
        <p className="text-sm text-light-text/60 dark:text-dark-text/60 font-medium mb-3">
          변환 완성도
        </p>
        <div className={`text-6xl font-bold ${getScoreColor(score)} mb-2`}>
          {score.toFixed(1)}%
        </div>
        <p className={`text-lg font-semibold ${getScoreColor(score)} mb-4`}>
          {getScoreLabel(score)}
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              score >= 80 ? 'bg-green-500' :
              score >= 50 ? 'bg-yellow-500' :
              score >= 30 ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-sm text-light-text/60 dark:text-dark-text/60">
          {convertedVideos} / {totalVideos} 영상 변환 완료
        </p>
      </div>
    </div>
  );
}
