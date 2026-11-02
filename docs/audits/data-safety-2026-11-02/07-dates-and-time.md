# 07 — Dates and time as data (second pass, 2026-11-02)

Audit at main @ 845f3bb8. Read-only. Scratch tests ran real code with `npx jest` under
`src/__audit_scratch__/` (deleted afterwards). Scope: every stored date, how it moves
through backup, merge, export/import, Send, copy/move/edit, and what a wrong clock or a
corrupt value does.

**Short answer to the founder.** Backups do not scramble dates. A backup or restore copies
every stored time exactly. Merge ("keep newer items") never compares dates at all, so a
backup from a phone with a wrong clock cannot overwrite anything. Activity comes back once,
not twice, and no stored date can crash the app. The real date problems are elsewhere:

1. **Hidden day groups are keyed to a moving target.** Hiding "Today", "Yesterday" or
   "Last week" undoes itself the next day. The leftover key later folds a whole month
   nobody hid. Revisit reads the same keys a different way, so ideas hidden in the list
   still come up in Revisit.
2. **Dates arriving from outside are never checked.** This covers a received parcel or an
   imported archive. A missing date stays broken forever, and future dates stick to
   "Today".
3. **The editor's Replace re-dates a take to the moment of the edit.** The take's recording
   date is then lost.

Already reported in the first pass and not repeated here: the clock and the Shelf/trash
(04 L2), Replace on a lone clip resetting its date (04 M5, L4), and Export missing the
activity history (02 G9). Finding M5 below adds what that last gap costs Revisit.

---

## HIGH

### H1. Hidden day groups undo themselves and later fold the wrong month
**Verified by running a scratch test** (America/New_York and Asia/Jerusalem).

A group's identity is its divider's `startTs`. For the relative groups, that value moves
every day. `src/domain/dateBuckets.ts:63-69, 87-95`:
```ts
yesterdayStart: todayStart - DAY_MS,
weekAgoStart: todayStart - 6 * DAY_MS,
...
if (ts >= weekAgoStart) {
    return { key: "last-week", label: i18n.t("time.lastWeek"), startTs: weekAgoStart };
```
Hiding stores that moving number as a permanent key.
`CollectionListSection.tsx:216-222`:
```ts
setTimelineDaysHidden(collectionIdRef.current, [{ metric, dayStartTs }], true);
```
`useCollectionScreenModel.ts:275` matches it against today's buckets:
```ts
if (hiddenDayKeySet.has(`${activeTimelineMetric}:${bucketStartTs}`))
```

Scratch test, hiding "Last week" on 7 Oct 2026 (key = 1 Oct 00:00):
- **8 Oct:** the same ideas are in "Last week" with `startTs` 2 Oct. They are no longer hidden.
- **15 Nov:** an idea from 20 Oct that was never hidden is in "Last month", `startTs` 1 Oct. The whole of October shows as one collapsed marker.
- **1 Mar 2027:** "October 2026", `startTs` 1 Oct, is still collapsed. This lasts forever.

Hiding "Today" on the 1st of a month collapses "This month" for the rest of that month
(test: `this-month true`).

- **Effect:** what the person hid comes back the next day. Months they never touched fold
  into one marker. Content stays reachable, because tapping the marker expands it. It looks
  like the app forgot what they did, and did something they didn't ask for.
- **Fix:** key hidden groups by what they contain. Store the hidden idea ids
  (`hiddenIdeaIds` already exists), or a stable calendar key for real calendar groups
  (`month-2026-9`). The bucket's `startTs` must never be stored. Write a one-time migration
  that drops `hiddenDays` keys that are not the 1st of a month.

### H2. Revisit treats hidden days differently, so hidden ideas come back in Revisit
**Verified by running a scratch test.**

Revisit tries to honour hidden groups, but it compares each idea's exact calendar day to
the key. `src/domain/revisit.ts:347-354`:
```ts
const createdKey = `created:${startOfActivityDay(getIdeaCreatedAt(idea))}`;
const updatedKey = `updated:${startOfActivityDay(getIdeaUpdatedAt(idea))}`;
return index.hiddenDayKeys.has(createdKey) || ...
```
The list's keys are group starts: the 1st of a month, a "last week" start, and so on. A
hidden "October" group therefore keeps only ideas from **1 October** out of Revisit.

Scratch test: two October ideas, October hidden. The list collapses both
(`[true, true]`). Revisit's workspace count still includes the 20 October idea (`count 1`),
so it stays eligible for the feed.

