import { describe, expect, it } from "vitest";
import { adminAgo, adminDate, adminPeriod } from "./admin-overview";
describe("admin display and period policy", () => {
  it("defaults to lifetime and supports rolling periods", () => {
    expect(adminPeriod(new URLSearchParams())).toEqual({});
    const now = new Date("2026-11-09T05:00:00Z");
    expect(adminPeriod(new URLSearchParams("period=30"), now)).toEqual({
      start: new Date("2026-10-10T05:00:00Z"),
      end: now,
    });
  });
  it("uses inclusive KST calendar dates for custom periods", () => {
    expect(
      adminPeriod(
        new URLSearchParams("period=custom&start=2026-10-01&end=2026-10-01"),
      ),
    ).toEqual({
      start: new Date("2026-09-30T15:00:00Z"),
      end: new Date("2026-10-01T15:00:00Z"),
    });
  });
  it.each([
    "period=other",
    "period=custom",
    "period=custom&start=2026-02-30&end=2026-03-01",
    "period=custom&start=2026-11-10&end=2026-11-09",
  ])("rejects invalid dates: %s", (query) =>
    expect(() => adminPeriod(new URLSearchParams(query))).toThrow(),
  );
  it("displays missing records without implying inactivity", () => {
    expect(adminDate(null)).toBe("기록 없음");
    expect(adminAgo(null)).toBe("기록 없음");
    expect(adminAgo("2026-09-09", new Date("2026-11-09").getTime())).toBe(
      "2개월 전",
    );
    expect(adminDate("2026-10-31T16:00:00Z")).toContain("11. 01.");
  });
});
