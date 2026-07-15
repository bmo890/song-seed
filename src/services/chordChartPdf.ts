import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildChordChartHtml } from "../domain/chords";
import { buildChordSheetHtml, isChordSheetEmpty } from "../domain/chordSheet";
import type { ChordSheet, LyricsLine } from "../types";

async function sharePdfFromHtml(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
  } else {
    await Print.printAsync({ uri });
  }
}

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

  await sharePdfFromHtml(buildChordChartHtml(title, subtitle, lines), `${title} — chords`);
  return true;
}

type ChordSheetPdfInput = {
  title: string;
  subtitle: string;
  sheet: ChordSheet;
};

/** Renders a standalone block chord chart to a PDF and shares/prints it. */
export async function shareChordSheetPdf({ title, subtitle, sheet }: ChordSheetPdfInput): Promise<boolean> {
  if (isChordSheetEmpty(sheet)) return false;
  await sharePdfFromHtml(buildChordSheetHtml(title, subtitle, sheet), `${title} — chord chart`);
  return true;
}
