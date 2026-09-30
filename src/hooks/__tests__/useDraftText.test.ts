import { createDraftCommitter } from "../../domain/draftCommitter";

function withTimers() {
  let scheduled: (() => void) | null = null;
  const schedule = (flush: () => void) => {
    scheduled = flush;
    return () => {
      scheduled = null;
    };
  };
  return { schedule, fire: () => scheduled?.() };
}

describe("draft committer (behind useDraftText)", () => {
  it("commits once after the pause, with the last draft", () => {
    const t = withTimers();
    const commit = jest.fn();
    const c = createDraftCommitter("", t.schedule);
    c.change("h", commit);
    c.change("he", commit);
    c.change("hel", commit);
    expect(commit).not.toHaveBeenCalled();
    t.fire();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("hel");
    expect(c.isPending()).toBe(false);
  });

  it("flush on demand commits once and skips a no-op", () => {
    const t = withTimers();
    const commit = jest.fn();
    const c = createDraftCommitter("start", t.schedule);
    c.flush();
    expect(commit).not.toHaveBeenCalled();
    c.change("start!", commit);
    c.flush();
    expect(commit).toHaveBeenCalledWith("start!");
    c.flush();
    t.fire();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("re-seeds from an outside value while idle, never mid-edit", () => {
    const t = withTimers();
    const c = createDraftCommitter("a", t.schedule);
    expect(c.seed("undone")).toBe(true);
    expect(c.current()).toBe("undone");
    c.change("typing", jest.fn());
    expect(c.seed("elsewhere")).toBe(false);
    expect(c.current()).toBe("typing");
  });

  it("runs the commit captured at typing time, not a later one", () => {
    const t = withTimers();
    const first = jest.fn();
    const second = jest.fn();
    const c = createDraftCommitter("", t.schedule);
    c.change("for the first note", first);
    // The caller switched records before the pause; the draft still lands
    // where it was typed.
    c.flush();
    expect(first).toHaveBeenCalledWith("for the first note");
    expect(second).not.toHaveBeenCalled();
  });
});
