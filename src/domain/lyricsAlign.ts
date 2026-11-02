import { graphemeCount, splitGraphemes } from "./chords";

/** Where a line of the new lyric text came from in the previous document.
 *  12b B-H2: chords follow their words, not the line number — adding or
 *  cutting a line used to slide every chord below it onto the wrong line. */
export type LineSource =
  /** The same words, unchanged (or moved): the chart comes across as-is. */
  | { kind: "same"; old: number }
  /** The same line with its words edited. */
  | { kind: "edited"; old: number }
  /** Enter pressed inside an old line: this is its `part` (0 or 1), split `offset` graphemes in. */
  | { kind: "split"; old: number; part: 0 | 1; offset: number }
  /** Backspace joined two old lines into this one. */
  | { kind: "merged"; olds: [number, number] };

/** Gaps bigger than this (old × new lines) skip the similarity pass; a paste
 *  that big replaces the words, and its lines pair by position. */
const GAP_ALIGN_LIMIT = 10_000;
/** How alike two lines must be to count as one line edited. */
const SIMILAR_LINE = 0.5;

function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const folded = text.toLocaleLowerCase();
  for (let index = 0; index < folded.length - 1; index += 1) {
    const pair = folded.slice(index, index + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

/** 0…1: how clearly `b` is `a` edited (shared letter pairs, or a shared start and end). */
function lineSimilarity(a: string, b: string, aPairs: Map<string, number>, bPairs: Map<string, number>): number {
  if (a.length === 0 || b.length === 0) return 0;
  let shared = 0;
  let aTotal = 0;
  let bTotal = 0;
  aPairs.forEach((count, pair) => {
    aTotal += count;
    shared += Math.min(count, bPairs.get(pair) ?? 0);
  });
  bPairs.forEach((count) => {
    bTotal += count;
  });
  const dice = aTotal + bTotal > 0 ? (2 * shared) / (aTotal + bTotal) : 0;
  const shorter = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < shorter && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < shorter - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
  return Math.max(dice, (prefix + suffix) / Math.max(a.length, b.length));
}

/** Pair the unmatched old lines of one gap with its unmatched new lines. */
function alignGap(
  oldTexts: string[],
  newTexts: string[],
  oldFrom: number,
  oldTo: number,
  newFrom: number,
  newTo: number,
  sources: (LineSource | null)[]
) {
  const n = oldTo - oldFrom;
  const m = newTo - newFrom;
  if (n === 0 || m === 0) return;
  // The same count either side: the same slots, rewritten. Each slot keeps its
  // chart (the chords belong to the melody under the words), as the editor
  // always did — and a line cleared and retyped between autosaves keeps it.
  if (n === m || n * m > GAP_ALIGN_LIMIT) {
    for (let offset = 0; offset < Math.min(n, m); offset += 1) {
      sources[newFrom + offset] = { kind: "edited", old: oldFrom + offset };
    }
    return;
  }
  const oldPairs = oldTexts.slice(oldFrom, oldTo).map(bigrams);
  const newPairs = newTexts.slice(newFrom, newTo).map(bigrams);
  // score[i][j]: the best alignment of old[i..] with new[j..].
  // choice: 0 drop old, 1 insert new, 2 edited pair, 3 split, 4 merge.
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const choice: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n; i >= 0; i -= 1) {
    for (let j = m; j >= 0; j -= 1) {
      if (i === n && j === m) continue;
      let best = -1;
      let pick = 0;
      if (i < n && score[i + 1][j] > best) {
        best = score[i + 1][j];
        pick = 0;
      }
      if (j < m && score[i][j + 1] > best) {
        best = score[i][j + 1];
        pick = 1;
      }
      if (i < n && j < m) {
        const oldText = oldTexts[oldFrom + i];
        const newText = newTexts[newFrom + j];
        const similarity = lineSimilarity(oldText, newText, oldPairs[i], newPairs[j]);
        if (similarity >= SIMILAR_LINE && similarity + score[i + 1][j + 1] > best) {
          best = similarity + score[i + 1][j + 1];
          pick = 2;
        }
        if (j + 1 < m && newText + newTexts[newFrom + j + 1] === oldText && 2 + score[i + 1][j + 2] > best) {
          best = 2 + score[i + 1][j + 2];
          pick = 3;
        }
        if (i + 1 < n && oldText + oldTexts[oldFrom + i + 1] === newText && 2 + score[i + 2][j + 1] > best) {
          best = 2 + score[i + 2][j + 1];
          pick = 4;
        }
      }
      score[i][j] = best;
      choice[i][j] = pick;
    }
  }
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const pick = choice[i][j];
    if (pick === 0) {
      i += 1;
    } else if (pick === 1) {
      j += 1;
    } else if (pick === 2) {
      sources[newFrom + j] = { kind: "edited", old: oldFrom + i };
      i += 1;
      j += 1;
    } else if (pick === 3) {
      const offset = graphemeCount(newTexts[newFrom + j]);
      sources[newFrom + j] = { kind: "split", old: oldFrom + i, part: 0, offset };
      sources[newFrom + j + 1] = { kind: "split", old: oldFrom + i, part: 1, offset };
      i += 1;
      j += 2;
    } else {
      sources[newFrom + j] = { kind: "merged", olds: [oldFrom + i, oldFrom + i + 1] };
      i += 2;
      j += 1;
    }
  }
}

