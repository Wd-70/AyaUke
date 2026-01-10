import { useEffect, useRef } from 'react';

type Politeness = 'polite' | 'assertive';

export function useLiveRegion(message: string, politeness: Politeness = 'polite') {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!message) return;

    // Create or get existing live region
    let liveRegion = document.getElementById(`live-region-${politeness}`);

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = `live-region-${politeness}`;
      liveRegion.setAttribute('aria-live', politeness);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Announce message
    liveRegion.textContent = message;

    // Clear message after announcement
    timeoutRef.current = setTimeout(() => {
      liveRegion!.textContent = '';
    }, 3000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, politeness]);
}
