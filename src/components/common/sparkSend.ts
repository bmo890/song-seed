import { captureDeletedNote } from "../../state/recentlyDeleted";
import { genId } from "../../utils";
import { useStore } from "../../state/useStore";
import { AppAlert } from "./AppAlert";
import { toast } from "./toastStore";
import { haptic } from "../../design/haptics";
import { i18n } from "../../i18n";
import { sparkSaveTitle } from "../../domain/notepad";
import { assembleDraftFromCanvas, boardItemText } from "../../domain/cutUp";
import { assembleDraft } from "../../domain/magpie";
import { detectTextDirection } from "../../i18n/direction";
import type { CutUpSpark, MagpieSpark, WordLadderExercise } from "../../types";

/**
 * A spark's lyric, sending it to the Lyric Pad, and finishing it (2026-10-17,
 * founder: "save it in the sparks, and have an option to add to lyric pad").
 *
 * Finishing keeps the spark in Lyric Spark as the record of the exercise.
 * Sending is a separate, deliberate copy into the Lyric Pad; the spark
 * remembers the page (`savedLyricId`), so a second send asks whether to update
 * that page or add a new one instead of quietly duplicating it.
 */

/** The lines a spark would send: the final text, else what the steps built. */
export function wordLadderText(spark: WordLadderExercise): string {
  return (spark.revision.trim() ? spark.revision : spark.draft).trim();
}

export function cutUpText(spark: CutUpSpark): string {
  if (spark.assembledDraftText.trim()) return spark.assembledDraftText.trim();
  const textOf = (id: string) => {
    const item = spark.boardItems.find((it) => it.id === id);
    return item ? boardItemText(item, spark.chunks) : "";
  };
  const rtl = detectTextDirection(spark.chunks.map((c) => c.text).join(" ")) === "rtl";
  return assembleDraftFromCanvas(spark.boardItems, textOf, rtl).trim();
}

export function magpieText(spark: MagpieSpark): string {
  return (spark.draft.trim() ? spark.draft : assembleDraft(spark.fragments)).trim();
}

type Navigation = { navigate: (route: string, params?: object) => void };

/** Opens a Lyric Pad page. */
export function openPadPage(navigation: Navigation, noteId: string) {
  navigation.navigate("NotepadHome", { noteId, openToken: Date.now() });
}

/**
 * Copies a spark's lyric into the Lyric Pad. `link` records the page on the
 * spark. Asks first when the spark already has a page there.
 */
export function sendSparkToPad({
  text,
  title,
  methodName,
  savedLyricId,
  savedLyricBody,
  link,
  navigation,
}: {
  text: string;
  title: string;
  methodName: string;
  savedLyricId?: string;
  /** What the last send put on that page (absent on sparks sent before 2026-11-02). */
  savedLyricBody?: string;
  /** Records the page on the spark, with the words this send put there. */
  link: (noteId: string, sentBody: string) => void;
  navigation: Navigation;
}) {
  const t = i18n.t.bind(i18n);
  if (!text) {
    AppAlert.info(t("wordSparks.nothingSendTitle"), t("wordSparks.nothingToSend"));
    return;
  }
  const { notes, addNote, updateNote } = useStore.getState();

  const sendNew = () => {
    const noteId = addNote();
    updateNote(noteId, { title: sparkSaveTitle(title, methodName, notes), body: text });
    link(noteId, text);
    // Haptics vocabulary: success, a meaningful completion (the lyric landed).
    haptic.success();
    toast(t("wordSparks.sentToPad"), "checkmark-outline", {
      action: { label: t("wordSparks.open"), onPress: () => openPadPage(navigation, noteId) },
    });
  };

  const existing = savedLyricId ? notes.find((note) => note.id === savedLyricId) : undefined;
  if (!existing) {
    sendNew();
    return;
  }
  // The page is the person's to keep writing on. If its words are no longer what
  // the last send put there (or that is unknown), updating would REPLACE what was
  // written in the Pad since: say so, as a destructive choice (12g G-H1, 12f F-M1).
  const writtenOnSince =
    existing.body.trim() !== text.trim() &&
    (savedLyricBody === undefined || existing.body.trim() !== savedLyricBody.trim());
  AppAlert.custom(t("wordSparks.sendAgainTitle"), t(writtenOnSince ? "wordSparks.sendAgainChangedBody" : "wordSparks.sendAgainBody"), [
    {
      label: t("wordSparks.newPage"),
      style: "default",
      icon: "add-outline",
      onPress: sendNew,
    },
    {
      label: t(writtenOnSince ? "wordSparks.replacePage" : "wordSparks.updatePage"),
      style: writtenOnSince ? "destructive" : "default",
      icon: "refresh",
      onPress: () => {
        // Words written in the Pad since the last send are never just overwritten:
        // the page as it was waits in Recently deleted, and the toast's Undo puts
        // them back (12f F-M1, 12g G-H1).
        const replaced = replacePadPageKeepingOld(existing.id, text, { keepOld: writtenOnSince });
        link(existing.id, text);
        // Haptics vocabulary: success, a meaningful completion.
        haptic.success();
        toast(t("wordSparks.pageUpdated"), "checkmark-outline", {
          action: replaced
            ? { label: t("recentlyDeleted.undo"), onPress: replaced.undo }
            : { label: t("wordSparks.open"), onPress: () => openPadPage(navigation, existing.id) },
        });
      },
    },
    { label: t("common.cancel"), style: "cancel" },
  ]);
}

/** Whether the page a spark was sent to is still in the Lyric Pad (the
 *  writer may have deleted it since). */
export function useHasPadPage(savedLyricId: string | undefined): boolean {
  return useStore((state) => (savedLyricId ? state.notes.some((note) => note.id === savedLyricId) : false));
}

/** The spark's status for its row in Lyric Spark, when it has one. */
export function sparkDoneLabel(
  spark: { finishedAt?: number; savedLyricId?: string },
  hasPage: (noteId: string) => boolean
): string | null {
  const t = i18n.t.bind(i18n);
  if (spark.savedLyricId && hasPage(spark.savedLyricId)) return t("wordSparks.inPad");
  if (spark.finishedAt) return t("wordSparks.finished");
  return null;
}

/**
 * Replace a Lyric Pad page's words with a spark's, keeping the old words: when they
 * differ, a copy of the page as it was goes to Recently deleted (its own id, so a
 * Restore adds it back beside the page). Returns an Undo that puts the old words back,
 * or null when nothing was lost.
 */
export function replacePadPageKeepingOld(
  noteId: string,
  text: string,
  opts: { keepOld?: boolean } = {}
): { undo: () => void } | null {
  const store = useStore.getState();
  const page = store.notes.find((note) => note.id === noteId);
  if (!page) return null;
  const before = page.body;
  const loses = opts.keepOld !== false && before.trim().length > 0 && before !== text;
  const kept = loses ? captureDeletedNote({ ...page, id: genId("note"), isPinned: false }) : null;
  useStore.setState((state) => ({
    notes: state.notes.map((note) => (note.id === noteId ? { ...note, body: text, updatedAt: Date.now() } : note)),
    ...(kept ? { recentlyDeleted: [kept, ...state.recentlyDeleted] } : null),
  }));
  if (!kept) return null;
  return {
    undo: () =>
      useStore.setState((state) => ({
        notes: state.notes.map((note) => (note.id === noteId ? { ...note, body: before, updatedAt: Date.now() } : note)),
        recentlyDeleted: state.recentlyDeleted.filter((item) => item.id !== kept.id),
      })),
  };
}
