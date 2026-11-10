# Mobile app shell

## Interaction model

- Public pages use five bottom destinations: home, songbook, clips, library, and more.
- Clip / playlist detail pages retain their parent tab and offer a deterministic parent link, including external deep links.
- Admin, game, OBS and embed routes do not receive the public bottom tabs.
- More is a Headless UI dialog: scroll lock, focus containment, Escape, focus restoration, and a scrollable safe-area-aware sheet. The separately portaled tab bar is inert while the sheet is open.
- The root `#app-shell` keeps background page and playback controls in one inert boundary when a menu dialog opens.
- The persistent video stage is not remounted when moving the mini player above the tabs or expanding it.

## Responsive layout

`globals.css` keeps the mobile shell below 768px. Existing desktop layouts and dark color tokens remain in use.

- `--mobile-tab-height`: bottom tabs + device safe area.
- `--player-clearance`: extra content space only when the collapsed player exists.
- Body padding and scroll padding reserve the same space; scroll-to-top follows the same offsets.
- The root viewport uses `viewport-fit=cover` without disabling zoom.
- Home has a smaller portrait and shorter first screen. Search headers are compact and left-aligned.
- Songbook filters start collapsed on phones, with explicit search labels and a visible filter label.
- Clips keep sorting visible and put secondary filters in a horizontally scrollable row.
- Library cards keep playback and management touch-sized next to the title; additional queue actions use a separate row when available.
- Profile tabs scroll horizontally; detail sheets and expanded playback account for safe areas.

## PWA

`PwaInstallProvider` retains the browser install event across page-owned Navigation remounts. The more sheet offers installation when supported, platform-specific instructions otherwise, and hides installation guidance in standalone mode. Browser installation still requires a secure deployed origin and browser support; it is not an offline media download feature.

Service worker registration handles hydration both before and after the load event. Existing media caching behavior is unchanged.

## Verification

- `npx tsc --noEmit`
- Unit tests: mobile route boundaries, PWA registration timing, and range controls / timeline / editor policies.
- Browser review uses a temporary static bundle of actual UI components with mocked authentication, data and video. No development server, live DB writes, or real media requests are needed.
- Check 320px / 390px widths, desktop navigation, dark mode, focus restoration, filter expansion, install-event retention, and mini-player / tab geometry.
- Real iOS / Android installation, virtual keyboards, streaming and device safe areas still need a deployed-device check; a mocked static preview cannot verify these end to end.
