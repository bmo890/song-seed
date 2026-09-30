/**
 * The state machine behind a text field that commits on a pause, not per
 * keystroke. Pure so it can be tested without React: `change` records the
 * latest draft and the commit that belongs to it (the field the user was in
 * when they typed), `flush` commits once, and `seed` adopts an outside value
 * while nothing is pending.
 */
export type DraftCommitter = {
  change: (next: string, commit: (value: string) => void) => void;
  flush: () => void;
  /** Adopt an outside value (undo, a different record). Ignored mid-edit. */
  seed: (value: string) => boolean;
  current: () => string;
  isPending: () => boolean;
};

export function createDraftCommitter(
  initial: string,
  schedule: (flush: () => void) => () => void
): DraftCommitter {
  let draft = initial;
  let committed = initial;
  let pending = false;
  let commit: ((value: string) => void) | null = null;
  let cancel: (() => void) | null = null;

  const flush = () => {
    if (cancel) {
      cancel();
      cancel = null;
    }
    if (!pending) return;
    pending = false;
    const run = commit;
    commit = null;
    if (draft === committed || !run) return;
    committed = draft;
    run(draft);
  };

  return {
    change: (next, nextCommit) => {
      draft = next;
      commit = nextCommit;
      pending = true;
      if (cancel) cancel();
      cancel = schedule(flush);
    },
    flush,
    seed: (value) => {
      if (pending) return false;
      if (value === draft) return false;
      draft = value;
      committed = value;
      return true;
    },
    current: () => draft,
    isPending: () => pending,
  };
}