/** Where each new line came from. An LCS on exact text keeps unchanged lines
 *  (identical duplicates included) on their own chords; the gaps between
 *  matches pair edited, split and joined lines; inserted lines come from
 *  nowhere; a deleted line's chart goes with it. */
export function alignLyricLines(oldTexts: string[], newTexts: string[]): (LineSource | null)[] {
  const n = oldTexts.length;
  const m = newTexts.length;
  const sources: (LineSource | null)[] = new Array(m).fill(null);
  // Trim the common head and tail first: a typical edit leaves a tiny middle.
  let head = 0;
  while (head < n && head < m && oldTexts[head] === newTexts[head]) {
    sources[head] = { kind: "same", old: head };
    head += 1;
  }
  let tail = 0;
  while (tail < n - head && tail < m - head && oldTexts[n - 1 - tail] === newTexts[m - 1 - tail]) {
    sources[m - 1 - tail] = { kind: "same", old: n - 1 - tail };
    tail += 1;
  }
  const oldMid = n - head - tail;
  const newMid = m - head - tail;
  const matches: [number, number][] = [];
  if (oldMid > 0 && newMid > 0) {
    // Suffix LCS lengths, so the forward walk takes the earliest match.
    const lcs: Uint16Array[] = Array.from({ length: oldMid + 1 }, () => new Uint16Array(newMid + 1));
    for (let i = oldMid - 1; i >= 0; i -= 1) {
      for (let j = newMid - 1; j >= 0; j -= 1) {
        lcs[i][j] =
          oldTexts[head + i] === newTexts[head + j]
            ? lcs[i + 1][j + 1] + 1
            : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < oldMid && j < newMid) {
      if (oldTexts[head + i] === newTexts[head + j]) {
        matches.push([head + i, head + j]);
        i += 1;
        j += 1;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }
  }
  let oldCursor = head;
  let newCursor = head;
  for (const [oldIndex, newIndex] of [...matches, [n - tail, m - tail] as [number, number]]) {
    alignGap(oldTexts, newTexts, oldCursor, oldIndex, newCursor, newIndex, sources);
    if (oldIndex < n - tail) sources[newIndex] = { kind: "same", old: oldIndex };
    oldCursor = oldIndex + 1;
    newCursor = newIndex + 1;
  }
  // A line cut and pasted elsewhere: an inserted line with the exact words of
  // a deleted line takes that line's chart (never a kept line's: no clones).
  const used = new Set<number>();
  for (const source of sources) {
    if (!source) continue;
    if (source.kind === "merged") source.olds.forEach((index) => used.add(index));
    else used.add(source.old);
  }
  const deletedByText = new Map<string, number[]>();
  for (let index = 0; index < n; index += 1) {
    if (used.has(index)) continue;
    const queue = deletedByText.get(oldTexts[index]) ?? [];
    queue.push(index);
    deletedByText.set(oldTexts[index], queue);
  }
  for (let index = 0; index < m; index += 1) {
    if (sources[index]) continue;
    const old = deletedByText.get(newTexts[index])?.shift();
    if (old !== undefined) sources[index] = { kind: "same", old };
  }
  return sources;
}

/** Move a chord's grapheme anchor through a one-line edit: anchors before the
 *  change stay, anchors after it ride with their words, anchors inside it stay
 *  inside it. */
export function remapChordAnchor(anchor: number, oldText: string, newText: string): number {
  const oldUnits = splitGraphemes(oldText);
  const newUnits = splitGraphemes(newText);
  const shorter = Math.min(oldUnits.length, newUnits.length);
  let prefix = 0;
  while (prefix < shorter && oldUnits[prefix] === newUnits[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    oldUnits[oldUnits.length - 1 - suffix] === newUnits[newUnits.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  let next: number;
  if (anchor < prefix) next = anchor;
  else if (anchor >= oldUnits.length - suffix) next = anchor + (newUnits.length - oldUnits.length);
  else next = Math.max(prefix, Math.min(anchor, newUnits.length - suffix));
  return Math.max(0, Math.min(next, newUnits.length));
}
