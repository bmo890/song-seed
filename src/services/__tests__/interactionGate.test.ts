import { InteractionManager } from "react-native";
import { runAfterInteractionsWithDeadline } from "../interactionGate";

jest.mock("react-native", () => ({
    InteractionManager: { runAfterInteractions: jest.fn() },
}));

const runAfterInteractions = InteractionManager.runAfterInteractions as jest.Mock;

describe("runAfterInteractionsWithDeadline", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        runAfterInteractions.mockReset();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("runs once when the interaction ends first", () => {
        let release: (() => void) | null = null;
        runAfterInteractions.mockImplementation((cb: () => void) => {
            release = cb;
        });
        const work = jest.fn();
        runAfterInteractionsWithDeadline(work, 2000);
        expect(work).not.toHaveBeenCalled();
        release!();
        expect(work).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(5000);
        expect(work).toHaveBeenCalledTimes(1);
    });

    it("runs once at the deadline when the interaction never ends", () => {
        let release: (() => void) | null = null;
        runAfterInteractions.mockImplementation((cb: () => void) => {
            release = cb;
        });
        const work = jest.fn();
        runAfterInteractionsWithDeadline(work, 2000);
        jest.advanceTimersByTime(1999);
        expect(work).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(work).toHaveBeenCalledTimes(1);
        release!();
        expect(work).toHaveBeenCalledTimes(1);
    });
});
