import type {
  ChordSheet,
  ChordSheetMeasure,
  ChordSheetSection,
  LyricsLine,
  LyricsVersion,
} from "./types";

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Section labels offered as quick-add presets (free custom labels also allowed). */
export const SECTION_PRESETS = ["Intro", "Verse", "Pre-Chorus", "Chorus", "Bridge", "Interlude", "Solo", "Outro"];

/** A bar can hold several chords, but stays readable — cap it. */
export const MAX_CHORDS_PER_BAR = 7;

export function createMeasure(chords: string[] = []): ChordSheetMeasure {
  return { id: randomId("measure"), chords };
}

/** A new section starts with four empty bars — a sensible default block. */
export function createSection(label: string, measureCount = 4): ChordSheetSection {
  return {
    id: randomId("section"),
    label,
    measures: Array.from({ length: Math.max(0, measureCount) }, () => createMeasure()),
    notes: "",
  };
}

/** A free-form prose block placed between sections (not a section's note). */
export function createTextBlock(text = ""): ChordSheetSection {
  return { id: randomId("text"), label: "", measures: [], notes: "", kind: "text", text };
}

export function createChordSheet(): ChordSheet {
  return { sections: [], updatedAt: Date.now() };
}

/** Chords packed per bar when building a chart from lyrics — kept low so the
 *  result is editable; the writer can "split" a bar afterward. */
export const IMPORT_CHORDS_PER_BAR = 2;

/** Split a bar's chords into one bar per chord (used by the "split bar" action). */
export function splitMeasureChords(measure: ChordSheetMeasure): ChordSheetMeasure[] {
  if (measure.chords.length <= 1) return [measure];
  return measure.chords.map((chord) => createMeasure([chord]));
}

/** A lyric line that is a section header, e.g. "[Chorus]" or "Chorus:" — returns
 *  the label, or null if the line is ordinary lyrics. */
function sectionLabelFromLine(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const bracket = trimmed.match(/^\[([^\]]+)\]$/);
  if (bracket) return bracket[1].trim();
  const colon = trimmed.match(/^([A-Za-z][A-Za-z0-9 '\-]{0,24}):$/);
  if (colon) return colon[1].trim();
  return null;
}

function lineChordsInOrder(line: LyricsLine): string[] {
  return [...line.chords]
    .sort((a, b) => a.at - b.at)
    .map((chord) => chord.chord)
    .filter((chord) => !!chord && chord.trim().length > 0);
}

/**
 * Build a block chord chart from a lyrics version: split into sections on blank
 * lines (and honour a leading "[Tag]"/"Tag:" header), collect each section's
 * chords in order, and pack them `IMPORT_CHORDS_PER_BAR` per bar. Sections with no
 * chords are skipped — it's a chord chart, not the lyrics. Returns an empty sheet
 * when the lyrics carry no chords.
 */
export function buildChordSheetFromLyrics(version: LyricsVersion | null | undefined): ChordSheet {
  const lines = version?.document.lines ?? [];

  const groups: LyricsLine[][] = [];
  let current: LyricsLine[] = [];
  for (const line of lines) {
    const isBlank = !line.text.trim() && line.chords.length === 0;
    if (isBlank) {
      if (current.length) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) groups.push(current);

  const sections: ChordSheetSection[] = [];
  for (const group of groups) {
    const tag = sectionLabelFromLine(group[0]?.text ?? "");
    const bodyLines = tag ? group.slice(1) : group;

    const chords: string[] = [];
    for (const line of bodyLines) chords.push(...lineChordsInOrder(line));
    if (chords.length === 0) continue;

    const measures: ChordSheetMeasure[] = [];
    for (let i = 0; i < chords.length; i += IMPORT_CHORDS_PER_BAR) {
      measures.push(createMeasure(chords.slice(i, i + IMPORT_CHORDS_PER_BAR)));
    }

    sections.push({
      id: randomId("section"),
      label: tag ?? `Section ${sections.length + 1}`,
      measures,
      notes: "",
    });
  }

  return { sections, updatedAt: Date.now() };
}

export function isChordSheetEmpty(sheet: ChordSheet | undefined): boolean {
  if (!sheet || sheet.sections.length === 0) return true;
  return sheet.sections.every((section) =>
    section.kind === "text"
      ? !(section.text ?? "").trim()
      : section.measures.every((m) => m.chords.length === 0) && !section.notes.trim()
  );
}

// ── Defensive sanitization (persisted/imported data may be partial) ──────────

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string";
}

function sanitizeMeasure(raw: unknown): ChordSheetMeasure | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.id)) return null;
  const chords = Array.isArray(obj.chords)
    ? obj.chords.filter((c): c is string => isNonEmptyString(c))
    : [];
  return { id: obj.id, chords };
}

