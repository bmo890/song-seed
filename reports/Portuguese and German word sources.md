# Build our own word data for Portuguese and German

There is no Datamuse for Portuguese or German, and no Charuzit either. We checked every likely API, and none gives rhymes plus meaning words with clear commercial terms. Datamuse ignores `v=pt` and `v=de` and quietly returns English. The good news is that open datasets cover most of what SongNook needs. The best ones are Wiktionary pronunciations and rhyme lists, OpenThesaurus (German), OpenWordNet-PT (Portuguese), and subtitle-based word-frequency lists. We would turn them into a small word file per language, a few megabytes, that the app reads on the phone. A thin Cloudflare Worker would serve definitions. The existing paid LLM Worker would fill the modes the open data covers badly: "describing words" and "related" in both languages, plus opposites and parts in Portuguese. German comes out stronger than Portuguese, and both come out stronger than Spanish is today, because Spanish relies on Datamuse's partial Spanish support. Borrowed Words needs almost no new code. Gutendex already returns 656 Portuguese and 2,479 German books through the same path. Two problems need fixing first. Some German and Portuguese titles are still under copyright in Europe and Brazil. And Portuguese books are mostly 19th-century Portugal in old spelling, which suits Brazilian writers poorly. The real work is a one-time data build, about two to four weeks for both languages by my estimate, plus a short list of emails and licence checks.

## No ready-made service exists, so we assemble one

SongNook's word tools rest on outside services today. Datamuse serves all English modes. For Spanish it serves meaning, sounds-like, consonance, spelling patterns and definitions; we compute Spanish rhymes ourselves from spelling. Hebrew uses Dicta's Charuzit for rhymes and our own LLM Worker for the meaning modes. We looked for the same kind of service in Portuguese and German. **None exists in a form we can rely on for a commercial app.**

