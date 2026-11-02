jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const mockDisk = new Map<string, string>();
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    cacheDirectory: "file:///cache/",
    getInfoAsync: jest.fn(async () => ({ exists: false })),
    makeDirectoryAsync: jest.fn(async () => {}),
    readAsStringAsync: jest.fn(async () => "[]"),
    writeAsStringAsync: jest.fn(async () => {}),
}));
jest.mock("expo-file-system", () => ({
    File: class {
        uri: string;
        constructor(uri: string) {
            this.uri = uri;
        }
        get exists() {
            return mockDisk.has(this.uri);
        }
        create() {
            mockDisk.set(this.uri, "");
        }
        write(value: string) {
            mockDisk.set(this.uri, value);
        }
        textSync() {
            return mockDisk.get(this.uri) ?? "";
        }
        delete() {
            mockDisk.delete(this.uri);
        }
    },
}));
jest.mock("expo-haptics", () => ({
    selectionAsync: jest.fn(async () => {}),
    impactAsync: jest.fn(async () => {}),
    notificationAsync: jest.fn(async () => {}),
    ImpactFeedbackStyle: {},
    NotificationFeedbackType: {},
}));
const mockBuild = jest.fn();
const mockSave = jest.fn();
jest.mock("../../../services/libraryBackup", () => ({
    BACKUP_SAVE_CANCELLED_MESSAGE: "cancelled",
    buildExactLibraryBackup: (...args: unknown[]) => mockBuild(...args),
    saveBuiltLibraryBackup: (...args: unknown[]) => mockSave(...args),
}));
jest.mock("../../../state/useStore", () => ({
    useStore: { getState: () => ({ activeWorkspaceId: "pkg", workspaces: [] }) },
}));

import React from "react";
// react-test-renderer ships without types in this repo; the few calls used are typed here.
type TestNode = { props: Record<string, any>; type: unknown };
type ReactTestRenderer = {
    root: { findAll: (match: (node: TestNode) => boolean) => TestNode[]; findAllByType: (type: unknown) => TestNode[] };
    update: (element: React.ReactElement) => void;
};
const { act, create } = require("react-test-renderer") as {
    act: (run: () => unknown) => any;
    create: (element: React.ReactElement) => ReactTestRenderer;
};
import { Text } from "react-native";
import { AppErrorBoundary } from "../AppErrorBoundary";
import { startupSetAsideWorkspaceId } from "../../../services/crashSetAside";
import { resolveStartupWorkspaceId } from "../../../domain/libraryNavigation";
import type { Workspace } from "../../../types";

/**
 * The crash screen's way out (audit 2026-11-02, 09 H1): a crash caused by stored
 * data used to repeat on Restart and on every cold launch, with nothing reachable.
 */

let shouldThrow = true;
function Bomb() {
    if (shouldThrow) throw new Error("title.trim is not a function");
    return <Text>library</Text>;
}

function labels(tree: ReactTestRenderer): string[] {
    // Pressable renders through a few layers that all carry the props: one per label.
    return Array.from(
        new Set(
            tree.root
                .findAll((node) => node.props?.accessibilityRole === "button")
                .map((node) => node.props.accessibilityLabel as string)
        )
    );
}

function press(tree: ReactTestRenderer, label: string) {
    const button = tree.root.findAll(
        (node) => node.props?.accessibilityRole === "button" && node.props.accessibilityLabel === label && typeof node.props.onPress === "function"
    )[0]!;
    return button.props.onPress();
}

beforeEach(() => {
    mockDisk.clear();
    shouldThrow = true;
    mockBuild.mockReset();
    mockSave.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

it("offers Back up, Open Home and Restart", () => {
    let tree!: ReactTestRenderer;
    act(() => {
        tree = create(
            <AppErrorBoundary>
                <Bomb />
            </AppErrorBoundary>
        );
    });
    expect(labels(tree)).toEqual(["Back up", "Open Home", "Restart SongNook"]);
});

it("remembers the workspace that crashed, so the next start opens elsewhere", () => {
    act(() => {
        create(
            <AppErrorBoundary>
                <Bomb />
            </AppErrorBoundary>
        );
    });
    expect(startupSetAsideWorkspaceId()).toBe("pkg");
});

it("Back up runs the existing exact backup and saves it", async () => {
    mockBuild.mockResolvedValue({ archiveUri: "file:///cache/b.zip", archiveTitle: "b", status: "complete", manifest: {} });
    mockSave.mockResolvedValue({ saveConfirmed: true });
    let tree!: ReactTestRenderer;
    act(() => {
        tree = create(
            <AppErrorBoundary>
                <Bomb />
            </AppErrorBoundary>
        );
    });
    await act(async () => {
        await press(tree, "Back up");
    });
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain("Backup saved");
});

it("a failed backup says so and leaves every way out", async () => {
    mockBuild.mockRejectedValue(new Error("disk"));
    let tree!: ReactTestRenderer;
    act(() => {
        tree = create(
            <AppErrorBoundary>
                <Bomb />
            </AppErrorBoundary>
        );
    });
    await act(async () => {
        await press(tree, "Back up");
    });
    expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain("The backup didn’t finish. Try again.");
    expect(labels(tree)).toEqual(["Back up", "Open Home", "Restart SongNook"]);
});

it("Restart tries the same place again; Open Home sets the crashed workspace aside", () => {
    let tree!: ReactTestRenderer;
    act(() => {
        tree = create(
            <AppErrorBoundary>
                <Bomb />
            </AppErrorBoundary>
        );
    });
    shouldThrow = false;
    act(() => {
        press(tree, "Restart SongNook");
    });
    expect(startupSetAsideWorkspaceId()).toBeNull();

    shouldThrow = true;
    act(() => {
        tree.update(
            <AppErrorBoundary>
                <Bomb />
            </AppErrorBoundary>
        );
    });
    shouldThrow = false;
    act(() => {
        press(tree, "Open Home");
    });
    expect(startupSetAsideWorkspaceId()).toBe("pkg");
});

describe("startup after a crash", () => {
    const ws = (id: string) => ({ id, title: id, collections: [], ideas: [] }) as unknown as Workspace;
    const base = { workspaces: [ws("mine"), ws("pkg")], primaryWorkspaceId: "mine", lastUsedWorkspaceId: "pkg", preference: "last-used" as const };

    it("never reopens the workspace set aside; the primary opens instead", () => {
        expect(resolveStartupWorkspaceId(base)).toBe("pkg");
        expect(resolveStartupWorkspaceId({ ...base, setAside: { workspaceId: "pkg" } })).toBe("mine");
    });

    it("when the primary is the one set aside, the workspace list opens", () => {
        expect(resolveStartupWorkspaceId({ ...base, setAside: { workspaceId: "mine" } })).toBeNull();
    });
});
