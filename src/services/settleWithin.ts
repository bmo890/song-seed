/**
 * Resolves when `call` settles or after `ms`, whichever is first; never rejects.
 * Right after a saved take, iOS can hand the next take a guide player whose seek
 * never answers. A take's start awaited it: the recorder rolled for a minute behind
 * a 0:00 clock that would not pause, and the run-up landed in the layer
 * (2026-10-26). A call that answers late still lands; the take just stops waiting.
 */
export async function settleWithin(call: Promise<unknown> | void, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const bounded = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  const settled = Promise.resolve(call).then(
    () => true,
    () => true
  );
  try {
    return await Promise.race([settled, bounded]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
