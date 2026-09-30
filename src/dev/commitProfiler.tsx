// __DEV__ only. A React.Profiler at the root that says how much render work each
// page really costs: commits per second, total and worst actualDuration, keyed by
// the route on screen. Prints a summary every 5 s while anything committed, and
// any single commit over SLOW_COMMIT_MS the moment it lands. Wraps nothing in
// release builds (App.tsx mounts it under __DEV__ only).
import { Profiler, type ReactNode } from "react";

const REPORT_MS = 5_000;
const SLOW_COMMIT_MS = 24;

type Bucket = { commits: number; totalMs: number; maxMs: number; slow: number };

const buckets = new Map<string, Bucket>();
let reportTimer: ReturnType<typeof setTimeout> | null = null;
let routeOf: () => string = () => "?";

function flush() {
    reportTimer = null;
    if (buckets.size === 0) return;
    for (const [route, b] of buckets) {
        console.log(
            `[Commits] ${route}: ${b.commits} commits · ${b.totalMs.toFixed(0)} ms · max ${b.maxMs.toFixed(0)} ms` +
                (b.slow > 0 ? ` · ${b.slow} slow` : "")
        );
    }
    buckets.clear();
}

function onRender(
    _id: string,
    phase: "mount" | "update" | "nested-update",
    actualDuration: number
) {
    const route = routeOf();
    const b = buckets.get(route) ?? { commits: 0, totalMs: 0, maxMs: 0, slow: 0 };
    b.commits += 1;
    b.totalMs += actualDuration;
    if (actualDuration > b.maxMs) b.maxMs = actualDuration;
    if (actualDuration >= SLOW_COMMIT_MS) {
        b.slow += 1;
        console.log(`[Commit] ${route}: ${actualDuration.toFixed(0)} ms (${phase})`);
    }
    buckets.set(route, b);
    if (!reportTimer) reportTimer = setTimeout(flush, REPORT_MS);
}

// Effect phases: layout effects (onCommit) and passive effects (onPostCommit) of
// the whole subtree per commit. Render time alone under-reports a mount whose
// hooks do their work in effects (native handles, subscriptions, engine loads).
function onCommit(_id: string, phase: "mount" | "update" | "nested-update", effectDuration: number) {
    if (effectDuration >= 8) console.log(`[Effects] ${routeOf()}: layout ${effectDuration.toFixed(0)} ms (${phase})`);
}
function onPostCommit(_id: string, phase: "mount" | "update" | "nested-update", passiveEffectDuration: number) {
    if (passiveEffectDuration >= 8) console.log(`[Effects] ${routeOf()}: passive ${passiveEffectDuration.toFixed(0)} ms (${phase})`);
}

export function CommitProfiler({
    children,
    currentRoute,
}: {
    children: ReactNode;
    currentRoute: () => string;
}) {
    routeOf = currentRoute;
    return (
        <Profiler
            id="root"
            onRender={onRender}
            // Effect-phase hooks exist in React's dev/profiling builds; the typings omit them.
            {...({ onCommit, onPostCommit } as Record<string, unknown>)}
        >
            {children}
        </Profiler>
    );
}
