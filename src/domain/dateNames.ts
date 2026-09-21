// Month and weekday names, looked up once per locale. Asking Intl for a name per list
// row is the slow path on Android (each call builds a formatter across the JNI bridge);
// twelve months and seven weekdays never change, so they are read once and indexed.

type NameStyle = "long" | "short";

const monthNames = new Map<string, string[]>();
const weekdayNames = new Map<string, string[]>();

export function getMonthName(locale: string, monthIndex: number, style: NameStyle): string {
  const cacheKey = `${locale}|${style}`;
  let names = monthNames.get(cacheKey);
  if (!names) {
    names = Array.from({ length: 12 }, (_, month) =>
      new Date(2024, month, 15).toLocaleDateString(locale, { month: style })
    );
    monthNames.set(cacheKey, names);
  }
  return names[monthIndex] ?? "";
}

/** `dayIndex` is Date#getDay(): 0 = Sunday. */
export function getWeekdayName(locale: string, dayIndex: number, style: NameStyle): string {
  const cacheKey = `${locale}|${style}`;
  let names = weekdayNames.get(cacheKey);
  if (!names) {
    // 2024-09-01 is a Sunday.
    names = Array.from({ length: 7 }, (_, day) =>
      new Date(2024, 8, 1 + day).toLocaleDateString(locale, { weekday: style })
    );
    weekdayNames.set(cacheKey, names);
  }
  return names[dayIndex] ?? "";
}
