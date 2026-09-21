import { persistLog } from "./persistLog";

// A step the user is waiting on that takes this long is worth a line in the
// diagnostics bundle: it names WHICH awaited hop was slow on a real phone.
const SLOW_STEP_MS = 750;

export class StepTimeoutError extends Error {
    constructor(label: string, ms: number) {
        super(`${label} did not finish within ${ms}ms`);
        this.name = "StepTimeoutError";
    }
}

type StepOptions<T> = {
    /** Give up waiting after this long and reject with StepTimeoutError. The native
     *  call cannot be aborted, so it may still finish later — see `onLateResult`. */
    timeoutMs?: number;
    /** Runs if the work settles AFTER the timeout fired, to undo what nobody awaited. */
    onLateResult?: (result: T) => void;
};

/** Await `work`, recording how long the user waited on it. Never alters the result. */
export async function timedStep<T>(
    label: string,
    work: Promise<T> | (() => Promise<T>),
    options?: StepOptions<T>
): Promise<T> {
    const startedAt = Date.now();
    const promise = typeof work === "function" ? work() : work;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
        if (!options?.timeoutMs) return await promise;
        const timeoutMs = options.timeoutMs;
        let timedOut = false;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                timedOut = true;
                reject(new StepTimeoutError(label, timeoutMs));
            }, timeoutMs);
        });
        promise.then(
            (result) => {
                if (timedOut) options.onLateResult?.(result);
            },
            () => {}
        );
        return await Promise.race([promise, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
        const ms = Date.now() - startedAt;
        if (__DEV__) console.log(`[Step] ${label} ${ms}ms`);
        if (ms >= SLOW_STEP_MS) persistLog("step.slow", { ms, detail: label });
    }
}
