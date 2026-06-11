import { useEffect, useState } from 'react';

/** 값 변경을 delay(ms) 동안 지연시켜 과도한 재계산/요청을 방지 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
