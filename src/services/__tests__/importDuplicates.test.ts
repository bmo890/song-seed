jest.mock("../../state/useStore", () => ({ useStore: { getState: () => ({ workspaces: [] }) } }));

import { checkImportDuplicates } from "../importDuplicates";
import type { ClipVersion } from "../../types";

const asset = (uri: string, sourceCreatedAt?: number, name = uri) => ({ uri, name, sourceCreatedAt });
const clip = (sourceCreatedAt: number) => ({ id: `c${sourceCreatedAt}`, sourceCreatedAt }) as unknown as ClipVersion;

test("a file already in the library is a duplicate; a new one is not", () => {
    const result = checkImportDuplicates([asset("a", 1_790_000_000_000), asset("b", 1_790_000_000_500)], [clip(1_790_000_000_000)]);
    expect(result.duplicateAssets.map((a) => a.uri)).toEqual(["a"]);
    expect(result.uniqueAssets.map((a) => a.uri)).toEqual(["b"]);
});

test("the same file picked twice in one import is one file", () => {
    const result = checkImportDuplicates(
        [asset("x", 1_790_000_000_000, "Take.m4a"), asset("y", 1_790_000_000_000, "Take.m4a"), asset("x")],
        []
    );
    expect(result.allAssets.map((a) => a.uri)).toEqual(["x"]);
    expect(result.hasDuplicates).toBe(false);
});

test("two different files that share a time but not a name both stay", () => {
    const result = checkImportDuplicates([asset("p", 1_790_000_000_000, "One.m4a"), asset("q", 1_790_000_000_000, "Two.m4a")], []);
    expect(result.allAssets).toHaveLength(2);
});

test("files without a source time are never called duplicates", () => {
    const result = checkImportDuplicates([asset("n1"), asset("n2")], [clip(1_790_000_000_000)]);
    expect(result.hasDuplicates).toBe(false);
    expect(result.allAssets).toHaveLength(2);
});
