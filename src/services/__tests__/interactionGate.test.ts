import {
    beginUiActivity,
    endUiActivity,
    isUiBusy,
    noteUiActivity,
    resetUiActivityForTests,
    runAfterInteractionsWithDeadline,
} from "../interactionGate";

describe("runAfterInteractionsWithDeadline", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetUiActivityForTests();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("runs on the next tick when nothing is happening", () => {
        const work = jest.fn();
        runAfterInteractionsWithDeadline(work, 2000);
        expect(work).not.toHaveBeenCalled();
        jest.advanceTimersByTime(0);
        expect(work).toHaveBeenCalledTimes(1);
    });

    it("waits for a drag to end, then its tail, and runs once", () => {
        beginUiActivity("scroll");
        const work = jest.fn();
        runAfterInteractionsWithDeadline(work, 2000);
        jest.advanceTimersByTime(600);
        expect(work).not.toHaveBeenCalled();
        endUiActivity("scroll", 250);
        jest.advanceTimersByTime(100);
        expect(work).not.toHaveBeenCalled(); // still inside the tail
        jest.advanceTimersByTime(300);
        expect(work).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(5000);
        expect(work).toHaveBeenCalledTimes(1);
    });

    it("runs at the deadline when the interaction never ends", () => {
        beginUiActivity("sheet");
        const work = jest.fn();
        runAfterInteractionsWithDeadline(work, 2000);
        jest.advanceTimersByTime(1900);
        expect(work).not.toHaveBeenCalled();
        jest.advanceTimersByTime(200);
        expect(work).toHaveBeenCalledTimes(1);
        endUiActivity("sheet");
        jest.advanceTimersByTime(1000);
        expect(work).toHaveBeenCalledTimes(1);
    });

    it("counts overlapping activities of one kind", () => {
        beginUiActivity("nav");
        beginUiActivity("nav");
        endUiActivity("nav", 0);
        expect(isUiBusy()).toBe(true);
        endUiActivity("nav", 0);
        expect(isUiBusy()).toBe(false);
    });

    it("a momentary note keeps the gate closed only for its tail", () => {
        noteUiActivity(250);
        expect(isUiBusy()).toBe(true);
        jest.advanceTimersByTime(251);
        expect(isUiBusy()).toBe(false);
    });
});
