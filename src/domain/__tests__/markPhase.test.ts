import { pinPhase, sectionPhase } from "../markPhase";

describe("sectionPhase", () => {
  it("is ahead, then now, then past as the playhead crosses it", () => {
    expect(sectionPhase(4000, 9000, 3999)).toBe("ahead");
    expect(sectionPhase(4000, 9000, 4000)).toBe("now");
    expect(sectionPhase(4000, 9000, 8999)).toBe("now");
    expect(sectionPhase(4000, 9000, 9000)).toBe("past");
  });

  it("never lights two touching sections at once", () => {
    const at = 9000;
    expect([sectionPhase(4000, 9000, at), sectionPhase(9000, 14000, at)]).toEqual(["past", "now"]);
  });
});

describe("pinPhase", () => {
  it("is now for a second either side, then past", () => {
    expect(pinPhase(6000, 4999)).toBe("ahead");
    expect(pinPhase(6000, 5000)).toBe("now");
    expect(pinPhase(6000, 7000)).toBe("now");
    expect(pinPhase(6000, 7001)).toBe("past");
  });
});
