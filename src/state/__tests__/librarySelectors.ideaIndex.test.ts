import type { SongIdea, Workspace } from "../../types";
import { getIdeaIndex, selectIdeaById } from "../librarySelectors";

const idea = (id: string, title = id): SongIdea => ({ id, title, clips: [] } as unknown as SongIdea);
const ws = (id: string, ideas: SongIdea[]): Workspace => ({ id, ideas } as unknown as Workspace);

describe("selectIdeaById", () => {
    it("returns the same idea object while the library array is unchanged", () => {
        const a = idea("a");
        const workspaces = [ws("w1", [a, idea("b")])];
        expect(selectIdeaById(workspaces, "a")).toBe(a);
        expect(selectIdeaById(workspaces, "a")).toBe(a);
        expect(getIdeaIndex(workspaces)).toBe(getIdeaIndex(workspaces));
    });

    it("an untouched idea keeps its identity across a write that changed another idea", () => {
        const a = idea("a");
        const b = idea("b");
        const before = [ws("w1", [a, b])];
        const bEdited = { ...b, title: "edited" };
        const after = [ws("w1", [a, bEdited])];
        expect(selectIdeaById(after, "a")).toBe(selectIdeaById(before, "a"));
        expect(selectIdeaById(after, "b")).toBe(bEdited);
        expect(selectIdeaById(after, "b")).not.toBe(b);
    });

    it("finds ideas in any workspace and returns null once one is gone", () => {
        const c = idea("c");
        const workspaces = [ws("w1", [idea("a")]), ws("w2", [c])];
        expect(selectIdeaById(workspaces, "c")).toBe(c);
        expect(selectIdeaById([ws("w1", [idea("a")])], "c")).toBeNull();
    });
});
