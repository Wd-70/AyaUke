'use client';

import { useLiveRegion } from '@/hooks/useLiveRegion';

interface LiveRegionAnnouncerProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export function LiveRegionAnnouncer({ message, politeness = 'polite' }: LiveRegionAnnouncerProps) {
  useLiveRegion(message, politeness);
  return null; // This component doesn't render anything visible
}
