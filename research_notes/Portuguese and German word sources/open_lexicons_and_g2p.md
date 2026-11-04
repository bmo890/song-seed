# Open lexical datasets, G2P tools and LLM fallback for Portuguese and German Word Finder (rhymes + thesaurus)

Researched 2026-10-25. Scope: the shared multilingual building blocks that could serve BOTH Portuguese (pt) and German (de) Word Finder modes: perfect/near rhymes, sounds-like, synonyms, antonyms, related, describing adjectives, hyponyms, meronyms, definitions. Live checks (GitHub API, ConceptNet API, file downloads, a rhyme-key prototype) were run from this machine on 2026-10-25 and are marked "[measured]".

Not legal advice. Licensing findings are deliberately conservative. Where a question turns on contested law (whether word-relation lists are copyrightable "facts", or what counts as a "substantial portion" of a database), it is flagged.

---

## 1. Wiktionary-derived data: Wiktextract / kaikki.org (en / de / pt editions) and DBnary. Fields, coverage, sizes, CC BY-SA / GFDL implications

### Takeaway
Wiktextract/kaikki is the richest single open source for both languages. It is actively maintained: re-extracted 2026-10-21/24 from the 2026-10-01 dumps, and the repo was pushed 2026-10-23. It gives IPA, glosses, synonyms, antonyms, hypernyms and hyponyms for both languages. The German-edition extraction adds meronyms, holonyms and a ready-made `rhymes` field. All of it is CC BY-SA (+ GFDL). Shipping or serving extracted data means attributing Wiktionary, and conservatively means releasing the derived word-data file itself under CC BY-SA 4.0. That does not reach the app's code.

### Cited findings

