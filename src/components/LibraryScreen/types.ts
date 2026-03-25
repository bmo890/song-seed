import type { PlaylistItemKind } from "../../types";

export type PlaylistPickerSelection = {
  kind: PlaylistItemKind;
  workspaceId: string;
  collectionId: string;
  ideaId: string;
  clipId?: string | null;
};

export type PlaylistPickerState = {
  playlistId: string;
  workspaceId: string | null;
  collectionId: string | null;
  songIdeaId: string | null;
  selectedItems: PlaylistPickerSelection[];
};

export type PlaylistDisplayItem = {
  id: string;
  kind: PlaylistItemKind;
  title: string;
  subtitle: string;
  metaLabel: string;
  available: boolean;
  workspaceId: string | null;
  ideaId: string | null;
};
