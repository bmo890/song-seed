# German word-tool data sources for SongNook (rhymes, thesaurus, definitions, frequency)

Research date: 2026-10-25. "Live-tested" means I actually called the endpoint on 2026-10-25 and saw the response quoted.

## 1. Rhymes and near rhymes: APIs, pronunciation lexicons, and how far spelling gets you

### Takeaway
No German rhyme API is both reliable and clearly licensed for commercial use. RhymeBrain answers `lang=de` but has a low rate limit and gives noisy results. Datamuse has no German. The best base is German Wiktionary, which stores phoneme-based rhyme classes (47,100 "Reim:Deutsch" pages) plus IPA under CC BY-SA. Build an offline rhyme index from it (via a Wiktextract/kaikki dump), and fill gaps with a spelling-to-sound fallback. Rhyming on spelling alone is unreliable for German.

### Cited Findings
**Datamuse (current EN/ES provider)**
- Live-tested: `api.datamuse.com/words?rel_rhy=liebe&v=de` returned English rhymes ("plebe", "dweeb", "glebe", "hebe"), so `v=de` is silently ignored and Datamuse has no German rhyme support. `ml=liebe&v=de` returned a mix of German and Dutch tokens from its English vocabulary ("lieber", "liebling", "lieve", "mensch"). It is not usable for German — live call to https://api.datamuse.com/words?rel_rhy=liebe&v=de

