// __DEV__ only. Counts renders per named component and prints the census every
// 5 s while anything rendered — the "who re-rendered" half of commitProfiler's
// "how much". Call `useRenderCensus("Name")` at the top of a component; the
// hook is a no-op outside dev. Temporary instrumentation for the 2026-09-29
// performance examination; call sites are not meant to ship.
const REPORT_MS = 5_000;
const counts = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
    timer = null;
    if (counts.size === 0) return;
    const line = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `${name}×${n}`)
        .join("  ");
    console.log(`[Census] ${line}`);
    counts.clear();
}

export function useRenderCensus(name: string): void {
    if (!__DEV__) return;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!timer) timer = setTimeout(flush, REPORT_MS);
}
