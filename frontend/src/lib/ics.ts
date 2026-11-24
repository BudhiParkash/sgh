/** Minimal RFC 5545 calendar builder (pure; unit-tested). */
export interface IcsEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  url?: string;
  /** Minutes before start for a reminder alarm. */
  alarmMinutes?: number;
}

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
const fold = (line: string) => (line.length <= 74 ? line : line.match(/.{1,73}/g)!.join("\r\n "));

export function buildIcs(events: IcsEvent[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shivanshi Gaming Hub//Tournaments//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${fmt(now)}`, `DTSTART:${fmt(e.start)}`, `DTEND:${fmt(e.end)}`, fold(`SUMMARY:${esc(e.title)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${esc(e.description)}`));
    if (e.url) lines.push(fold(`URL:${e.url}`));
    if (e.alarmMinutes) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(e.title)}`), `TRIGGER:-PT${e.alarmMinutes}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: { title: string; start: Date; end: Date; details?: string }): string {
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${fmt(e.start)}/${fmt(e.end)}`, ...(e.details && { details: e.details }) });
  return `https://calendar.google.com/calendar/render?${p}`;
}
