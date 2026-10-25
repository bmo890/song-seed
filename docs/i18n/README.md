# Adding or updating a language

The app's text lives in one catalog per language, `src/i18n/locales/<code>.ts`,
all with the same keys as English. The language list is `src/i18n/languages.ts`.
`src/__tests__/translations.test.ts` fails when a catalog is missing a key or
has one English doesn't.

## The pipeline

1. **Brief and glossary.** Every translator gets `brief.md` (voice, hard rules)
   and the language's `glossary-<code>.md` (a fixed word for every SongNook
   term, so six people's worth of work reads as one voice). Write the glossary
   first; it is the decision document a native reader reviews.
2. **Split.** `node scripts/i18n/split.mjs <code> <workdir>` writes
   `part-N.en.json`: whole sections, about 2,000 words each.
3. **Translate.** One translator per part, all at once. With Claude Code this is
   one agent per part, given the prompt below.
4. **Merge.** `node scripts/i18n/merge.mjs <code> <workdir> --header "…"` lays the
   parts over the catalog in English order, adds the language's extra plural
   forms, and refuses to write if a key or `{{token}}` is missing.
5. **Register** (new language only): add the language to `APP_LANGUAGES` in
   `src/i18n/languages.ts` and its catalog to `src/i18n/translations.ts`; add
   its code to `supportedLocales` in `app.json` (takes effect in the next store
   build).
6. **Check.** `npx tsc --noEmit && npx jest src/__tests__/translations.test.ts`,
   then walk the welcome tour, Settings and a few busy screens in the simulator:
   longer words wrap where English didn't.
7. **Native read** before the language is promoted. Machine translation with a
   glossary is consistent, not finished.

## When English text changes

`node scripts/i18n/split.mjs <code> <workdir> --missing` exports only the keys
the language lacks; translate those and merge as above. The parity test names
anything left behind.

## Translator prompt

> Translate a slice of a mobile app's UI string catalog from English to
> {LANGUAGE}. Read the brief first: docs/i18n/brief.md, then
> docs/i18n/glossary-{code}.md, and follow both exactly.
> Input: {workdir}/part-{N}.en.json. Output: {workdir}/part-{N}.{code}.json,
> the same keys, nesting and order with {LANGUAGE} values.
> For context on how a string is used you may grep src/ for its key (read
> only). Other catalogs in src/i18n/locales/ show how earlier translators
> adapted demo content, but translate from English.
> When done, verify the output parses, its key paths equal the input's, and
> every {{token}} survives. Reply with the output path, the number of strings,
> and up to ten strings you were unsure about (key and your choice).

After the parts are in, read the "unsure" lists together: terms that cross
parts (a menu item quoted in a help text) must match.

## Beyond text

Some features carry language content of their own and fall back to English
until it exists (see the comment in `src/i18n/languages.ts`): Word Finder
lookups, Word Ladder lists (`src/domain/wordLadderIdeas.ts`), name ideas
(`NAME_IDEA_LANGUAGES` in `src/utils.ts`), default clip titles
(`src/domain/titleNaming.ts`) and Borrowed Words sources
(`src/domain/magpie.ts`). Research on sources for Portuguese and German is in
`reports/` of the founder's working copy (2026-10-25).