**RhymeBrain**
- Supports German through `lang=de` (the docs list "en, de, es, fr, ru") — [RhymeBrain API](https://rhymebrain.com/api.html)
- Rate limit: "The current rate limit is 350 requests per hour" (leaky bucket). Each query in a batch counts separately. Higher volumes need "special arrangements" — [RhymeBrain API](https://rhymebrain.com/api.html)
- Attribution: apps "must acknowledge RhymeBrain.com in your application's About screen". The docs give no fees, do not address commercial use directly, and give no uptime guarantee ("We cannot guarantee that RhymeBrain will remain available all the time") — [RhymeBrain API](https://rhymebrain.com/api.html)
- Live-tested `rhymebrain.com/talk?function=getRhymes&word=Liebe&lang=de`: it returned liebe, zuliebe (score 300, perfect), then liegen, siehe, inklusive, operative, respektive (228), müde (120), prima, stünde (84). Perfect rhymes are few. The near rhymes are loose, and the list includes the query word itself. Each result carries `freq` and `syllables` — live call to https://rhymebrain.com/talk?function=getRhymes&word=Liebe&lang=de
- The 350/hour limit is per caller. Every user request routed through one Cloudflare Worker would share that budget unless results are heavily cached — inference from the [RhymeBrain API](https://rhymebrain.com/api.html) terms.

**German Wiktionary rhyme data (strongest open source)**
- Wiktionary defines rhymes by pronunciation, not spelling: "Wörter reimen sich, wenn sich ihre Aussprache vom Vokal der letzten hauptbetonten Silbe an gleicht." Diphthongs count fully. Secondary stress does not count, and words with several main stresses rhyme on the last one. Words with several pronunciations can belong to several rhymes — [Wiktionary Hilfe:Reime](https://de.wiktionary.org/wiki/Hilfe:Reime)
- Rhyme pages are named "Reim:Deutsch:-<IPA>" and are all listed in "Kategorie:Reim (Deutsch)". Each entry's pronunciation section has a "Reime:" line linking to its page — [Wiktionary Hilfe:Reime](https://de.wiktionary.org/wiki/Hilfe:Reime)
- Live-tested via the MediaWiki API: Kategorie:Reim (Deutsch) holds 47,100 pages, Kategorie:Deutsch 1,003,194 pages (inflected forms included), and Kategorie:Substantiv (Deutsch) 141,730 pages — live call to https://de.wiktionary.org/w/api.php?action=query&prop=categoryinfo&titles=Kategorie:Reim%20(Deutsch)
- Live-tested page "Reim:Deutsch:-iːbə": a header template lists `Schreibungen=-ibe, -iebe` and `Ähnliche Reime={{Reim|iːpə}}, {{Reim|ɪbə}}, {{Reim|yːbə}}`. Words are grouped by syllable count (zweisilbig: bliebe, Diebe, Liebe, Triebe…; dreisilbig: Getriebe, verliebe, zuliebe…). The "Ähnliche Reime" links are a curated source of near rhymes — live call to https://de.wiktionary.org/w/api.php?action=parse&page=Reim:Deutsch:-iːbə&prop=wikitext&format=json
- Live-tested: the entry "Liebe" has IPA `ˈliːbə`, hyphenation `Lie·be`, the rhyme `{{Reim|iːbə|Deutsch}}`, and 8 numbered senses — live call to https://de.wiktionary.org/w/api.php?action=parse&page=Liebe&prop=wikitext&format=json&section=1
- Wiktionary itself warns about other tools: rhyme search engines on the internet "betrachten meist nur die Schreibung von Wörtern und sind daher wenig geeignet". It names Echtreim as giving relatively good results — [Wiktionary Hilfe:Reime](https://de.wiktionary.org/wiki/Hilfe:Reime); [search summary](https://de.wiktionary.org/wiki/Hilfe:Reime)
- Machine-readable dump: kaikki.org hosts a Wiktextract extraction of the German edition (dewiktionary dump dated 2026-10-01, extracted 2026-10-24). The raw JSONL is 2.9 GB (295.8 MB gzipped). The post-processed files are marked "[DEPRECATED]… will be removed in the near future", but the raw data remains. The page states no license; Wiktionary content itself is CC BY-SA — [kaikki dewiktionary raw data](https://kaikki.org/dewiktionary/rawdata.html); [Wiktextract repo](https://github.com/tatuylonen/wiktextract) (active, last push 2026-10-23, per the GitHub API)

**Other pronunciation sources**
- DWDS IPA API: `https://www.dwds.de/api/ipa/?q={term}`, up to 20 characters. It returns `ipa` plus `status` ("auto" = machine-generated, "proved" = edited by DWDS) — [DWDS API](https://www.dwds.de/d/api). Live-tested "Liebe" → `[{"ipa":"ˈliːbə","status":"auto"}]`. However, DWDS terms forbid automated queries and text/data mining without explicit permission (see section 2), so bulk-harvesting IPA would need DWDS's consent — [DWDS Nutzungsbedingungen](https://www.dwds.de/d/nutzungsbedingungen)
- eSpeak NG (German grapheme-to-phoneme rules): GPL-3.0 and actively maintained (last push 2026-09-22) — [GitHub espeak-ng](https://github.com/espeak-ng/espeak-ng) (license from the GitHub API)
- MaryTTS German lexicon: repo `marytts/marytts-lexicon-de`, LGPL-3.0, last push 2024-02-06 (slow maintenance) — [GitHub marytts-lexicon-de](https://github.com/marytts/marytts-lexicon-de)
- CELEX German (v2.0) is distributed by LDC as LDC96L14 under a "CELEX Agreement". No public price or commercial terms were found, and it is described as proprietary — [LDC catalog LDC96L14](https://catalog.ldc.upenn.edu/LDC96L14); [CELEX readme](https://catalog.ldc.upenn.edu/docs/LDC96L14/celex.readme.html)
- reimemonster (npm) does spelling-ending rhyme matching plus regex syllable counting. Its author concedes it fails on some words — [npm reimemonster](https://npmjs.com/package/reimemonster)
- Rhyme websites: reimemaschine.de is up (HTTP 200, robots.txt `allow: /`) but publishes no API and has no linked terms page. d-reim.de, reimlexikon-online.de and echtreim.de did not respond to my requests (HTTP 000 / timeout) on 2026-10-25 — live checks of https://www.reimemaschine.de/ etc. None documents a public API — [search](https://npmjs.com/package/reimemonster)

### Inferences
- **Recommended rhyme stack:** at build time, run Wiktextract (de edition) to pull every German lemma's IPA and its "Reim" class. Key each word on its rhyme class: IPA from the last stressed vowel to the end. Bundle that as a compact table, roughly a few MB after filtering to words that appear in a frequency list. Perfect rhymes = same class. Near rhymes = Wiktionary's own "Ähnliche Reime" links plus computed relaxations: same vowel ignoring length, voiced/voiceless consonant swaps, nasal swaps, and ə-endings. This mirrors the Hebrew/Spanish approach without a paid API.
- **Share-alike:** an IPA/rhyme table derived from Wiktionary is CC BY-SA, so the bundled data file (not the app code) must be offered under CC BY-SA, with attribution in About/Credits. That is manageable for a data file but should be a deliberate, recorded choice.
- **eSpeak NG as a tool:** using it as an offline build tool to generate IPA for words missing from Wiktionary is probably fine. GPL governs the program, and the output is arguably not a derivative. Linking or bundling eSpeak NG inside the app would trigger GPL-3 obligations, so it should be avoided. This is a legal judgement, not verified.
- **Where spelling-only rhyme fails** (from German phonology, illustrated by the Wiktionary data above):
  - Vowel length is often unmarked in spelling. The "-iːbə" page itself lists two spellings, and its similar rhyme "ɪbə" differs only in vowel length.
  - Final devoicing makes different spellings rhyme (Rad/Rat, -ig = [ɪç]).
  - Loanwords carry final stress.
  - Compounds take the rhyme from the last main-stressed element.
  - RhymeBrain's "Liebe → inklusive/operative" shows a spelling/phoneme-similarity engine blurring b/v.
  - So spelling-only rhyme (the Spanish approach) would give noticeably worse German results. Use it only as a last-resort fallback for words with no IPA, ideally after an ending-to-IPA rule table derived from Wiktionary's `Schreibungen=` fields.
- **RhymeBrain** is viable only as a cached, Worker-proxied fallback. 350 requests/hour is far too low for live per-user traffic, and its commercial status is unclear, so ask the operator before shipping.

### Gaps
- I did not measure what fraction of German lemmas carry a `Reim` line or IPA. The category count (47,100 rhyme pages) covers rhyme classes, not words. Measuring it needs a dump pass.
- Echtreim, d-reim.de and reimlexikon-online.de were unreachable, so their terms are unknown. I found no German rhyme API with published commercial terms.
- The CELEX price and commercial terms are unpublished; ask LDC.
- BAS (Munich) G2P web services were not researched.
- I did not verify the MaryTTS lexicon's size or coverage.

## 2. Thesaurus and meaning modes (synonyms, antonyms, broader/narrower terms, related words, describing words)

### Takeaway
OpenThesaurus is the backbone. It is free, live, and offered under CC BY-SA 4.0 or LGPL 2.1, with a 6.4 MB MySQL dump and a 1.6 MB text dump updated daily. Its JSON API gives synonyms plus broader terms (Oberbegriffe → "kinds of" inverse) and narrower terms (Unterbegriffe → "kinds of"), but not antonyms or associations, which appear only on its website. That data is probably in the dump (unverified). OdeNet (CC BY-SA, active) adds WordNet-style relations. Leipzig co-occurrences (CC BY 4.0 API) are a good source for "related/triggered" words and "describing words". GermaNet is the gold-standard wordnet, but its commercial license is negotiated and unpriced. DWDS and Duden do not offer usable thesaurus APIs.

### Cited Findings
**OpenThesaurus.de**
- Live-tested JSON: `https://www.openthesaurus.de/synonyme/search?q=Liebe&format=application/json&supersynsets=true&subsynsets=true&baseform=true&similar=true&substring=true`
  - Returned HTTP 200 with `access-control-allow-origin: *` (callable directly from the app).
  - metaData reads `"license":"Creative Commons Attribution-ShareAlike 4.0 or GNU LESSER GENERAL PUBLIC LICENSE Version 2.1"`, plus a warning to contact feedback@openthesaurus.de before serious use.
  - Synsets returned: {Hingabe, Leidenschaft, Liebe} and {Bindung (zu jemandem), Liebe, völlige Zuwendung}.
  - Other fields: `similarterms` (lieb, lieben, lieber, Liebes, Liege, with Levenshtein distance), `substringterms`, `baseforms` ["lieb","lieben"].
  - Source: live call.
- Live-tested `q=Baum` with super/subsynsets: supersynsets [Pflanze, Gewächs], [Gehölz, Holzgewächs…]; subsynsets [Nadelbaum, Konifere], [Laubbaum…], [Großbaum…] etc. Terms carry `level` (umgangssprachlich, fachsprachlich) and `categories` (Botanik). This covers "kinds of" (hyponyms) and its inverse — live call to https://www.openthesaurus.de/synonyme/search?q=Baum&format=application/json&supersynsets=true&subsynsets=true
- The JSON synsets contain only the keys {terms, subsynsets, id, categories, supersynsets}; no antonym or association field exists even with `mode=all` — live call with q=gut. The HTML pages, however, do show antonyms inline (hell → "dunkel", gut → "schlecht", angenehm → "bedauerlich"), "Assoziationen" lists (e.g. "Gesindehaus · Häuslingshaus" for the Gut/Gutshof sense), and Wiktionary definitions (with "Quelle & Lizenz… Creative Commons Attribution-ShareAlike") — live fetch of https://www.openthesaurus.de/synonyme/gut and /hell
- API terms:
  - Free, but requests from one IP above 60 per minute get an error.
  - Use the database download instead of bulk API queries.
  - Must link to www.openthesaurus.de without nofollow; background-only use needs only an imprint notice.
  - The User-Agent must contain a contact (homepage or email).
  - Contact feedback@openthesaurus.de before long-term use.
  - Parameters: `similar`, `substring`/`substringFromResults`/`substringMaxResults` (max 250), `startswith`, `supersynsets`, `subsynsets`, `baseform` (JSON only).
  - Source: [OpenThesaurus API](https://www.openthesaurus.de/about/api)
- Downloads (all dated 2026-10-23, so actively updated): LibreOffice .oxt 14.38 MB, a zipped text format 1.61 MB, and a MySQL dump 6.41 MB. License: "Creative Commons Attribution-ShareAlike 4.0 oder GNU Lesser General Public License" (the user may choose). Conditions: redistributed data must be clearly marked LGPL for the user, and openthesaurus.de must be linked as the source — [OpenThesaurus download](https://www.openthesaurus.de/about/download)

**OdeNet (Open German WordNet)**
- License CC BY-SA 4.0, last push 2026-01-07, not archived — [GitHub hdaSprachtechnologie/odenet](https://github.com/hdaSprachtechnologie/odenet) (license via the GitHub API)
- Built automatically from OpenThesaurus plus Princeton WordNet (ILI links), then partly corrected by hand. Hypernyms were added through compound analysis. Basic vocabulary is tagged `dc:type="Basiswortschatz"`. Per the README, "The current version is automatically compiled. We have started to check synsets manually" — [OdeNet README](https://github.com/hdaSprachtechnologie/odenet)
- It is included in the Open Multilingual Wordnet under cc-by-sa-4.0 — [search summary citing OMW / pub.dev odenet_wordnet_de](https://pub-web-s2.flutter-io.cn/packages/odenet_wordnet_de)

**GermaNet (Tübingen)**
- Academic license is free. A Research & Development license (internal research only) and a commercial license (right to distribute derived products) exist, but the commercial terms say only "contact us"; no public fee — [GermaNet licenses](https://www.sfs.uni-tuebingen.de/GermaNet/licenses.shtml); [License Agreements](https://uni-tuebingen.de/en/142828); [commercial template PDF](https://nats-www.informatik.uni-hamburg.de/pub/CDG/GermaNet/liz_comm.pdf)
- Contact: germanetinfo@uni-tuebingen.de — [GermaNet flyer](https://hinrichs.sfs.uni-tuebingen.de/files/GermaNet/illustrations/GermaNetFlyer.pdf)
- The OdeNet authors say GermaNet "is not under an open-source license and is therefore not broadly used in language technology applications" — [OdeNet paper, GWC 2019](https://aclweb.org/anthology/2019.gwc-1.34.pdf)

**Wortschatz Leipzig / Leipzig Corpora Collection (LCC) REST API**
- Live: the OpenAPI spec at `https://api.wortschatz-leipzig.de/ws/v3/api-docs` declares `license: CC BY 4.0` and `termsOfService: https://wortschatz-leipzig.de/usage`, and says "All services require the selection of a corpus" — live call
- Endpoints listed in the spec:
  - `/cooccurrences/{corpus}/cooccurrences|leftcooccurrences|rightcooccurrences|cooccurrencesgraph/{word}`
  - `/similarity/{corpus}/coocsim/{word}`
  - `/words/{corpus}/word|wordlist|wordrelations|wordattributes|subwords|similarwordslevenshtein|prefixword|likewords|randomword`
  - `/sentences/...`, `/corpora`
  - Source: live call
- Older v1-style paths (`getSimilarWords`, `getCooccurrences`) now return 404, so old tutorials are stale — live calls.
- Only 8 German corpora are exposed through the API, all 2008–2012 news/Wikipedia (largest `deu_news_2012_3M`: 3,000,000 sentences, 50.7M tokens, 1.5M types) — live call to /ws/corpora
- Live-tested `cooccurrences/deu_news_2012_3M/cooccurrences/Liebe`: "große Liebe" (sig 1124.8), "Detail", "Liebe auf den ersten Blick", "und", "große", "Lebens"… `leftcooccurrences` gave "große", "die", "der", "ihre", "seine". Results are useful for "describing words", but stopwords must be filtered. `coocsim` returned 404 for this corpus (it is probably available only on corpora with that annotation; that corpus advertises only `wordsLevenshteinSim`) — live calls
- Terms (usage page, from the search summary; the page sits behind an Anubis bot wall I could not pass):
  - Corpora offered for download are CC BY.
  - Everything else is "free of charge for private and scientific use under… CC BY-NC", with "automated queries (except via our web services) and commercial use of the data without written consent" prohibited.
  - Users are asked to cite Goldhahn, Eckart & Quasthoff (LREC 2012).
  - Source: [Wortschatz Leipzig Terms of Usage](https://wortschatz.uni-leipzig.de/en/usage) via search snippet; [Danish gov catalogue mirror of the terms](https://sprogressource.digst.govcloud.dk/dataset/leipzig-corpora-collection)
- The API spec (CC BY 4.0) and the usage page (CC BY-NC for non-download data) are in tension. Treat API-served co-occurrence data for commercial use as unclear without written consent.

**DWDS**
- Its documented API has no thesaurus or synonym endpoint. Endpoints: frequency, wb/snippet, Goethe word lists, random, ipa, feeds, glossaries, headword downloads. "For legal reasons many dictionary data cannot be opened via an API" — [DWDS API](https://www.dwds.de/d/api)
- Live: `/api/thesaurus`, `/api/synonyme`, `/api/wortprofil`, `/api/wp`, `/api/lemma` all return 404. `/r/?…format=json` (corpus search) returns 403 — live calls. Responses carry `tdm-reservation: 1` and a TDM policy requiring `obtainConsent` for mining — live call to https://www.dwds.de/dwds_static/tdm-policy.json
- Terms: automated queries and text/data mining "ist nur mit ausdrücklicher Genehmigung gestattet". BBAW reserves rights under § 44b UrhG. Results need a source citation, and quotations must stay within normal citation scope — [DWDS Nutzungsbedingungen](https://www.dwds.de/d/nutzungsbedingungen)

**Duden API**
- Covers spelling, grammar and punctuation checks plus synonym suggestions; the page mentions no definitions — [Duden API](https://www.duden.de/api)
- Prices:
  - Pro 100: 100 requests/day, €39.95/month
  - Pro 500: €99.95/month
  - Pro 1000: €174.95/month
  - Higher volume via kundenservice@duden.de
  - Requests are up to 20,000 characters. Source: [Duden API](https://www.duden.de/api)
- A search snippet also listed a free tier of 20 requests/day that the fetched page did not show. This is an unresolved conflict — [search result for duden.de/api](https://www.duden.de/api)
- The product is aimed at text-checking ("API für Mentor"), not lookup at word-tool scale. Per-day caps make it unsuitable for a free tier — inference from [Duden API](https://www.duden.de/api)

**Woxikon**
- The site is up (HTTP 200). No public API or license terms were found — live check of https://www.woxikon.de/

### Inferences
- Mode mapping for German:
  - **Synonyms:** OpenThesaurus synsets.
  - **Similar meaning:** OpenThesaurus synsets + sibling terms (other subsynsets of the same supersynset) + OdeNet.
  - **Kinds of (hyponyms):** OpenThesaurus `subsynsets`; OdeNet hyponyms.
  - **Broader terms (inverse):** `supersynsets`.
  - **Opposites:** OpenThesaurus antonyms from the dump (the website shows them; the API does not), possibly OdeNet antonyms, Wiktionary "Gegenwörter" sections.
  - **Related/triggered:** OpenThesaurus "Assoziationen" (dump) + Leipzig co-occurrences.
  - **Describing words:** Leipzig left-cooccurrences filtered to adjectives (needs a POS list such as Wiktionary's).
  - **Parts of (meronyms):** OdeNet if present; otherwise weak (gap). Wiktionary has "Teilbegriffe"/"Holonyme" sections, so check a Wiktextract dump.
- Best architecture: bundle or Worker-host the OpenThesaurus MySQL dump (6.4 MB raw, smaller once converted to SQLite or JSON). The 60 requests/minute per-IP limit plus the "contact before long-term use" request make live API calls from a shared Worker IP a bad fit. Calling directly from each phone (CORS is open, so each device has its own IP) is possible, but the dump is more robust and works offline.
- Licensing: choosing LGPL for OpenThesaurus data means marking the redistributed thesaurus data as LGPL and linking openthesaurus.de. Choosing CC BY-SA is equivalent in practice for a separate data file. Either is compatible with a commercial closed app as long as the data file stays separable and attributed — inference; not legal advice.
- An LLM Worker (as used for Hebrew) remains the fallback for modes that open data covers poorly (parts-of, describing words), at per-call cost.

### Gaps
- I did not inspect the OpenThesaurus MySQL dump schema, so whether antonym (Gegenteil) and Assoziation relations are in it is unconfirmed (they are shown on the site). Downloading it would settle this.
- I did not measure the size or relation counts of OdeNet's antonym and meronym data.
- No GermaNet commercial price is published.
- I could not read Leipzig's usage page directly (Anubis wall); its terms come from a search snippet.
- The Duden free-tier conflict is unresolved.

## 3. Definitions ("hold a word to see its definition")

### Takeaway
German Wiktionary is the only open, commercially usable source of German-language definitions. Use the MediaWiki Action API live (parse wikitext; the Wikimedia REST `definition` endpoint does not work for de.wiktionary) or pre-extract definitions from the kaikki/Wiktextract dump into a bundled or Worker-hosted table. DWDS has rich definitions but forbids automated reuse without permission. Duden's API does not serve definitions.

### Cited Findings
- Live-tested: `https://de.wiktionary.org/api/rest_v1/page/definition/Liebe` → `{"status":501,"type":"Internal error"}`, so the REST definition endpoint is not implemented for the German edition — live call
- Live-tested: the MediaWiki Action API (`action=parse&prop=wikitext&section=1`) on "Liebe" returned the Bedeutungen block (":[1] {{K|kein Plural}} [[innig]]es [[Gefühl]] der [[Zuneigung]]…" through [8]) plus IPA, hyphenation, rhyme and inflection table. The wikitext must be parsed (strip templates and links) — live call to https://de.wiktionary.org/w/api.php?action=parse&page=Liebe&prop=wikitext&format=json&section=1
- OpenThesaurus already displays Wiktionary definitions on its pages, licensed "Creative Commons Attribution-ShareAlike", with source and author links — live fetch of https://www.openthesaurus.de/synonyme/hell
- kaikki.org: German-edition Wiktextract raw JSONL, 2.9 GB (295.8 MB gz), dump 2026-10-01 — [kaikki dewiktionary](https://kaikki.org/dewiktionary/rawdata.html)
- DWDS `wb/snippet` only confirms that an entry exists and gives its part of speech and URL. Live: `[{"input":"Liebe","wortart":"Substantiv","lemma":"Liebe","url":"https://www.dwds.de/wb/Liebe"}]` — [DWDS API](https://www.dwds.de/d/api) + live call. A deep link to the DWDS page is permissible; copying definitions is not without consent — [DWDS Nutzungsbedingungen](https://www.dwds.de/d/nutzungsbedingungen)
- Duden API: spelling, grammar and synonyms only; no definitions on the product page — [Duden API](https://www.duden.de/api)

### Inferences
- Simplest path: a Worker that calls the de.wiktionary Action API (with a proper User-Agent per Wikimedia policy), extracts the Bedeutungen lines, caches them in KV, and returns 1–3 senses with a "Wiktionary, CC BY-SA" credit. Alternative: pre-extract glosses for the roughly 50k most frequent lemmas from the kaikki dump into a bundled file of a few MB.
- Option for the definition sheet: a "more at DWDS" deep link (a link, not copied content) is consistent with DWDS terms.

### Gaps
- I did not fetch the Wikimedia API etiquette or rate-limit page in this session; standard practice is a descriptive User-Agent and serial requests.
- I did not measure how many German lemmas have Bedeutungen in the kaikki dump.

## 4. Frequency lists for ranking

### Takeaway
For a commercial app the clear choices are FrequencyWords German (OpenSubtitles 2018; CC BY-SA 4.0 content, de_50k is 662 KB, conversational register, good for lyrics) and Leipzig downloadable corpora (CC BY; news/web register). The DWDS frequency API works but falls under DWDS's no-automation terms. SUBTLEX-DE is non-commercial (CC BY-NC-ND per a mirror) and excluded.

### Cited Findings
- FrequencyWords (hermitdave): MIT for code, "CC-by-sa-4.0 for content". Last push 2022-02-07 (static, unmaintained but complete) — [FrequencyWords README](https://github.com/hermitdave/FrequencyWords) (license via the GitHub API and README)
- Live: `content/2018/de/de_50k.txt` is 662,497 bytes. Top entries: ich 5,890,279; sie 3,806,767; das 3,122,198; ist 3,025,610; du 2,947,020. Entries are lowercased surface forms (German noun capitalisation is lost) — live call to https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt
- SUBTLEX-DE: 25.4M words from the subtitles of 4,610 films and series. The original paper says "free for educational purposes". An OSF mirror states CC BY-NC-ND 3.0; the official download is crr.ugent.be/archives/534 — [OSF wiki](https://osf.io/479um/wiki); [De Gruyter 2025](https://www.degruyterbrill.com/document/doi/10.1515/ling-2024-0143/html)
- Leipzig: downloaded corpora are CC BY per the usage terms (see section 2). The API also serves ranked word lists: live `words/deu_news_2012_3M/wordlist/?limit=5` → der 1,440,937; die 1,337,694; und 952,224… and `words/deu_news_2012_1M/word/Liebe` → `{"freq":813,"wordRank":1979,"frequencyClass":9}` — live calls; [Wortschatz Leipzig usage](https://wortschatz.uni-leipzig.de/en/usage)
- DWDS frequency API: live `api/frequency/?q=Liebe` → `{"hits":7218696,"total":"53410842716","lemma":"Liebe","frequency":4}`. It is lemmatised, on a 0–6 log scale, over a corpus of about 53 billion tokens — [DWDS API](https://www.dwds.de/d/api) + live call. Bulk use needs DWDS permission — [DWDS Nutzungsbedingungen](https://www.dwds.de/d/nutzungsbedingungen)
- CELEX frequencies were the weakest predictor of lexical decision times in the SUBTLEX-DE study, while subtitle frequencies did best — [search summary of Brysbaert et al. 2011](https://osf.io/479um/wiki)

### Inferences
- Use FrequencyWords de_50k (or the full list, trimmed) to rank rhyme and thesaurus results and to filter Wiktionary's long tail of rare inflected forms. Because it is lowercased, recover capitalisation (nouns) from Wiktionary or OpenThesaurus forms. The CC BY-SA obligation applies to the shipped list. Subtitles are close to lyric register, which is a good fit for a songwriting app.
- Leipzig CC BY corpora are an alternative if share-alike must be avoided (attribution only). The 2008–2012 news register is less lyric-like.

### Gaps
- I could not list the full Leipzig German download catalogue (newer, larger corpora) or their exact per-file license text because of the Anubis wall.
- I did not confirm SUBTLEX-DE's license on the official CRR page.

## 5. Commercial-use summary per source (license, attribution, share-alike, proxy need)

### Takeaway
Safe for a commercial app with attribution: OpenThesaurus (CC BY-SA/LGPL), German Wiktionary/Wiktextract (CC BY-SA), OdeNet (CC BY-SA), FrequencyWords (CC BY-SA), Leipzig downloads (CC BY). Needs permission or a contract: DWDS (any automated use), GermaNet (commercial license), CELEX (LDC agreement), Leipzig API data beyond downloads (written consent for commercial use), Duden (paid, per-day caps, no definitions). Unclear: RhymeBrain (free, attribution in About, 350/hour, commercial use not addressed).

### Cited Findings
| Source | Modes | Access (live?) | License / commercial | Attribution / SA | Limits & cost | Worker proxy? |
|---|---|---|---|---|---|---|
| OpenThesaurus | synonyms, broader/narrower terms, (antonyms and associations in dump/web), similar spelling | JSON API live 2026-10-25; dumps updated 2026-10-23 | CC BY-SA 4.0 or LGPL 2.1, free — [download](https://www.openthesaurus.de/about/download) | link openthesaurus.de (no nofollow); mark data LGPL; contact UA — [API](https://www.openthesaurus.de/about/api) | 60 req/min/IP; use dump for bulk — [API](https://www.openthesaurus.de/about/api) | Bundle the dump; no proxy needed (CORS `*`) |
| de.wiktionary / kaikki Wiktextract | rhymes (Reim classes + similar rhymes), IPA, definitions, antonyms (Gegenwörter) | Action API live; REST definition returns 501; dump 2026-10-01 | CC BY-SA (Wikimedia) | credit Wiktionary; SA on derived data — [Hilfe:Reime](https://de.wiktionary.org/wiki/Hilfe:Reime), [kaikki](https://kaikki.org/dewiktionary/rawdata.html) | free; 2.9 GB raw to preprocess | Optional Worker cache for definitions |
| OdeNet | hypernyms, hyponyms, maybe antonyms and meronyms | GitHub, active 2026-01 | CC BY-SA 4.0 — [GitHub](https://github.com/hdaSprachtechnologie/odenet) | attribution + SA | free | Bundle |
| GermaNet | full wordnet (hyponyms, meronyms, antonyms) | licensed download | commercial = negotiated, fee unpublished — [licenses](https://www.sfs.uni-tuebingen.de/GermaNet/licenses.shtml) | per contract | unknown cost | n/a |
| Leipzig LCC API | co-occurrences (related, describing), frequency, Levenshtein-similar | REST v3 live; old paths 404 | API spec says CC BY 4.0; usage page says non-download data CC BY-NC, commercial use needs written consent — [usage](https://wortschatz.uni-leipzig.de/en/usage) | cite LREC 2012 paper | no documented rate limit found | Precompute from CC BY downloads instead |
| DWDS | IPA, frequency, existence/POS, links | frequency/ipa/snippet live; no thesaurus endpoint | automated querying/TDM only with explicit permission — [terms](https://www.dwds.de/d/nutzungsbedingungen) | source citation | free but permission needed | Only with permission |
| Duden API | synonyms (in a spell-check product) | paid key | commercial product | n/a | €39.95–174.95/month for 100–1000 req/day — [Duden API](https://www.duden.de/api) | Would need a Worker to hide the key |
| RhymeBrain | rhymes, near rhymes (de) | live, `lang=de` works | commercial use not addressed — [API](https://rhymebrain.com/api.html) | About-screen credit | 350 req/hour | Worker + heavy cache |
| Datamuse | none for German | `v=de` ignored (live) | — | — | — | — |
| FrequencyWords de | ranking | GitHub static (2022) | CC BY-SA 4.0 content — [README](https://github.com/hermitdave/FrequencyWords) | attribution + SA | 662 KB (50k) | Bundle |
| SUBTLEX-DE | ranking | download | free for education; CC BY-NC-ND 3.0 per mirror — [OSF](https://osf.io/479um/wiki) | — | — | Excluded (non-commercial) |
| CELEX German | pronunciation, morphology | LDC LDC96L14 | proprietary "CELEX Agreement" — [LDC](https://catalog.ldc.upenn.edu/LDC96L14) | — | unpublished fee | n/a |
| eSpeak NG | G2P fallback | GitHub active 2026-09 | GPL-3.0 — [GitHub](https://github.com/espeak-ng/espeak-ng) | — | free | Build-time only |
| MaryTTS lexicon-de | pronunciation lexicon | GitHub, last push 2024-02 | LGPL-3.0 — [GitHub](https://github.com/marytts/marytts-lexicon-de) | LGPL notice | free | Build-time / bundle |

### Inferences
- A zero-marginal-cost German stack is feasible with no live third-party dependency at runtime:
  1. Wiktextract → rhyme classes, IPA and definitions.
  2. OpenThesaurus dump (+ OdeNet) → synonyms, kinds-of, opposites, associations.
  3. FrequencyWords → ranking.
  4. Leipzig CC BY download corpora → co-occurrence for "related/describing" (would need computing ourselves, or written consent to use API-served co-occurrence data).
  5. Optional: the existing LLM Worker for parts-of and describing words where data is thin.
- Every chosen open dataset is share-alike (except Leipzig CC BY and MIT code). The app needs a Credits/Licenses screen listing OpenThesaurus (link required), Wiktionary, OdeNet, FrequencyWords/OpenSubtitles and RhymeBrain (if used), and the bundled data files must be redistributable under CC BY-SA/LGPL. App code remains proprietary as long as the data files are separate — inference; not legal advice.
- Contact emails worth sending before launch:
  - feedback@openthesaurus.de (requested before "ernsthafter Nutzung")
  - DWDS contact form (only if IPA or frequency via API is wanted)
  - RhymeBrain (commercial clarification)
  - Leipzig (written consent if using the API commercially)

### Gaps
- No source here is legal advice. Whether LGPL/CC BY-SA data bundled inside a closed-source mobile app satisfies "clearly recognisable for the user as LGPL" should be confirmed. A visible licenses screen plus a downloadable data file is the likely answer.
- I did not verify Wikimedia's API rate limits or User-Agent policy text in this session.
