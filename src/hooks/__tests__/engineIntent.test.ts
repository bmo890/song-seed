import { ENGINE_LOAD_GRACE_MS, presentEngineReport } from "../engineIntent";

const loaded = { isLoaded: true, isPlaying: false, didJustFinish: false };

describe("presentEngineReport", () => {
  it("a play that is still loading shows as playing", () => {
    const r = presentEngineReport(loaded, { playing: true, since: 1000 }, 1400);
    expect(r.playing).toBe(true);
    expect(r.recheckInMs).toBe(ENGINE_LOAD_GRACE_MS - 400);
  });

  it("a stop that outlasts any load is believed", () => {
    const r = presentEngineReport(loaded, { playing: true, since: 1000 }, 1000 + ENGINE_LOAD_GRACE_MS + 1);
    expect(r.playing).toBe(false);
    expect(r.intent.playing).toBe(false);
  });

  it("real playing renews the grace", () => {
    const r = presentEngineReport({ ...loaded, isPlaying: true }, { playing: true, since: 0 }, 9000);
    expect(r.intent.since).toBe(9000);
  });

  it("paused stays paused while it loads a seek", () => {
    expect(presentEngineReport(loaded, { playing: false, since: 0 }, 50).playing).toBe(false);
  });

  it("the end of the clip ends it at once", () => {
    const r = presentEngineReport({ ...loaded, didJustFinish: true }, { playing: true, since: 0 }, 10);
    expect(r.playing).toBe(false);
  });

  it("a build that says what it was asked wins", () => {
    expect(presentEngineReport({ ...loaded, playWhenReady: true }, { playing: false, since: 0 }, 99999).playing).toBe(
      true
    );
    expect(presentEngineReport({ ...loaded, isPlaying: true, playWhenReady: false }, { playing: true, since: 0 }, 1).playing).toBe(
      false
    );
  });
});
