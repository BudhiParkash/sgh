import { describe, expect, it } from "vitest";
import { countdown } from "@/lib/countdown";
import { buildIcs, googleCalendarUrl } from "@/lib/ics";

const now = Date.parse("2026-12-01T12:00:00Z");
const iso = (offsetH: number) => new Date(now + offsetH * 3_600_000).toISOString();

describe("countdown", () => {
  it("prioritises an open registration deadline", () => {
    expect(countdown({ startDate: iso(240), endDate: iso(260), registrationDeadline: iso(30) }, now)).toEqual({ text: "Registration closes in 30 hours", tone: "warning" });
    expect(countdown({ startDate: iso(240), endDate: iso(260), registrationDeadline: iso(120) }, now)!.text).toBe("Registration closes in 5 days");
  });
  it("start, live, finished, cancelled, rumour", () => {
    expect(countdown({ startDate: iso(2), endDate: iso(5), registrationDeadline: null }, now)!.text).toBe("Starts in 2 hours");
    expect(countdown({ startDate: iso(-1), endDate: iso(5), registrationDeadline: null }, now)).toEqual({ text: "Live now", tone: "success" });
    expect(countdown({ startDate: iso(-10), endDate: iso(-5), registrationDeadline: null }, now)!.text).toBe("Finished");
    expect(countdown({ startDate: iso(10), endDate: null, registrationDeadline: null, status: "cancelled" }, now)!.text).toBe("Cancelled");
    expect(countdown({ startDate: iso(10), endDate: null, registrationDeadline: null, status: "rumour" }, now)).toBeNull();
  });
});

describe("ics", () => {
  it("builds a valid calendar with escaping, folding and an alarm", () => {
    const ics = buildIcs([{ uid: "a@x", title: "Cup; Finals, Day 1", start: new Date(now), end: new Date(now + 3_600_000), description: "x".repeat(200), alarmMinutes: 1440 }], new Date(now));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain(String.raw`SUMMARY:Cup\; Finals\, Day 1`);
    expect(ics).toContain("DTSTART:20261201T120000Z");
    expect(ics).toContain("TRIGGER:-PT1440M");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
  it("google calendar link", () => {
    expect(googleCalendarUrl({ title: "Cup", start: new Date(now), end: new Date(now + 1000) })).toContain("dates=20261201T120000Z%2F20261201T120001Z");
  });
});
