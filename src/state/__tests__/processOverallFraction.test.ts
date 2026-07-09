import { getProcessOverallFraction, type LibraryProcess } from "../useProcessStore";
import type { BackupOperationPhase } from "../../services/backupOperation";

function process(
    kind: LibraryProcess["kind"],
    phase: BackupOperationPhase,
    completedBytes: number,
    totalBytes: number,
    status: LibraryProcess["status"] = "running"
): LibraryProcess {
    return {
        id: "p",
        kind,
        title: "t",
        status,
        progress: { phase, completedBytes, totalBytes, message: "" },
        startedAt: 0,
        minimized: false,
        canCancel: true,
    };
}

describe("getProcessOverallFraction", () => {
    it("spans backup's two byte passes so progress never resets between phases", () => {
        // Prepare → 0.
        expect(getProcessOverallFraction(process("backup", "preparing", 0, 0))).toBe(0);
        // Halfway through the first pass (hashing) → a quarter overall (1 of 2 passes, half done).
        expect(getProcessOverallFraction(process("backup", "hashing", 50, 100))).toBeCloseTo(0.25);
        // End of the first pass → half overall, NOT 100% (the packaging pass still remains).
        expect(getProcessOverallFraction(process("backup", "hashing", 100, 100))).toBeCloseTo(0.5);
        // Start of the second pass stays at half — no reset to zero.
        expect(getProcessOverallFraction(process("backup", "packaging", 0, 100))).toBeCloseTo(0.5);
        // Halfway through packaging → three quarters overall.
        expect(getProcessOverallFraction(process("backup", "packaging", 50, 100))).toBeCloseTo(0.75);
        // Saving is the final, non-byte step → essentially done.
        expect(getProcessOverallFraction(process("backup", "saving", 0, 0))).toBe(1);
    });

    it("treats a successful process as fully complete regardless of phase", () => {
        expect(
            getProcessOverallFraction(process("backup", "hashing", 10, 100, "success"))
        ).toBe(1);
    });

    it("uses a single pass for export", () => {
        expect(getProcessOverallFraction(process("export", "preparing", 0, 0))).toBe(0);
        expect(getProcessOverallFraction(process("export", "packaging", 40, 100))).toBeCloseTo(0.4);
        expect(getProcessOverallFraction(process("export", "saving", 0, 0))).toBe(1);
    });

    it("spans restore's restore + verify passes and finishes at commit", () => {
        expect(getProcessOverallFraction(process("restore", "inspecting", 0, 0))).toBe(0);
        expect(getProcessOverallFraction(process("restore", "restoring", 100, 100))).toBeCloseTo(0.5);
        expect(getProcessOverallFraction(process("restore", "verifying", 50, 100))).toBeCloseTo(0.75);
        expect(getProcessOverallFraction(process("restore", "committing", 0, 0))).toBe(1);
    });
});
