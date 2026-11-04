# Portuguese (pt-BR first, pt-PT second) data sources for SongNook Word Finder

Research date: 2026-10-25. "Probed" means I sent a live request from this machine on that date and report the HTTP result. Licence statements are quoted from the project's own page or LICENSE file wherever I could reach one. Where I could only find secondary or packaging metadata, I say so.

## Rhymes, near rhymes, sounds-like, consonance: rhyme APIs, rhyme sites, phonetic lexicons, and whether spelling-based rhyme is reliable

### Takeaway
I found no Portuguese rhyme API: no Portuguese counterpart to Dicta's Charuzit and no Datamuse support. The best foundation is to bundle a pronunciation lexicon. WikiPron's Brazilian and European Portuguese IPA tables, scraped from en.wiktionary, have about 188k pt-BR rows in roughly 5.6 MB uncompressed, with dialect variants. They carry Wiktionary's CC BY-SA terms. Rhyme would then be computed on-device from the stressed vowel onward. Spelling-only rhyme, the method the Spanish tool uses, works noticeably worse for Portuguese. The reasons are unmarked é/ê and ó/ô quality, nasal diphthongs, coda /l/→[w], and pt-BR vs pt-PT vowel reduction. A spelling rule set plus the lexicon as an override is the realistic hybrid.

