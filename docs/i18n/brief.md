# Translation brief (every language)

SongNook is a songwriting app: a quiet place to finish songs. Translators get
this brief plus the language's glossary (`glossary-<code>.md`).

## Voice
- A calm, terse studio companion. Label, don't narrate.
- No exclamation marks. No "simply/just". No marketing tone inside the product.
- Use the language's informal "you" (tú, du, você) unless its glossary says otherwise.

## Hard rules
- Keep every key, the nesting and the order. Translate VALUES only.
- Keep interpolation tokens byte for byte: `{{count}}`, `{{title}}`, `{{value}}`.
  Never translate or rename them; you may move them within the sentence.
- Keep `\n` line breaks, leading and trailing spaces, "…", "·", "—".
- Plural keys: English has `x_one` / `x_other`. Produce those two. The merge
  script adds any extra forms the language needs (Spanish `_many`, Hebrew `_two`).
- Brand and product names stay as they are: SongNook, SongNook Pro, SongNook
  Send, Pro.
- Length budgets are hard. Buttons ≤ 2 words. Toasts ≤ 5. Empty-state titles ≤ 6.
  Alert bodies ≤ 20. Most languages run longer than English; prefer the
  shorter natural phrasing, and keep one-word English labels to one word.
- Chord names (G, Em, C#m7) and units (BPM, st, Hz, ms) stay as they are.
- Demo content (song titles, lyrics, names like Maya) becomes natural content
  of the same spirit in the language. Lyrics must still scan, with chords
  landing on the first and fourth words of each line.

## Output
Valid JSON, UTF-8, two-space indent, the same structure as the input. Before
finishing, check that it parses, that its key paths equal the input's, and
that every `{{token}}` in each English value is still in its translation.
