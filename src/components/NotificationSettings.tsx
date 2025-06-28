'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { BellIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';

export default function NotificationSettings() {
  const { settings, updateSettings, requestNotificationPermission, playNotificationSound } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationToggle = async () => {
    if (!settings.streamNotifications) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('알림 권한이 필요합니다. 브라우저 설정에서 알림을 허용해주세요.');
        return;
      }
    }
    updateSettings({ streamNotifications: !settings.streamNotifications });
  };

  const handleSoundToggle = () => {
    updateSettings({ soundEnabled: !settings.soundEnabled });
    if (!settings.soundEnabled) {
      playNotificationSound();
    }
  };

  const handleVolumeChange = (volume: number) => {
    updateSettings({ volume });
    playNotificationSound();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full bg-light-primary/20 dark:bg-dark-primary/20 
                   hover:bg-light-primary/30 dark:hover:bg-dark-primary/30 
                   transition-all duration-300"
        aria-label="알림 설정"
      >
        <BellIcon className="w-6 h-6 text-light-purple dark:text-dark-text" />
        {settings.streamNotifications && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-72 p-4 bg-white dark:bg-gray-900 
                        rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 
                        z-50 animate-slide-up">
          <h3 className="text-lg font-semibold mb-4 gradient-text">알림 설정</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">방송 시작 알림</span>
              <button
                onClick={handleNotificationToggle}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 
                           ${settings.streamNotifications 
                             ? 'bg-light-accent dark:bg-dark-accent' 
                             : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 
                                ${settings.streamNotifications ? 'translate-x-7' : 'translate-x-1'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">알림 소리</span>
              <button
                onClick={handleSoundToggle}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {settings.soundEnabled ? (
                  <SpeakerWaveIcon className="w-5 h-5 text-light-accent dark:text-dark-accent" />
                ) : (
                  <SpeakerXMarkIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>

            {settings.soundEnabled && (
              <div className="space-y-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">볼륨</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
                           slider-thumb"
                />
                <div className="text-xs text-gray-500 text-center">
                  {Math.round(settings.volume * 100)}%
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="mt-4 w-full py-2 bg-light-primary dark:bg-dark-primary text-white rounded-lg
                       hover:bg-light-purple dark:hover:bg-dark-secondary transition-colors"
          >
            확인
          </button>
        </div>
      )}

      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
}