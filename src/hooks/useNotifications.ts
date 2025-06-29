'use client';

import { useState, useEffect, useCallback } from 'react';
import { NotificationSettings } from '@/types';

export function useNotifications() {
  const [settings, setSettings] = useState<NotificationSettings>({
    streamNotifications: true,
    soundEnabled: true,
    volume: 0.5,
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }, [settings]);

  const playNotificationSound = useCallback(() => {
    if (!settings.soundEnabled) return;

    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Create a pleasant notification sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(settings.volume * 0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [settings.soundEnabled, settings.volume]);

  const showStreamNotification = useCallback((streamInfo: { title?: string }) => {
    if (!settings.streamNotifications) return;

    playNotificationSound();

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🎉 아야가 방송을 시작했어요!', {
        body: streamInfo.title || '지금 바로 시청하세요!',
        icon: '/favicon.ico',
        tag: 'stream-notification',
      });
    }
  }, [settings.streamNotifications, playNotificationSound]);

  useEffect(() => {
    const handleStreamStarted = (event: CustomEvent) => {
      showStreamNotification(event.detail);
    };

    window.addEventListener('streamStarted', handleStreamStarted as EventListener);
    
    return () => {
      window.removeEventListener('streamStarted', handleStreamStarted as EventListener);
    };
  }, [showStreamNotification]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return {
    settings,
    updateSettings,
    requestNotificationPermission,
    playNotificationSound,
  };
}