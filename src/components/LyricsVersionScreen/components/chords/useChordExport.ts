import { Share } from "react-native";
import { serializeChordChartText, serializeChordPro } from "../../../../chords";
import { shareChordChartPdf } from "../../../../services/chordChartPdf";
import { AppAlert } from "../../../common/AppAlert";
import { formatDate } from "../../../../utils";
import type { LyricsVersion } from "../../../../types";

/** Shared chord-chart export handlers (PDF + text/ChordPro), used by both the
 * chord editor and the read view. */
export function useChordExport(songTitle: string, version: LyricsVersion | null | undefined) {
  const lines = version?.document.lines ?? [];
  const subtitle = version ? `${songTitle} · ${formatDate(version.updatedAt)}` : songTitle;

  const exportPdf = async () => {
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
