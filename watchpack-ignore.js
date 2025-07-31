// Watchpack 에러 억제를 위한 설정 파일
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Node.js의 process.stderr도 패치
const originalStderrWrite = process.stderr.write;

console.error = function(...args) {
  const message = args.join(' ');
  
  // Watchpack 관련 에러만 필터링
  if (message.includes('Watchpack Error') && 
      (message.includes('ENODEV') || message.includes('/mnt/g') || message.includes('no such device'))) {
    return;
  }
  
  originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  const message = args.join(' ');
  
  if (message.includes('Watchpack') && message.includes('/mnt/g')) {
    return;
  }
  
  originalConsoleWarn.apply(console, args);
};

// stderr 직접 출력도 필터링
process.stderr.write = function(chunk, encoding, callback) {
  if (typeof chunk === 'string' && 
      chunk.includes('Watchpack Error') && 
      (chunk.includes('/mnt/g') || chunk.includes('ENODEV'))) {
    // 필터링된 에러는 무시
    if (callback) callback();
    return true;
  }
  
  return originalStderrWrite.call(this, chunk, encoding, callback);
};