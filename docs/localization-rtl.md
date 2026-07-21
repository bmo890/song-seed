# Localization and authored-text direction

SongNook treats the interface language and the writer's content as separate concerns.

## Interface locale

- Supported locales are `en` and `he`.
- On first install, Hebrew device locales start in Hebrew; every other locale starts in English.
- That choice is persisted. Later device-language changes do not silently change SongNook.
- Settings offers English and Hebrew. A change reloads the app because React Native's native layout direction is process-wide.
- Hebrew UI uses Heebo for sans-serif text and Frank Ruhl Libre for editorial serif text.

## Authored content

- Shared title, search, note, lyric, and writing-exercise inputs detect the first strong character and align independently of the UI locale.
- Mixed text follows Unicode bidirectional behavior. A leading neutral string falls back to the UI direction.
- Lyrics versions persist `textDirection: auto | ltr | rtl`. The editor's overflow menu is the only manual override; Auto is the default.
- Chord anchors persist a grapheme-cluster index as well as the legacy UTF-16 index. This prevents Hebrew vowel marks, emoji, and other composed characters from splitting or shifting anchors. Old data is migrated during normalization.
- Standalone measure/block chord sheets remain a left-to-right music grid. Labels and authored titles can still be Hebrew.

## Language-limited creative tools

- Word Finder detects Unicode words at the cursor but only calls Datamuse for English words. Hebrew input gets a localized explanation and no network request.
- Word Ladder, Cut-Up, and Magpie remain available and accept bidirectional authored text. They display a localized English-content notice.
- Magpie currently requests English public-domain books from Gutendex. The resulting draft can be written in either language.

## Hebrew voice glossary

Song maturity deliberately uses natural creative language rather than translating the English botanical metaphor word-for-word:

- Seed → רעיון
- Sprout → התחלה
- Stem (song stage) → מתגבש
- Song → שיר
- Audio stem → שכבת שמע (never the song-stage term)
- Take → טייק
- Sketch → סקיצה / יצירת סקיצה
- Gather → לאסוף
- Word Spark → ניצוץ כתיבה
- Lyrics Spark → ניצוץ למילים
- Revisit → לחזור לזה
- Shelf → מדף
- Capture → לתפוס
- Clip → קטע
- Lyrics Pad → פנקס מילים
- Word Ladder → סולם מילים
- Cut-Up → קאט־אפ
- Magpie and SongNook remain product/proper names.

Generic English copy about “seeds,” “sprouting,” or “tending” should be adapted to ideas, beginnings, and development in Hebrew rather than translated botanically.

## Adding a locale

Add the locale to `src/i18n/translations.ts`, `supportedLngs`, the persisted-language type and validator, and the Expo localization plugin config. Keep catalog keys in parity; `translations.test.ts` enforces this for English and Hebrew.
