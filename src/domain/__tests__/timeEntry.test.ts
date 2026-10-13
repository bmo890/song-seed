import { formatTimeEntry, formatTimeMs, readTimeEntry, timeEntryFromMs, timeEntryToMs } from "../timeEntry";

const typed = (text: string) => {
  const entry = readTimeEntry(text);
  return { shown: formatTimeEntry(entry), ms: timeEntryToMs(entry) };
};

describe("typing a time", () => {
  it("fills from the right like a timer", () => {
    expect(typed("")).toEqual({ shown: "0:00", ms: 0 });
    expect(typed("4")).toEqual({ shown: "0:04", ms: 4000 });
    expect(typed("45")).toEqual({ shown: "0:45", ms: 45000 });
    expect(typed("123")).toEqual({ shown: "1:23", ms: 83000 });
    expect(typed("1230")).toEqual({ shown: "12:30", ms: 750000 });
  });

  it("re-reads its own formatted text, so each keystroke builds on the last", () => {
    // The field shows "0:45"; the user types 6 and the field holds "0:456".
    expect(typed("0:456")).toEqual({ shown: "4:56", ms: 296000 });
    // Backspace on "1:23" leaves "1:2".
    expect(typed("1:2")).toEqual({ shown: "0:12", ms: 12000 });
  });

  it("takes one digit of tenths after a dot", () => {
    expect(typed("123.")).toEqual({ shown: "1:23.", ms: 83000 });
    expect(typed("123.5")).toEqual({ shown: "1:23.5", ms: 83500 });
    expect(typed("123.57")).toEqual({ shown: "1:23.5", ms: 83500 });
    expect(typed("1.2.3")).toEqual({ shown: "0:01.2", ms: 1200 });
  });

  it("carries seconds past 59 instead of refusing them", () => {
    expect(typed("90").ms).toBe(90000);
  });

  it("drops anything that is not a digit or a dot", () => {
    expect(typed("1m 23s")).toEqual({ shown: "1:23", ms: 83000 });
    expect(typed("abc")).toEqual({ shown: "0:00", ms: 0 });
  });

  it("keeps the last six digits of a runaway entry", () => {
    expect(typed("12345678").shown).toBe("3456:78");
  });
});

describe("showing a time", () => {
  it("round-trips a mark's position", () => {
    for (const ms of [0, 4000, 6500, 83000, 83500, 750000]) {
      expect(timeEntryToMs(timeEntryFromMs(ms))).toBe(ms);
    }
  });

  it("shows tenths only when there are any, rounded to a tenth", () => {
    expect(formatTimeMs(6000)).toBe("0:06");
    expect(formatTimeMs(6500)).toBe("0:06.5");
    expect(formatTimeMs(6449)).toBe("0:06.4");
    expect(formatTimeMs(83000)).toBe("1:23");
  });
});