- **Effect:** a person who folds away a month of rough takes still gets them in Revisit.
  This is the kind of wrong surfacing the founder asked about.
- **Fix:** share one predicate between the list and Revisit. It falls out of the H1 fix:
  hidden idea ids, or the same group key computed the same way.

---

## MEDIUM

### M1. Hidden groups depend on the phone's time zone
**Verified by reading, plus a time-zone and DST computation.**

Keys are local-midnight milliseconds. 1 Oct 00:00 is `1790827200000` in New York and
`1790802000000` in Jerusalem. Restoring a backup on a phone set to another zone, or
travelling, means no hidden month matches any more. Every hidden group reopens. Others may
fold if an old key now lines up with a new group start (H1).

Across a DST change, "Today" hidden on 1 Nov (New York) no longer matches "Yesterday" on
2 Nov. The `yesterdayStart` value is 01:00, not 00:00 (test: `yesterday false … 01:00:00 GMT-0400`).

- **Fix:** the H1 fix removes this too. Calendar keys like `2026-10` don't depend on the time zone.

### M2. Dates from parcels and archives are never validated; a missing one stays broken
**Verified by running a scratch test.**

The archive check accepts any manifest that has a `format` and a `workspaces` array.
`src/services/libraryImport.ts:413-422`:
```ts
return (format === SONG_NOOK_ARCHIVE_FORMAT || format === LEGACY_SONG_NOOK_ARCHIVE_FORMAT) &&
    Array.isArray(candidate.workspaces);
```
The import copies `createdAt` / `lastActivityAt` as they arrive (`:301, :700-701, :763-764`).
At boot, `normalizeIdea` and `normalizeClip` (`state/dataSlice.ts:942-1070`) repair
`importedAt`/`sourceCreatedAt` but never `createdAt`. Activity events, Shelf, sent links,
playlists and archive state are all checked with `Number.isFinite`. Ideas and takes are the
exception.

Scratch results through the real `normalizeWorkspaces`, `getIdeaCreatedAt` and Activity
code:

