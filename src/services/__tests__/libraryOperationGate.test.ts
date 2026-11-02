jest.mock("expo-haptics", () => ({}));
jest.mock("../../design/haptics", () => ({ haptic: { error: jest.fn() } }));
const mockToast = jest.fn();
jest.mock("../../components/common/toastStore", () => ({ toast: (...args: unknown[]) => mockToast(...args) }));

let mockTakeHolds = false;
jest.mock("../recordingTakeSession", () => ({ takeHoldsRecorder: () => mockTakeHolds }));

import {
    claimLibraryOperation,
    libraryOperationBlockedReason,
    recordingBlockedBy,
    resetLibraryOperationGateForTests,
    tellIfLibraryBusy,
    withLibraryOperation,
} from "../libraryOperationGate";

beforeEach(() => {
    mockTakeHolds = false;
    mockToast.mockReset();
    resetLibraryOperationGateForTests();
});

it("runs one heavy operation at a time", async () => {
    const release = claimLibraryOperation("restore");
    expect(() => claimLibraryOperation("archive")).toThrow(expect.objectContaining({ reason: "restore" }));
    release();
    await expect(withLibraryOperation("archive", async () => "done")).resolves.toBe("done");
    expect(libraryOperationBlockedReason()).toBeNull();
});

it("a take holding the recorder refuses every operation, calmly", () => {
    mockTakeHolds = true;
    let refusal: unknown;
    try {
        claimLibraryOperation("import");
    } catch (error) {
        refusal = error;
    }
    expect(tellIfLibraryBusy(refusal)).toBe(true);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(tellIfLibraryBusy(new Error("other"))).toBe(false);
});

it("a running operation refuses a take; the automatic backup steps aside instead", () => {
    const release = claimLibraryOperation("unarchive");
    expect(recordingBlockedBy()).toBe("unarchive");
    release();

    const stop = jest.fn();
    const releaseAuto = claimLibraryOperation("backup", { stepAside: stop });
    expect(recordingBlockedBy()).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(libraryOperationBlockedReason()).toBeNull();
    // Its late release can't free a slot someone else took meanwhile.
    const next = claimLibraryOperation("import");
    releaseAuto();
    expect(libraryOperationBlockedReason()).toBe("import");
    next();

    // An operation the person starts takes the slot from it too.
    const stopAgain = jest.fn();
    claimLibraryOperation("backup", { stepAside: stopAgain });
    const restore = claimLibraryOperation("restore");
    expect(stopAgain).toHaveBeenCalledTimes(1);
    restore();
});
