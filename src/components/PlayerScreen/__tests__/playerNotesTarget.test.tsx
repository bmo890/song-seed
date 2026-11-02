jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({}));
// Only the Notes page's wiring is under test: the doors and the sheet are captured.
const captured: { doors?: any; sheet?: any } = {};
jest.mock("../components/PlayerArtifactDoors", () => ({
  PlayerArtifactDoors: (props: any) => {
    captured.doors = props;
    return null;
  },
}));
jest.mock("../../modals/ClipNotesSheet", () => ({
  ClipNotesSheet: (props: any) => {
    captured.sheet = props;
    return null;
  },
}));
jest.mock("../../QueuePanel", () => ({ QueuePanel: () => null, QUEUE_SHEET_COLLAPSED_HEIGHT: 300 }));
jest.mock("../../common/BottomSheet", () => ({ BottomSheet: () => null }));

import React from "react";
import { PlayerSupportSections } from "../components/PlayerSupportSections";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Rendered = { update(element: React.ReactElement): void; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 12a A-H2: the Notes page saved into whichever clip
 * was playing when Save was pressed. A queue that moved on under the sheet put the
 * note over the NEXT clip's.
 */
function sections(props: { ideaId: string; clipId: string; notes: string; expanded: boolean; onSave: jest.Mock; onToggle: (v: boolean) => void }) {
  return (
    <PlayerSupportSections
      canAuthor
      hasLyrics={false}
      lyricsPreview=""
      lyricsChordSummary=""
      lyricsMeta={null}
      hasChart={false}
      chordSheet={null}
      onOpenLyrics={() => {}}
      onOpenChart={() => {}}
      onWriteLyrics={() => {}}
      onBuildChart={() => {}}
      clipNotes={props.notes}
      notesIdeaId={props.ideaId}
      notesClipId={props.clipId}
      notesLabel="Notes"
      onSaveNotes={props.onSave}
      notesExpanded={props.expanded}
      hasQueue={false}
      queueExpanded={false}
      onToggleNotesExpanded={props.onToggle}
      onToggleQueueExpanded={() => {}}
      onQueueOpenIdea={() => {}}
    />
  );
}

it("a note lands on the take it was written about, after the queue moves on", () => {
  const onSave = jest.fn();
  let expanded = false;
  const onToggle = (v: boolean) => (expanded = v);
  let r!: Rendered;
  act(() => {
    r = TestRenderer.create(sections({ ideaId: "a", clipId: "a-take", notes: "", expanded, onSave, onToggle }));
  });
  act(() => captured.doors.onOpenNotes());
  act(() => r.update(sections({ ideaId: "a", clipId: "a-take", notes: "", expanded, onSave, onToggle })));
  act(() => captured.sheet.onChangeNotes("the bridge drags here"));
  // The clip ends; the next one plays under the open sheet.
  act(() => r.update(sections({ ideaId: "b", clipId: "b-take", notes: "b's own note", expanded, onSave, onToggle })));
  act(() => captured.sheet.onSave());
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith({ ideaId: "a", clipId: "a-take" }, "the bridge drags here");
  act(() => r.unmount());
});
