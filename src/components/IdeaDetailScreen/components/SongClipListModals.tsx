import { fmtDuration, formatDate } from "../../../utils";
import { type CustomTagDefinition, type SongIdea } from "../../../types";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
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
}: SongClipListModalsProps) {
  return (
    <>
      <ClipNotesSheet
        visible={!!notesSheetClip}
        clipSubtitle={
          notesSheetClip
            ? `${notesSheetClip.durationMs ? fmtDuration(notesSheetClip.durationMs) : "0:00"} • ${formatDate(notesSheetClip.createdAt)}`
            : ""
        }
        titleDraft={editingClipDraft}
        notesDraft={editingClipNotesDraft}
        onChangeTitle={setEditingClipDraft}
        onChangeNotes={setEditingClipNotesDraft}
        onSave={saveNotesSheet}
        onCancel={closeNotesSheet}
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