### Cited Findings
**Datamuse (ruled out)**
- Probed `api.datamuse.com/words?ml=amor&v=pt` and `?ml=casa&v=pt`. Both returned English words ("cupid", "heaven"; "villa", "apartment", "house"), so `v=pt` is silently ignored and Portuguese is unsupported. The control `v=es` returned Spanish ("desamor", "amar", "pasión"). `rel_syn=casa&v=pt` returned `[]`. — [Datamuse API](https://www.datamuse.com/api/) (live probe)
- Datamuse's own page lists "Spanish" as its only recent vocabulary addition. — [Datamuse API](https://www.datamuse.com/api/)

**Rhyme websites (no API; scraping-only)**
- Dicio (dicio.com.br) has editorial rhyme articles such as "Palavras que rimam com amor" (HTTP 200). They are hand-written lists by a teacher, labelled "rimas perfeitas", rather than a queryable rhyme engine. The URL pattern `/rimas-com-coracao/` returned 404. — [Dicio: palavras que rimam com amor](https://www.dicio.com.br/palavras-que-rimam-com-amor/), [Dicio: palavras que rimam](https://www.dicio.com.br/palavras-que-rimam/)
- Dicio's robots.txt is `Allow: /`, disallowing only `/backoffice/`. Its terms page has no explicit scraping or commercial clause, only "Todos os direitos reservados" (© 2009–2026 7Graus) and "content is for informational purposes only". — [dicio robots.txt](https://www.dicio.com.br/robots.txt), [Dicio Termos de Uso](https://www.dicio.com.br/termos-de-uso.html)
- rimas.mobi and dicionariodesinonimos.com.br did not respond (connection failure, code 000) on 2026-10-25. rimador.net returned 200, but I did not inspect its content or terms. — live probes
- Infopédia (Porto Editora) appears in searches only as dictionary entries for "rima/rimas". I found no rhyme tool or API. — [Infopédia: rimas](https://www.infopedia.pt/dicionarios/lingua-portuguesa/rimas)

**Pronunciation and phonetic lexicons**
- **WikiPron** (CUNY-CL), code under Apache 2.0, repo active (last push 2026-07-23). Its README says the scraped data has "its own licensing terms", linking to Wiktionary:Copyrights, which is CC BY-SA. — [WikiPron README](https://github.com/CUNY-CL/wikipron)
  - Files per the repo's `summary.tsv`: `por_latn_bz_broad.tsv` 188,055 rows (Brazil, broad); `_filtered` 187,755; `por_latn_bz_narrow` 107,965; `por_latn_po_broad` 87,240 (Portugal); `por_latn_po_broad_filtered` 59,043; `por_latn_po_narrow` 33,280. — [WikiPron summary.tsv](https://github.com/CUNY-CL/wikipron/blob/master/data/scrape/summary.tsv)
  - I downloaded `por_latn_bz_broad.tsv`: 5,619,586 bytes, 188,055 lines, **0 stress marks (ˈ)**. Stress was stripped in the published scrape. A word has several rows for regional variants, e.g. `amor` → `a m o ɻ / a m o ɾ / a m o ʁ`; `gosto` → 6 variants with o/ɔ and s/ʃ; `olho` → `o ʎ o / ɔ ʎ o / …`; `coração` → `k o ɾ a s ɐ̃ w̃`. — [por_latn_bz_broad.tsv](https://raw.githubusercontent.com/CUNY-CL/wikipron/master/data/scrape/tsv/por_latn_bz_broad.tsv) (downloaded and inspected)
- **en.wiktionary Rhymes:Portuguese** has a category tree of rhyme pages keyed by IPA from the stressed vowel, e.g. `Rhymes:Portuguese/ɛs`, `Rhymes:Portuguese/oʎo`, `Rhymes:Portuguese/ejs`. It is queryable through the MediaWiki API (`list=categorymembers`), which responded. — [Rhymes:Portuguese/ɛs](https://en.wiktionary.org/wiki/Rhymes:Portuguese/%C9%9Bs), MediaWiki API probe
- **Kaikki / Wiktextract** (machine-readable en.wiktionary): the Portuguese dictionary lists 425,855 distinct word forms with JSONL per word, including senses, examples, translations and pronunciation fields. Probed `kaikki.org/dictionary/Portuguese/meaning/s/sa/saudade.jsonl`, which returned 200 with full JSON. Content is CC BY-SA as Wiktionary-derived. — [Kaikki Portuguese](https://kaikki.org/dictionary/Portuguese/)
- **Portal da Língua Portuguesa: Dicionário Fonético** (ILTEC). In its own words: "ainda em versão de teste", indicative phonetic transcription for "cerca de 70 000 palavras do VOP" across varieties (Africa, Asia, Europe, South America). It comes from the LUPo project (Léxico Unisyn do Português). The site says "Todo o conteúdo do Portal é de livre acesso". I found **no licence or download** for the data; it looks web-lookup only. — [Portal da Língua Portuguesa](http://www.portaldalinguaportuguesa.org/), [VOP presentation, ILTEC 2010](https://iilp.cplp.org/wp-content/uploads/2022/04/Apresentacao-do-VOP-Brasilia-2010-1.pdf)
- **Montreal Forced Aligner Portuguese (Brazil) dictionary v2.0.0**: pronunciation dictionary licensed "CC BY 4.0". This is a more permissive alternative to WikiPron (no share-alike). I did not verify its size or whether it marks stress. — [MFA pt-BR dictionary v2.0.0](https://mfa-models.readthedocs.io/en/latest/dictionary/Portuguese/Portuguese%20%28Brazil%29%20MFA%20dictionary%20v2_0_0.html)
- **FalaBrasil G2P** (UFPA): Docker image and GitLab source `gitlab.com/fb-nlp/nlp-generator`, about 4 years old. The listing states no licence. — [Docker Hub falabrasil/g2p](https://hub.docker.com/r/falabrasil/g2p), [FalaBrasil on Hugging Face](https://huggingface.co/falabrasil)
- **jcsilva/multilingual-g2p**: espeak-based, Brazilian Portuguese by default; its bundled spelling dictionary is LGPL 2.1. — [multilingual-g2p](https://github.com/jcsilva/multilingual-g2p)
- **kokorog2p** has a Portuguese G2P module (documentation only; licence not checked). — [kokorog2p Portuguese API](https://kokorog2p.readthedocs.io/en/latest/api/portuguese.html)
- An Interspeech 2014 paper (Mendonça et al.) describes building a machine-readable pronunciation dictionary for Brazilian Portuguese. I did not confirm its availability or licence. — [ISCA Interspeech 2014](https://www.isca-archive.org/interspeech_2014/mendonca14_interspeech.html)
- Dicionário Aberto entries sometimes contain a partial `<pron>` (e.g. saudade → `<pron extent="part">sa-u</pron>`), but only sporadically. — live probe of `api.dicionario-aberto.net/word/saudade/1`

**Spelling-based candidate generation (works today)**
- Dicionário Aberto's API has a `suffix/{ending}` endpoint (probed `suffix/ação` → JSON list of headwords ending in -ação with previews) plus `prefix/`, `infix/`, `near/` (edit-distance neighbours: `near/casa` → asa, basa, caba, cama, capa, cara, casca, caso, causa…) and `browse/`. These are usable for building rhyme candidate sets or a sounds-like fallback. — live probes of api.dicionario-aberto.net

### Inferences
- **Spelling-only rhyme reliability.** This is my linguistic reasoning, not a sourced study, and should be checked with a native speaker. Portuguese spelling marks stress whenever it departs from the default, so the stressed syllable can be found from spelling by rule. Unaccented paroxytones end in a/e/o(s)/am/em/ens; words ending in other letters default to oxytone. Spelling does **not** give vowel quality, and that is where it breaks:
  - unaccented e/o can be open or closed: gosto (n., ô) vs gosto (v., ó); olho n./v.; "amor" [ô] vs "flor" [ô] vs "pó"
  - ão/am/õe nasal diphthongs (coração ↔ mão ↔ falam: the -am verb ending sounds [ɐ̃w̃] in BR)
  - pt-BR coda l→[w], so "mal" rhymes with "mau"
  - pt-BR final -e→[i], -o→[u], and de/te palatalisation
  - pt-PT heavy reduction of unstressed vowels
  - x has four values
  
  The WikiPron variant rows (o/ɔ for "gosto", "olho") show this ambiguity directly. A spelling rhyme will therefore over-match é/ê and ó/ô pairs. Songwriters often treat those pairs as acceptable rhymes anyway, so the result is less harmful as a "near rhyme" tier.
- **Recommended design.** Bundle a compressed pt-BR IPA table built from WikiPron or the MFA dictionary, keyed word → rhyme tail. A few MB is enough; 5.6 MB raw for all 188k BR rows should gzip to about 1–1.5 MB. Restrict the table to the frequency-list top ~50k words. Restore stress with the spelling stress rule, because WikiPron strips it. Fall back to spelling rules for out-of-lexicon words. Near rhyme = same stressed vowel + same following vowels (assonance, which is the dominant rhyme in Lusophone popular song). Consonance = same consonant skeleton after the stressed vowel. Sounds-like can use Dicionário Aberto `near/` or local edit distance over IPA.
- **Licence choice.** WikiPron or Kaikki data is CC BY-SA. Bundling it means attribution, plus share-alike on the derived *data file*, but not on the app code. MFA's CC BY 4.0 avoids share-alike. Neither requires a Worker proxy.

### Gaps
- I found no reliable source on whether rimas.mobi, rimador.net, rimas.app or "Rimador" sites offer an API or what their terms are; the hosts were unreachable or uninspected.
- I did not confirm the MFA pt-BR dictionary's word count, stress marking, or pt-PT counterpart.
- The Portal da Língua Portuguesa Dicionário Fonético licence and any bulk download are unknown; I found no terms page.
- Licence for the FalaBrasil G2P / nlp-generator is unverified.
- I found no published evaluation of spelling-based rhyme accuracy for Portuguese.

## Similar meaning, synonyms, opposites, related words, describing words, kinds of, parts of (thesaurus and wordnet sources)

### Takeaway
Four open sources cover the meaning modes. OpenWordNet-PT (CC BY 4.0, new v1.1.0 release April 2026) gives hyponyms ("kinds of"), meronyms ("parts of") and similar words via PWN-projected synset relations, but only 517 antonym links. Onto.PT and CONTO.PT (CC BY 3.0, last updated 2018) merge PAPEL, TeP, Dicionário Aberto, Wikcionário, OpenThesaurus.PT and OWN-PT into larger synset and relation sets. PAPEL 3.5 (191k relation triples incl. antonymy and part/member meronymy) is "público, grátis" but has no explicit licence and is derived from a Porto Editora dictionary. TeP 2.0 (NILC) has synonyms and antonyms for pt-BR, but its site is partly broken and its licence is unverified. Commercial sites (Sinônimos.com.br, Dicio) prohibit extraction, and I found no commercial thesaurus API for Portuguese. "Describing words" (adjectives for a noun) and "related/triggered" words have no good lexical source; they need corpus co-occurrence or the existing LLM Worker.

### Cited Findings
**OpenWordNet-PT (OWN-PT)**
- LICENSE: "licensed under the Creative Commons Attribution 4.0 International License". Built on Princeton WordNet 3.0, which is under the separate Princeton licence. — [OWN-PT LICENSE](https://github.com/own-pt/openWordnet-PT/blob/master/LICENSE)
- Repo not archived; last push 2026-04-19. Release **v1.1.0 (2026-04-19)** assets: `own-pt-2026.04.07.tar.xz` 2.27 MB, `own-en-2026.04.07.tar.xz` 8.5 MB, `pt-cygnet.db.gz` 30.5 MB, `pt-provenance.db.gz` 22.9 MB. The earlier v1.0.0 (2021-09-21) included LMF XML. — [OWN-PT releases](https://github.com/own-pt/openWordnet-PT/releases) (GitHub API)
- Statistics: 59,211 words, 83,762 senses, 52,670 synsets (35,572 noun; 8,197 verb; 3,344 adj + 3,591 adj-satellite; 1,966 adv). — [OWN-PT statistics.org](https://github.com/own-pt/openWordnet-PT/blob/master/statistics.org)
- Relations (senses / synsets):

  | Relation | Count | Word Finder mode |
  |---|---|---|
  | antonymOf | 517 (sense-level only; PWN has 7,979) | opposites |
  | hypernymOf / hyponymOf | 89,089 | kinds of |
  | partMeronymOf | 9,097 | parts of |
  | memberMeronymOf | 12,293 | parts of |
  | substanceMeronymOf | 797 | parts of |
  | similarTo | 21,386 | similar meaning |
  | attribute | 1,278 | describing words (thin) |
  | entails | 408 | |
  | causes | 220 | |
  | derivationallyRelated | 0 in PT | |

  — [OWN-PT statistics.org](https://github.com/own-pt/openWordnet-PT/blob/master/statistics.org)
- CHANGES: the 2021 v1.0.0 note says "relations from English PWN projected to Portuguese". Synset relations are inherited from English, not curated for Portuguese. — [OWN-PT CHANGES](https://github.com/own-pt/openWordnet-PT/blob/master/CHANGES)
- OWN-PT is the Portuguese wordnet in the Open Multilingual Wordnet; FreeLing has a version. — [OWN-PT README](https://github.com/own-pt/openWordnet-PT)
- Background papers: modelled after and interoperable with Princeton WordNet; developed by FGV/IBM Research (Rademaker, de Paiva et al.). The dialect is effectively pt-BR. — [OpenWordNet-PT: a project report (FGV)](https://repositorio.fgv.br/items/c8d99d3b-465f-4ed6-8eb4-b7cb7723efa8/full), [ACL W14-0153](https://aclanthology.org/W14-0153.pdf)

**Onto.PT and CONTO.PT (Univ. Coimbra, Hugo Gonçalo Oliveira)**
- Onto.PT v0.6 (Aug 2013), WordNet RDF/OWL schema, RDF/XML and N3 downloads. About 156k lexical forms, about 117k synsets (67,873 N / 26,451 V / 20,760 Adj / 2,366 Adv), and more than 173k semantic relation instances (PAPEL 3.0 relation types). Extracted from Porto Editora's Dicionário PRO 2005 (via PAPEL), Dicionário Aberto, Wikcionário.PT, TeP 2.0, OpenWordNet-PT and OpenThesaurus.PT. Licence: "Creative Commons Attribution 3.0 Unported" (Universidade de Coimbra). Page last updated July 2018. — [Onto.PT download](https://ontopt.dei.uc.pt/index.php?sec=download_ontopt)
- CONTO.PT 0.1 is a fuzzy wordnet with a confidence value per decision, so a confidence cutoff can be applied. It has about 34,000 fuzzy synsets and about 459,254 relations, built from 7 resources (PAPEL, Dicionário Aberto, Wikcionário.PT, TeP, OpenThesaurus.PT, OpenWordNet-PT, PULO). Format: zip (`recursos/CONTO.PT.01.zip`) in a "non-standard" format. Licence: CC BY 3.0 Unported. — [CONTO.PT](https://ontopt.dei.uc.pt/index.php?sec=contopt)
- Other downloads on the "Outros recursos" page:
  - relation triples from 10 resources (PAPEL, Dicionário Aberto, Wikcionário.PT, TeP, OpenThesaurus.PT, OWN-PT, PULO, Port4Nooj, Wordnet.Br, ConceptNet)
  - PT-LKB node2vec word embeddings (dim 64/128)
  - fuzzy thesaurus from 5 resources
  - TePOT (TeP + OpenThesaurus)
  - CLIP, TOP
  - Onto.PT synsets with sentiment polarities (from SentiLex-PT)
  
  — [Onto.PT outros recursos](https://ontopt.dei.uc.pt/index.php?sec=download_outros)
- Status: the project has not been updated since 2018, but the downloads were reachable on 2026-10-25. — same pages

**PAPEL (Linguateca)**
- "criado pela Linguateca a partir do Dicionário PRO de Língua Portuguesa da Porto Editora através de um protocolo de colaboração". It is described as "público, grátis e utilizável por todos os actores de processamento da língua que o quiserem usar".
- Coverage: PAPEL v3.5 has relations among about 102k words, about 191k relation instances (about 83k synonymy, about 49k hyponymy).
- Download: `PAPEL.v.3.5_utf8.zip`, in "palavra RELACAO palavra" format. Last version from 2013.

— [PAPEL (Linguateca)](https://www.linguateca.pt/PAPEL/papel.html)
- The LEIAME lists relation types incl. meronymy split into PARTE, MEMBRO, CONTIDO and MATERIAL (from v3.0) and `ANTONIMO_ADJ_DE` (pattern "que não é"). I found **no licence statement** in the LEIAME. — [PAPEL LEIAME](https://www.linguateca.pt/PAPEL/LEIAMEiso.txt)

**TeP 2.0 (NILC/USP + UNESP), pt-BR**
- A wordnet-like resource for Brazilian Portuguese with synonym and antonym relations. The Portulan CLARIN entry points to `nilc.icmc.usp.br/tep2/download.htm`. — [Portulan CLARIN: TeP 2.0](https://portulanclarin.net/repository/browse/thesaurus-for-portuguese-version-20/86bf0708284511eb8a2502420a0004110cff28a259e84cdca2dd0212a6e7c07a/)
- Live status 2026-10-25:
  - `nilc.icmc.usp.br/tep2/` and `/tep2/download.htm` returned **404**
  - `/tep2/index.htm` loads a search UI (categories, "Mostrar Antônimos"; credits Dias da Silva, Pardo, Hasegawa, Maziero)
  - Portulan CLARIN was "Under maintenance"
  
  — live probes; [TeP 2.0 interface](https://www.nilc.icmc.usp.br/tep2/index.htm)
- TeP was built from conventional dictionaries. — [Dias-da-Silva & Moraes, Alfa 2003](https://periodicos.fclar.unesp.br/alfa/article/view/4244)
- A 2012 LREC paper calls it "freely available". This is not a licence statement. — [paperswithcode (LREC 2012)](https://astro.paperswithcode.com/author/vitor-rocio)

**OpenThesaurus.PT / LibreOffice Portuguese thesaurus**
- `mythes-pt` distro packages list the licence as GPLv2+, with upstream `openthesaurus.caixamagica.pt`. This is packaging metadata, not the upstream file. — [mythes-pt repoview](https://spiegel.nikhef.nl/mirror/scientificlinux.org/7.8/x86_64/os/repoview/mythes-pt.html)
- A LibreOffice bug proposes a new pt-PT thesaurus merging OpenThesaurus + PAPEL + ONTO.PT ("nearly quadruples the amount of words"). — [LibreOffice bug 101616](https://www.libreoffice.org/bugzilla/show_bug.cgi?id=101616)
- I could not read git.libreoffice.org: it sits behind an Anubis anti-bot wall. — live probe

**Commercial sites (no API; terms forbid extraction)**
- Sinônimos.com.br (7Graus), Termos de Uso dated 12 Aug 2026. Not permitted: "Copiar, extrair ou redistribuir o conteúdo do dicionário, os verbetes e as listas de sinônimos, no todo ou em parte" and "Utilizar os serviços para construir, treinar ou alimentar produtos ou serviços concorrentes". Its robots.txt is `Allow: /`, but the ToS still governs. — [Sinônimos Termos de Uso](https://www.sinonimos.com.br/termos-de-uso/)
- Dicio is the same company (7Graus, footer © 2009–2026). Its terms page has no explicit clause, only "Todos os direitos reservados". — [Dicio Termos de Uso](https://www.dicio.com.br/termos-de-uso.html)
- Priberam: Lisbon dictionary publisher; 155,180 entries + 8,683 locutions (2019). Offers a free website and an Office add-in. I found no public API or pricing. — [Wikipedia: Priberam](https://en.wikipedia.org/wiki/Priberam), [Sul Informação 2019](https://www.sulinformacao.pt/en/2019/03/o-priberam-faz-10-anos/), [AppSource add-in](https://appsource.microsoft.com/en-us/product/saas/wa104379861)

**ConceptNet (related/triggered words)**
- Onto.PT's 10-resource triples include ConceptNet PT. — [Onto.PT outros recursos](https://ontopt.dei.uc.pt/index.php?sec=download_outros)
- Probe of `api.conceptnet.io/c/pt/casa` returned **502** on 2026-10-25. — live probe

### Inferences
- **Best licence-clean stack for a commercial app:** OWN-PT (CC BY 4.0) + Onto.PT or CONTO.PT (CC BY 3.0). Both need attribution only, with no share-alike, so the derived bundle can be shipped freely with an Acknowledgements line.
  - "kinds of" = OWN-PT hyponymOf / Onto.PT hiperonímia
  - "parts of" = OWN-PT part/member/substance meronyms + PAPEL PARTE_DE / MEMBRO_DE (if PAPEL is accepted)
  - synonyms = synset co-members, ranked by CONTO.PT confidence
  - opposites = OWN-PT's 517 antonyms + Onto.PT/PAPEL antonym relations
  
  Coverage of opposites will be thin without TeP or PAPEL.
- **Upstream licences inside the CC BY data are mixed.** Onto.PT and CONTO.PT already ingest PAPEL (Porto Editora-derived), TeP and Wikcionário.PT (CC BY-SA). Their CC BY 3.0 label therefore sits on top of upstream sources with mixed or unclear licences. The risk is low for an app, but it should be noted.
- PAPEL's Porto Editora origin and lack of a written licence make it the riskiest open source for commercial use. If it is included, get written permission from Linguateca/CISUC.
- **"Describing words" and "related/triggered":** no lexical source covers adjective-for-noun well (OWN-PT `attribute` is only 1,278). Options:
  1. Mine adjective–noun co-occurrence from a corpus that permits commercial use, e.g. OpenSubtitles bigrams. OPUS licence terms were not checked here.
  2. Use the PT-LKB node2vec embeddings for "related".
  3. Route these modes through the existing paid LLM Worker, as Hebrew does.
- **Dialect.** OWN-PT and TeP are essentially pt-BR; Onto.PT, PAPEL and OpenThesaurus.PT lean pt-PT. Expect spelling mismatches across the 1990 Acordo Ortográfico (e.g. "acção/ação", "projecto/projeto"). Normalise spelling before merging.

### Gaps
- TeP 2.0 licence and a live download URL are unknown: the NILC pages 404 and Portulan was in maintenance. The LREC citation only says "freely available".
- PAPEL licence is unknown beyond the "público, grátis" prose. The PJR (FAQ) page did not yield licence text in my grep.
- The upstream licence file for OpenThesaurus.PT is unverified; there is only GPLv2+ distro metadata.
- I found no information on commercial thesaurus or dictionary APIs or pricing from Priberam, Porto Editora (Infopédia), Michaelis (Melhoramentos) or Aulete. None showed a public API in searches; licensing would require contacting them.
- ConceptNet API availability: one 502 probe. I did not check whether the API is permanently down or the downloadable assertions dump is still hosted.

## Definitions ("hold a word to see its definition")

### Takeaway
Dicionário Aberto's free JSON API works today (probed). It is CC BY-SA 2.5 Portugal, but the content is a 1913-era Cândido de Figueiredo dictionary with archaic pt-PT spelling and senses, a poor fit for pt-BR songwriters. The modern option is Wiktionary: Kaikki/Wiktextract JSONL bundles (English glosses from en.wiktionary; 425k Portuguese forms) or pt.wiktionary via the MediaWiki action API (Portuguese glosses). The pt.wiktionary REST `definition` endpoint is not available (501). Wiktionary content is CC BY-SA, so it needs attribution, and share-alike applies to the redistributed definition data.

### Cited Findings
- **Dicionário Aberto API** (`api.dicionario-aberto.net`), all probed with HTTP 200:
  - `word/{w}` → JSON with a TEI-like XML entry. Example `casa`: "Edifício para habitação…", creator "ambs".
  - `word/{w}/{n}` → a specific sense.
  - `near/{w}` → edit-distance neighbours.
  - `prefix/`, `suffix/`, `infix/` → headword lists with HTML previews.
  - `browse/{w}` → alphabetical neighbours with ids.
  - `random`
  
  I found no API key or rate-limit documentation. — live probes
- Licence shown on the site footer: "This work is licensed under a Creative Commons Attribution-Share Alike 2.5 Portugal License", maintained by Alberto Simões (Univ. Minho), with support from Biblioteca Nacional de Portugal and Distributed Proofreaders. — [Dicionário Aberto](https://dicionario-aberto.net/)
- A 2010 description called it "public domain"; the current site says CC BY-SA 2.5 PT, so the two conflict and the live site should be followed. — [oasisbr record](https://oasisbr.ibict.br/vufind/Record/RCAP_c9070207bb97a032edfc5d378d79afee?lng=en)
- The source text is Cândido de Figueiredo's *Novo dicionário da língua portuguesa* (Gutenberg #31552, credited to Alberto Simões and Distributed Proofreaders), public domain in the USA. Figueiredo lived 1846–1925. — [Project Gutenberg #31552](https://www.gutenberg.org/ebooks/31552), [Wikipedia: Cândido de Figueiredo](https://en.wikipedia.org/wiki/C%C3%A2ndido_de_Figueiredo)
- An old npm wrapper `dicionario-aberto` (MIT) used an older base URL (`dicionario-aberto.net/search-json`); it is superseded by `api.` as probed. — [npm dicionario-aberto](https://npmjs.com/package/dicionario-aberto)
- **pt.wiktionary:**
  - `pt.wiktionary.org/api/rest_v1/page/definition/casa` → **501** (the definition endpoint is only enabled on en.wiktionary).
  - `pt.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=saudade` → 200 with plain-text sections (e.g. "Substantivo / sau.da.de, feminino / memória ou recordação grata…"). The syllabification is useful for stress. Parsing is needed.
  
  — live probes
- **en.wiktionary REST** `page/definition/saudade` → 200 JSON (English-language glosses). — live probe
- **Kaikki.org Portuguese:** 425,855 distinct word forms; per-word JSONL with senses, examples, quotations and translations (probed "saudade"). Whole-language downloads are available. — [Kaikki Portuguese](https://kaikki.org/dictionary/Portuguese/)
- Wiktionary text is CC BY-SA (other terms may apply for media). — [Wiktionary-derived page licence note](https://wiki.neonvagabond.xyz/content/wiktionary_en_all_nopic_2024-05/A/Novaes); see also [WikiPron README → Wiktionary:Copyrights](https://github.com/CUNY-CL/wikipron)
- **OWN-PT** carries Portuguese glosses on some synsets, and Onto.PT v0.6 added "Atribuição de definições a synsets". — [Onto.PT download](https://ontopt.dei.uc.pt/index.php?sec=download_ontopt)
- **Priberam, Michaelis, Aulete, Infopédia:** I found no public API (see the thesaurus section).

### Inferences
- **Recommended definitions approach.** Use pt.wiktionary through a Cloudflare Worker that fetches `action=query&prop=extracts`, trims to the first 1–2 senses, and caches in KV. Wikimedia asks for a descriptive User-Agent, and the Worker makes caching and UA control easy. Show "Wikcionário · CC BY-SA" attribution in the definition sheet. Dicionário Aberto is a fallback only; its 1913 senses (e.g. "fato" for suit, "taboleiro") will read as antique to Brazilians. A bundled Kaikki extract would give English glosses, which is wrong for a Portuguese UI unless the app's UI is English.
- Live calls to Dicionário Aberto from the app are technically possible: it is unauthenticated JSON. The service is a single academic maintainer's, so a Worker cache is advisable for reliability.

### Gaps
- I found no published rate limits or usage policy for api.dicionario-aberto.net.
- No reliable source on whether pt.wiktionary has a structured (Wiktextract-style) Portuguese-language dump comparable to Kaikki's en.wiktionary extraction. I did not check kaikki.org's "Portuguese edition" extraction.
- Commercial definition licences (Priberam, Michaelis/Melhoramentos, Porto Editora): there is no public information, so the companies would need to be contacted.

## Frequency lists for ranking

### Takeaway
hermitdave/FrequencyWords (OpenSubtitles 2018) has separate `pt` and `pt_br` lists, is live, and is the easiest choice. It is MIT for code and **CC BY-SA 4.0 for content**, the same licensing as the Spanish list SongNook likely uses. Leipzig Corpora downloads carry conflicting CC BY vs non-commercial language and need written consent for commercial use. Corpus do Português licences forbid redistributing word lists. Subtitle-based frequency suits song lyrics' conversational register well.

### Cited Findings
- **FrequencyWords:** `content/2018/pt/pt_50k.txt` and `content/2018/pt_br/pt_br_50k.txt` both returned 200. Format is `word count` (pt_br top: que 15,044,152 / não 12,169,729 / o / de / a). README: "MIT License for code. CC-by-sa-4.0 for content." Source data is OpenSubtitles2018 via OPUS. Repo last push 2022-02-07, so it is static but stable. — [FrequencyWords](https://github.com/hermitdave/FrequencyWords), live probes
- **Leipzig Corpora Collection:** the terms say the download corpora are under CC BY, but also "free of charge for private and scientific use under CC BY-NC" and "commercial use … prohibited without the written consent of the project management". Contact: wort@informatik.uni-leipzig.de. The site now sits behind an Anubis anti-bot wall, which blocked my fetch. — [Wortschatz Leipzig Terms of Usage](https://wortschatz.uni-leipzig.de/en/usage), [data.gov.dk mirror metadata](https://sprogressource.digst.govcloud.dk/dataset/leipzig-corpora-collection)
- **Corpus do Português (Mark Davies):** institutional licences are research-oriented, and the restrictions include "you cannot create a large word list or set of n-grams, and then distribute this to others". — [UVA Library: Corpus do Português](https://library.virginia.edu/data/datasources/licensed/corpus-do-portugues), [Columbia linguistics guide](https://guides.library.columbia.edu/linguistics/full-text-corpus-data)
- **English-Corpora.org** offers Portuguese 20k frequency-list samples; full lists are for purchase. — [English-Corpora frequency lists](https://www.english-corpora.org/word_frequency.asp)
- **Lexical Computing (Sketch Engine)** sells Portuguese frequency lists from an approximately 17-billion-word corpus, with custom lists on request (commercial). — [Lexical Computing: Portuguese word frequency lists](https://lexicalcomputing.com/?p=1249)
- **P-PAL:** a European Portuguese lexical database on a corpus of more than 227M words. Licence not checked. — [Lexical Computing page mentioning P-PAL](https://lexicalcomputing.com/?p=1249)

### Inferences
- Use `pt_br_50k` as the primary ranker and `pt_50k` for the pt-PT variant. Two 50k lists are about 1 MB raw (not measured) and gzip well.
- **Share-alike scope.** CC BY-SA 4.0 on the list means a derived ranked word list shipped in the app must also be CC BY-SA, with attribution. Ranking order computed at runtime from it is the same situation as the Spanish build, so whatever SongNook decided there applies here.
- Linguateca/CETENFolha frequency lists exist (Folha de S.Paulo corpus), but I did not reach a licence page. Treat them as unverified and likely research-only.

### Gaps
- Linguateca CETENFolha / AC/DC frequency-list licence: not reached.
- OPUS OpenSubtitles upstream terms, relevant if building custom bigrams for "describing words": not checked.
- P-PAL licence: not checked.

## Per-source summary: commercial use, attribution, share-alike, need for a Worker proxy

### Takeaway
A fully commercial-safe pt-BR Word Finder can be built from bundled open data:
- rhyme: WikiPron (CC BY-SA) or MFA (CC BY) IPA + FrequencyWords (CC BY-SA)
- meaning: OWN-PT (CC BY) + Onto.PT/CONTO.PT (CC BY)
- definitions: pt.wiktionary via a caching Worker (CC BY-SA)

Every source needs an attribution line. Nothing requires an API key. Only definitions benefit from a Worker. The weak modes are opposites, "describing words" and "related/triggered"; those are LLM-Worker or corpus-mining candidates.

### Cited Findings

| Source | Modes | Access (probed 2026-10-25) | Licence | Commercial | Attribution / share-alike | Worker? |
|---|---|---|---|---|---|---|
| Datamuse | none | `v=pt` returns English | n/a | n/a | n/a | n/a |
| WikiPron pt-BR/pt-PT TSV ([repo](https://github.com/CUNY-CL/wikipron)) | rhyme, near rhyme, sounds-like, consonance | static TSV, 5.6 MB BR broad; stress stripped | data CC BY-SA (Wiktionary), code Apache-2.0 | yes | yes / SA on the data file | no (bundle) |
| MFA pt-BR dictionary ([docs](https://mfa-models.readthedocs.io/en/latest/dictionary/Portuguese/Portuguese%20%28Brazil%29%20MFA%20dictionary%20v2_0_0.html)) | same | download | CC BY 4.0 | yes | attribution only | no |
| en.wiktionary Rhymes:Portuguese ([page](https://en.wiktionary.org/wiki/Rhymes:Portuguese/%C9%9Bs)) | rhyme validation | MediaWiki API 200 | CC BY-SA | yes | yes / SA | optional |
| Portal da Língua Portuguesa fonético ([site](http://www.portaldalinguaportuguesa.org/)) | pronunciation (~70k, multi-variety) | web lookup only, "test version" | none found | unclear | unclear | n/a |
| Dicionário Aberto API ([site](https://dicionario-aberto.net/)) | definitions, suffix/near lists | JSON 200, no key | CC BY-SA 2.5 PT | yes | yes / SA | recommended (cache) |
| OWN-PT v1.1.0 ([LICENSE](https://github.com/own-pt/openWordnet-PT/blob/master/LICENSE)) | synonyms, kinds of, parts of, similar, few antonyms | release tarball 2.3 MB | CC BY 4.0 (+ PWN licence) | yes | attribution only | no |
| Onto.PT v0.6 / CONTO.PT 0.1 ([download](https://ontopt.dei.uc.pt/index.php?sec=download_ontopt), [CONTO](https://ontopt.dei.uc.pt/index.php?sec=contopt)) | synonyms, hypernyms, parts, antonyms, confidence | zip/RDF, reachable; stale since 2018 | CC BY 3.0 | yes | attribution only | no |
| PAPEL 3.5 ([page](https://www.linguateca.pt/PAPEL/papel.html)) | synonyms, hyponyms, PARTE/MEMBRO, antonyms | zip reachable | no explicit licence ("público, grátis"); Porto Editora-derived | uncertain; ask | attribution expected | no |
| TeP 2.0 ([UI](https://www.nilc.icmc.usp.br/tep2/index.htm)) | synonyms, antonyms (pt-BR) | download 404 | not found | uncertain | unknown | no |
| OpenThesaurus.PT / mythes-pt ([repoview](https://spiegel.nikhef.nl/mirror/scientificlinux.org/7.8/x86_64/os/repoview/mythes-pt.html)) | synonyms (pt-PT) | distro package | GPLv2+ (metadata) | GPL obligations make bundling awkward | yes / copyleft | no |
| Sinônimos.com.br / Dicio ([ToS](https://www.sinonimos.com.br/termos-de-uso/)) | synonyms, antonyms, rhymes | HTML only | ToS forbids extraction | no | n/a | n/a |
| pt.wiktionary action API | definitions (pt) | 200; REST definition 501 | CC BY-SA | yes | yes / SA | yes (cache, UA) |
| Kaikki Portuguese ([site](https://kaikki.org/dictionary/Portuguese/)) | English glosses, IPA, examples | JSONL 200 | CC BY-SA | yes | yes / SA | no (bundle) |
| FrequencyWords pt / pt_br ([repo](https://github.com/hermitdave/FrequencyWords)) | ranking | raw files 200 | content CC BY-SA 4.0 | yes | yes / SA | no |
| Leipzig Corpora ([terms](https://wortschatz.uni-leipzig.de/en/usage)) | ranking, co-occurrence | Anubis-gated | CC BY vs CC BY-NC conflict | needs written consent | yes | no |
| Corpus do Português ([UVA](https://library.virginia.edu/data/datasources/licensed/corpus-do-portugues)) | ranking | licensed | no redistribution of lists | no (without a deal) | n/a | n/a |
| ConceptNet API | related | 502 | CC BY-SA 4.0 (general knowledge, not verified here) | yes | yes / SA | n/a |

### Inferences
- **Mode-by-mode recommendation for pt-BR:**
  - **Rhymes:** IPA-lexicon rhyme tail with frequency ranking.
  - **Near rhymes:** assonance on the IPA vowels from the stressed syllable on. This is culturally central in Portuguese/Brazilian song.
  - **Sounds-like and consonance:** IPA edit distance / consonant skeleton.
  - **Synonyms:** OWN-PT + CONTO.PT synsets.
  - **Opposites:** OWN-PT antonyms + Onto.PT/PAPEL antonym relations; LLM fallback.
  - **Kinds of / parts of:** OWN-PT hyponyms and meronyms.
  - **Similar meaning:** synsets + similarTo, or the PT-LKB embeddings.
  - **Related/triggered and describing words:** the LLM Worker, as for Hebrew.
  - **Definitions:** pt.wiktionary via a Worker.
- Share-alike obligations attach to redistributed data, not to SongNook's app code. A combined bundled data file mixing CC BY-SA sources would need to be offered under CC BY-SA, with an Acknowledgements screen listing every source.

### Gaps
- PAPEL, TeP and OpenThesaurus.PT licences need direct confirmation from their maintainers before commercial inclusion.
- The ConceptNet licence and API status were not verified in this session.
- No source gave a Portuguese commercial thesaurus or dictionary API with published pricing; none was found.
