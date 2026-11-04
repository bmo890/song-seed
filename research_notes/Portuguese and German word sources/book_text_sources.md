# Public-domain book text sources for Portuguese and German "Borrowed Words" passages

Research date: 2026-10-25. Endpoints were queried live from macOS with curl where noted ("tested"). Legal readings are a non-lawyer's reading of published terms, not legal advice.

## Q1. Gutendex / Project Gutenberg: how many Portuguese and German books, in what shape, and how to fetch a random passage?

### Takeaway
Gutendex currently returns **656 Portuguese** and **2,479 German** books (vs 922 Spanish), and the same Range-fetch method used for English and Spanish works unchanged for both: every sampled record has a UTF-8 `text/plain` file served with `accept-ranges: bytes`. Portuguese is heavily weighted to Portugal (Camilo Castelo Branco alone has 52 titles), and most Portuguese texts use pre-1911/1943 spelling. German is large and mostly literature, but about 10% of the German titles carry authors or translators who died in 1956 or later. Those are public domain in the US but **not in Germany, Austria or Portugal** (life+70).

### Cited Findings
- `https://gutendex.com/books/?languages=pt` returned `count: 656`. `?languages=de` returned `count: 2479`. (Tested 2026-10-25.) The first `pt` request timed out with no response and succeeded on retry. — [Gutendex pt](https://gutendex.com/books/?languages=pt), [Gutendex de](https://gutendex.com/books/?languages=de)
- Top `pt` results by downloads: Biblia Sagrada (62383), Figueiredo's *Novo dicionário* (31552), *Dom Casmurro* (55752), *Amor Crioulo* (24919), *Os Lusíadas* (3333), *Memorias Posthumas de Braz Cubas* (54829). Each has both `text/plain; charset=utf-8` and `text/plain; charset=us-ascii`, and each has `copyright: false`. The `de` results lead with recent 2026 additions (78079 *Allgemeine Physiologie*, 78125 Polenz *Liebe ist ewig*, 78030 …), all with `text/plain; charset=utf-8`. — [Gutendex pt](https://gutendex.com/books/?languages=pt), [Gutendex de](https://gutendex.com/books/?languages=de)
- **Full crawl of `text/plain` coverage** (tested 2026-10-25):
  - **pt:** all 656 of 656 have a `text/plain` format, and none is marked `copyright: true`. Gutendex was very slow: 21 pages took 629 s (about 30 s per page), with 2 failed requests retried.
  - **de:** the crawl stopped after 384 books (12 pages) because Gutendex began failing repeatedly. A later probe of `?languages=de&page=13` returned **HTTP 500** in 0.28 s. In that sample, 383 of 384 had `text/plain`; the one without was 3221, a business dictionary. One was marked `copyright: true`: 5740, Wittgenstein's *Tractatus*, which has a Russell introduction.
  - Source: [Gutendex pt](https://gutendex.com/books/?languages=pt), [Gutendex de p.13](https://gutendex.com/books/?languages=de&page=13)
- Gutenberg's own machine-readable catalog (`pg_catalog.csv`, 21 MB, 79,634 rows, downloaded 2026-10-25) agrees: **pt 656** (652 monolingual, all of type Text) and **de 2,478** (2,439 monolingual, 2,453 of type Text). For comparison: es 922, en 63,232. — [PG catalog CSV](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv)
- Literary share, from the same CSV, by LoCC class: pt has PQ (Romance literatures) on 390 of 656. de has PT (German literature) on 1,184 of 2,453, plus PZ 64, PG 69, PQ 45 and PR 44 (translations). Non-literary pt classes include DP (Portuguese history) 76. Non-literary de classes include DD (German history) 97, B (philosophy) 45 and BF 42. — [PG catalog CSV](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv)
- Top pt authors: Castelo Branco 52, Alberto Pimentel 24, Antero de Quental 16, Herculano 14, Eça de Queirós 13 (+11 as editor), Jaime de Magalhães Lima 12, **Machado de Assis 12**, Almeida Garrett 9, Bocage 8, Almada Negreiros 8. That makes the collection predominantly European Portuguese, 19th century. — [PG catalog CSV](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv)
- Top de authors: Goethe 46, Gerstäcker 44, Landesverein Sächsischer Heimatschutz 34, Freud 24, Shakespeare (in translation) 23, **Hesse 21**, Wassermann 20, Dostoevsky (in translation) 19, Storm 18, Lessing 18, Edschmid 18, Hauff 16, Grillparzer 16, Schiller 15. In 2025 or later, 235 German titles were issued, against 12 Portuguese. — [PG catalog CSV](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv)
- Death-date screen of CSV author and translator strings against life+70 (an author must have died in 1955 or earlier to be public domain in the EU or Brazil in 2026). Editors are excluded:
  - **pt:** 535 clearly public domain, **16** with an author or translator who died in 1956 or later (Almada Negreiros, d. 1970; Mário Beirão, d. 1965; António Botto, d. 1959), 105 with no dates.
  - **de:** 1,985 clearly public domain, **256** later (e.g. Hesse, d. 1962; Oskar Maria Graf, d. 1967; Shaw plays translated by Siegfried Trebitsch), 212 with no dates.
  - **es, for reference:** 713 / 67 / 134.
  - Source: [PG catalog CSV](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv)
- The statutory terms behind that screen: German copyright "erlischt siebzig Jahre nach dem Tode des Urhebers" — [§ 64 UrhG](https://www.gesetze-im-internet.de/urhg/__64.html). Brazilian economic rights "perduram por setenta anos contados de 1° de janeiro do ano subseqüente ao de seu falecimento" — [Lei 9.610/98 art. 41](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm)
- Range fetch, tested on both languages: `https://www.gutenberg.org/ebooks/55752.txt.utf-8` → 302 → `/cache/epub/55752/pg55752.txt`, `content-type: text/plain; charset=utf-8`, `accept-ranges: bytes`, `content-length: 418230`. `curl -r 120000-121200` returned the matching window. German 78125: same pattern, 603,092 bytes. — [PG 55752](https://www.gutenberg.org/ebooks/55752.txt.utf-8), [PG 78125](https://www.gutenberg.org/ebooks/78125.txt.utf-8)
- Spelling in the raw text, tested:
  - *Dom Casmurro* (1899 edition): "naquella", "minimas", "promptamente", "saude", "tambem", "Papae". This is pre-1911 Portuguese spelling.
  - Polenz (1900s): "daß", "er that zunächst nichts". This is pre-1901/1996 German spelling.
  - Source: [PG 55752](https://www.gutenberg.org/ebooks/55752.txt.utf-8), [PG 78125](https://www.gutenberg.org/ebooks/78125.txt.utf-8)
- Project Gutenberg robot policy: the site is "intended for human users only". Perceived automated use can bring a temporary or permanent IP block. For bulk use it recommends mirrors, the robot harvest endpoint with a wait between requests, or the public-domain machine-readable catalog. — [PG robot access policy](https://www.gutenberg.org/policy/robot_access.html)
- Germany: in February 2018 a Frankfurt court ruled for S. Fischer Verlag over 18 works by Thomas Mann, Heinrich Mann and Döblin. On 28 Feb 2018 PGLAF blocked all of gutenberg.org for German IP addresses. — [Techdirt 2018](https://archive.techdirt.com/articles/20180306/03423339363/project-gutenberg-blocks-access-germany-to-all-public-domain-books-because-local-copyright-claim-18-them.shtml), [Teleread 2018](https://teleread.org/2018/03/03/project-gutenberg-blocks-german-users-after-court-rules-in-favor-of-holtzbrinck-subsidiary/). I found no source confirming that the block was later lifted (see Gaps).

### Inferences
- **Same code path works for both languages.** The existing English/Spanish code (`gutendex.com/books?languages=XX&page=N`, then a Range window of the `.txt.utf-8` file) works unchanged for `pt` and `de`. Only the language code changes.
- **German is a big enough random pool. Portuguese is borderline.** 2,479 de books is bigger than Spanish. 656 pt books is smaller than Spanish, and only about 390 of them are literature.
- **Portuguese will feel European and archaic.** A Brazilian writer will mostly get 19th-century Portugal: Camilo, Herculano, Eça. The Brazilian titles (Machado and a handful of others) are a small minority. Most texts use pre-1911 Portuguese or pre-1943 Brazilian spelling ("ella", "somno", "pharmacia"). For a word-collecting exercise, old spellings may be charming or confusing; consider a light normaliser or curated picks.
- **Filter German titles for the EU audience.** Gutenberg applies the US public-domain rule, so titles like Hesse's *Siddhartha* are served but are still under copyright in Germany and Austria until 2033. For a commercial app showing excerpts to users in the EU, the de and pt pools should be filtered by author and translator death year ≤ (current year − 71), using the catalog CSV dates. Titles with no dates should be dropped or reviewed. This removes roughly 10–19% of German titles and about 3–19% of Portuguese ones, depending on how the undated titles are treated.
- **Build the index yourself rather than leaning on Gutendex.** Gutendex is a single volunteer-run instance. During testing it timed out, took about 30 s per page, and returned HTTP 500 under a light sequential crawl. A Worker can rebuild its own pt/de index daily from `pg_catalog.csv`, which includes the LoCC literature filter and the death-year filter. It can then pick random IDs locally, so the app no longer needs Gutendex at runtime.
- **The German block may bite through the Worker too (unverified).** If PG's German geoblock still exists, direct fetches from phones in Germany would fail. Cloudflare Workers usually send their outbound requests from a data centre near the user, so routing through the Worker may not get around it either. Caching passage windows in R2/KV, or using a PG mirror, could. This needs testing from a German IP.

### Gaps
- Whether gutenberg.org still blocks German IP addresses in 2026. I found only 2018 reporting and no confirmation of a lift. This needs testing from a German VPN or the Cloudflare colo.
- The Brazil vs Portugal split of the pt pool was not computed exactly. Only the top authors were checked.

## Q2. Wikisource (pt and de): size, API access to random works, licensing, rate limits, cleanliness

### Takeaway
German Wikisource is large (656,614 main-namespace pages, 253M words) and carefully proofread, with useful genre categories (9,970 poems, 1,936 fairy tales, 3,630 legends, 631 stories, 215 novellas, 154 novels). Portuguese Wikisource is much smaller (39,540 content pages; 735 Brazilian short-story entries, 184 Brazilian novel entries) and noisier.

On both wikis, plain `list=random` mostly returns reference or legal pages (German: lexicon entries from Meyers 1888 and Pauly's RE; Portuguese: laws and anthems). Random selection must therefore go through literary categories. The `prop=extracts` plain-text API returns **empty** for proofread, transcluded works. Use `action=parse` and strip the `ws-noexport` header to get clean text.

The texts are public domain. The site's CC BY-SA 4.0 covers contributions, and both communities state that a faithful transcription creates no new copyright. The new Wikimedia rate limits allow 200 requests/min for a client with a compliant User-Agent, so a shared Worker needs a cache.

### Cited Findings
- **Size** (`meta=siteinfo&siprop=statistics`, tested):
  - pt.wikisource: 170,298 pages, 39,540 articles (content pages), 33.7M search-index words, 56 active users, 2 admins.
  - de.wikisource: 715,616 pages, 656,614 articles, 253.3M words, 117 active users, 16 admins.
  - Source: [pt API](https://pt.wikisource.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json), [de API](https://de.wikisource.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json)
- **Random sampling, tested:**
  - `list=random&rnnamespace=0` on de returned mostly encyclopedia entries: `MKL1888:Sahlīt`, `RE:Tuscus Vicus 2`, `RE:Procula 7`, `MKL1888:Seeauswurf`, `Boetticher:…`, `BLKÖ:Koberwein, Friedrich`, and one literary title.
  - On pt it returned: `Turbilhão/IX`, `Cantigas de Santa Maria/CCXXV`, `Hino do município de Bezerros`, `Coleção das leis do Brasil/1889`, `As Doutoras/II/XVII`, `Fantina/X`, and a Bible chapter.
  - Source: [de random](https://de.wikisource.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=8&format=json), [pt random](https://pt.wikisource.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=8&format=json)
- **German category sizes** (`prop=categoryinfo`, tested): Gedicht 9,970; Sage 3,630; Märchen 1,936; Erzählung 631; Novelle 215; Roman 154; Drama 86. Proofreading-status categories: Fertig 416,895; Korrigiert 133,916; Unkorrigiert 19,964. — [de.wikisource API](https://de.wikisource.org/w/api.php)
- **Portuguese category sizes**, tested: the top-level Romances, Contos and Poesia categories are almost empty and act as containers. The real content is in national subcategories:
  - Contos brasileiros: 735 (622 pages + 113 subcategories)
  - Contos portugueses: 152
  - Romances brasileiros: 184 (91 pages + 93 subcategories, typically one per multi-chapter novel)
  - Romances portugueses: 40
  - Crônicas brasileiras: 35
  - Several guessed category names do not exist, e.g. "Poemas brasileiros", "Sonetos".
  - Source: [pt.wikisource API](https://pt.wikisource.org/w/api.php)
- **License (site level):** `siprop=rightsinfo` reports "Creative Commons Attribution-Share Alike 4.0" on both wikis. — [pt](https://pt.wikisource.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json), [de](https://de.wikisource.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json)
- **License (de policy):** "Die Texte in Wikisource sind im allgemeinen gemeinfrei" and "Gemeinfreie Texte dürfen beliebig genutzt werden". Texts that are not public domain are explicitly marked. Editorial contributions are usually under CC BY-SA 2.0 DE. — [de.wikisource Lizenzbestimmungen](https://de.wikisource.org/wiki/Wikisource:Lizenzbestimmungen)
- **License (pt policy):** digitisation, OCR and transcription of public-domain works "não resulta em nova proteção de direitos autorais". — [pt.wikisource: Seu suor não gera direitos autorais](https://pt.wikisource.org/wiki/Wikisource:Seu_suor_n%C3%A3o_gera_direitos_autorais)
- **Plain text, tested:** `prop=extracts&explaintext=1` returned an extract of length 0 for both `Turbilhão/IX` (pt) and `’s ist Krieg!` (de), which are transcluded from the `Página:`/`Seite:` scan namespace. It did work for a plain wikitext page (a BLKÖ entry and a Bible chapter).
- **Parse API, tested:** `action=parse&prop=text` returned full HTML.
  - The metadata header ("Textdaten", "Bearbeitungsstand … Fertig! Dieser Text wurde zweimal anhand der Quelle Korrektur gelesen. Die Schreibweise folgt dem Originaltext") is wrapped in `class="… noprint ws-noexport"`. Page numbers appear as `[15]`.
  - After dropping `ws-noexport`/`noprint`/`pagenum` elements, the result is clean verse: Tucholsky, 154 words. The pt chapter came out at 2,554 words.
  - Source: [de parse](https://de.wikisource.org/w/api.php?action=parse&page=%E2%80%99s_ist_Krieg!&prop=text&formatversion=2&format=json), [pt parse](https://pt.wikisource.org/w/api.php?action=parse&page=Turbilh%C3%A3o/IX&prop=text&formatversion=2&format=json)
- **Text quality, tested:**
  - pt sample (Coelho Neto, *Turbilhão*, 1919 Porto edition) is in old spelling ("amollecido", "somno", "sommas", "ella", "idéa") and contains at least one OCR error ("cominentarios" for "commentarios").
  - de sample is marked "Fertig", meaning proofread twice against the scan.
  - Some pt pages are explicitly modernised versions, e.g. "João Ferreira de Almeida 1819 (ortografia atualizada)".
  - Source: same parse calls; [pt extract sample](https://pt.wikisource.org/w/api.php?action=query&prop=extracts&explaintext=1&generator=random&grnnamespace=0&format=json)
- **Wikimedia rate limits** (page last edited 15 Oct 2026; described as new and subject to change):
  - Unidentified client (IP only): 10 req/min.
  - Unauthenticated bot with a compliant User-Agent: 200 req/min.
  - Authenticated established editor: 2,000 req/min.
  - Over-limit requests get HTTP 429 with Retry-After; without that header, wait at least 5 s.
  - Source: [Wikimedia APIs/Rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits)
- **User-Agent policy** (updated 27 Mar 2026): format `<client>/<version> (<contact>) <library>/<version>`. Generic agents such as "curl" or "Python-urllib" are discouraged. A missing or generic UA can get HTTP 403. Browser JavaScript should use `Api-User-Agent`. — [WMF User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy); [Wikimedia APIs/Access policy](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy) (edited 24 Apr 2026: "The API requires an HTTP User-Agent header for all requests"; bulk data via dumps.wikimedia.org)

### Inferences
- **de.wikisource is the best German source for short, clean pieces.** Its poems, fairy tales and legends are mostly proofread twice and ideal "page-sized" passages. A Worker can cache category member lists (Gedicht + Märchen + Sage + Erzählung + Novelle ≈ 16,000 titles) in KV, pick a random title, call `action=parse`, strip `.ws-noexport, .noprint, .pagenum` with HTMLRewriter, cache the result, and return a window of about 300 words.
- **pt.wikisource is a secondary Portuguese source.** It is stronger for Brazilian contos than Gutenberg is, but needs recursive category walking (novels are subcategories of chapters) and tolerance for OCR slips.
- **Rate limits favour on-device calls but require a Worker cache at scale.** Each phone calling the API directly with a proper `Api-User-Agent` or app UA gets its own per-IP allowance. A single Worker identity is capped at about 200 req/min, so a Worker would need a KV/Cache-API cache of parsed passages if usage grows.
- **Licensing is low-risk for the underlying texts.** Excerpts of public-domain works need no attribution under copyright law. Attribution ("via Wikisource") is courteous, and it is cheap insurance in case a page includes CC BY-SA editorial material (headers and notes, which are stripped anyway).

### Gaps
- How many pt.wikisource poems exist in total. The poetry category tree is split by country and theme, and I did not walk it.
- How common OCR errors are on pt.wikisource: I saw one error in one sample, which is not a measured rate.

## Q3. Other German sources: Projekt Gutenberg-DE, Zeno.org, Deutsches Textarchiv (DTA), TextGrid, DWDS

### Takeaway
- **TextGrid Repository's "Digitale Bibliothek"** (the former Zeno.org literature collection) is the strongest German addition. It has about 93,675 work records, a public search API, and a tested endpoint that returns **plain text** per item. Its CC BY 3.0 DE license covers the edition layer, not the public-domain texts.
- **DTA** is high quality but small for fiction: 553 Belletristik texts in the core corpus, 774 with extensions. It covers 1600–1899 and is best taken as a bulk ZIP, because its per-text download sits behind a JavaScript cookie check. Its terms contradict themselves on non-commercial use, although they declare plain-text versions public domain.
- **Projekt Gutenberg-DE** is **private use only**: unusable.
- **Zeno.org** refused connections during testing.
- **DWDS** has no full-text passage API.

### Cited Findings
- **Projekt Gutenberg-DE** (projekt-gutenberg.org, operated by Cultural Assets GmbH):
  - Use is "ausschließlich zum privaten Gebrauch". "Vervielfältigung, Weitergabe, Veröffentlichung, Bearbeitung" beyond private use is not permitted.
  - Editorial preparation, structure and metadata are claimed by Cultural Assets GmbH.
  - The terms do not address automated access.
  - Source: [Projekt Gutenberg-DE Nutzungsbedingungen](https://projekt-gutenberg.org/nutzungsbedingungen/)
- **Zeno.org:**
  - Status: `https://www.zeno.org/` returned no response (curl 000) and WebFetch got `ECONNREFUSED 35.156.38.217:443` on 2026-10-25. The terms page URL tried returned 404 over http. (Tested.)
  - Background: Zeno.org is a full-text German library started by Zenodot Verlagsgesellschaft and later owned by Contumax. — [Wikipedia: Zeno.org](https://en.wikipedia.org/wiki/Zeno.org)
  - TextGrid bought the Zeno.org literature library. A 2009 Göttingen press release says it is available "zur freien wissenschaftlichen Bearbeitung". — [SUB Göttingen press release 2009](https://www03.sub.uni-goettingen.de/fileadmin/media/texte/oeffentlichkeitsarbeit/pressemitteilungen/2009/249_Presse-Info_Uni_Goett.pdf)
- **TextGrid license:** TextGrid's edition of the Digitale Bibliothek is "an adaptation of the data of www.editura.de", published under CC BY 3.0 DE. The license does not cover the underlying public-domain texts. Suggested citation: "TextGrid Repository (2012) … TextGrid Digitale Bibliothek". — [TextGridRep browse page](https://textgridrep.org/browse/knd5.0); [B2FIND record](https://b2find.eudat.eu/dataset/4159a294-b22b-5021-93c9-115d1722dd19). (Summarised from search results; I did not open the license page directly.)
- **TextGrid API, tested:**
  - `https://textgridlab.org/1.0/tgsearch-public/search?q=*&filter=format:text/xml` reports 164,029 hits.
  - Filtered to project `TGPR-372fe6dc-57f2-6cd4-01b5-2c4bbefcfd3c` ("Digitale Bibliothek"): 106,832 XML objects and **93,675 work records** (`text/tg.work+xml`).
  - Each item carries a TEI path such as `/Literatur/M/Tucholsky, Kurt/Werke/1919/Der alte Fontane`, which allows filtering to Literatur.
  - `https://textgridlab.org/1.0/aggregator/text/textgrid:wmx2.0` returns `content-type: text/plain;charset=UTF-8` with clean prose. `tgcrud-public/rest/<uri>/data` returns TEI XML.
  - Source: [tgsearch-public](https://textgridlab.org/1.0/tgsearch-public/search?q=Fontane&filter=format:text/xml&limit=3), [aggregator text sample](https://textgridlab.org/1.0/aggregator/text/textgrid:wmx2.0)
- **TextGrid scope:** the TextGridRep home page describes the Digitale Bibliothek as XML/TEI texts of fiction and non-fiction "vom Anfang des Buchdrucks bis zu den ersten Jahrzehnten des 20. Jahrhunderts". It also hosts Kolimo+ (German prose, ca. 1650–1930). — [TextGrid Repository](https://textgridrep.org/)
- **DTA corpus size** (download page, version of 10 Feb 2026):
  - Core corpus: 1,478 texts. Of these, Belletristik 553, Gebrauchsliteratur 266, Wissenschaft 659. By period: 1600–1699 237, 1700–1799 529, 1800–1899 692.
  - Core plus extensions: 5,481 texts, of which Belletristik 774 and Zeitung 2,036.
  - Downloads are TEI ZIPs in the DTA base format, plus TCF and "Reintext" (plain-text) versions.
  - Since the project ended, the texts are curated within NFDI Text+.
  - Source: [DTA Download](https://www.deutschestextarchiv.de/download)
- **DTA terms** (page dated 12 Feb 2025):
  - The introduction says full texts may be used "für nicht-kommerzielle Zwecke".
  - §1 says all full texts are under **CC BY-SA 4.0** since 16 June 2020 (before that, CC BY-NC 3.0), with attribution as "Deutsches Textarchiv".
  - §2 says the plain-text ("Reintext") version, without the XML/HTML annotations, "kann im Sinne der Gemeinfreiheit ohne jegliche Einschränkungen benutzt werden".
  - Scan images are non-commercial and remain with the owning libraries.
  - Source: [DTA Nutzungsbedingungen](https://www.deutschestextarchiv.de/doku/nutzungsbedingungen)
- **DTA APIs:** the API page lists Atom feeds, a BEACON author feed, OAI-PMH, a DDC OpenSearch wrapper and DTA::CAB (spelling normalisation). It lists no REST endpoint for random passages. — [DTA APIs](https://www.deutschestextarchiv.de/api)
- **DTA per-text download, tested:** `https://www.deutschestextarchiv.de/book/download_txt/goethe_werther01_1774` returned a 227-byte HTML page that sets a `verified=1` cookie through JavaScript and reloads ("JavaScript wird benötigt"). It is a bot gate, and I did not try to get past it. — [DTA download_txt](https://www.deutschestextarchiv.de/book/download_txt/goethe_werther01_1774)
- **DWDS:** the API page documents word frequency (`/api/frequency`), dictionary information, word lists, random entries and IPA. It does not offer full-text passage retrieval. — [DWDS API](https://www.dwds.de/d/api)

### Inferences
- **TextGrid as a complement to de.wikisource.** A Worker can build an index of Digitale Bibliothek work URIs once, filtered to the `/Literatur/` path and optionally by author death year, and store it in KV/R2. It can then fetch `aggregator/text/<uri>` for a random pick and window about 300 words.
  - Size: these are mostly whole works, with poems as individual items, so the pool is several times larger than Gutenberg-de.
  - Spelling: texts follow Zeno's sources, typically 19th-century editions, so spelling is pre-1901/1996 ("daß", "Thür" possible).
  - Copyright: the underlying texts are public domain. Attributing "TextGrid Repository / Digitale Bibliothek" is good practice, even though excerpts of public-domain text arguably need none.
- **DTA is better as a bulk import than a live API.** Usable as a static, pre-processed pool: download the Belletristik Reintext ZIP once, slice it into passages, and store them in R2. It is not suited to live calls because of the JavaScript gate.
  - Its 1600–1899 spelling is the most archaic of all the sources (unverified whether ſ is kept in plain text).
  - The non-commercial wording in the terms preamble conflicts with §1 (CC BY-SA 4.0) and §2 (Reintext public domain). Relying on §2 for plain text looks defensible, but a short email to DTA/Text+ would remove the doubt.
- **Ranking for German:** (1) Gutenberg via Gutendex, death-year filtered, already built; (2) de.wikisource poems, fairy tales and stories; (3) TextGrid Digitale Bibliothek.

### Gaps
- Zeno.org's current terms and status: the site was unreachable, so whether it is down for good or only temporarily is unknown.
- I did not open TextGrid's own license page, and I did not measure how much of the Digitale Bibliothek is "Literatur" versus philosophy or history.
- Whether DTA Reintext keeps long-s (ſ) and other historical glyphs. Its guidelines have an "s-Graphemes" section, but I could not read the rule. — [DTA base format: spellings](https://kaskade.dwds.de/~haaf/dtabf_en/trSchreibweisen.html)
- DWDS corpus licenses (the corpora are search-only, so they do not matter for this use).

## Q4. Portuguese sources beyond Gutenberg: Domínio Público, BN Digital (Brazil), BND Portugal (purl.pt), Biblioteca Digital Camões, Projecto Adamastor, Brasiliana USP

### Takeaway
None of the Portuguese-language national or institutional libraries offers a usable full-text API. Domínio Público and BN Digital Brasil returned **403** to scripted requests, and Domínio Público's collection is moving into MEC Livros. BND Portugal (purl.pt) has OAI-PMH **metadata** for about 43,000 public-domain digitised records, but the items are page scans/PDFs of mixed type (scores, manuscripts, pamphlets). Biblioteca Digital Camões returned 503. Brasiliana USP is a DSpace of scans.

Projecto Adamastor has about 100 well-edited classics with **updated spelling** (1945 Acordo), as EPUB only, likely CC BY-SA 4.0. It could seed a small curated Portuguese pool.

Practical Portuguese pool: Gutenberg pt (656), plus pt.wikisource contos/romances (about 1,100 Brazilian and Portuguese entries), plus optionally Adamastor EPUBs pre-processed into R2.

### Cited Findings
- **Domínio Público (MEC):**
  - `https://www.dominiopublico.gov.br/` returned HTTP 403 to both a descriptive UA and `Mozilla/5.0` (search form also 403). (Tested 2026-10-25.)
  - The collection is being folded into **MEC Livros**. Portaria nº 640 (July 2026) sets selection criteria, including formal verification of public-domain status in Brazil and checks on textual integrity and scan quality. The new platform may include works from public repositories, "especially the Domínio Público portal". — [Atlas Público](https://atlaspublico.com.br/noticias/mec-regulamenta-criterios-de-selecao-e-gestao-do-acervo-da-73304)
  - Domínio Público offers PDFs for offline reading, while MEC Livros does not allow downloads to e-readers. — [Tecnoblog](https://tecnoblog.net/noticias/mec-livros-plataforma-do-governo-oferece-classicos-e-best-sellers-de-graca/)
  - An older report says the portal would not be deactivated. — [Baguete](https://www.baguete.com.br/noticias/portal-dominio-publico-nao-sera-desativado)
- **BND Portugal (purl.pt):**
  - The OAI-PMH endpoint `https://oai.bnportugal.gov.pt/servlet/OAIHandler` publishes the sets `bnd` (44,218 records, Aug 2025), `bndlivre_digitalizadas` (public-domain works, 30,486 in Aug 2025) and `bndlivre`. The formats are oai_dc, MarcXchange, MODS, EDM and ESE. The page describes metadata only and states no data license. — [BNP Open Data OAI-PMH](https://opendata.bnportugal.gov.pt/eng_oai-pmh.htm)
  - Tested: `ListRecords&set=bndlivre_digitalizadas` now reports `completeListSize="43459"`. Sample records: an 1898 pamphlet (22 p.), an 1843 single-leaf declaration, and two Italian manuscript scores. Identifiers are `https://purl.pt/<n>` plus a cover image, and `dc:rights` was empty. — [BNP OAI ListRecords](https://oai.bnportugal.gov.pt/servlet/OAIHandler?verb=ListRecords&metadataPrefix=oai_dc&set=bndlivre_digitalizadas)
- **BN Digital Brasil:** `https://bndigital.bn.gov.br/` returned HTTP 403 and `https://bibdigital.bn.gov.br/` did not respond. (Tested.) — [BN Digital](https://bndigital.bn.gov.br/)
- **Biblioteca Digital Camões:** `https://cvc.instituto-camoes.pt/` returned HTTP 503. (Tested.) — [Instituto Camões CVC](https://cvc.instituto-camoes.pt/)
- **Brasiliana USP:**
  - `https://digital.bbm.usp.br/` (Biblioteca Brasiliana Guita e José Mindlin, DSpace) is reachable. Its ten main collections list roughly 4,166 items. The pages state no license, no file format and no API.
  - `https://www.brasiliana.usp.br/` did not respond.
  - Source: [BBM Digital](https://digital.bbm.usp.br/handle/bbm/1)
- **Projecto Adamastor:**
  - It describes itself as a "Biblioteca digital de obras literárias em domínio público … em formato EPUB e MOBI, sem qualquer tipo de restrição", made available "sob uma licença Creative Commons".
  - The catalog page links about 101 titles, and its "Colecção Clássicos" numbering reaches n.º 66.
  - Spelling: "As obras são revistas segundo o Acordo Ortográfico de 1945", not the 1990 agreement. The project is non-profit and volunteer-run.
  - Source: [Projecto Adamastor](https://projectoadamastor.org/), [FAQ](https://projectoadamastor.org/faq/), [Catálogo](https://projectoadamastor.org/catalogo/)
  - One Adamastor EPUB (*Oaristos*, 2020), found re-hosted by a school library, states "Creative Commons - Atribuição-CompartilhaIgual 4.0 Internacional". — [aeaveiro.pt copy](https://aeaveiro.pt/biblioteca/download/525/Oaristos%20-%20Eugenio%20de%20Castro.epub) (secondary host; the license may vary by title)

### Inferences
- **No Portuguese API equivalent of Ben-Yehuda exists.** For a live random passage, Gutenberg pt and pt.wikisource are the only programmatic options.
- **purl.pt and BN Digital are scan archives.** Their content is scans/PDF, the OCR text layer is unknown, and record types are mixed. Extracting clean passages would need PDF OCR text extraction and heavy filtering, which is not worth it for v1.
- **Adamastor is the best way to offer modern-spelling Portuguese.** A one-time import of its approximately 100 EPUBs, segmented into passages and stored in R2, could make Portuguese feel less archaic.
  - CC BY-SA 4.0 permits commercial use with attribution and share-alike. Share-alike on displayed excerpts of a modernised edition is a real but small obligation: credit "Projecto Adamastor" and link the license.
  - Confirm the license per title, or email projectoadamastor@outlook.com.
  - The EPUBs are Portugal-centric, including Brazilian authors such as Machado and Bernardo Guimarães, but use the 1945 PT norm ("actual", "facto").
- **Brazil vs Portugal is a spelling choice more than a source choice.** All sources carry both countries' authors. Old-spelling Gutenberg/Wikisource versus 1945-PT Adamastor is the real stylistic lever. No source found offers Brazilian 1943/1990-norm modernised texts at scale.

### Gaps
- Domínio Público's current size and any terms. The site blocked scripted access, and I found no 2025–2026 figures. It is unclear whether MEC Livros has an API (it appears to be a reading app without downloads).
- Whether purl.pt items expose OCR plain text (I did not test a purl.pt item's media endpoints beyond the record).
- Biblioteca Digital Camões and BN Digital terms and contents: unreachable, not researched further.
- Adamastor's exact title count, and whether every title is CC BY-SA 4.0. The license was confirmed on only one title, through a secondary host.
- Brasiliana USP item licenses and whether it has OAI-PMH (DSpace usually does, but this was not verified).