function sanitizeSection(raw: unknown): ChordSheetSection | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.id)) return null;
  const measures = Array.isArray(obj.measures)
    ? obj.measures.map(sanitizeMeasure).filter((m): m is ChordSheetMeasure => m !== null)
    : [];
  return {
    id: obj.id,
    label: isNonEmptyString(obj.label) ? obj.label : "Section",
    measures,
    notes: isNonEmptyString(obj.notes) ? obj.notes : "",
    kind: obj.kind === "text" ? "text" : undefined,
    text: isNonEmptyString(obj.text) ? obj.text : undefined,
  };
}

export function sanitizeChordSheet(raw: unknown): ChordSheet | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.sections)) return undefined;
  const sections = obj.sections.map(sanitizeSection).filter((s): s is ChordSheetSection => s !== null);
  if (sections.length === 0) return undefined;
  return {
    sections,
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
  };
}

/** Deep clone with fresh ids — used when duplicating a song. */
export function cloneChordSheet(sheet: ChordSheet | undefined): ChordSheet | undefined {
  if (!sheet) return undefined;
  return {
    updatedAt: Date.now(),
    sections: sheet.sections.map((section) => ({
      id: randomId(section.kind === "text" ? "text" : "section"),
      label: section.label,
      notes: section.notes,
      measures: section.measures.map((m) => ({ id: randomId("measure"), chords: [...m.chords] })),
      kind: section.kind,
      text: section.text,
    })),
  };
}

/** Renders a measure's content — chords joined by spaces, or "-" for an empty
 * bar so it reads as a real (closed) bar: "| - |" rather than a blank "|   |". */
function measureText(measure: ChordSheetMeasure): string {
  return measure.chords.length > 0 ? measure.chords.join(" ") : "-";
}

/** Plain-text chart: each section's label, its bars in rows of `perRow`, then notes. */
export function serializeChordSheetText(sheet: ChordSheet, perRow = 4): string {
  const blocks = sheet.sections.map((section) => {
    if (section.kind === "text") return (section.text ?? "").trim();
    const lines: string[] = [section.label.toUpperCase()];
    for (let i = 0; i < section.measures.length; i += perRow) {
      const row = section.measures.slice(i, i + perRow);
      lines.push(`| ${row.map(measureText).join(" | ")} |`);
    }
    if (section.measures.length === 0) lines.push("(no bars yet)");
    if (section.notes.trim()) lines.push(section.notes.trim());
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Printable HTML chord chart for PDF export. */
export function buildChordSheetHtml(
  title: string,
  subtitle: string,
  sheet: ChordSheet,
  perRow = 4
): string {
  const sectionsHtml = sheet.sections
    .map((section) => {
      if (section.kind === "text") {
        const t = (section.text ?? "").trim();
        return t ? `<div class="textblock">${escapeHtml(t)}</div>` : "";
      }
      const rows: string[] = [];
      for (let i = 0; i < section.measures.length; i += perRow) {
        const cells = section.measures
          .slice(i, i + perRow)
          .map((m) => `<td class="bar">${escapeHtml(measureText(m)).trim() || "&nbsp;"}</td>`)
          .join("");
        rows.push(`<tr>${cells}</tr>`);
      }
      const grid = rows.length > 0 ? `<table class="bars">${rows.join("")}</table>` : "";
      const notes = section.notes.trim() ? `<div class="notes">${escapeHtml(section.notes.trim())}</div>` : "";
      return `<div class="section"><div class="label">${escapeHtml(section.label)}</div>${grid}${notes}</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 40px; }
  body { color: #1b1c1a; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 12px; margin: 0 0 22px; }
  .section { margin-bottom: 22px; break-inside: avoid; }
  .label { text-transform: uppercase; letter-spacing: 1px; font-size: 11px; font-weight: 700; color: #824f3f; margin-bottom: 6px; }
  table.bars { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td.bar { border: 1px solid #d7c2bd; padding: 10px 8px; font-size: 15px; font-weight: 600; text-align: center; }
  .notes { margin-top: 8px; font-size: 13px; color: #4b5563; white-space: pre-wrap; }
  .textblock { margin-bottom: 22px; font-size: 14px; line-height: 1.5; color: #1b1c1a; white-space: pre-wrap; break-inside: avoid; }
</style></head><body>
  <h1>${escapeHtml(title || "Untitled")}</h1>
  <div class="sub">${escapeHtml(subtitle)}</div>
  ${sectionsHtml}
</body></html>`;
}
