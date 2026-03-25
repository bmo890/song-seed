import { fmtDuration, formatDate } from "../../../utils";
import { type CustomTagDefinition, type SongIdea } from "../../../types";
import { ClipNotesSheet } from "../../modals/ClipNotesSheet";

type SongClipListModalsProps = {
  selectedIdea: SongIdea;
  globalCustomTags: CustomTagDefinition[];
  notesSheetClip: SongIdea["clips"][number] | null;
  editingClipDraft: string;
  editingClipNotesDraft: string;
  setEditingClipDraft: (value: string) => void;
  setEditingClipNotesDraft: (value: string) => void;
  saveNotesSheet: () => void;
  closeNotesSheet: () => void;
};

export function SongClipListModals({
  selectedIdea,
  globalCustomTags,
  notesSheetClip,
  editingClipDraft,
  editingClipNotesDraft,
  setEditingClipDraft,
  setEditingClipNotesDraft,
  saveNotesSheet,
  closeNotesSheet,
}: SongClipListModalsProps) {
  return (
    <ClipNotesSheet
      visible={!!notesSheetClip}
      clipSubtitle={
        notesSheetClip
          ? `${notesSheetClip.durationMs ? fmtDuration(notesSheetClip.durationMs) : "0:00"} • ${formatDate(notesSheetClip.createdAt)}`
          : ""
      }
      clip={notesSheetClip}
      idea={selectedIdea}
      globalCustomTags={globalCustomTags}
      titleDraft={editingClipDraft}
      notesDraft={editingClipNotesDraft}
      onChangeTitle={setEditingClipDraft}
      onChangeNotes={setEditingClipNotesDraft}
      onSave={saveNotesSheet}
      onCancel={closeNotesSheet}
    />
  );
}
