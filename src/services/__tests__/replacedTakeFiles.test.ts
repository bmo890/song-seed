import { SONG_NOOK_AUDIO_DIR } from "../storagePaths";
import { collectManagedClipAudioUris, filterUnreferencedManagedAudioUris } from "../managedMedia";
import type { ClipVersion, SongIdea, Workspace } from "../../types";

const audio = (name: string) => `${SONG_NOOK_AUDIO_DIR}/${name}`;

function clip(id: string, extra: Partial<ClipVersion> = {}): ClipVersion {
  return { id, title: id, notes: "", createdAt: 0, isPrimary: true, ...extra } as ClipVersion;
}

function workspaceWith(clips: ClipVersion[]): Workspace {
  const idea = {
    id: "idea",
    title: "",
    notes: "",
    status: "clip",
    completionPct: 0,
    kind: "clip",
    collectionId: "c",
    createdAt: 0,
    lastActivityAt: 0,
    clips,
  } as SongIdea;
  return { id: "w", title: "", ideas: [idea] } as unknown as Workspace;
}

describe("a combine that replaces its take", () => {
  const replaced = clip("take", {
    audioUri: audio("take.m4a"),
    sourceAudioUri: audio("shared-source.m4a"),
    overdub: {
      renderedMixUri: audio("mix.m4a"),
      stems: [{ id: "s1", audioUri: audio("layer-1.m4a") }],
    } as ClipVersion["overdub"],
  });

  it("collects every file the take owns: take, source, mix and each layer", () => {
    expect(Array.from(collectManagedClipAudioUris(replaced)).sort()).toEqual(
      [audio("layer-1.m4a"), audio("mix.m4a"), audio("shared-source.m4a"), audio("take.m4a")].sort()
    );
  });

  it("trashes only what nothing in the new library still uses", () => {
    const flattened = clip("flat", { audioUri: audio("flat.m4a") });
    const sibling = clip("older", { audioUri: audio("older.m4a"), sourceAudioUri: audio("shared-source.m4a") });
    const next = [workspaceWith([flattened, sibling])];
    expect(filterUnreferencedManagedAudioUris(collectManagedClipAudioUris(replaced), next).sort()).toEqual(
      [audio("layer-1.m4a"), audio("mix.m4a"), audio("take.m4a")].sort()
    );
  });
});