**Kaikki / Wiktextract: activity and versions**
- kaikki.org English-edition data was "extracted on 2026-10-21 from the enwiktionary dump dated 2026-10-01" — [kaikki.org Portuguese index](https://kaikki.org/dictionary/Portuguese/index.html); [kaikki raw data](https://kaikki.org/dictionary/rawdata.html)
- The German-edition and Portuguese-edition extractions were made 2026-10-24 from the 2026-10-01 dumps — [kaikki dewiktionary](https://kaikki.org/dewiktionary/index.html); [kaikki ptwiktionary](https://kaikki.org/ptwiktionary/index.html)
- The wiktextract GitHub repo was last pushed 2026-10-23 [measured via GitHub API] — [tatuylonen/wiktextract](https://github.com/tatuylonen/wiktextract)
- Wiktextract code is MIT. The README says it is "free for both commercial and non-commercial use". It does not license the extracted data — [wiktextract README](https://github.com/tatuylonen/wiktextract/blob/master/README.md)
- Kaikki says its data "is made available under the same licenses as Wiktionary - both CC-BY-SA and GFDL". It also asks academic users to cite Ylonen, LREC 2022, and appreciates links back to kaikki.org — [kaikki.org dictionary index](https://kaikki.org/dictionary/); [kaikki raw data](https://kaikki.org/dictionary/rawdata.html)

**Coverage and sizes: English Wiktionary entries for pt/de words** ("Portuguese"/"German" sections of en.wiktionary, glossed in English)
- Portuguese: 425,855 distinct words. The count includes inflected forms; for example there are 365,578 verb senses, most of them conjugated-form entries. That is 527,775 senses in total. The per-language JSONL is 581.9 MB, and kaikki marks that postprocessed per-language file "deprecated" — [kaikki Portuguese](https://kaikki.org/dictionary/Portuguese/index.html); [kaikki index](https://kaikki.org/dictionary/)
- German: 353,033 distinct words and 634,188 senses. The per-language JSONL is about 1.0 GB (also marked deprecated) — [kaikki German](https://kaikki.org/dictionary/German/index.html); [kaikki index](https://kaikki.org/dictionary/)
- The full English-edition raw JSONL is 24.8 GB (2.9 GB gz) — [kaikki raw data](https://kaikki.org/dictionary/rawdata.html)

**Coverage and sizes: native-language editions** (glosses in the language itself, which a pt/de UI needs for definitions)
- German Wiktionary (de) edition: JSONL 2.9 GB, 295.8 MB compressed — [kaikki raw data](https://kaikki.org/dictionary/rawdata.html)
  - 3,217,802 "Deutsch" senses — [kaikki dewiktionary](https://kaikki.org/dewiktionary/index.html)
  - Inference: this count is far above the en-edition count, so it almost certainly includes de.wiktionary's large set of inflected-form pages.
- Portuguese Wiktionary (pt) edition: JSONL 341.6 MB, 35.5 MB compressed — [kaikki raw data](https://kaikki.org/dictionary/rawdata.html)
  - 566,201 "Português" senses — [kaikki ptwiktionary](https://kaikki.org/ptwiktionary/index.html)
- Kaikki labels every non-English edition "work in progress" — [kaikki raw data](https://kaikki.org/dictionary/rawdata.html)

**Fields**
- Wiktextract word entries carry:
  - `sounds`: a list of objects, which may include an `ipa` string
  - `senses[].glosses`
  - Linkage lists: `synonyms`, `antonyms`, `hypernyms`, `holonyms`, `meronyms`, `derived`, `related` (each item has a `word`), at word or sense level
  - The README format section does not document a `hyponyms` key, although its overview mentions hyponyms
  - [wiktextract README](https://github.com/tatuylonen/wiktextract/blob/master/README.md)
- German-edition extractor model (`extractor/de/models.py`) [measured: grep of the source]:
  - Sound: `ipa`, `rhymes`
  - Word: `synonyms`, `antonyms`, `hypernyms`, `hyponyms`, `holonyms`, `meronyms`, `coordinate_terms`, `derived`, `related`, `expressions`, `proverbs`, `translations`, `sounds`
  - Sense: `glosses`
  - [wiktextract de models.py](https://github.com/tatuylonen/wiktextract/blob/master/src/wiktextract/extractor/de/models.py)
- Portuguese-edition extractor model (`extractor/pt/models.py`) [measured]:
  - Present: `glosses`, `ipa`, `sounds`, `synonyms`, `antonyms`, `hypernyms`, `hyponyms`, `related`, `derived`, `phraseology`, `translations`
  - No `meronyms`/`holonyms`, and no `rhymes` field
  - [wiktextract pt models.py](https://github.com/tatuylonen/wiktextract/blob/master/src/wiktextract/extractor/pt/models.py)

**Wiktionary license terms**
- Wiktionary text is dual-licensed under CC BY-SA 4.0 International and GFDL ("Version 1.1 or any later version", no invariant sections) — [Wiktionary:Copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- CC BY-SA reuse requires three things — [Wiktionary:Copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights):
  - your material carries the same or a compatible license
  - you credit as the licensor specifies
  - you imply no endorsement
- GFDL reuse requires GFDL licensing plus access to the wiki text. A "conspicuous link back" to the article satisfies the access part — [Wiktionary:Copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- The page itself is flagged outdated and does not say when 4.0 was adopted — [Wiktionary:Copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)

**CC guidance on data / databases (CC BY-SA 4.0)**
- "Facts are not subject to copyright." Sui generis database rights exist only in some places (EU, Korea, Mexico). Where they apply, BY-SA requires you to "apply the same or a compatible license to any database you share publicly" that includes a substantial portion of the licensed contents — [CC wiki: Data](https://wiki.creativecommons.org/wiki/Data)
  - Substantiality has no clear rule. It is judged quantitatively and qualitatively, and several insubstantial extractions can add up — [CC wiki: Data](https://wiki.creativecommons.org/wiki/Data)
  - That obligation "does not require you to ShareAlike any copyright or other rights" you hold in the individual contents of your database — [CC wiki: Data](https://wiki.creativecommons.org/wiki/Data)
- In the 4.0 suite, "applicable sui generis database rights are licensed under the same license conditions as copyright". Uses already permitted by copyright exceptions do not trigger license terms — [CC FAQ](https://creativecommons.org/faq/)
- BY-SA 4.0 is one-way compatible with GPLv3, and only for content integrated into software — [CC FAQ](https://creativecommons.org/faq/)

**DBnary**
- DBnary is an RDF (OntoLex/lemon) extraction of many Wiktionary language editions, German and Portuguese among them. It is described as updated twice a month — [kaiko.getalp.org (via search)](https://kaiko.getalp.org/); [Zenodo DBnary record](https://zenodo.org/records/10064025)
- A search summary said DBnary data is CC BY-SA 3.0. I could not load the DBnary "about" page to confirm on the primary source (the fetch failed) — [kaiko.getalp.org](https://kaiko.getalp.org/)
- One repository listing shows the German edition at 80.7 MB with morphology, 40.1 MB without — [linguistik.de annohub](https://linguistik.de/en/lod/annohub-repository)

### Inferences
- **Which edition for which mode.**
  - Definitions shown to a pt/de user should come from the native editions (pt.wiktionary, de.wiktionary). en.wiktionary glosses are in English.
  - Relations (synonyms, antonyms, hyponyms) can be merged from both editions and keyed by headword.
  - For German, the de edition is clearly the stronger source: meronyms, holonyms and a Wiktionary-authored `rhymes` value.
  - For Portuguese, the native edition is much smaller (35.5 MB gz versus 295.8 MB for de) and lacks meronyms. Portuguese "parts of" will be thin from Wiktionary alone.
- **Size after trimming.** Raw files are hundreds of MB to GB, but the shippable derived data is small. Keep lemmas only, drop translations/etymology/inflection pages, cap glosses, and store relations as word-ID lists. That likely gives a few MB per language compressed. This is an estimate: not measured, and it should be measured by actually building the file.
- **Licensing: conservative reading for SongNook.**
  1. Definitions (glosses) are clearly copyrightable expression. Shipping or serving them is redistribution of CC BY-SA material.
  2. Synonym/antonym lists are closer to "facts". But the curated Wiktionary selection, extracted wholesale, is plausibly a "substantial portion" of a database in the EU. German and Portuguese users are largely EU and Brazil, and SongNook serves the EU.
  3. Safest posture:
     - (a) In-app credit: "Word data from Wiktionary (CC BY-SA 4.0)", with a link, on the Word Finder about/credits row.
     - (b) Publish the derived data file (the JSON/SQLite the app ships or the Worker serves) under CC BY-SA 4.0, e.g. a public download or GitHub repo.
     - (c) Mark changes.
  4. ShareAlike attaches to the adapted material (the word database), not to the app's own source code. A mobile app that reads a separate CC BY-SA data file is normally treated as a collection, not an adaptation. This is a common reading, not something a source here confirmed.
  5. Choose the CC BY-SA option of the dual license; GFDL's whole-text/notice requirements are heavier.
  6. Serving results from a Worker API is still "making available" to the public. Attribution belongs in the client UI regardless of where the lookup happens.
- **Pros and cons.** Wiktextract is the only open source that covers definitions, IPA and relations together for both languages, with a living update pipeline. It is the natural spine for a build-it-ourselves approach.
- **DBnary** adds little over Wiktextract for this use case: the same Wiktionary origin, RDF instead of JSON. Its unconfirmed 3.0 license version is a further reason to prefer Wiktextract (4.0).

### Gaps
- When Wikimedia moved from CC BY-SA 3.0 to 4.0. The page fetched is flagged outdated and is silent on the date, so older revisions may be 3.0-only. BY-SA 3.0 permits adaptations under later versions with the same elements, but that clause was not verified from a primary source here.
- Exact per-field fill rates: how many pt/de entries actually have synonyms, antonyms, hyponyms, meronyms or IPA. This needs a jq pass over the JSONL. Not done (the downloads are 35 MB to 3 GB).
- Whether en-edition wiktextract output still emits `hyponyms` in practice. The README format section omits it, and the JSON-schema grep returned nothing (the file path may have moved).
- DBnary license version and per-language statistics: the primary page was not reachable.
- No court ruling or CC statement specifically on word-relation lists and EU database rights. Legal review advisable before launch.

---

## 2. Wordnets: Open Multilingual Wordnet (OMW), Open German WordNet (OdeNet), OpenWordNet-PT

### Takeaway
Two maintained wordnets exist: OdeNet (de) and OpenWordnet-PT (pt). Both are packaged in the `wn` Python library. They give synset-structured synonyms plus hypernym/hyponym-type relations, at modest size: about 36k synsets (de) and about 44–53k synsets (pt). Licenses differ:
- OdeNet: CC BY-SA 4.0
- OpenWordnet-PT: CC BY 4.0, attribution only, no ShareAlike, which makes it the friendliest license of anything here

### Cited findings
- `wn` library (MIT, v1.1.1 released 2026-08-14) lists the following — [wn on PyPI](https://pypi.org/project/wn/):
  - `odenet:1.4`: 36,268 synsets (German)
  - `own-pt:1.0.0`: 52,670 synsets (Portuguese)
  - `omw-pt:2.0`: 43,895 synsets (Portuguese)
  - `oewn:2025+`: 120,564 synsets (English)
  - No separate `omw-de` lexicon is listed
- OdeNet data is CC BY-SA 4.0 and its Python code is MIT. The repo says "the current version is automatically compiled", that manual checking of synsets has begun, and that it is released in the `wn` package — [hdaSprachtechnologie/odenet](https://github.com/hdaSprachtechnologie/odenet)
- OdeNet's last commit was 2026-01-07 [measured via GitHub API], so it is maintained — [odenet repo](https://github.com/hdaSprachtechnologie/odenet)
- OdeNet was built from the OpenThesaurus German synonym lexicon plus OMW links to Princeton WordNet. The 2021 paper estimates about 90% accuracy for OMW-derived synsets. Hypernym relations were added from an analysis of German nominal compounds — [OdeNet GWC 2021 paper](https://preview.aclanthology.org/fix_video/2021.gwc-1.22.pdf); [odenet repo](https://github.com/hdaSprachtechnologie/odenet)
- OpenWordnet-PT README: "This work is licensed under a Creative Commons Attribution 4.0 International License." The RDF is based on W3C wordnet-rdf / Princeton-derived vocabulary — [own-pt/openWordnet-PT](https://github.com/own-pt/openWordnet-PT)
- OpenWordnet-PT's last commit was 2026-04-19 [measured] — [own-pt repo](https://github.com/own-pt/openWordnet-PT)
- OpenWordnet-PT is a Brazilian-Portuguese wordnet using the same identifiers as WordNet 3.0 — [Rademaker et al. 2014](https://aclanthology.org/W14-0153.pdf)
- The OMW data repo (`omwn/omw-data`) was last pushed 2026-03-28 [measured] — [omwn/omw-data](https://github.com/omwn/omw-data)

### Inferences
- **Coverage is modest.** 36–53k synsets will cover common nouns, verbs and adjectives well but miss slang and lyric vocabulary. Wordnets are a good second source to merge with Wiktionary relations, not a replacement.
- **Filling gaps via ILI.** Both wordnets align to Princeton/ILI identifiers, so missing relations can be "borrowed" from the far denser English wordnet. A Portuguese synset linked to an English synset can inherit that synset's hyponyms, meronyms and "describing" (attribute/similar-to) neighbours, kept only where the target synsets also have pt/de lemmas.
  - This is the standard trick to fill hyponyms ("kinds of") and meronyms ("parts of") for both languages without an LLM.
  - Open English WordNet's license is not confirmed here (see Gaps).
- **License fit.**
  - OpenWordnet-PT (CC BY 4.0): ship freely with attribution.
  - OdeNet (CC BY-SA 4.0): same ShareAlike posture as Wiktionary data. Since the German file will likely already contain Wiktionary data, one CC BY-SA 4.0 data file covers both.
- **Antonyms and meronyms** in OdeNet and OWN-PT were not enumerated here. Wordnets usually carry antonyms at the sense level for adjectives only.

### Gaps
- Precise relation-type counts for OdeNet and OWN-PT (antonym, meronym, hyponym edge counts) were not found. They need loading via `wn` and counting.
- License of `omw-pt` (OMW's packaging) and of Open English WordNet (needed if borrowing relations via ILI). Not verified in this pass; OEWN is generally reported as CC BY 4.0.
- Quality assessment of OdeNet's automatically compiled synsets for lyric use was not tested.

---

## 3. ConceptNet: pt/de coverage, license, relations, maintenance status

### Takeaway
ConceptNet treats German and Portuguese as "core" languages and has the right relation types (RelatedTo, Antonym, PartOf). But it is effectively unmaintained: the last commit was September 2021, and the public API returned HTTP 502 on 2026-10-25. Its data is CC BY-SA 4.0 with an attribution text that must be shown in the app, and the English parts it imports come from Wiktionary anyway. Use, if at all, only as a one-time offline dump for "related words". Do not call its API.

### Cited findings
- German and Portuguese are among ConceptNet's 10 "core languages", with vocabularies of about 825,741 terms (de) and 473,709 terms (pt) — [ConceptNet wiki: Languages](https://github.com/commonsense/conceptnet5/wiki/Languages)
- License — [ConceptNet wiki: Copying and sharing](https://github.com/commonsense/conceptnet5/wiki/Copying-and-sharing-ConceptNet):
  - The complete data is CC BY-SA 4.0: "You may not use ConceptNet without attribution."
  - Software must show the provided credit text in a user-visible location.
  - Embedded sources keep their own terms: Wiktionary/DBpedia under CC BY-SA 3.0, WordNet under the Princeton license, OMW and others.
- The last commit in commonsense/conceptnet5 is dated 2021-09-07 [measured via GitHub API] — [conceptnet5 repo](https://github.com/commonsense/conceptnet5)
- `https://api.conceptnet.io/c/de/haus` and `/c/pt/casa` returned "502 Bad Gateway" (nginx/1.14.0) on 2026-10-25 [measured]
- Third-party conceptnet-lite says ConceptNet "was not updated since September 2021" and advises against use in new projects — [conceptnet-lite on PyPI](https://pypi.org/project/conceptnet-lite)
- The ConceptNet wiki home page was last edited 2021-05-24 — [conceptnet5 wiki](https://github.com/commonsense/conceptnet5/wiki)

### Inferences
- Mark ConceptNet **unmaintained**. A one-time 2019–2021 dump (5.7/5.8) could seed a "related words" mode. But it adds an extra attribution string and mixed CC BY-SA 3.0/4.0 provenance.
- For pt/de, much of ConceptNet's non-English content derives from Wiktionary, so overlap with Wiktextract is high.
- Low priority. Embeddings or wordnet neighbours are a cleaner route to "related".

### Gaps
- Whether the 5.7 dump is still downloadable from its original S3 location, and its current size. Not checked.
- Per-language edge counts for pt/de relation types: not on the Languages page.

---

## 4. G2P (pronunciation) tools for computing rhymes: espeak-ng, Epitran, CharsiuG2P, Phonetisaurus, ipa-dict, and deriving rhyme keys from IPA

### Takeaway
For both languages the practical path is offline precomputation.
1. Take a word list (Wiktionary headwords plus a frequency list).
2. Get IPA from Wiktionary/ipa-dict where it exists, and fill the rest by running a G2P tool at build time.
3. Derive a rhyme key: the last stressed vowel to the end, with a secondary-stress rule for German compounds.
4. Ship a word→key table plus a key→words index.

A quick prototype on ipa-dict produced sensible rhyme sets for both languages [measured]. espeak-ng is the strongest stress-aware G2P for pt-BR/pt-PT/de. It is GPL-3.0-or-later, so run it only offline or server-side; do not bundle it in the iOS/Android binary.

### Cited findings

**ipa-dict (open-dict-data)**
- The repo is MIT "unless otherwise specified"; third-party datasets keep their licenses — [open-dict-data/ipa-dict](https://github.com/open-dict-data/ipa-dict)
- German data comes from devio-at/german-ipa-dict, "based on Wiktionary, and released under a CC BY-SA license" — [ipa-dict README credits](https://github.com/open-dict-data/ipa-dict)
- german-ipa-dict extracts IPA from en.wiktionary and de.wiktionary dumps. Its last push was 2023-10-25 [measured] — [devio-at/german-ipa-dict](https://github.com/devio-at/german-ipa-dict)
- `data/pt_BR.txt` exists [measured]: 95,933 entries, 2.7 MB.
  - It was created 2020-11-26 and last touched 2025-03-06 (formatting fix).
  - The README credits section does **not** state its source or license, so it falls back to the repo's MIT default. Provenance is unclear.
  - Spot-check errors seen: "ilo /ˈĩ.lʊ/".
  - [ipa-dict data folder](https://github.com/open-dict-data/ipa-dict/tree/master/data)
- `data/de.txt` [measured]: 787,104 entries, 29 MB, with 81,924 multi-word entries such as "arbeitetet heraus" — [ipa-dict de.txt](https://github.com/open-dict-data/ipa-dict/blob/master/data/de.txt)
- There is no pt_PT file [measured]. Only pt_BR exists.

**espeak-ng**
- "eSpeak NG Text-to-Speech is released under the GPL version 3 or later license" — [espeak-ng README](https://github.com/espeak-ng/espeak-ng/blob/master/README.md); [COPYING](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING)
- Voices `pt`, `pt-BR` (under `espeak-ng-data/lang/roa`) and `de` (under `lang/gmw`) exist [measured via GitHub API] — [espeak-ng repo](https://github.com/espeak-ng/espeak-ng)
- The latest release is 1.52.0 (2024-12-12), and the repo was pushed 2026-09-22 [measured], so it is maintained — [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases)

**Epitran**
- MIT; repo pushed 2026-10-08, so maintained [measured] — [dmort27/epitran](https://github.com/dmort27/epitran)
- Maps `por-Latn.csv`, `deu-Latn.csv`, `deu-Latn-np.csv` and `deu-Latn-nar.csv` exist [measured] — [Epitran maps](https://github.com/dmort27/epitran/tree/master/epitran/data/map)

**CharsiuG2P**
- MIT; last push 2023-05-26, so effectively **unmaintained** [measured] — [lingjzhu/CharsiuG2P](https://github.com/lingjzhu/CharsiuG2P)

**Phonetisaurus**
- BSD-3-Clause; last push 2024-06-01, so low activity [measured]. It is a WFST G2P trainer: you supply the training lexicon — [AdolfVonKleist/Phonetisaurus](https://github.com/AdolfVonKleist/Phonetisaurus)

**Rhyme-key prototype** [measured]
- Script: take the first listed IPA, drop syllable dots and secondary stress, cut at the last primary stress `ˈ`, then take the first vowel onward.
- Portuguese (pt_BR, 95,933 entries, all stress-marked): 7,084 distinct keys.
  - coração → `ãʊ̃` → 3,659 words (abdicação, aberração…)
  - saudade → `adʒɪ` → 939
  - amor → `ox` → 1,314
  - cantar → `ax` → 3,187
- German (de, 694,416 of 787,104 entries stress-marked): 439,799 distinct keys.
  - Herz → `ɛʁt͡s` → 24 (Hertz, März, Nerz, Konzerts…)
  - Liebe → `iːbə` → 51 (bliebe, Diebe, Getriebe…)
  - singen → `ɪŋən` → 85 (bringen, bezwingen…)
  - Nacht → `axt` → 75 (acht, bedacht, bewacht…)
  - The very high distinct-key count comes from compounds and from entries without a stress mark, which yield whole-word keys.

### Inferences

**Rhyme-key recipe** (proposed, building on the prototype)
- **Perfect rhyme key**: the segment from the nucleus of the last stressed syllable to the end of the word, normalised:
  - strip syllable dots and length variants as policy decides
  - fold allophones that songwriters treat as rhyming: pt-BR `x/h/ʁ/ɾ` in coda; `ɐ/a` unstressed
- **German compounds** carry primary stress on the first element (Herzschmerz = ˈhɛʁt͡sʃmɛʁt͡s). A primary-stress key would make "Herzschmerz" rhyme with nothing. Use the last stress mark of either kind (`ˈ` or `ˌ`). For unmarked compounds, split on the known final element and take its key. The 439,799-key count shows this matters.
- **Near rhyme**: key on the stressed vowel plus the vowels of following syllables only (assonance), or allow coda-consonant classes (nasal/stop/fricative) to match.
- **Sounds-like**: edit distance on the full IPA string, or on a consonant skeleton, within a length band. Precompute top-N per word at build time.
- **Portuguese varieties**: ipa-dict pt_BR is Brazilian only (amor → `ox` reflects a carioca-style coda r). European Portuguese rhymes differ (final unstressed vowels reduce, coda r is `ɾ`). For Portugal users, generate pt-PT IPA with espeak-ng `pt` and keep two key columns, or fold coda-r variants into one class.
- **Coverage pipeline**: Wiktionary IPA (best quality; de.wiktionary has dense IPA and a `rhymes` field) → ipa-dict → espeak-ng for out-of-vocabulary words, run offline. Epitran is MIT and maintained, so it is bundle-safe, but it is rule-based. Whether its pt/de maps mark stress was not verified, and stress is required for rhyme keys, so treat it as a fallback only.
- **GPL implications for espeak-ng**:
  - Running it on a server, or as a build-time tool, does not distribute it. GPLv3 (not AGPL) imposes no source obligation for network use.
  - Its IPA output is generally not treated as a GPL-covered derivative work. This is an inference, not legally confirmed here.
  - Bundling libespeak-ng inside the app would make the app a GPLv3 distribution: source must be offered, and App Store terms are widely considered to conflict with GPLv3. Avoid.
  - Cloudflare Workers cannot run native espeak without a WASM build, so precomputation is simpler than runtime G2P.
- **Data licenses for rhymes**:
  - German IPA from ipa-dict or Wiktionary is CC BY-SA, so it joins the same attributed CC BY-SA data file.
  - The pt_BR ipa-dict file's provenance is undocumented. Prefer pt Wiktionary IPA plus espeak-ng output, both of known license status, and use ipa-dict pt_BR only after confirming its origin with the maintainers.
- **Size**: a word→rhyme-key table for about 100k words per language is a few MB uncompressed. The de file must be trimmed: drop multi-word entries, keep only lemmas plus common inflections, filter by a frequency list. Estimate, not measured.

### Gaps
- Whether Epitran's por-Latn/deu-Latn output includes stress. Not tested.
- CharsiuG2P's exact language codes and model sizes for pt/de: not retrieved. Its unmaintained status and the ~100 MB+ ByT5 weights (a recollection, not verified) make it unattractive anyway.
- Accuracy benchmarks of espeak-ng vs Wiktionary IPA for pt/de: none found in this pass.
- The license and source of ipa-dict `pt_BR.txt` are undocumented. Would need to ask the maintainers or check the creating commit's discussion.

---

## 5. Word embeddings for "similar"/"related" words: fastText vectors, size, precomputing nearest neighbours

### Takeaway
fastText Common Crawl vectors exist for both languages (300-d, CC BY-SA 3.0), but the downloads are about 1.3 GB (.vec.gz) or 4.5 GB (.bin.gz) per language. They are only practical as an offline input: precompute the top-20 or top-30 neighbours for the 30–100k most frequent words. The result is a few MB per language, which can be bundled or put in KV/D1. It inherits CC BY-SA attribution and, conservatively, ShareAlike.

### Cited findings
- The cc vectors are "distributed under the Creative Commons Attribution-Share-Alike License 3.0" — [fastText crawl vectors](https://fasttext.cc/docs/en/crawl-vectors.html)
  - Training: Common Crawl + Wikipedia; CBOW with position weights; 300 dimensions; character 5-grams; window 5; 10 negatives
  - A `reduce_model.py` / `fasttext.util.reduce_model` reduces dimensions, e.g. to 100
- Download sizes [measured, HTTP Content-Length on dl.fbaipublicfiles.com]:
  - `cc.de.300.vec.gz` 1.28 GB; `cc.de.300.bin.gz` 4.50 GB
  - `cc.pt.300.vec.gz` 1.27 GB; `cc.pt.300.bin.gz` 4.51 GB
  - Aligned vectors: `wiki.de.align.vec` 5.15 GB; `wiki.pt.align.vec` 1.34 GB

### Inferences
- **Neighbour-list file size.** Restrict the vocabulary to about 50k frequent lemmas and compute top-25 cosine neighbours with an approximate nearest-neighbour library offline. Store neighbours as 2–3-byte word IDs, then compress. That is about 50k × 25 × 3 B ≈ 3.75 MB raw, likely 2–3 MB compressed per language. Arithmetic estimate, not built.
- **Quality caveats.** Embedding neighbours mix synonyms, antonyms, co-hyponyms and inflections (e.g. "Liebe" next to "Liebes", "Hass"). Filter out same-lemma inflections and use them for the "related"/"sounds-similar-in-meaning" mode only, not "synonyms".
  - "Describing adjectives" (Datamuse's `rel_jjb`) is better approximated by POS-filtering neighbours to adjectives or, more faithfully, by corpus adjective–noun co-occurrence counts. That needs a pt/de corpus not covered here.
- **License.** CC BY-SA 3.0 adaptations may be relicensed under later BY-SA versions with the same elements (a clause of the 3.0 license, not re-verified here). Neighbour lists could therefore live in the same CC BY-SA 4.0 data file as the Wiktionary data. Whether a neighbour list is even an "adaptation" of a vector file (versus non-copyrightable computed facts) is uncertain; treat it conservatively as covered.
- **fastText status.** The vectors date from about 2018 and are static: unmaintained but stable. Facebook's fastText repo activity was not checked.

### Gaps
- Newer open multilingual embedding models with permissive licenses (e.g. sentence-embedding models under Apache/MIT) were not evaluated. They could avoid ShareAlike, but this is outside the brief.
- Actual neighbour quality for pt/de lyric vocabulary was not sampled.
- Whether fastText's GitHub repo is archived was not checked.

---

## 6. LLM fallback: cost per 1,000 lookups (small fast models, October 2026 pricing) and caching

### Takeaway
At current list prices a small model costs roughly $0.10–$0.50 per 1,000 word-list lookups (estimate). Claude Haiku 4.5 or Gemini 3-series Flash costs about $1–2 per 1,000. Precomputing an entire vocabulary offline through a Batch API is cheap: tens of dollars per language per mode set. An LLM is therefore financially viable for meaning modes (synonyms, antonyms, kinds of, parts of, describing words, short definitions). It should **not** be the source of rhymes: LLMs are unreliable at phonetic rhyme, which is a model-behaviour claim not sourced here, and G2P keys are deterministic and free.

### Cited findings

**Anthropic (per million tokens)** — [Claude pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)

| Model | Input | Output | Cache hit | Batch input | Batch output |
|---|---|---|---|---|---|
| Claude Haiku 5.5 (prompts ≤100k tokens) | $0.10 | $0.50 | $0.01 | $0.05 | $0.25 |
| Claude Haiku 4.5 | $1 | $5 | $0.10 | $0.50 | $2.50 |

- Batch API is 50% off.
- US-only inference (`inference_geo`) adds a 1.1× multiplier on Claude 4.6+ models.

**OpenAI standard tier (per million tokens)** — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

| Model | Input | Output |
|---|---|---|
| gpt-5-nano | $0.05 | $0.40 |
| gpt-4.1-nano | $0.10 | $0.40 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-5.4-nano | $0.20 | $1.25 |
| gpt-5-mini | $0.25 | $2.00 |
| gpt-5.4-mini | $0.75 | $4.50 |

- Batch is half price, e.g. gpt-5-nano $0.025 / $0.20.

**Google Gemini paid tier, text (per million tokens)** — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

| Model | Input | Output |
|---|---|---|
| 2.5 Flash-Lite | $0.10 | $0.40 |
| 3.1 Flash-Lite | $0.25 | $1.50 |
| 2.5 Flash | $0.30 | $2.50 |
| 3.5 Flash-Lite | $0.30 | $2.50 |
| 3 Flash Preview | $0.50 | $3.00 |
| 3.6 / 3.8 Flash | $0.75 | $3.75 |

- 3.6/3.8 Flash are listed at that price "through December 31, 2026", rising to $1.50 / $7.50 from 2027-01-01.
- Batch is 50% off. Output prices include thinking tokens.

### Inferences

All figures below are estimates under stated assumptions.
- **Assumed lookup shape**: a ~300-token prompt (system instructions plus word plus mode) and a ~250-token JSON list of 30–50 words. Cost per 1,000 lookups = 0.3 M input × price + 0.25 M output × price.

| Model | Approx. cost per 1,000 lookups |
|---|---|
| Claude Haiku 5.5 | $0.03 + $0.125 ≈ **$0.16** (Batch ≈ $0.08) |
| Claude Haiku 4.5 | $0.30 + $1.25 ≈ **$1.55** |
| gpt-5-nano | $0.015 + $0.10 ≈ **$0.12**, more if reasoning tokens are billed as output |
| gpt-4.1-nano | ≈ **$0.13** |
| gpt-4o-mini | $0.045 + $0.15 ≈ **$0.20** |
| Gemini 2.5 Flash-Lite | ≈ **$0.13** |
| Gemini 3.1 Flash-Lite | $0.075 + $0.375 ≈ **$0.45** |
| Gemini 3 Flash Preview | ≈ **$0.90** |
| Gemini 3.6/3.8 Flash | ≈ **$1.16** in 2026, ≈ **$2.33** from 2027 |

- **Prompt caching** cuts the input share further but barely matters: output dominates.
- **Precompute instead of per-lookup.**
  - Example: 20,000 headwords × 7 meaning modes = 140,000 calls ≈ 140 × $0.08 ≈ **$11 per language** on Haiku 5.5 Batch, or about $217 on Haiku 4.5 Batch.
  - Results go into KV/D1 or a bundled file. Per-user cost becomes zero, and quality can be spot-checked before shipping.
  - The long tail (words outside the precomputed set) goes to the live Worker path, cached for a year as the Hebrew Worker already does.
- **Hybrid that fits SongNook's "quiet, offline-capable" ethos.**
  1. Rhymes, near rhymes, sounds-like: G2P keys, bundled, deterministic, offline. Built from Wiktionary IPA + espeak-ng offline + ipa-dict.
  2. Synonyms/antonyms/hyponyms/meronyms/definitions: Wiktextract + wordnet (+ ILI borrowing), bundled or served from a CC BY-SA data file.
  3. LLM (batch-precomputed or cached live) only where the open data is thin. "Describing adjectives" is the prime candidate: no open source above provides it directly. Portuguese meronyms are next, plus long-tail words.
- **Licensing advantage of LLM output.** LLM-generated lists do not carry CC BY-SA, so they avoid ShareAlike entirely. Provider output-ownership terms were not verified here (see Gaps). Mixing them into a CC BY-SA file would, conservatively, place the combined file under BY-SA. Keep LLM-generated lists in a separate table if that matters.

### Gaps
- Real token counts per lookup were not measured. The 300/250 assumption could be off by 2×, especially for reasoning-enabled models like gpt-5-nano and Gemini 3.x, where thinking tokens are billed as output.
- Cloudflare Workers AI model pricing was not checked. It may be relevant since the stack is already on Cloudflare.
- Provider terms on output ownership and commercial reuse were not re-verified for 2026.
- No benchmark of small-model accuracy for Portuguese/German synonym, antonym or hyponym lists. Spot-checking is advisable before precomputing at scale.
