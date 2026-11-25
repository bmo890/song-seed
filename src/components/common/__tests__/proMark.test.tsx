let mockPlan: { kind: string; daysLeft?: number } = { kind: "free" };
let mockAccess = false;
jest.mock("../../../domain/entitlements", () => ({
    useHasProAccess: () => mockAccess,
    usePlanState: () => mockPlan,
}));
jest.mock("../proUpsell", () => ({ isReceivedIdea: (id?: string | null) => id === "received" }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import React from "react";
import { useProLocked } from "../ProMark";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
    create(element: React.ReactElement): unknown;
    act(run: () => void): void;
};

function marked(options: Parameters<typeof useProLocked>[1] = {}) {
    let value = false;
    function Probe() {
        value = useProLocked("practice-suite", options);
        return null;
    }
    TestRenderer.act(() => {
        TestRenderer.create(<Probe />);
    });
    return value;
}

describe("the Pro mark", () => {
    it("marks a door the gate would stop", () => {
        mockPlan = { kind: "free" };
        mockAccess = false;
        expect(marked()).toBe(true);
    });

    it("marks Pro doors in the free month too (founder, 2026-11-25), though they open", () => {
        mockPlan = { kind: "freeMonth", daysLeft: 20 };
        mockAccess = true;
        expect(marked()).toBe(true);
    });

    it("never marks for a Pro member or founding install, a received song, or room left", () => {
        mockAccess = true;
        mockPlan = { kind: "pro" };
        expect(marked()).toBe(false);
        mockPlan = { kind: "founding" };
        expect(marked()).toBe(false);
        mockPlan = { kind: "freeMonth", daysLeft: 3 };
        expect(marked({ ideaId: "received" })).toBe(false);
        expect(marked({ atLimit: false })).toBe(false);
    });
});