| Stored `createdAt` | Result |
|---|---|
| missing | `lastActivityAt` NaN, saved as `null`, and NaN again on every boot. Sort and created dates are NaN. The bucket label reads `" NaN"` and the card reads `" NaN NaN"`. **Activity lists the idea under any year** (`filterActivityEvents` year 2019 → `["bad"]`) **and on any tapped day** (`buildActivityRangeEntries`, 1 Jan 2024 → `["bad"]`), because every comparison against NaN is false. |
| `null` (the form NaN takes once saved as JSON) | `Math.min(x, null)` = 0, so the idea dates to **1 Jan 1970**. It is the oldest item, and the Vault says "made 56 years ago". |
| ISO string | Groups correctly by accident (`new Date(str)`), but sorts as NaN. |
| future (the sender's clock was ahead, or a hostile parcel) | Stays in "Today" and reads "Just now" until the real date catches up. It sits at the top of Newest/Updated. Revisit clamps `ageDays` to 0 and counts it among the recent ideas, so it never surfaces. |

Nothing crashed. See Solid below for why.

- **Plausibility:** you can't trigger this from the app's own exports, which always write
  numbers. It needs a hostile or hand-edited parcel, a future format, or a bug. A sender
  whose clock is ahead by days is rare, but it is real.
- **Fix:** in `normalizeClip` and `normalizeIdea`, replace a non-finite `createdAt` with a
  fallback: the idea's other dates, else `importedAt`, else now. On import and receive,
  clamp dates later than `now + 1 day` to the import time. `normalizeExternalTimestamp`
  already does exactly this for files.

### M3. The editor's Replace re-dates the take, for every kind of idea, and drops its lyrics stamp
**Verified by reading.**

The first pass covered Replace on a lone clip (04 M5). The same commit re-dates the take
itself in sketches and in clip stacks too. `EditorScreen/hooks/useEditorExportFlow.ts:257-262`:
```ts
const createdClips = clipsToInsert.map((clip, index) => ({
  ...clip,
  id: buildClipId(),
  createdAt: now + index,
```
`buildDerivedClipDraft` (`:203-232`) carries `importedAt` and `sourceCreatedAt`. It does
not carry the recording time, and it drops `lyricsVersionId`. The combine path keeps
`lyricsVersionId`; see `actions.ts:1786`.

- **Effects:**
  - **Recording date lost.** A trimmed take from March reads as recorded today, moves to the top of the take list, and its original recording date is gone. No field holds it.
  - **Sketch "created" date can shift.** It follows the oldest surviving take (`ideaSort.ts:94-108`). For sketches built from several clips (`CollectionFloatingActions.tsx:406`, `createdAt: now`), replacing the oldest take moves the sketch's created date forward. It then sits in a different date group, and Revisit's archive age changes.
  - **Lyrics marker goes wrong.** The "edited since this take" check compares the version's `updatedAt` with the take's `createdAt` (`actions.ts:1926-1929`). After the edit, the take claims the current words. With the stamp gone, readers fall back to the latest version.
- **Fix:** carry the source's `createdAt` and `lyricsVersionId` into a Replace result. Use
  `now` only for a Save-as-new.

### M4. One launch with the clock set forward ends the free month early, and the Keychain keeps it that way
**Verified by reading.** Dormant until the paywall goes live (`APP_STORE_RELEASE_AT` is
null and everything is free).

`domain/freeMonth.ts:62-64`:
```ts
export function freeMonthNow(now: number, lastSeenAt: number | null | undefined): number {
  return lastSeenAt != null && lastSeenAt > now ? lastSeenAt : now;
}
```
`lastSeenAt` only ever rises (`freeMonthClock.ts:157-161`), and it lives in the Keychain,
which survives deleting the app and "Erase everything" (`:21-24`). One launch while the
date is wrong ends the month, permanently on that phone. Examples: a user moving the date
forward for a game, or an Android phone that booted with a bad clock before network time.

On content: the catalog gates creating, not reading (`proCatalog.ts:18-19`), and I found
no gate that hides existing work. The one exception is the full-screen stage reader for the
person's own chart books (`useSongbookModel.ts:105`); each song remains readable on its own.

- **Fix:** cap how far the high-water mark can jump, for example by ignoring a single jump of
  more than 2 days unless later launches confirm it. Alternatively, judge the month by
  RevenueCat/StoreKit server time when it is available. Add a support path (promo
  entitlement) to the pricing record.

### M5. A phone move through Export/Import changes what Revisit offers (deeper look at 02 G9)
**Verified by reading.**

Export carries no activity history (G9). After an import, Activity falls back to synthetic
seeds: one "created" event per idea, plus one "updated" per sketch
(`activity.ts:102-126`). Revisit's `sessionsCount` is the number of distinct activity days
(`revisit.ts:703-705`), so it drops to 2 or fewer for everything.

That changes eligibility, not just the Activity grid:
- Clip pickup needs `sessionsCount >= 2` (`:776`).
- The forgotten score adds +14 when `sessionsCount <= 2` (`:376`).

The heatmap loses every past session. The recommended Back Up / Restore path is fine: it
carries the full history.

- **Fix:** include `activityEvents` (remapped to the new ids) in full-fidelity export.
  Or label Export as "not for moving phones" (G9's fix).

---

## LOW

- **L1. DST off by an hour in the date groups.** `dateBuckets.ts:65-66` and Notepad
  (`useNotepadScreenModel.ts:144-145`) subtract fixed 24 h blocks. On the day after the
  autumn change, an idea from 00:30 the previous day files under "Last week", not
  "Yesterday". Verified by a scratch test (`00:30 idea -> last-week`). The heatmap already
  steps by calendar day (`activity.ts:247-249`). Do the same here with `setDate(d - n)`.
- **L2. Revisit's daily refresh follows the UTC date.** In `revisit.ts:623` and
  `useRevisitScreenModel.ts:106`:
  ```ts
  new Date(now).toISOString().slice(0, 10)
  ```
  The feed reshuffles and vault exposure resets at 19:00/20:00 in New York and 02:00/03:00
  in Israel, not at midnight. Use a local date key.
- **L3. The Send outbox is pruned by the phone's clock.**
  - `pruneExpiredSentLinks` (`sentLinks.ts:45-47`) drops a record 3 days after it expires by the device clock. Setting the date 10+ days ahead deletes the record and its `uploadToken` while the link is still live on the server (up to 7 days, `server/.../env.ts:86`). "Delete link" is then impossible.
  - `expiresAt: Date.parse(transfer.expiresAt) || Date.now()` (`shareLink.ts:206, 333`) marks a malformed expiry as already expired.
  - Fix: keep a record while its token exists. Prune by server-confirmed expiry, or only after a successful delete.
- **L4. IDs built only from the clock.**
  - `addIdea` and `quickRecordIdea` use `idea-${Date.now()}` (`dataSlice.ts:3039, 3061`); `addClipVersion` uses `clip-${Date.now()}` (`:3098`).
  - Merge restore assumes "IDs are random at creation; a collision means the same item" (`libraryMergeRestore.ts:13-15`). Two creations in the same millisecond collide. A clash across two devices is negligible but not impossible.
  - Fix: use `genId()` (time plus random), which already exists in `utils.ts:302`.
  - *Speculative.*
- **L5. Copy flattens history.** `cloneIdeaForCopy` (`actions.ts:559-583`) re-dates every
  take and lyric version to `now + index`. It re-IDs the versions, but takes keep their old
  `lyricsVersionId`, so the "sung from" stamp points at nothing and falls back to the
  latest. Verified by reading. Keep the original take and version dates on a copy, and remap
  the stamp.
- **L6. Merge brings back a Shelf entry the person had removed.**
  `satelliteSnapshot.ts:146-155` unions `entries` and `departed` separately. A backup-era
  entry that is now in `departed` returns as active, so the same key sits in both lists.
  Verified by reading. When merging, drop restored entries whose key is in current `departed`.
- **L7. A corrupt lyric-version date becomes "now".** `normalizeLyricsVersion`
  (`dataSlice.ts:641-647`) stamps `Date.now()` for a missing date. The sketch jumps to
  "updated today" at that boot. Scratch test confirmed it. Fall back to the idea's
  `createdAt` instead.
- **L8. The backup reminder trusts restored and future stamps.** Replace restore brings
  back the backup's own `lastSuccessfulBackupAt` (the backup *before* it) and
  `backupReminderLastPromptedAt` (`persistedSnapshot.ts:52-56`), so a nag can appear right
  after a restore. A stamp written while the clock was ahead silences reminders until that
  date (`backupPreferences.ts:83-88`). Treat a stamp in the future as "now".
- **L9. Display oddities.**
  - A future time reads "Just now" (`formatClipDate`, `utils.ts:144`) and "Edited -3 days ago" (`formatLastEdited`, `utils.ts:287-291`). Both seen in a scratch test.
  - The backup date uses `Intl.DateTimeFormat(undefined)`, the device locale rather than the app's language (`backupPreferences.ts:101`).
  - `SettingsImportView.tsx:50` prints "Invalid Date" for a manifest without `exportedAt`.

---

## Inventory (where each date lives, what carries it)

| Field | Store | Backup / Replace | Merge | Export / Send | Copy / Move / Edit |
|---|---|---|---|---|---|
| idea `createdAt`, `lastActivityAt`, `importedAt`, `sourceCreatedAt` | main snapshot | exact | current wins | preserved (M2: unvalidated) | copy = now; move keeps; edit never touches `createdAt` |
| take `createdAt`, `parentAssignedAt`, `importedAt` | main | exact | backup-only takes return | preserved | copy = now+i (L5); editor Replace = now (M3) |
| lyric version `createdAt` / `updatedAt` | main | exact | deleted versions slot back by date, never as latest | preserved | copy = now+i |
| collection, playlist, setlist, songbook, note, group, stem dates | main | exact | union by id | preserved | — |
| `activityEvents[].at` | main (activity row) | exact | union by id (no duplicates) | **not exported** (M5) | relocated on move, dropped with the idea |
| `hiddenDays[].dayStartTs` | main | exact (zone-bound, M1) | current wins | preserved, remapped ids | — (H1/H2) |
| `workspaceLastOpenedAt` / `collectionLastOpenedAt` | main | exact | union, current wins | — | — |
| Shelf `shelvedAt` / `expiresAt` / `leftAt` | satellite | exact; old entries expire on first sweep | union (L6) | — | — |
| Revisit snoozes and vault exposure | satellite | exact | union, current wins | — | — |
| sent links `createdAt` / `expiresAt`, `sentAt[]` | satellite | exact | union by transferId | — | — |
| `received.receivedAt` / `openedAt` | main | exact | current wins | stamped at receive | — |
| `archiveState.archivedAt` / `offloadedAt` | main | exact | current wins | — | — |
| `firstLaunchAt`, `lastSuccessfulBackupAt`, `backupReminderLastPromptedAt`, `reviewPromptShownAt` | main | **from the backup** (L8) | current wins | — | — |
| free month start, paywall-since, `lastSeenAt`, founding | Keychain + AsyncStorage | not carried (by design) | — | — | — (M4) |
| trash time | file name `<ms>-<rand>-<name>` | not carried | — | — | — |
| pending-recording journal `startedAt` / `updatedAt` | AsyncStorage | not carried | — | — | — |

## Clock-driven timers

| Timer | Clock jumps forward | Clock jumps back |
|---|---|---|
| Trash purge, 14 days (`managedMedia.ts:269`) | empties early (04 L2); runs after referenced files are rescued | entries kept longer (safe) |
| Shelf, 7 days | everything leaves; the "left" list keeps 5 (04 L2); pointer only | stays longer |
| Sent-link prune | record and token lost (L3) | kept longer |
| Revisit snoozes | end early | last longer |
| Free month | ends, and latches (M4) | can't reopen (by design) |
| Send allowance (`recentSendStamps`) | stamps age out, so more links allowed | future stamps dropped, so more allowed (server enforces at release) |
| Backup reminder | fires early | delayed (L8) |
| Backup and share temp sweep (24 h, by mtime) | temp files only | — |
| Orphan take ↔ placeholder pairing (by id ms) | a gap < 0 or too large goes to Recovered, not lost | same |
| Pending-recording journal | no expiry (good) | no expiry |

## Solid (checked, holds up)

- **Merge never reads a date.** `libraryMergeRestore.ts` unions by id, and the current copy
  wins every collision. A backup from a phone with a wrong or future clock cannot replace a
  newer item. Lyric versions that return slot in by `createdAt` but never become the
  latest; "latest" is the array position, not a date (`:222-237`).
- **Activity after restore.** Events are checked (`Number.isFinite(event.at)`,
  `dataSlice.ts:1225-1246`) and merged by id, so there are no duplicates. They move with an
  idea (`relocateActivityEvents`) and leave with it. Seed events are rebuilt at render time,
  never stored, so they can't pile up.
- **Edits never touch `createdAt`.** `updateIdeas` stamps only `lastActivityAt`, only when
  the content changed (`ideaActivity.ts`, `dataSlice.ts:2988-2995`). Moves, bookmarks,
  re-renders and imports don't count as updates. Making a sketch from one clip keeps the
  clip's date (`actions.ts:2390`).
- **Import dates are guarded at the source.** `normalizeExternalTimestamp` handles seconds
  vs milliseconds, sets a 1990 floor, and rejects anything past now + 1 day
  (`audioStorage.ts:83-105`). The video `mvhd` reader uses a 2000 floor and the same
  ceiling. The person chooses Original or Today. A post-creation import never backdates a
  sketch (`ideaSort.ts:99-107`).
- **Library import and Send keep every date:** `createdAt`, `lastActivityAt`, `importedAt`,
  `sourceCreatedAt`, `parentAssignedAt`, and the lyric, collection, compilation and note
  dates. Received parcels show the sender's dates; only `receivedAt` is local.
- **No stored date can crash a screen.** `Intl.DateTimeFormat` (which throws on an Invalid
  Date, as the scratch test confirmed) is used only on now-derived values (`revisit.ts:251`)
  or behind `Number.isFinite` plus `try` (`backupPreferences.ts:96-106`). `toISOString` is
  called only on `new Date()` or `now`. Every `Date.parse` of stored or server text is
  guarded. `toLocaleDateString` on an invalid date returns "Invalid Date" rather than
  throwing. Sorts compare with `-`, never throw, and tie-break on title and id.
- **Free month vs restore.** Its dates are not in the snapshot, so a restored backup cannot
  carry access or restart the month. Turning the date back cannot reopen it. Founding is
  decided once and stored.
- **Seconds vs milliseconds** is handled wherever a file mtime is read (`> 1e12 ? … : * 1000`).
  No time is stored in 32 bits. SQLite `updated_at` and the stores' own values are 64-bit
  milliseconds.
- **Calendars and RTL.** Date formatting passes explicit locales (Gregorian, including
  `he-IL`). Auto-title detection checks every language plus pattern fallbacks, so a time
  zone or language change doesn't promote a machine name to the serif.
- **The heatmap** steps by calendar day and rounds month columns, so it is DST-safe.
- **Recovery dates.** A recovered take is dated by its file's mtime (`audioRecovery.ts:361`).
  The pending-recording journal never expires on age.
