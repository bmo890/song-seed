# Feature audit 2026-11-13

Six area reports read from code at 2442cd38, as written by the readers. NOT yet cross-checked or merged into one page; the flagged lines in each file (\"Worth a decision\", \"Not sure\") still need verifying against the code before the founder decides anything from them.

- 01 capture, import, instruments (230 rows)
- 02 library and organising (335)
- 03 player, practice, layers, editor (289)
- 04 words, charts, stage (392)
- 05 sharing, data, settings, Pro (328)
- 06 every public claim about features, free and Pro (121)

## The page for the founder

Published as an artifact: https://claude.ai/artifact/QccRZXBJoCuLErzKd3xCso ("SongNook Feature Ledger").
1,579 rows: 1,457 free, 84 Pro, 35 free up to a limit, 3 plans. It opens with the fourteen
paid lines and nineteen numbered decisions, each with a recommendation; the founder answers
by number. `page/parse.py` turns reports 01 to 05 into the page's data and `page/template.html`
is the page (the decisions, the unreachable list and the stale-wording list are written by
hand in the template). Decisions are recorded in `../pricing-and-marketing.md` as they are made.

Confirmed a second time in code on 2026-11-13: the recorder has no Pro check (pins there are
free); only the + button checks the workspace limit; `PRO_FOR_ALL="true"` and
`APP_SEND_ENFORCED="false"` in the Send worker's `wrangler.toml`; tempo detection's row is
hidden (`PlayerPracticeDrawers.tsx`, note of 2026-10-13); archiving is shelved
(`useWorkspaceListScreenModel.ts`, 2026-08-04); Recently deleted is 30 days, file trash 31.

## The page is a form (2026-11-14)

The founder asked to answer in one pass. The same artifact now carries, on every line, what it
is now, what I suggest, a choice and a note. Answers are saved in the artifact's own store,
collection `answers`, one document per answered line: ids `d01`–`d19` (decisions), `g01`–`g14`
(paid lines), `f<hash>` (a feature row; the hash comes from `page/parse.py`), `general`. Each
document carries `label`, `now`, `suggest`, `call` (`agree` / `different` / `skip`, or `free` /
`pro` / `limit` for a feature) and `note`, so it reads on its own. Read them with the
ArtifactData tool when the founder says they are done.
