'use client';

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Listen before the menu opens; Chromium's install event is not replayed. */
function useInstallController() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    update();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    standalone.addEventListener('change', update);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      standalone.removeEventListener('change', update);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === 'accepted' ? '설치 요청을 보냈어요. 홈 화면에서 AyaUke를 찾아주세요.' : '나중에 브라우저 메뉴에서 다시 설치할 수 있어요.');
    } catch {
      setMessage('브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해 주세요.');
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  };
  return { available: !!prompt, installed, ios, busy, message, install };
}

const InstallContext = createContext<ReturnType<typeof useInstallController>>({
  available: false, installed: false, ios: false, busy: false, message: '', install: async () => {},
});

/** Root lifetime: moving between page-owned Navigation instances must not lose the prompt. */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  return createElement(InstallContext.Provider, { value: useInstallController() }, children);
}

export function usePwaInstall() { return useContext(InstallContext); }
