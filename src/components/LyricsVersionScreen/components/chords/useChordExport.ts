import { Share } from "react-native";
import { serializeChordChartText, serializeChordPro } from "../../../../domain/chords";
import { shareChordChartPdf } from "../../../../services/chordChartPdf";
import { AppAlert } from "../../../common/AppAlert";
import { ensurePro } from "../../../common/proUpsell";
import { formatDate } from "../../../../utils";
import { transposeLyricsLines } from "../../../../domain/transpose";
import { useChartPrefsStore } from "../../../../state/useChartPrefsStore";
import type { LyricsVersion } from "../../../../types";

/** Shared chord-chart export handlers (PDF + text/ChordPro), used by both the
 * chord editor and the read view. Exports honor the song's active display
 * transpose when `transposeIdeaId` is provided — a shifted chart prints shifted. */
export function useChordExport(
  songTitle: string,
  version: LyricsVersion | null | undefined,
  transposeIdeaId?: string
) {
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
      if (!ok) AppAlert.info("Nothing to export", "Add some lyrics first.");
    } catch {
      AppAlert.info("Export failed", "Couldn't create the PDF. Please try again.");
    }
  };

  const exportText = () => {
    const chart = serializeChordChartText(lines);
    if (!chart.trim()) {
      AppAlert.info("Nothing to share", "Add some lyrics first.");
      return;
    }
    void Share.share({
      title: `${songTitle} — chords`,
      message: `${chart}\n\n— ChordPro —\n${serializeChordPro(lines)}`,
    });
  };

  return { exportPdf, exportText };
}
