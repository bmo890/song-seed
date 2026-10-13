/**
 * Typing a time into the reel's At / Start / End boxes.
 *
 * The field is a digits-only pad that fills from the right, the way a timer
 * does: "45" is 0:45, "123" is 1:23, "1230" is 12:30. A single decimal digit
 * gives tenths: "123.5" is 1:23.5. No colon to hunt for on a number pad, and
 * the same keys on every platform. Pasted text with colons reads the same way,
 * since everything but digits and the first dot is dropped.
 */

/** Longest run of digits kept before the dot: mmmm + ss. */
const MAX_DIGITS = 6;

export type TimeEntry = {
  /** Whole-seconds digits, minutes then seconds, no separators. */
  digits: string;
  /** One tenths digit, or "" when none was typed. */
  tenths: string;
  /** True while the entry ends on a bare dot — "1:23." waiting for its digit. */
  openDot: boolean;
};

/** Read whatever the field holds into an entry. */
export function readTimeEntry(text: string): TimeEntry {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = (dot < 0 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const after = dot < 0 ? "" : cleaned.slice(dot + 1).replace(/\./g, "");
  return {
    digits: whole.slice(-MAX_DIGITS),
    tenths: after.slice(0, 1),
    openDot: dot >= 0 && after.length === 0,
  };
}

/** "123" → "1:23", "45" → "0:45", "" → "0:00"; tenths appended when present. */
export function formatTimeEntry(entry: TimeEntry): string {
  const padded = entry.digits.padStart(3, "0");
  const minutes = String(Number(padded.slice(0, -2)));
  const seconds = padded.slice(-2);
  const tail = entry.tenths ? `.${entry.tenths}` : entry.openDot ? "." : "";
  return `${minutes}:${seconds}${tail}`;
}

/** Milliseconds for an entry. Seconds past 59 simply carry ("90" is 1:30). */
export function timeEntryToMs(entry: TimeEntry): number {
  const padded = entry.digits.padStart(3, "0");
  const minutes = Number(padded.slice(0, -2));
  const seconds = Number(padded.slice(-2));
  const tenths = entry.tenths ? Number(entry.tenths) : 0;
  return minutes * 60000 + seconds * 1000 + tenths * 100;
}

/** The entry that shows a given time, tenths only when it has any. */
export function timeEntryFromMs(ms: number): TimeEntry {
  const safe = Math.max(0, Math.round(ms / 100) * 100);
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const tenths = Math.round((safe % 1000) / 100);
  const digits = `${minutes}${String(seconds).padStart(2, "0")}`.replace(/^0+(?=\d)/, "");
  return { digits, tenths: tenths > 0 ? String(tenths) : "", openDot: false };
}

/** "0:06" or "1:23.5" for a time in ms — the same shape the field shows. */
export function formatTimeMs(ms: number): string {
  return formatTimeEntry(timeEntryFromMs(ms));
}
