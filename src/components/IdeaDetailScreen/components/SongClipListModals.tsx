import { type CustomTagDefinition, type SongIdea } from "../../../types";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { useIsReadOnlyIdea } from "../../../hooks/useReadOnly";
import { ClipTagPicker } from "./ClipTagPicker";

type SongClipListModalsProps = {
  selectedIdea: SongIdea;
  globalCustomTags: CustomTagDefinition[];
  notesSheetClip: SongIdea["clips"][number] | null;
  tagPickerClip: SongIdea["clips"][number] | null;
  editingClipDraft: string;
  editingClipNotesDraft: string;
  setEditingClipDraft: (value: string) => void;
  setEditingClipNotesDraft: (value: string) => void;
  saveNotesSheet: () => void;
  closeNotesSheet: () => void;
  closeTagPicker: () => void;
  /** The open sheet's key in the unsaved-words store. */
  notesSheetDraftKey?: string | null;
};

export function SongClipListModals({
  selectedIdea,
  globalCustomTags,
  notesSheetClip,
  tagPickerClip,
  editingClipDraft,
  editingClipNotesDraft,
  setEditingClipDraft,
  setEditingClipNotesDraft,
  saveNotesSheet,
  closeNotesSheet,
  closeTagPicker,
  notesSheetDraftKey,
}: SongClipListModalsProps) {
  // A parcel's take (until Keep) or an archived one: its note opens to be read in full.
  const readOnly = useIsReadOnlyIdea(selectedIdea.id);
  return (
    <>
      <ClipNotesSheet
        visible={!!notesSheetClip}
        durationMs={notesSheetClip?.durationMs}
        createdAt={notesSheetClip?.createdAt}
        titleDraft={editingClipDraft}
        notesDraft={editingClipNotesDraft}
        onChangeTitle={setEditingClipDraft}
        onChangeNotes={setEditingClipNotesDraft}
        onSave={saveNotesSheet}
        onCancel={closeNotesSheet}
        draftKey={notesSheetDraftKey}
        readOnly={readOnly}
      />
      <ClipTagPicker
        visible={!!tagPickerClip}
        clips={tagPickerClip ? [tagPickerClip] : []}
        idea={selectedIdea}
        globalCustomTags={globalCustomTags}
        onClose={closeTagPicker}
      />
    </>
  );
}
