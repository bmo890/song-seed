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
  link,
  navigation,
}: {
  text: string;
  title: string;
  methodName: string;
  savedLyricId?: string;
  link: (noteId: string) => void;
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
    link(noteId);
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
  AppAlert.custom(t("wordSparks.sendAgainTitle"), t("wordSparks.sendAgainBody"), [
    {
      label: t("wordSparks.newPage"),
      style: "default",
      icon: "add-outline",
      onPress: sendNew,
    },
    {
      label: t("wordSparks.updatePage"),
      style: "default",
      icon: "refresh",
      onPress: () => {
        updateNote(existing.id, { body: text });
        // Haptics vocabulary: success, a meaningful completion.
        haptic.success();
        toast(t("wordSparks.pageUpdated"), "checkmark-outline", {
          action: { label: t("wordSparks.open"), onPress: () => openPadPage(navigation, existing.id) },
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
