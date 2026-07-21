import { Share } from "react-native";
import { serializeChordChartText, serializeChordPro } from "../../../../domain/chords";
import { shareChordChartPdf } from "../../../../services/chordChartPdf";
import { AppAlert } from "../../../common/AppAlert";
import { ensurePro } from "../../../common/proUpsell";
import { formatDate } from "../../../../utils";
import { transposeLyricsLines } from "../../../../domain/transpose";
import { useChartPrefsStore } from "../../../../state/useChartPrefsStore";
import type { LyricsVersion } from "../../../../types";
import { useTranslation } from "react-i18next";

/** Shared chord-chart export handlers (PDF + text/ChordPro), used by both the
 * chord editor and the read view. Exports honor the song's active display
 * transpose when `transposeIdeaId` is provided — a shifted chart prints shifted. */
export function useChordExport(
  songTitle: string,
  version: LyricsVersion | null | undefined,
  transposeIdeaId?: string
) {
  const { t } = useTranslation();
  const rawLines = version?.document.lines ?? [];
  const transpose = transposeIdeaId
    ? useChartPrefsStore.getState().transposeByIdeaId[transposeIdeaId] ?? 0
    : 0;
  const lines = transposeLyricsLines(rawLines, transpose);
  const subtitle = version ? `${songTitle} · ${formatDate(version.updatedAt)}` : songTitle;

  const exportPdf = async () => {
    if (!ensurePro("pdf-export")) return;
    try {
      const ok = await shareChordChartPdf({ title: songTitle, subtitle, lines });
      if (!ok) AppAlert.info(t("chordEditor.nothingExport"), t("chordEditor.addLyricsFirst"));
    } catch {
      AppAlert.info(t("chordEditor.exportFailed"), t("chordEditor.exportFailedBody"));
    }
  };

  const exportText = () => {
    const chart = serializeChordChartText(lines);
    if (!chart.trim()) {
      AppAlert.info(t("chordEditor.nothingShare"), t("chordEditor.addLyricsFirst"));
      return;
    }
    void Share.share({
      title: t("chordEditor.shareTitle", { title: songTitle }),
      message: `${chart}\n\n— ChordPro —\n${serializeChordPro(lines)}`,
    });
  };

  return { exportPdf, exportText };
}
