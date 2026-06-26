import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildChordChartHtml } from "../chords";
import type { LyricsLine } from "../types";

type ChordChartPdfInput = {
  title: string;
  subtitle: string;
  lines: LyricsLine[];
};

/** Renders the chord chart to a PDF and hands it to the OS share/print sheet.
 * Returns false if there's nothing to export. Throws on render/share failure so
 * callers can surface an error. */
export async function shareChordChartPdf({ title, subtitle, lines }: ChordChartPdfInput): Promise<boolean> {
  const hasContent = lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0);
  if (!hasContent) return false;

  const html = buildChordChartHtml(title, subtitle, lines);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `${title} — chords`,
      UTI: "com.adobe.pdf",
    });
  } else {
    // No share sheet available — fall back to the native print dialog.
    await Print.printAsync({ uri });
  }
  return true;
}
