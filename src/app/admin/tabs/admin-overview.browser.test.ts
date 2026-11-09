import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { build } from "vite";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import type { AdminOverview } from "@/domains/operations/admin-overview";

describe("admin overview and people UI", () => {
  let browser: Browser, javascript: string, css: string;
  beforeAll(async () => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      oxc: { jsx: { runtime: "automatic", development: false } },
      resolve: { alias: { "@": path.resolve("src") } },
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [
        {
          name: "admin-review-fixture",
          resolveId(id) {
            if (id === "admin-fixture") return "\0admin-fixture.tsx";
          },
          load(id) {
            if (id === "\0admin-fixture.tsx")
              return `import React from 'react';import {createRoot} from 'react-dom/client';import Dashboard from '${path.resolve("src/app/admin/tabs/DashboardTab.tsx").replaceAll("\\", "/")}';import Users from '${path.resolve("src/app/admin/tabs/UserManagementTab.tsx").replaceAll("\\", "/")}';function App(){const [tab,setTab]=React.useState('dashboard');return <main style={{padding:16,maxWidth:1440,margin:'auto'}}><button onClick={()=>setTab('users')}>사용자 화면</button><button onClick={()=>setTab('dashboard')}>대시보드 화면</button>{tab==='users'?<Users/>:<Dashboard onNavigate={setTab}/>}</main>}createRoot(document.getElementById('root')).render(<App/>);`;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: "admin-fixture",
          output: { inlineDynamicImports: true },
        },
      },
    });
    const output = Array.isArray(result) ? result[0] : result;
    if (!("output" in output)) throw Error("build");
    javascript = output.output
      .filter((x) => x.type === "chunk")
      .map((x) => x.code)
      .join("\n");
    const require = createRequire(import.meta.url),
      config = require(path.resolve("tailwind.config.js"));
    css = (
      await postcss([
        tailwindcss({
          ...config,
          content: [
            "./src/app/admin/tabs/DashboardTab.tsx",
            "./src/app/admin/tabs/UserManagementTab.tsx",
            "./src/components/admin/*.tsx",
          ],
        }),
      ]).process("@tailwind base; @tailwind components; @tailwind utilities;", {
        from: undefined,
      })
    ).css;
    browser = await chromium.launch({ headless: true });
  }, 60000);
  afterAll(async () => {
    await browser?.close();
  });
  async function fixture(width = 390, dark = false) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const record = {
      id: "record",
      title: "오래된 기록도 사라지지 않는 곡",
      subtitle: "가수",
      at: "2025-07-12T00:00:00Z",
    };
    const data: AdminOverview = {
      generatedAt: "2026-11-09T00:00:00Z",
      canManageUsers: true,
      totals: {
        songs: 570,
        mr: 569,
        duration: 82,
        users: 21,
        clips: 4164,
        playable: 4033,
        verified: 170,
        songLikes: 51,
        clipLikes: 2,
        songPlaylists: 3,
        clipPlaylists: 2,
      },
      period: {
        users: 21,
        clips: 4164,
        songLikes: 51,
        clipLikes: 2,
        playlists: 5,
      },
      work: {
        unavailable: 131,
        reports: 0,
        proposals: 0,
        timelines: {
          unmatched: 620,
          matchedUnverified: 4123,
          aiUnverified: 252,
        },
        videos: [
          {
            id: "video",
            title:
              "아주 긴 영상 제목 — 최근 수정한 타임라인 검증을 이어서 진행합니다",
            total: 20,
            verified: 5,
            unmatched: 2,
            at: record.at,
          },
        ],
      },
      recent: {
        clips: [record],
        users: [{ ...record, title: "새 사용자" }],
        playlists: [{ ...record, title: "공개 플레이리스트" }],
        likes: [{ ...record, title: "좋아요한 곡" }],
      },
    };
    const user = {
      _id: "507f1f77bcf86cd799439011",
      channelName: "아주 긴 사용자 이름도 잘 보이도록",
      displayName: "활동 사용자",
      channelId: "user-channel",
      role: "user",
      createdAt: record.at,
      lastLoginAt: record.at,
      lastVisitAt: "2026-11-02T00:00:00Z",
      lastActivityAt: "2026-11-02T00:00:00Z",
      visitDays: 10,
      likesCount: 15,
      clipLikesCount: 2,
      playlistsCount: 2,
      clipPlaylistsCount: 1,
      addedClipsCount: 0,
      proposalsCount: 0,
      titles: [],
      selectedTitle: null,
      activityStats: {
        totalLoginDays: 10,
        currentStreak: 1,
        longestStreak: 2,
        lastVisitDate: "2026-11-02",
      },
      channelNameHistory: [],
      preferences: { theme: "system", defaultPlaylistView: "grid" },
    };
    const control = { queries: [] as string[], writes: 0, fail: false };
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "admin.test") return route.abort();
      if (url.pathname === "/")
        return route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: `<html ${dark ? 'class="dark"' : ""}><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="background:${dark ? "#111827" : "#faf8ff"}"><div id="root"></div><script type="module">${javascript}</script></body></html>`,
        });
      if (route.request().method() !== "GET") control.writes++;
      control.queries.push(url.pathname + url.search);
      if (control.fail)
        return route.fulfill({
          status: 500,
          json: { error: "테스트 조회 실패" },
        });
      if (url.pathname.endsWith("/dashboard-stats"))
        return route.fulfill({
          json: {
            ...data,
            period:
              url.searchParams.get("period") === "all"
                ? data.period
                : {
                    users: 2,
                    clips: 18,
                    songLikes: 0,
                    clipLikes: 0,
                    playlists: 0,
                  },
          },
        });
      if (url.pathname.endsWith("/activity"))
        return route.fulfill({
          json: {
            visits: [{ date: "2026-11-02", lastVisitAt: user.lastVisitAt }],
            clipLikes: [record],
            clipPlaylists: [],
            contributions: { clips: 0, proposals: 0, applied: 0, reports: 0 },
          },
        });
      if (url.pathname.endsWith(`/${user._id}`))
        return route.fulfill({ json: { user, likedSongs: [], playlists: [] } });
      return route.fulfill({
        json: {
          users: url.searchParams.get("search") === "없는 사용자" ? [] : [user],
          overview: { total: 21, admins: 1 },
          pagination: {
            currentPage: Number(url.searchParams.get("page")) || 1,
            totalPages: 2,
            totalUsers: 21,
            hasPreviousPage: url.searchParams.get("page") === "2",
            hasNextPage: url.searchParams.get("page") !== "2",
            limit: 20,
          },
        },
      });
    });
    await page.goto("http://admin.test/");
    await page.getByText("4,164", { exact: true }).first().waitFor();
    return { page, control, errors };
  }
  it("keeps lifetime cards and old records visible when filtering, including mobile custom dates", async () => {
    const { page, control, errors } = await fixture();
    expect(
      await page
        .locator("html")
        .evaluate((e) => e.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByLabel("신규 기록 집계 기간").selectOption("30");
    await page.getByText("곡 좋아요").count();
    await page.waitForFunction(() =>
      document
        .querySelector('[aria-label="기간별 신규 기록"]')
        ?.textContent?.includes("가입 2명"),
    );
    expect(await page.getByText("4,164", { exact: true }).isVisible()).toBe(
      true,
    );
    expect(
      await page
        .getByText("오래된 기록도 사라지지 않는 곡", { exact: true })
        .isVisible(),
    ).toBe(true);
    await page.getByLabel("신규 기록 집계 기간").selectOption("custom");
    await page.getByLabel("시작일", { exact: true }).fill("2026-10-01");
    await page.getByLabel("종료일", { exact: true }).fill("2026-10-31");
    await page.getByRole("button", { name: "기간 적용", exact: true }).click();
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[role="status"]')
          ?.textContent?.includes("집계 중"),
    );
    expect(
      control.queries.some((q) =>
        q.includes("start=2026-10-01&end=2026-10-31"),
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(tmpdir(), "ayauke-admin-dashboard-mobile.png"),
      fullPage: true,
    });
    expect(control.writes).toBe(0);
    expect(errors).toEqual([]);
    await page.close();
  });
  it("supports people search, pagination, readonly activity and accessible modal dismissal on mobile", async () => {
    const { page, control, errors } = await fixture();
    await page
      .getByRole("button", { name: "사용자 화면", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "활동 사용자 사용자 상세 보기",
        exact: true,
      })
      .waitFor();
    expect(
      await page
        .locator("html")
        .evaluate((e) => e.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByText("검색 결과 21명 · 2 / 2 페이지").waitFor();
    await page.getByLabel("사용자 검색").fill("없는 사용자");
    await page.getByText("검색 조건에 맞는 사용자가 없습니다.").waitFor();
    await page.getByLabel("사용자 검색").fill("");
    await page
      .getByRole("button", {
        name: "활동 사용자 사용자 상세 보기",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", {
        name: "활동 사용자 사용자 상세 보기",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "활동 사용자 사용자 상세",
    });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "클립·활동 기록" }).click();
    await dialog
      .getByRole("heading", { name: "방문 기록", exact: true })
      .waitFor();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({path:path.join(tmpdir(),"ayauke-admin-user-activity-mobile.png"),fullPage:false});
    expect(await page.evaluate(() => document.body.style.position)).toBe(
      "fixed",
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    expect(await page.evaluate(() => document.body.style.position)).not.toBe(
      "fixed",
    );
    expect(
      await page
        .getByRole("button", {
          name: "활동 사용자 사용자 상세 보기",
          exact: true,
        })
        .evaluate((e) => e === document.activeElement),
    ).toBe(true);
    await page.screenshot({
      path: path.join(tmpdir(), "ayauke-admin-users-mobile.png"),
      fullPage: true,
    });
    expect(control.writes).toBe(0);
    expect(errors).toEqual([]);
    await page.close();
  });
  it("shows usable errors and retries on desktop, including dark mode", async () => {
    const { page, control, errors } = await fixture(1440, true);
    await page.screenshot({
      path: path.join(tmpdir(), "ayauke-admin-dashboard-dark.png"),
      fullPage: true,
    });
    control.fail = true;
    await page.getByRole("button", { name: "대시보드 새로고침" }).click();
    await page.getByRole("alert").waitFor();
    control.fail = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await page.getByRole("alert").waitFor({ state: "detached" });
    expect(errors).toEqual([]);
    expect(control.writes).toBe(0);
    await page.close();
  });
});
