// __DEV__ only. Measures what "the app feels slow" actually is: how long the JS
// thread goes without servicing a timer (every tap waits at least that long), and
// what the store was doing in the same window. App.tsx requires it under __DEV__.
import { useStore } from "../state/useStore";
import { onRecordingActivityChange } from "../services/audioForegroundActivity";

const TICK_MS = 50;
const STALL_MS = 120;
const REPORT_MS = 5_000;

let started = false;

export function startJsStallMonitor() {
    if (!__DEV__ || started) return;
    started = true;
    onRecordingActivityChange((active) => console.log(`[StallWho] recording active: ${active}`));

    let last = Date.now();
    let stalls: number[] = [];
    let sets = 0;
    const changedKeys = new Map<string, number>();
    let subscriberMs = 0;

    // Registered first-ish; measures nothing about other subscribers on its own, so the
    // set→settled cost is sampled by timing a microtask hop after each notification.
    useStore.subscribe((state, prev) => {
        sets += 1;
        const at = Date.now();
        if (state.workspaces !== prev.workspaces) {
            // What changed in the library? Names the writer by its footprint.
            const prevIdeas = new Map(prev.workspaces.flatMap((ws) => ws.ideas).map((idea) => [idea.id, idea]));
            let changedIdeas = 0;
            let added = 0;
            const fields = new Map<string, number>();
            for (const ws of state.workspaces) {
                for (const idea of ws.ideas) {
                    const before = prevIdeas.get(idea.id);
                    if (!before) { added += 1; continue; }
                    if (before === idea) continue;
                    changedIdeas += 1;
                    for (const key of Object.keys(idea) as (keyof typeof idea)[]) {
                        if (idea[key] !== before[key]) fields.set(key as string, (fields.get(key as string) ?? 0) + 1);
                    }
                    const beforeClips = new Map(before.clips.map((clip) => [clip.id, clip]));
                    for (const clip of idea.clips) {
                        const clipBefore = beforeClips.get(clip.id);
                        if (!clipBefore || clipBefore === clip) continue;
                        for (const key of Object.keys(clip) as (keyof typeof clip)[]) {
                            if (clip[key] !== clipBefore[key]) fields.set(`clip.${key as string}`, (fields.get(`clip.${key as string}`) ?? 0) + 1);
                        }
                    }
                }
            }
            const summary = [...fields.entries()].map(([k, n]) => `${k}×${n}`).join(" ");
            console.log(`[StallWho] library write: +${added} ideas, ${changedIdeas} changed · ${summary}`);
        }
        for (const key of Object.keys(state) as (keyof typeof state)[]) {
            if (state[key] !== prev[key]) {
                changedKeys.set(key as string, (changedKeys.get(key as string) ?? 0) + 1);
            }
        }
        setTimeout(() => {
            subscriberMs += Date.now() - at;
        }, 0);
    });

    setInterval(() => {
        const now = Date.now();
        const lag = now - last - TICK_MS;
        last = now;
        if (lag >= STALL_MS) {
            stalls.push(lag);
            console.log(`[Stall] JS thread blocked ${lag}ms`);
        }
    }, TICK_MS);

    setInterval(() => {
        if (stalls.length === 0 && sets === 0) return;
        const total = stalls.reduce((a, b) => a + b, 0);
        const worst = stalls.length ? Math.max(...stalls) : 0;
        const keys = [...changedKeys.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([k, n]) => `${k}×${n}`)
            .join(" ");
        const g = globalThis as any;
        console.log(`[Renders] timeline ${g.__tlRenders ?? 0} reel ${g.__reelRenders ?? 0} recorder ${g.__recRenders ?? 0} in ${REPORT_MS / 1000}s`);
        g.__tlRenders = 0; g.__reelRenders = 0; g.__recRenders = 0;
        console.log(
            `[StallReport] ${REPORT_MS / 1000}s: blocked ${total}ms in ${stalls.length} stalls (worst ${worst}ms) · ` +
                `${sets} store sets, set→idle ${subscriberMs}ms · ${keys}`
        );
        stalls = [];
        sets = 0;
        subscriberMs = 0;
        changedKeys.clear();
    }, REPORT_MS);
}