Live tests on 2026-10-25 settled Datamuse. `ml=amor&v=pt` returned "cupid" and "heaven", and `rel_rhy=liebe&v=de` returned "plebe" and "dweeb". The language flag is ignored for both ([Datamuse API](https://www.datamuse.com/api/)). The other candidates each fail on something. The table shows what each one offers and why it falls short.

| Service | Language | What it offers | Access | Commercial terms | Cost and limits | Reliability | Verdict |
|---|---|---|---|---|---|---|---|
| Datamuse | pt, de | Nothing; returns English | Open JSON | n/a | n/a | n/a | Ruled out ([Datamuse](https://www.datamuse.com/api/)) |
| RhymeBrain | de only | Rhymes and near rhymes; noisy ("Liebe" → "inklusive", "operative") | Open JSON | Not addressed; About-screen credit required | Free, **350 requests per hour** | "Cannot guarantee" uptime | Fallback at most; ask first ([RhymeBrain API](https://rhymebrain.com/api.html)) |
| OpenThesaurus API | de | Synonyms, broader and narrower terms | Open JSON, callable from phones | CC BY-SA 4.0 or LGPL; link required | Free, **60 requests/min per IP**; they want the dump used for bulk | Live, data updated daily | Use the **dump**, not the API ([OpenThesaurus API](https://www.openthesaurus.de/about/api)) |
| Duden API | de | Spell-check plus synonym suggestions; no definitions | Paid key | Commercial product | **€39.95/month for 100 requests a day**, up to €174.95 for 1,000 | Solid | Wrong product, wrong price ([Duden API](https://www.duden.de/api)) |
| DWDS | de | IPA, frequency, dictionary links | Open JSON | Automated use **only with explicit permission** | Free | Solid | Link to it only ([DWDS terms](https://www.dwds.de/d/nutzungsbedingungen)) |
| Leipzig Wortschatz API | de, pt | Word co-occurrences ("große Liebe"), frequency | Open JSON | Conflicting: API says CC BY 4.0, usage page says commercial use needs written consent | Free | Live, but corpora date from 2008–2012 | Needs written consent ([Leipzig terms](https://wortschatz.uni-leipzig.de/en/usage)) |
| Dicionário Aberto API | pt | Definitions; word lists by ending and by similar spelling | Open JSON, no key | CC BY-SA 2.5 Portugal | Free; no published limits | One academic maintainer | Fallback only; 1913 senses ([Dicionário Aberto](https://dicionario-aberto.net/)) |
| Sinônimos.com.br / Dicio | pt | Synonyms, antonyms, hand-written rhyme lists | Web pages only | Terms **forbid copying or extracting** the lists | n/a | n/a | Off limits ([Sinônimos terms](https://www.sinonimos.com.br/termos-de-uso/)) |
| ConceptNet | pt, de | "Related" links | API returned **502**; last code change 2021 | CC BY-SA 4.0 | Free | Unmaintained | Skip ([ConceptNet licence](https://github.com/commonsense/conceptnet5/wiki/Copying-and-sharing-ConceptNet)) |

GermaNet, the reference German wordnet, offers a commercial licence on request with no published price ([GermaNet licences](https://www.sfs.uni-tuebingen.de/GermaNet/licenses.shtml)). Priberam, Porto Editora, Michaelis and Aulete publish no API we could find. German rhyme sites (reimemaschine.de, echtreim.de and others) publish no API, and most did not respond. German Wiktionary itself warns that online rhyme engines "mostly look only at spelling" and are poorly suited to the job ([Wiktionary Hilfe:Reime](https://de.wiktionary.org/wiki/Hilfe:Reime)).

So the Hebrew model of "one specialist API plus the LLM" does not transfer. The model that does transfer is the Spanish one, where we compute rhymes ourselves, taken further with real pronunciation data.

## Rhymes need a pronunciation table, because spelling misleads in both languages

The Spanish rhyme tool works from spelling, and that is fine for Spanish. It is not fine here. In Portuguese, spelling does not show whether an *e* or *o* is open or closed: *gosto* the noun and *gosto* the verb are pronounced differently. Nasal endings also blur, so *coração*, *mão* and *falam* all end in the same sound in Brazil. Brazilian speech turns a final *l* into a *w* sound, so *mal* rhymes with *mau*. And Portugal reduces unstressed vowels heavily, so the two countries rhyme differently. In German, spelling often hides vowel length. Final consonants harden (*Rad* rhymes with *Rat*), loanwords stress the last syllable, and compounds take their rhyme from the last stressed part. The Wiktionary rhyme page for *-iːbə* lists two spellings, *-ibe* and *-iebe*, for one sound ([Wiktionary API](https://de.wiktionary.org/w/api.php?action=parse&page=Reim:Deutsch:-iːbə&prop=wikitext&format=json)). The Portuguese points are the researchers' linguistic reasoning, not a published study, and a native speaker should confirm them.

The fix is a **pronunciation table**: each word mapped to its sound, written in the phonetic alphabet (IPA). From that we take a "rhyme key", the sound from the last stressed vowel to the end. Two words with the same key rhyme. Near rhymes match only the vowels, which is assonance, the dominant rhyme in Lusophone popular song. Consonance matches only the consonants after the stress. Homophones match the whole sound. Sounds-like uses distance between whole sounds. This all runs on the phone, offline, with no per-use cost.

A quick prototype on 2026-10-25 showed the method works. On a 95,933-word Brazilian list, *coração* matched 3,659 words (*abdicação*, *aberração*…) and *amor* matched 1,314. On the German list, *Liebe* matched 51 (*bliebe*, *Diebe*, *Getriebe*), *Herz* matched 24 (*März*, *Nerz*, *Konzerts*) and *Nacht* matched 75 (*acht*, *bedacht*, *bewacht*) ([ipa-dict data](https://github.com/open-dict-data/ipa-dict/tree/master/data)). German compounds need one extra rule. *Herzschmerz* stresses its first part, so a naive key would rhyme it with nothing. We key compounds on their last stressed element instead.

### Where the pronunciations come from

| Source | Language | What it gives | Size | Licence | Commercial use | Notes |
|---|---|---|---|---|---|---|
| German Wiktionary (via Wiktextract dump) | de | IPA **plus a ready-made rhyme class** per word, and curated "similar rhymes" links | **47,100 rhyme pages**; dump 2.9 GB raw, trimmed to a few MB (estimate) | CC BY-SA | Yes, with credit and share-alike on the data file | Best German source ([Hilfe:Reime](https://de.wiktionary.org/wiki/Hilfe:Reime), [kaikki dewiktionary](https://kaikki.org/dewiktionary/rawdata.html)) |
| WikiPron | pt-BR, pt-PT | IPA scraped from Wiktionary, with regional variants | **188,055** Brazil rows (5.6 MB), 87,240 Portugal rows | CC BY-SA (data), Apache (code) | Yes, as above | Stress marks were stripped; we restore them by spelling rule ([WikiPron](https://github.com/CUNY-CL/wikipron), [summary](https://github.com/CUNY-CL/wikipron/blob/master/data/scrape/summary.tsv)) |
| Montreal Forced Aligner dictionary | pt-BR | Pronunciation dictionary | Not checked | **CC BY 4.0** (no share-alike) | Yes, credit only | Size and stress marks unverified ([MFA pt-BR](https://mfa-models.readthedocs.io/en/latest/dictionary/Portuguese/Portuguese%20%28Brazil%29%20MFA%20dictionary%20v2_0_0.html)) |
| ipa-dict | pt-BR, de | Word → IPA lists with stress | 95,933 pt-BR; 787,104 de | German part CC BY-SA; **pt-BR origin undocumented** | de yes; pt-BR ask first | No pt-PT file ([ipa-dict](https://github.com/open-dict-data/ipa-dict)) |
| eSpeak NG | pt, pt-BR, de | Generates IPA for any word | Program | **GPL-3** | Build-time only | Never ship it inside the app ([espeak-ng](https://github.com/espeak-ng/espeak-ng)) |
| Wiktionary Rhymes:Portuguese | pt | Rhyme pages by sound | Category tree | CC BY-SA | Yes | Good for checking results ([example](https://en.wiktionary.org/wiki/Rhymes:Portuguese/%C9%9Bs)) |
| CELEX German | de | Classic lexicon | n/a | Proprietary; price unpublished | Contract | Not needed ([LDC](https://catalog.ldc.upenn.edu/LDC96L14)) |

German is the easier build. German Wiktionary already assigns each word a rhyme class by sound, following a clear rule: words rhyme when they sound alike from the vowel of the last main-stressed syllable ([Hilfe:Reime](https://de.wiktionary.org/wiki/Hilfe:Reime)). Its pages also list "similar rhymes" by hand, a ready-made near-rhyme source. Portuguese needs more of our own work: WikiPron or MFA pronunciations, stress restored by rule, and a spelling-rule fallback for missing words. For Portugal users, eSpeak NG can generate a second pronunciation column at build time.

One uncertainty matters. **Nobody has measured how many German words actually carry a rhyme class or IPA** in the dump. That needs one processing pass. The same goes for the MFA dictionary's size and stress marks.

## Meaning words: German is rich, Portuguese is thinner

German has an excellent open thesaurus. **OpenThesaurus** is free, was updated two days before our check (2026-10-23), and offers a 6.4 MB database dump and a 1.6 MB text dump. Its licence is CC BY-SA 4.0 or LGPL 2.1, our choice. It must be linked as the source ([OpenThesaurus download](https://www.openthesaurus.de/about/download)). It gives synonyms plus broader and narrower terms: *Baum* → *Nadelbaum*, *Laubbaum* ("kinds of") and *Pflanze* (broader) ([live API call](https://www.openthesaurus.de/synonyme/search?q=Baum&format=application/json&supersynsets=true&subsynsets=true)). Its website also shows opposites (*hell* → *dunkel*) and "associations", but the API does not return them. Whether the dump contains them is **unconfirmed**. Downloading it settles that. **OdeNet**, an open German wordnet built from OpenThesaurus and the English WordNet, adds structure (CC BY-SA 4.0, about 36,000 synsets, maintained) ([OdeNet](https://github.com/hdaSprachtechnologie/odenet), [wn package](https://pypi.org/project/wn/)). German Wiktionary adds opposites, kinds, and "parts of" fields ([Wiktextract de model](https://github.com/tatuylonen/wiktextract/blob/master/src/wiktextract/extractor/de/models.py)).

Portuguese has fewer and older sources. **OpenWordNet-PT** is the cleanest. It is CC BY 4.0, credit only with no share-alike, had a new release in April 2026, and is effectively Brazilian ([licence](https://github.com/own-pt/openWordnet-PT/blob/master/LICENSE), [releases](https://github.com/own-pt/openWordnet-PT/releases)). Its counts show the gaps clearly ([statistics](https://github.com/own-pt/openWordnet-PT/blob/master/statistics.org)):

| OpenWordNet-PT relation | Count | Word Finder mode |
|---|---|---|
| Broader / narrower terms | 89,089 | Kinds of (good) |
| Part, member and substance parts | about 22,000 | Parts of (fair) |
| Similar-to | 21,386 | Similar (fair) |
| Opposites | **517** | Opposites (thin) |
| Attribute | 1,278 | Describing words (very thin) |

Its relations were copied over from English, not written for Portuguese ([CHANGES](https://github.com/own-pt/openWordnet-PT/blob/master/CHANGES)). **Onto.PT and CONTO.PT** from the University of Coimbra merge seven older Portuguese resources into larger synonym and relation sets, under CC BY 3.0. CONTO.PT gives a confidence score for each link, so weak links can be dropped. But they were last updated in 2018 and lean towards Portugal ([Onto.PT](https://ontopt.dei.uc.pt/index.php?sec=download_ontopt), [CONTO.PT](https://ontopt.dei.uc.pt/index.php?sec=contopt)). **PAPEL** has 191,000 relations, including opposites and parts, but has no written licence and comes from a Porto Editora dictionary. Using it needs written permission ([PAPEL](https://www.linguateca.pt/PAPEL/papel.html)). **TeP 2.0**, the Brazilian synonym-and-antonym thesaurus, has a broken download page (404) and no licence we could find ([TeP 2.0](https://www.nilc.icmc.usp.br/tep2/index.htm)). The Portuguese Wiktionary dump adds synonyms, antonyms and broader and narrower terms. It has **no "parts of" field and no rhyme field** ([Wiktextract pt model](https://github.com/tatuylonen/wiktextract/blob/master/src/wiktextract/extractor/pt/models.py)).

### The two modes open data does not cover

"Describing words" (*ocean → deep, vast*) has no good open source in either language. "Related" is weak too. There are three ways to fill them. We could count which adjectives sit next to which nouns in a big text collection. Leipzig's co-occurrence data does this well for German ("große Liebe" scores top for *Liebe*), but commercial use needs Leipzig's written consent ([Leipzig terms](https://wortschatz.uni-leipzig.de/en/usage)). We could use word-similarity vectors (fastText, CC BY-SA 3.0). They are about 1.3 GB per language to download, but cut down to the top 25 neighbours of 50,000 words they come to roughly 2–3 MB (estimate). They mix synonyms with opposites, though, so they suit "related" and not "synonyms" ([fastText](https://fasttext.cc/docs/en/crawl-vectors.html)). Or we could use the **LLM Worker**, as Hebrew does.

The LLM route is cheap. With a ~300-token prompt and a ~250-token answer, Claude Haiku 5.5 costs about **$0.16 per 1,000 lookups**, or about $0.08 with the Batch API ([Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)). Precomputing 20,000 common words across 7 meaning modes is 140,000 calls, roughly **$11 per language**. After that, each lookup costs nothing and the answers can be checked before shipping. Rare words would go to the live Worker and be cached, as Hebrew already works. These costs are estimates. Real token counts were not measured and could be off by 2×. LLM output also carries no CC BY-SA, so it can live in a separate table without share-alike. One firm rule: the LLM should **not** make rhymes. The pronunciation table does that better, for free.

## Definitions come from Wiktionary through a small Worker

For both languages, Wiktionary is the only open source of definitions written in the language itself. The ready-made Wikimedia definition endpoint does not work for Portuguese or German. Both returned error 501 ([pt test](https://pt.wiktionary.org/api/rest_v1/page/definition/casa), [de test](https://de.wiktionary.org/api/rest_v1/page/definition/Liebe)). The general Wiktionary API does work. It returned eight numbered senses for *Liebe* and a clean text entry for *saudade*, though the text needs tidying ([de API](https://de.wiktionary.org/w/api.php?action=parse&page=Liebe&prop=wikitext&format=json&section=1)). A small Worker would fetch the entry, keep the first one to three senses, cache them, and send them to the phone. Wikimedia now limits clients to **200 requests a minute** with a proper identifying header, and 10 a minute without one ([Wikimedia rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits), [User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy)). The cache keeps us well under that. The alternative is to pull definitions for the 50,000 most common words out of the dump and ship them in the word file.

The other options are weaker. Dicionário Aberto works today, but it is a 1913 Portugal dictionary, and its senses read as antique to Brazilians ([Dicionário Aberto](https://dicionario-aberto.net/), [Gutenberg #31552](https://www.gutenberg.org/ebooks/31552)). The English Wiktionary's Portuguese and German entries give English glosses, which only suit an English interface ([Kaikki Portuguese](https://kaikki.org/dictionary/Portuguese/)). DWDS has rich German definitions but forbids copying them without permission. A "more at DWDS" link is allowed ([DWDS terms](https://www.dwds.de/d/nutzungsbedingungen)).

## Ranking uses subtitle word counts, the same kind Spanish likely uses

Results must be sorted so common words come first. The FrequencyWords lists, built from film and TV subtitles, have separate Brazilian (`pt_br`), Portugal (`pt`) and German (`de`) lists of 50,000 words each. They are CC BY-SA 4.0 for content ([FrequencyWords](https://github.com/hermitdave/FrequencyWords)). Subtitle language is conversational, close to lyrics. The German 50k list is 662 KB. It is all lowercase, so noun capitals have to be restored from Wiktionary or OpenThesaurus. The alternatives are worse for us. SUBTLEX-DE is non-commercial ([OSF](https://osf.io/479um/wiki)). Corpus do Português forbids redistributing word lists ([UVA](https://library.virginia.edu/data/datasources/licensed/corpus-do-portugues)). DWDS frequency needs permission.

## Borrowed Words works today, but the shelves need sorting

The existing code path (a random Gutendex page, then a byte-range fetch of the book's text) works unchanged for both languages. Only the language code changes. Gutendex returned **656 Portuguese** and **2,479 German** books, against 922 Spanish. Every sampled book had a plain-text file that supports range fetches ([Gutendex pt](https://gutendex.com/books/?languages=pt), [Gutendex de](https://gutendex.com/books/?languages=de), [Gutenberg catalog](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv)). Four problems need handling.

First, **copyright differs by country**. Gutenberg follows US rules. Germany and Brazil protect works until 70 years after the author's death ([§ 64 UrhG](https://www.gesetze-im-internet.de/urhg/__64.html), [Lei 9.610/98 art. 41](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm)). Checking the catalog's death dates found **256 German titles** whose author or translator died in 1956 or later, Hermann Hesse among them. That is about 10% of the German shelf. It also found 16 Portuguese titles and **67 Spanish titles** ([Gutenberg catalog](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv)). Spanish is live today, and SongNook's Gutendex fetch does not filter on this. Another 212 German, 105 Portuguese and 134 Spanish titles list no dates at all.

Second, **Portuguese feels like old Portugal**. The top authors are Camilo Castelo Branco (52 titles), Pimentel, Quental and Herculano. Machado de Assis has 12. Texts use pre-1911 spelling ("naquella", "tambem") ([Gutenberg catalog](https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv), [Dom Casmurro](https://www.gutenberg.org/ebooks/55752.txt.utf-8)).

Third, **Gutenberg blocked all German internet addresses in 2018** after a Frankfurt court case ([Techdirt](https://archive.techdirt.com/articles/20180306/03423339363/project-gutenberg-blocks-access-germany-to-all-public-domain-books-because-local-copyright-claim-18-them.shtml)). We found no report that the block was lifted. If it still stands, German users get nothing, and a Worker near Germany may hit the same wall. **This needs a test from a German connection before launch.**

Fourth, **Gutendex is fragile**. It took about 30 seconds per page and returned error 500 under a light crawl. Gutenberg also asks robots to use its catalog file rather than scraping ([Gutenberg robot policy](https://www.gutenberg.org/policy/robot_access.html)).

Better sources fill the gaps:

| Source | Language | Size | Access | Licence | Quality | Needs Worker? |
|---|---|---|---|---|---|---|
| Gutenberg via Gutendex | pt, de | 656 / 2,479 books | Existing code | Public domain in the US | Old spelling; pt mostly Portugal | Today no; recommended (own index, copyright filter) |
| **German Wikisource** | de | 9,970 poems, 1,936 fairy tales, 3,630 legends, 631 stories, 215 novellas | Wikimedia API | Texts public domain; site CC BY-SA 4.0 | **Proofread twice**; ideal page-sized pieces | Yes (clean-up and cache) ([de.wikisource](https://de.wikisource.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json), [licence](https://de.wikisource.org/wiki/Wikisource:Lizenzbestimmungen)) |
| TextGrid Digitale Bibliothek | de | 93,675 works (former Zeno.org) | Public API returns plain text | Edition CC BY 3.0 DE; texts public domain | Good, 19th-century spelling | Yes ([TextGrid](https://textgridrep.org/), [sample](https://textgridlab.org/1.0/aggregator/text/textgrid:wmx2.0)) |
| Deutsches Textarchiv | de | 553 to 774 fiction texts, 1600–1899 | Bulk download only | Terms contradict themselves; plain text declared public domain | High, very archaic | Bulk import ([DTA terms](https://www.deutschestextarchiv.de/doku/nutzungsbedingungen)) |
| **Portuguese Wikisource** | pt | 735 Brazilian short-story entries, 184 Brazilian novel entries, 152 Portuguese stories | Wikimedia API | Texts public domain ([policy](https://pt.wikisource.org/wiki/Wikisource:Seu_suor_n%C3%A3o_gera_direitos_autorais)) | Old spelling, some scanning errors | Yes ([pt.wikisource](https://pt.wikisource.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json)) |
| Projecto Adamastor | pt | About 100 classics, EPUB | One-time import | Likely CC BY-SA 4.0, confirmed on one title only | **Modernised spelling** (1945 Portugal norm) | One-time import to storage ([Adamastor](https://projectoadamastor.org/)) |
| Projekt Gutenberg-DE | de | Large | Website | **Private use only** | n/a | Off limits ([terms](https://projekt-gutenberg.org/nutzungsbedingungen/)) |
| Domínio Público, BN Digital, purl.pt, Camões | pt | Large | Blocked (403/503) or scans only | Varies | Scans, not text | Not usable ([BNP OAI](https://opendata.bnportugal.gov.pt/eng_oai-pmh.htm)) |

On Wikisource, picking a random page directly mostly returns encyclopedia entries and laws. Random picks must come from the literature categories. The simple plain-text API also returns empty text for proofread works, so the Worker must fetch full HTML and strip the header ([de parse test](https://de.wikisource.org/w/api.php?action=parse&page=%E2%80%99s_ist_Krieg!&prop=text&formatversion=2&format=json)). That is the same shape of job the Ben-Yehuda Worker does for Hebrew. No Portuguese library offers anything like Ben-Yehuda's API.

## Feature by feature: what each language gets

"Today" is what the app does now, per `src/domain/wordTools.ts`. "Proposed" is this report's plan. *Bundle* means a word file on the phone. *Worker* means our Cloudflare Worker. *LLM* means the paid LLM Worker.

| Mode | English (today) | Spanish (today) | Portuguese (proposed) | German (proposed) |
|---|---|---|---|---|
| Rhymes | Datamuse | Spelling rules + Datamuse patterns, ranked by frequency | Bundle: pronunciation table (WikiPron/MFA) + spelling fallback. **Good for Brazil**; Portugal second | Bundle: Wiktionary rhyme classes + IPA. **Good** |
| Near rhymes | Datamuse | Spelling rules | Bundle: vowel match (assonance). Good | Bundle: Wiktionary "similar rhymes" + vowel match. Good |
| Sounds like | Datamuse | Datamuse | Bundle: sound distance. Fair | Bundle: sound distance. Fair |
| Consonance | Datamuse | Datamuse | Bundle: consonant match. Fair | Bundle: consonant match. Fair |
| Homophones | Datamuse | Not offered | Bundle: same full sound. Fair | Bundle: same full sound. Fair |
| Similar | Datamuse | Datamuse | Bundle: OpenWordNet-PT + CONTO.PT. Fair | Bundle: OpenThesaurus + OdeNet. Good |
| Related | Datamuse | Not offered | LLM (or word vectors). Fair | OpenThesaurus associations if in dump, else LLM. Fair |
| Synonyms | Datamuse | Not offered | Bundle: OpenWordNet-PT + CONTO.PT. Fair | Bundle: OpenThesaurus. **Good** |
| Opposites | Datamuse | Not offered | Thin open data (517 + Onto.PT + Wiktionary), **LLM top-up**. Weak to fair | Bundle: Wiktionary + OpenThesaurus (if in dump). Fair |
| Describing words | Datamuse | Not offered | **LLM** | **LLM** (Leipzig only with consent) |
| Kinds of | Datamuse | Not offered | Bundle: OpenWordNet-PT. Good | Bundle: OpenThesaurus + OdeNet + Wiktionary. Good |
| Parts of | Datamuse | Not offered | Bundle: OpenWordNet-PT parts, LLM top-up. Fair | Bundle: Wiktionary parts (fill rate unknown), LLM top-up. Fair |
| Definitions | Datamuse | Datamuse | Worker: pt.wiktionary, cached. Fair | Worker: de.wiktionary, cached. Good |
| Borrowed Words | Gutenberg via Gutendex + curated pool | Gutenberg via Gutendex (922 books) | Gutendex (656) + pt.wikisource Brazilian stories; Adamastor later | Gutendex (2,479, filtered) + de.wikisource poems and tales; TextGrid later |

Quality grades are judgements from the evidence above, not measurements. A native speaker should test each mode before launch.

## The recommended plan, with effort

Effort is my estimate for one developer. **S** is a day or two, **M** is about a week, **L** is two weeks or more. The rhyme engine is shared, so building it once serves both languages.

### Shared groundwork

| Step | What | Effort |
|---|---|---|
| 1 | A build script that turns the Wiktionary dumps, wordnets, thesaurus and frequency lists into one compact word file per language | L |
| 2 | An on-phone engine for rhyme keys: perfect, near, consonance, homophones, sounds-like. It generalises the Spanish rhyme code | M |
| 3 | A definitions Worker for pt and de Wiktionary, with cache and proper identifying header | S |
| 4 | Extend the LLM Worker with pt and de prompts for describing, related, and top-ups; precompute common words in batch | S to M |
| 5 | A Credits row naming every source, and the derived word files published under CC BY-SA | S |

### German (do first, it is the stronger case)

| Feature | Source | Runs where | Ongoing cost | Effort |
|---|---|---|---|---|
| Rhymes, near, consonance, sounds-like, homophones | Wiktionary rhyme classes + IPA; eSpeak NG at build time for gaps | Bundle | Free | Part of shared L + M |
| Synonyms, similar, kinds of | OpenThesaurus dump + OdeNet | Bundle | Free | S on top of shared |
| Opposites, parts of | Wiktionary fields + OpenThesaurus (if present) | Bundle | Free | S |
| Related | OpenThesaurus associations if present, else LLM | Bundle or LLM | About $11 one-off precompute (estimate) | S |
| Describing words | LLM | LLM Worker, cached | Same as above | S |
| Definitions | de.wiktionary | Worker | Free | S |
| Borrowed Words | Gutendex with death-year filter; then de.wikisource poems and tales | App, then Worker | Free | S for the filter; M for Wikisource |

### Portuguese (Brazil first)

| Feature | Source | Runs where | Ongoing cost | Effort |
|---|---|---|---|---|
| Rhymes, near, consonance, sounds-like, homophones | WikiPron (or MFA) Brazilian IPA, stress restored by rule, spelling fallback | Bundle | Free | Part of shared + M for Portuguese rules |
| Portugal variant | eSpeak NG pt at build time as a second column | Bundle | Free | M, can wait |
| Synonyms, similar, kinds of, parts of | OpenWordNet-PT + CONTO.PT (+ Wiktionary pt) | Bundle | Free | S on top of shared |
| Opposites | Open data + LLM top-up | Bundle + LLM | Small | S |
| Related, describing words | LLM | LLM Worker | About $11 one-off precompute (estimate) | S |
| Definitions | pt.wiktionary | Worker | Free | S |
| Borrowed Words | Gutendex pt with filter; add pt.wikisource Brazilian contos; Adamastor later for modern spelling | App, then Worker | Free | S, then M |

What **cannot be done well**, even with this plan: Portuguese opposites will stay thinner than English. Describing words in either language will depend on the LLM. Portugal-specific rhymes will lag Brazilian ones. Modern-spelling Brazilian books do not exist at scale in any open source we found.

## What this means for SongNook

Portuguese and German are both doable without a new paid service. The ongoing cost is close to zero: a small Worker for definitions and passages, plus LLM calls we can mostly pay for once, up front. Most of the tool works offline, which fits a quiet app.

German can launch with every Word Finder mode. Portuguese can launch with every mode too, but opposites and describing words lean on the LLM.

Both new languages would offer more modes than Spanish does today. Spanish serves five of the twelve modes plus definitions; Portuguese and German would serve all twelve plus definitions. The same open-data pattern could probably fill Spanish's gaps, but we did not research Spanish here.

Borrowed Words needs a copyright filter before Portuguese or German ship. The existing Spanish shelf needs one too.

The biggest unknown for German is whether Gutenberg still blocks Germany. One test answers it.

Every source except OpenWordNet-PT and MFA carries "share-alike". In plain terms, we credit the sources in the app and publish our derived word files under the same licence. Our app code stays ours. This is the common reading. It is not legal advice, and a lawyer should confirm it once.

## Emails to send and checks to run

| To | Why | Needed before launch? |
|---|---|---|
| feedback@openthesaurus.de | They ask to be told before serious use. Confirm whether the dump includes opposites and associations, and how they want LGPL marked in an app ([API terms](https://www.openthesaurus.de/about/api)) | Yes (German) |
| projectoadamastor@outlook.com | Confirm every title is CC BY-SA 4.0 ([Adamastor](https://projectoadamastor.org/)) | Only if we import Adamastor |
| wort@informatik.uni-leipzig.de | Written consent for commercial use of co-occurrence data ([terms](https://wortschatz.uni-leipzig.de/en/usage)) | Only if we use Leipzig for describing words |
| Linguateca (PAPEL) | Written permission; it derives from a Porto Editora dictionary ([PAPEL](https://www.linguateca.pt/PAPEL/papel.html)) | Only if we want PAPEL |
| NILC/USP (TeP 2.0) | Licence and a working download ([TeP](https://www.nilc.icmc.usp.br/tep2/index.htm)) | No; nice to have |
| ipa-dict maintainers | Where the Brazilian list came from ([ipa-dict](https://github.com/open-dict-data/ipa-dict)) | Only if we use that list |
| RhymeBrain | Commercial use and limits ([API](https://rhymebrain.com/api.html)) | No; we do not need it |
| DTA / Text+ | Confirm commercial use of plain texts ([terms](https://www.deutschestextarchiv.de/doku/nutzungsbedingungen)) | Only if we import DTA |

| Check | Why |
|---|---|
| Fetch a Gutenberg book from a German connection, directly and through the Worker | The 2018 block may still stand |
| Add a death-year filter (author and translator died ≤ 71 years ago) to Borrowed Words for es, pt and de | EU and Brazil use life + 70 |
| Lawyer review: CC BY-SA and LGPL data inside a closed-source app; EU database rights on Wiktionary extracts | Common reading is fine, not confirmed ([CC on data](https://wiki.creativecommons.org/wiki/Data)) |
| Keep eSpeak NG out of the app binary | GPL-3 conflicts with app-store distribution |
| Measure fill rates in the Wiktionary dumps (IPA, rhyme, parts, opposites) | Sets the real quality of German parts and opposites |
| Native-speaker test of rhymes: one Brazilian, one Portuguese, one German | Spelling and stress rules here are reasoning, not tested |
| Spot-check LLM lists in Portuguese and German before batch precompute | No accuracy benchmark exists for small models in these languages |

## Conclusion

The research changes the question. It is no longer "which service do we sign up for?" but "are we willing to own a word database?" For Portuguese and German the answer has to be yes. Owning it brings real benefits. The tool works offline, there is no rate limit, no vendor can disappear on us, and there is no per-lookup bill. Datamuse's partial Spanish support, by comparison, leaves seven modes dark. The rhyme engine built for these two languages is a reusable asset. It is the same pipeline any later language would run through, and it could replace the spelling-only Spanish rhymes.

Two findings deserve action even if Portuguese and German wait. Borrowed Words already serves Spanish books by authors still under copyright in Europe. And German Wiktionary's hand-curated rhyme classes are a better rhyme source than any rhyme API we found in any language. They are a sign that, for songwriting tools, careful open data now beats the commercial services.
