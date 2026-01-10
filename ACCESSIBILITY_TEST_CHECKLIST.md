# Accessibility Testing Checklist

## Screen Reader Testing (NVDA - Windows)

### Navigation
- [ ] Page title is announced correctly
- [ ] All headings are announced in correct hierarchy (H1 → H2)
- [ ] Landmark regions are announced (main, nav, aside)
- [ ] Button labels are clear and descriptive

### Interactive Elements
- [ ] Pagination buttons announce "이전 페이지" and "다음 페이지"
- [ ] Sync button announces "치지직 채널 영상 및 댓글 수집"
- [ ] Copy button announces "타임라인 댓글 복사하기"
- [ ] Search input announces "영상 제목 검색"
- [ ] Video cards announce title and status

### Dynamic Content
- [ ] Loading status is announced ("영상 목록을 불러오는 중입니다")
- [ ] Sync progress is announced
- [ ] Error messages are announced immediately
- [ ] Comment toggle announces state change
- [ ] Page changes are announced

### Forms
- [ ] YouTube URL input has associated label
- [ ] Form errors are announced
- [ ] Helper text is read by screen reader

## Keyboard Navigation Testing

### Tab Order
- [ ] Tab order follows visual layout
- [ ] All interactive elements are reachable
- [ ] Focus indicators are visible (2px outline)
- [ ] No keyboard traps (except intentional modal traps)

### Keyboard Shortcuts
- [ ] Enter activates buttons and links
- [ ] Space activates buttons
- [ ] Escape closes modals
- [ ] Tab/Shift+Tab navigate forward/backward

### Focus Management
- [ ] Focus moves to modal when opened
- [ ] Focus trapped inside modal
- [ ] Focus returns to trigger element when modal closes
- [ ] Focus visible on all interactive elements

## Color Contrast (WCAG AA)

### Text Contrast
- [ ] Body text: 4.5:1 ratio
- [ ] Large text (18pt+): 3:1 ratio
- [ ] Focus indicators: 3:1 ratio

### UI Component Contrast
- [ ] Button borders: 3:1 ratio
- [ ] Form inputs: 3:1 ratio
- [ ] Icons: 3:1 ratio

## Screen Reader Testing (VoiceOver - macOS)

- [ ] Repeat all NVDA tests with VoiceOver
- [ ] Test rotor navigation (headings, landmarks, links)
- [ ] Test table navigation if applicable

## Automated Testing

- [ ] Run axe DevTools scan (0 violations)
- [ ] Run Lighthouse accessibility audit (100 score)
- [ ] Run WAVE browser extension check

## Browser Testing

- [ ] Chrome + NVDA
- [ ] Firefox + NVDA
- [ ] Safari + VoiceOver
- [ ] Edge + Narrator

## Test Results

### Date: _________________
### Tester: _________________

### Summary of Findings:

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

### Critical Issues:

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

### Recommendations:

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
