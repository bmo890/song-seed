# Hebrew review, 2026-10-20

Every Hebrew string (3,377) was read against its English. 289 were changed. Grouped by area of the app; each line is English, then Hebrew before → after, and why.

Not changed on purpose: `reading.aa` (אב, the text-size key) and `collectionActions.undo` (ביטול is what Hebrew apps say for Undo).

## common

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `common.almostDone` | Almost done | כמעט סיום | כמעט סיימנו | "כמעט סיום" is ungrammatical; natural progress phrase |
| `common.fullBackupBody` | This is a full backup, not a shared archive. Restore it from Data & storage. | זה גיבוי מלא, לא ארכיון משותף. שחזרו אותו מתוך נתונים ואחסון. | זה גיבוי מלא, לא ארכיון לשיתוף. שחזרו אותו מתוך נתונים ואחסון. | "ארכיון משותף" means jointly owned, not shareable |
| `common.transposeDown` | Transpose down a semitone | הורדת הטרנספוזיציה בחצי טון | הורדה בחצי טון | "lowering the transposition" is a calque; musicians say this |
| `common.transposeUp` | Transpose up a semitone | העלאת הטרנספוזיציה בחצי טון | העלאה בחצי טון | "raising the transposition" is a calque; musicians say this |

## settingsImport

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `settingsImport.fullBackupBody` | This is a full backup, not a shared archive. Restore it from Data & storage. | זה גיבוי מלא, לא ארכיון משותף. שחזרו אותו מתוך נתונים ואחסון. | זה גיבוי מלא, לא ארכיון לשיתוף. שחזרו אותו מתוך נתונים ואחסון. | "ארכיון משותף" means jointly owned, not shareable |
| `settingsImport.exported` | Exported {{date}}. | יוצא ב־{{date}}. | ייצוא: {{date}}. | "יוצא ב־" reads as "goes out on" |

## settingsBackup

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `settingsBackup.shareArchiveBody` | This is a shared archive, not a backup. Import it from Data & storage. | זה ארכיון משותף, לא גיבוי. ייבאו אותו מתוך נתונים ואחסון. | זה ארכיון לשיתוף, לא גיבוי. ייבאו אותו מתוך נתונים ואחסון. | Match title "ארכיון לשיתוף"; "משותף" means jointly owned |
| `settingsBackup.confirmBody` | {{estimate}}You can minimize the backup and keep using the app while it runs. | {{estimate}}אפשר למזער את הגיבוי ולהמשיך להשתמש ביישום בזמן שהוא פועל. | {{estimate}}אפשר להעביר את הגיבוי לרקע ולהמשיך לעבוד באפליקציה בזמן שהוא רץ. | "למזער" is a calque; "היישום" inconsistent with "האפליקציה" |
| `settingsBackup.notSaved` | Not saved | לא נשמר | לא שמרתי | User's answer about their own action; first person |
| `settingsBackup.savedIt` | Saved it | נשמר | שמרתי | User's answer about their own action; first person |
| `settingsBackup.lowStorage` | Your device is low on storage. Free up some space, then try the backup again. | האחסון במכשיר נמוך. פנו מקום ונסו לגבות שוב. | אין מספיק מקום במכשיר. פנו מקום ונסו לגבות שוב. | "האחסון…נמוך" is a calque of "low on storage" |
| `settingsBackup.finishRecording` | Finish recording first | יש לסיים קודם את ההקלטה | קודם צריך לסיים את ההקלטה | "יש לסיים" officialese |
| `settingsBackup.restoreBody` | How should this backup be restored? The app restarts afterward.{{size}} | איך לשחזר את הגיבוי? היישום יופעל מחדש לאחר מכן.{{size}} | איך לשחזר את הגיבוי? האפליקציה תופעל מחדש אחר כך.{{size}} | "היישום…לאחר מכן" stiff; app is אפליקציה elsewhere |
| `settingsBackup.replaceDesc` | Your library becomes the backup. Removed clips wait in trash 14 days. | הספרייה הופכת לגיבוי. קטעים שהוסרו ממתינים בפח 14 יום. | הספרייה תוחלף בגיבוי. קטעים שהוסרו יישארו בפח 14 יום. | "הספרייה הופכת לגיבוי" literal; meaning unclear |
| `settingsBackup.overdubLayer` |  (overdub layer) |  (שכבת הקלטה) |  (שכבת אוברדאב) | "שכבת הקלטה" is vague; musicians say אוברדאב |

## stages

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `stages.seed` | Early | מוקדם | התחלתי | "מוקדם" reads as "early (time)", not a stage |
| `stages.stem` | Close | כמעט | כמעט מוכן | "כמעט" alone is a dangling adverb as a stage label |

## brand

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `brand.idea_two` | ideas | שני רעיונות | רעיונות | Bare-noun form; "שני" duplicates the separately rendered count |
| `brand.take_two` | takes | שני טייקים | טייקים | Bare-noun form; "שני" duplicates the separately rendered count |

## workspaceBrowse

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `workspaceBrowse.collectionsHint` | Collections hold your ideas. | אוספים מחזיקים את הרעיונות שלכם. | הרעיונות שלכם מסודרים באוספים. | "מחזיקים" is a calque of "hold" |
| `workspaceBrowse.createHint` | Create one to start organizing ideas. | צרו אחד כדי להתחיל לארגן רעיונות. | צרו אוסף כדי להתחיל לסדר רעיונות. | "צרו אחד" calques "create one" |
| `workspaceBrowse.sortLeastRecent` | Least recent | הכי מזמן | הישנים קודם | Match filters.oldestFirst; "הכי מזמן" is odd as a sort |

## workspaceList

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `workspaceList.leastRecent` | Least recent | הכי פחות לאחרונה | הישנים קודם | "הכי פחות לאחרונה" is a broken calque |
| `workspaceList.titleAz` | Title A–Z | כותרת א׳–ת׳ | כותרת א–ת | Match other A–Z labels (no geresh) |
| `workspaceList.titleZa` | Title Z–A | כותרת ת׳–א׳ | כותרת ת–א | Match other Z–A labels (no geresh) |
| `workspaceList.empty` | Tap + to create one. | לחצו על + כדי ליצור אחד. | לחצו על + כדי ליצור מרחב עבודה. | "ליצור אחד" calques "create one" |

## collection

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `collection.hideSection` | Hide section | הסתרת הקטע | הסתרת הקבוצה | "קטע" is the glossary word for clip; collision |
| `collection.empty` | Nothing here yet | עדיין אין כאן דבר | עדיין אין כאן כלום | "אין כאן דבר" is stiff; "כלום" is spoken Hebrew |
| `collection.nested` | Nested collections | אוספים מקוננים | תתי־אוספים | "מקוננים" is programmer jargon; glossary uses תת־אוסף |
| `collection.nestedCount_two` | {{count}} | שני אוספים בתוך האוסף הזה | {{count}} | Siblings render just the number; _two is a sentence |

## received

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `received.moveNestedHint` | Nested collections keep to the top level. | אוספים מקוננים נשארים ברמה העליונה. | תתי־אוספים נשארים ברמה העליונה. | "מקוננים" is programmer jargon; glossary uses תת־אוסף |
| `received.moveSelected` | Keep | לשמור | שמירה | Buttons are nouns; matches received.keepTitle |
| `received.moveHint` | Where should it live? | איפה זה יחיה? | איפה לשמור את זה? | "איפה זה יחיה" is a literal calque |
| `received.keepsAsWorkspace` | Keeping makes it one of your workspaces. | השמירה הופכת אותו למרחב עבודה שלכם. | אחרי השמירה הוא יהיה אחד ממרחבי העבודה שלכם. | "השמירה הופכת אותו" calques "keeping makes it" |
| `received.keepsInto` | Keeping moves it into {{title}}. | השמירה מעבירה אותו אל {{title}}. | בשמירה הוא יעבור אל {{title}}. | "השמירה מעבירה אותו" calques "keeping moves it" |
| `received.empty` | Nothing received yet | עדיין לא התקבל דבר | עדיין לא התקבל כלום | "דבר" stiff; match spoken register |
| `received.unopened` | Not opened yet | טרם נפתחה | עוד לא נפתחה | "טרם" is formal register |

## revisit

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `revisit.reason.sessions` | {{count}} sessions | {{count}} מפגשים | {{count}} סשנים | "מפגשים" means meetings; musicians say סשנים |
| `revisit.reason.untouched` | Untouched for {{span}} | ללא שינוי {{span}} | ללא שינוי כבר {{span}} | Missing "כבר"; reads as "no change two days" |
| `revisit.aroundTitle` | Around this time | בערך בזמן הזה | בתקופה הזו | "בערך בזמן הזה" is a literal calque |
| `revisit.around` | Around this time | בערך בזמן הזה | בתקופה הזו | "בערך בזמן הזה" is a literal calque |
| `revisit.customize` | Customize Revisit | התאמת החזרה | התאמת ״לחזור לזה״ | "התאמת החזרה" reads as "adjusting the return" |
| `revisit.hideBody` | It won’t resurface here again. It stays in its collection — restore it from Customize → Restore hidden. | הרעיון לא יחזור להופיע כאן, אבל נשאר באוסף שלו — אפשר להחזיר אותו דרך התאמת החזרה ← החזרת מוסתרים. | הרעיון לא יחזור להופיע כאן, אבל נשאר באוסף שלו — אפשר להחזיר אותו דרך התאמת ״לחזור לזה״ ← החזרת מוסתרים. | Follow the renamed Customize label |
| `revisit.empty` | Older ideas return here as newer work piles up. | רעיונות ישנים חוזרים לכאן כשעבודה חדשה נערמת. | רעיונות ישנים חוזרים לכאן ככל שמצטברת עבודה חדשה. | "נערמת" is a literal "piles up" |
| `revisit.unfinishedDesc` | Worked on, then left alone | עבדתם עליהם ואז הנחתם | עבדתם עליהם ואז עזבתם | "הנחתם" is ambiguous (placed / premise) |
| `revisit.deepCuts` | Deep cuts | מהעומק | מהמגירה | Israeli idiom for old unreleased material: "שירים מהמגירה" |
| `revisit.aroundSnapshotSubtitle` | A seasonal snapshot from around this point in past years. | תמונת מצב עונתית מסביב לנקודה הזו בשנים קודמות. | תמונת מצב עונתית מהתקופה הזו בשנים קודמות. | "מסביב לנקודה הזו" is a literal calque |

## shelf

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `shelf.reshelve` | Re-shelve | להחזיר למדף | החזרה למדף | Buttons are nouns; siblings use "הסרה" |
| `shelf.emptyTitle` | Nothing set aside | שום דבר לא הונח בצד | אין כלום על המדף | Passive "לא הונח בצד" is stiff |
| `shelf.browseIdeas` | Browse ideas | לעיון ברעיונות | עיון ברעיונות | Button/link style is noun, not "ל…" |

## settings

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `settings.startupHint` | Where the app lands when it opens. | לאן האפליקציה נפתחת בהפעלה. | איפה האפליקציה נפתחת. | "לאן…נפתחת" calques "lands"; drop redundant "בהפעלה" |
| `settings.restartFailedBody` | Close and reopen SongNook to finish changing the language. | יש לסגור ולפתוח מחדש את SongNook כדי להשלים את שינוי השפה. | סגרו ופתחו מחדש את SongNook כדי לסיים את שינוי השפה. | "יש ל…" officialese; house style is plural imperative |
| `settings.classicReel` | Classic reel | סרט קלאסי | סליל קלאסי | "סרט" reads as film; tape reel is סליל |
| `settings.primaryWorkspaceHint` | Opens {{name}} when the app starts. | פתיחת {{name}} עם הפעלת היישום. | {{name}} ייפתח עם הפעלת האפליקציה. | Stiff nominal; "היישום" vs "האפליקציה" elsewhere |

## eraseAll

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `eraseAll.finalConfirm` | Delete all | למחוק הכול | מחיקת הכול | Buttons are nouns per house style |

## backupReminder

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `backupReminder.bodyOverdue` | More than a {{window}} since the last backup. | עבר יותר מ{{window}} מאז הגיבוי האחרון. | עבר יותר מ־{{window}} מאז הגיבוי האחרון. | Window can be "3 חודשים"; digit needs maqaf |

## settingsLibrary

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `settingsLibrary.safetyCopy` | Safety copy | עותק בטיחות | עותק גיבוי | "עותק בטיחות" is a calque |
| `settingsLibrary.safetyHint` | Every clip, take and detail, restorable on any device. | כל קטע, טייק ופרט, ניתנים לשחזור בכל מכשיר. | כל קטע, טייק ופרט — אפשר לשחזר בכל מכשיר. | "ניתנים לשחזור" is officialese |

## settingsStorage

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `settingsStorage.integrityPassed` | Integrity check passed | בדיקת התקינות עברה | בדיקת התקינות עברה בהצלחה | "הבדיקה עברה" alone is a calque of "passed" |
| `settingsStorage.exportTempDetail_other` | {{count}} files staged for exports or native sharing. This is shown separately from the library total. | {{count}} קבצים שהוכנו לייצוא או לשיתוף. נתון זה מוצג בנפרד מסך הספרייה. | {{count}} קבצים הוכנו לייצוא או לשיתוף. נתון זה מוצג בנפרד מסך הספרייה. | "שהוכנו" makes a fragment; match _one/_two |

## settingsExport

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `settingsExport.readyBody` | {{summary}} were packaged and handed to the share sheet. | {{summary}} נארזו והועברו לגיליון השיתוף. | {{summary}} נארזו ומוכנים לשיתוף. | "גיליון השיתוף" is a calque of iOS "share sheet" |
| `settingsExport.selectionHint` | A workspace includes everything inside; a collection includes its subcollections. | מרחב עבודה כולל את כל מה שבתוכו; אוסף כולל את אוספי המשנה שלו. | מרחב עבודה כולל את כל מה שבתוכו; אוסף כולל את תתי־האוספים שלו. | Glossary: תת־אוסף, not "אוספי משנה" |
| `settingsExport.metadata` | Preserve all metadata | שמירת כל הנתונים | שמירת כל הפרטים | "כל הנתונים" suggests all data, not metadata |

## backupRestoreError

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `backupRestoreError.missingAudio` | This backup is missing clips it lists. | בגיבוי חסרים קטעים שהוא מציין. | חסרים בגיבוי קטעים שרשומים בו. | "שהוא מציין" is awkward |
| `backupRestoreError.mergeNeedsReplace` | An older backup can’t be merged. Use Replace Everything instead. | אי אפשר למזג גיבוי ישן. השתמשו ב„החלף הכול” במקום. | אי אפשר למזג גיבוי ישן. בחרו ב„החלפת הכול”. | Button is "החלפת הכול"; trailing "במקום" is a calque |
| `backupRestoreError.newerApp` | This backup needs a newer SongNook. Update the app to restore it. | הגיבוי דורש גרסה חדשה יותר של SongNook. עדכנו את היישום כדי לשחזר אותו. | הגיבוי דורש גרסה חדשה יותר של SongNook. עדכנו את האפליקציה כדי לשחזר אותו. | "היישום" inconsistent with "האפליקציה" |

## backupOperation

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `backupOperation.action.archive` | archive this workspace | לארכב את סביבת העבודה | להעביר את מרחב העבודה לארכיון | Glossary: מרחב עבודה, not "סביבת עבודה"; "לארכב" is rare |
| `backupOperation.tooLarge` | Your library is over 4 GB, too large for one backup. | הספרייה גדולה מ־4GB, יותר מדי לגיבוי אחד. | הספרייה גדולה מ־4GB — גדולה מדי לגיבוי אחד. | "יותר מדי לגיבוי" is ungrammatical |

## sharing

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `sharing.forgetTitle` | Forget this link? | לשכוח את הקישור? | להסיר את הקישור מהרשימה? | "לשכוח" a link is a calque; a11y already says "הסרה" |
| `sharing.forget` | Forget | לשכוח | הסרה | Calque "לשכוח"; buttons are nouns |

## shareImport

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `shareImport.sentMusic` | Someone sent you music | נשלחה אליך מוזיקה | נשלחה אליכם מוזיקה | House style addresses user in plural |
| `shareImport.noCurrentCollection` | No current collection is active, so choose another collection or create a new one. | אין אוסף נוכחי פעיל, לכן בחרו אוסף אחר או צרו אוסף חדש. | אין אוסף פעיל. בחרו אוסף אחר או צרו אוסף חדש. | Stiff 'נוכחי פעיל, לכן' calque; split and trim |
| `shareImport.moreFiles` | +{{count}} more shared audio files | +עוד {{count}} קובצי שמע משותפים | ועוד {{count}} קובצי שמע משותפים | '+' plus 'עוד' is doubled; Hebrew uses ועוד |
| `shareImport.unsupportedOnly` | SongNook can import shared audio files, but the current share payload does not contain supported audio. | SongNook יכול לייבא קובצי שמע משותפים, אך תוכן השיתוף הנוכחי אינו מכיל שמע נתמך. | SongNook יכול לייבא קובצי שמע, אבל מה ששותף לא כולל שמע נתמך. | Officialese 'תוכן השיתוף הנוכחי אינו מכיל'; friendlier register |

## library

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `library.pauseReference` | Pause reference audio | השהיית שמע ההדגמה | השהיית הרפרנס | Reference audio is 'רפרנס' to musicians; הדגמה means demo |
| `library.playReference` | Play reference audio | ניגון שמע ההדגמה | ניגון הרפרנס | Reference audio is 'רפרנס' to musicians; הדגמה means demo |
| `library.shufflePlaylist` | Shuffle playlist | ניגון הפלייליסט בערבוב | ניגון אקראי של הפלייליסט | 'בערבוב' is a calque; Hebrew players say ניגון אקראי |
| `library.sort_updated` | Updated | עודכן | עדכון אחרון | Sort option reads as a past verb; needs a noun |
| `library.sort_created` | Created | נוצר | תאריך יצירה | Sort option reads as a past verb; needs a noun |
| `library.setlistHint` | Setlists hold an ordered set of songs (clips + charts) to share with your band. | סטליסטים מחזיקים מערך מסודר של שירים, קטעים ותרשימים לשיתוף עם הלהקה. | סטליסט הוא רשימת שירים מסודרת, עם הקטעים והתרשימים, לשיתוף עם הלהקה. | 'מחזיקים מערך' calque; clips+charts belong to songs, not siblings |
| `library.bookEmptyBody` | Add finished songs — their final lyrics and chords live here, read like a book. | הוסיפו שירים גמורים — המילים והאקורדים הסופיים שלהם יחיו כאן, לקריאה כמו ספר. | הוסיפו שירים גמורים — המילים והאקורדים הסופיים שלהם נשמרים כאן, לקריאה כמו ספר. | 'יחיו כאן' is a literal calque of 'live here' |
| `library.setEditHint` | Drag the handle to reorder · tap a row to repack it · − removes | גררו את הידית לשינוי הסדר · לחצו על שורה לאריזה מחדש · − מסיר | גררו את הידית לשינוי הסדר · לחצו על שורה לאריזה מחדש · − להסרה | Match reorderHint pattern; '− מסיר' is clumsy |
| `library.setEmptyBody` | Add songs. Each brings its takes and charts. | הוסיפו שירים. כל אחד מביא את הטייקים והתרשימים שלו. | הוסיפו שירים. כל שיר מגיע עם הטייקים והתרשימים שלו. | 'מביא את' is a calque of 'brings' |
| `library.packFootnote` | A chosen take brings its reel with it — sections, pins, and take notes come along. Version history stays home. | טייק שנבחר מביא איתו את כל הסליל — חלקים, סמנים והערות לטייק. היסטוריית הגרסאות נשארת בבית. | טייק שנבחר נארז עם כל מה שעליו — חלקים, סמנים והערות לטייק. היסטוריית הגרסאות נשארת אצלכם. | 'סליל' and 'נשארת בבית' are literal idiom calques |

## player

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `player.offsetInPlace` | In place | במקום | במקום המקורי | Bare 'במקום' reads as 'instead' |
| `player.sketchDoorTitle` | Grow this into a sketch | להצמיח את זה לסקיצה | להפוך את זה לסקיצה | 'להצמיח' is a literal calque of 'grow' |
| `player.showTakes` | Show take’s | חזרה לטייק | מילות הטייק | Meaning drift: shows the take's words, not 'back to take' |
| `player.onShelf` | Shelved for 7 days | במדף ל־7 ימים | על המדף ל־7 ימים | Things sit 'על המדף', not 'במדף' |
| `player.closeReading` | Close reading | סגירת קריאה | סגירת מצב קריאה | 'סגירת קריאה' is ungrammatical without 'מצב' |
| `player.chartBars_two` | {{count}} bars | {{count}} תיבות | שתי תיבות | Dual form; match player.bars_two |
| `player.loopWhat` | Loop what | מה ללולאה | לולאה על | 'מה ללולאה' is ungrammatical word-for-word |
| `player.newVersionBody` | Keep writing on a fresh version. | להמשיך לכתוב על גרסה חדשה. | להמשיך לכתוב בגרסה חדשה. | Wrong preposition; write 'in' a version, not 'on' |
| `player.sectionInk` | Section ink | דיו החלק | צבע החלק | 'דיו' is literal; user sees a colour picker |
| `player.usePlayhead` | Use playhead | לפי קו הנגינה | לפי נקודת הניגון | Inconsistent: app uses 'נקודת הניגון' for playhead everywhere |
| `player.noTempoYet` | No tempo yet | אין קצב עדיין | עדיין אין קצב | Match the file's 'עדיין אין…' pattern |
| `player.stepUpSheetHint` | Each step holds a speed for a number of passes. | כל שלב מחזיק מהירות למספר סבבים. | בכל שלב המהירות נשמרת למספר סבבים. | 'מחזיק מהירות' is a calque of 'holds' |
| `player.stepUpHelpThesis` | Loop a part slowly. It speeds up as you repeat. | נגנו קטע בלופ לאט. הוא מאיץ עם כל חזרה. | נגנו חלק בלולאה, לאט. הקצב עולה עם כל חזרה. | Glossary: part=חלק (קטע=clip), loop=לולאה; smoother |
| `player.stepUpHelpPlan` | Set the speeds with the sliders. | קבעו את המהירויות בכפתור המחוונים. | קבעו את המהירויות עם המחוונים. | Mistranslation: sliders are not 'a button of sliders' |
| `player.stepUpHelpStepsBody` | Each step holds a speed for some passes; the last speed stays. | כל שלב מחזיק מהירות למספר סבבים; המהירות האחרונה נשארת. | בכל שלב המהירות נשמרת למספר סבבים; המהירות האחרונה נשארת. | 'מחזיק מהירות' calque of 'holds' |
| `player.stepUpHelpPresetsBody` | Pick a ready drill or build one; save it for any passage. | בחרו תרגיל מוכן או בנו אחד; שמרו אותו לכל קטע. | בחרו תרגיל מוכן או בנו אחד; שמרו אותו לכל חלק. | 'קטע' means clip in glossary; passage here is a part |
| `player.loopSection` | Loop a section | חזרה על חלק | לולאה על חלק | Glossary loop=לולאה; matches player.loopAPart |
| `player.noSectionsLoop` | No sections to loop | אין חלקים לחזרה | אין חלקים ללולאה | Glossary loop=לולאה |
| `player.layerPreviewFailed` | Layer preview failed | תצוגת השכבה נכשלה | השמעת השכבה נכשלה | Audio preview is a listen, not a visual 'תצוגה' |
| `player.updatingMix` | Updating layer mix | מעדכן את מיקס השכבה | מעדכן את מיקס השכבות | It is the mix of all layers, plural |

## recording

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `recording.dropPin` | Drop a pin | נעיצת סיכה | הוספת סמן | Glossary pin=סמן; 'סיכה' is a map-app calque |
| `recording.guide` | Guide | מנחה | גייד | Bare 'מנחה' reads as TV host; studios say גייד |
| `recording.masterJoins` | Guide in {{count}} | המנחה נכנס בעוד {{count}} | הגייד נכנס בעוד {{count}} | Musicians call the guide track 'גייד' |
| `recording.masterJoining` | Guide joining… | המנחה נכנס… | הגייד נכנס… | Musicians call the guide track 'גייד' |
| `recording.headphonesHint` | Headphones keep the guide out of your take. | אוזניות שומרות את המנחה מחוץ לטייק. | עם אוזניות הגייד לא נכנס לטייק. | 'שומרות…מחוץ ל' is a calque; guide=גייד |
| `recording.discardShort` | Discard | ביטול | מחיקה | Discarding deletes the take; 'ביטול' means cancel; match recording.discard |
| `recording.inputListFailed` | Couldn’t list audio inputs — using the default mic. | לא ניתן להציג את קלטי השמע — נעשה שימוש במיקרופון ברירת המחדל. | לא ניתן להציג את קלטי השמע — משתמשים במיקרופון ברירת המחדל. | 'נעשה שימוש ב' is officialese |
| `recording.metronomeOn` | Clicks while recording | נקישות בזמן ההקלטה | קליק בזמן ההקלטה | Musicians say קליק; app also uses קליק elsewhere |
| `recording.clickBars_one` | {{count}} bar of clicks before recording | תיבת נקישות אחת לפני ההקלטה | תיבת קליק אחת לפני ההקלטה | Musicians say קליק; consistency with player.click |
| `recording.clickBars_two` | {{count}} bars of clicks before recording | שתי תיבות נקישות לפני ההקלטה | שתי תיבות קליק לפני ההקלטה | Musicians say קליק; consistency with player.click |
| `recording.clickBars_other` | {{count}} bars of clicks before recording | {{count}} תיבות נקישות לפני ההקלטה | {{count}} תיבות קליק לפני ההקלטה | Musicians say קליק; consistency with player.click |
| `recording.stopPreviewA11y` | Stop the preview | עצירת התצוגה המקדימה | עצירת ההשמעה המקדימה | Metronome preview is audio, not visual |
| `recording.stopPreview` | Stop preview | עצירת תצוגה | עצירת השמעה | Metronome preview is audio, not visual |
| `recording.nativeUnavailable` | Rebuild the app to use the native metronome engine. | יש לבנות מחדש את היישום כדי להשתמש במנוע המטרונום המקורי. | יש לבנות מחדש את האפליקציה כדי להשתמש במנוע המטרונום הנייטיב. | 'מקורי' means original, not native; app says אפליקציה elsewhere |
| `recording.uncalibrated` | {{name}} not calibrated. Takes may land late. | {{name}} לא מכוילות. טייקים עלולים לנחות מאוחר. | {{name}} לא מכוילות. הטייקים עלולים להיכנס באיחור. | 'לנחות מאוחר' is a literal calque of 'land late' |

## metronome

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `metronome.unavailable` | Rebuild the app to use the native metronome engine. | יש לבנות מחדש את היישום כדי להשתמש במנוע המטרונום המקורי. | יש לבנות מחדש את האפליקציה כדי להשתמש במנוע המטרונום הנייטיב. | 'מקורי' means original, not native |
| `metronome.raise` | Raise the tempo by one BPM | הגברת הקצב ב־BPM אחד | העלאת הקצב ב־BPM אחד | 'הגברה' is for volume; tempo is raised (העלאה) |
| `metronome.sound` | Sound | רמזים | צליל | Mistranslation: 'Sound' rendered as 'cues'; duplicates metronome.cues |
| `metronome.clickOn` | Click on | נקישה על | קליק על | Musicians say קליק; matches metronome.voiceClick |
| `metronome.feel.a11y` | Click on {{label}} | נקישה על {{label}} | קליק על {{label}} | Musicians say קליק; matches metronome.clickOn |
| `metronome.pulse.rest` | rest | שקט | הפסק | Musical rest is 'הפסק' in Hebrew |
| `metronome.voiceA11y` | Click sound: {{label}} | צליל הנקישה: {{label}} | צליל הקליק: {{label}} | Musicians say קליק; the option itself is labelled קליק |
| `metronome.marking.adagio` | Adagio | אדג׳ו | אדאג׳ו | Misspelled; reads 'adgo'; standard Hebrew is אדאג׳ו |

## tuner

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `tuner.tuneUp` | Tune up | יש לכוון למעלה | כוונו למעלה | 'יש ל' is bureaucratic; house style is plural imperative |
| `tuner.tuneDown` | Tune down | יש לכוון למטה | כוונו למטה | 'יש ל' is bureaucratic; house style is plural imperative |
| `tuner.detectorUnavailable` | Pitch detector is unavailable. Rebuild the native app to use the tuner. | גלאי הגובה אינו זמין. יש לבנות מחדש את היישום המקורי כדי להשתמש בטיונר. | גלאי הגובה אינו זמין. יש לבנות מחדש את האפליקציה הנייטיב כדי להשתמש בטיונר. | 'היישום המקורי' means original app, not native |

## bluetoothCalibrationWarnings

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `bluetoothCalibrationWarnings.farFromReported` | Music measured {{music}} ms; the phone reports about {{reported}} ms. Try again to be sure. | המוזיקה נמדדה {{music}} מ״ש; הטלפון מדווח כ־{{reported}} מ״ש. נסו שוב כדי לוודא. | השהיית המוזיקה נמדדה ב־{{music}} מ״ש; הטלפון מדווח כ־{{reported}} מ״ש. נסו שוב כדי לוודא. | 'The music was measured X ms' is a literal calque |

## bluetoothCalibration

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `bluetoothCalibration.fineTuneSaved` | Fine-tune | כוונון | כוונון עדין | Lost 'fine'; plain כוונון reads as tuning |
| `bluetoothCalibration.musicMeta` | Guides and layers | מנחים ושכבות | גייד ושכבות | 'מנחים' reads as hosts; musicians say גייד |
| `bluetoothCalibration.musicInstruction` | Tap with every beep. A few beats stay silent; skip those. | הקישו עם כל צפצוף. כמה פעמות שקטות; דלגו עליהן. | הקישו עם כל צפצוף. כמה פעמות יהיו שקטות; דלגו עליהן. | Missing verb makes the middle clause a fragment |
| `bluetoothCalibration.retry` | Try again | שוב | ניסיון נוסף | Bare 'שוב' is not a button label |
| `bluetoothCalibration.inconsistent` | Taps were uneven. Keep a steady pulse and try again. | ההקשות לא היו אחידות. שמרו על דופק יציב ונסו שוב. | ההקשות לא היו אחידות. שמרו על קצב יציב ונסו שוב. | 'דופק' is heartbeat; musicians say קצב |

## editor

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `editor.noPartsRemove` | Each part you remove is cut out. | כל חלק שתסירו ייחתך החוצה. | כל חלק שתסירו ייחתך מהקטע. | 'ייחתך החוצה' is a calque of 'cut out' |
| `editor.noRoom` | No room | אין מספיק מקום | קצר מדי | Reads as storage full (same as recording.noSpaceTitle); it's part length |
| `editor.noRoomBody` | Parts must be at least 1 second. | אורך כל חלק לפחות שנייה אחת. | כל חלק צריך להיות באורך שנייה לפחות. | Verbless fragment; reads ungrammatical |

## restoreGate

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `restoreGate.summary` | {{items}} across {{workspaces}} restored. | שוחזרו {{items}} ב־{{workspaces}}. | שוחזרו: {{items}} · {{workspaces}}. | Breaks with singular counts ('שוחזרו פריט אחד', 'ב־מרחב') |

## search

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `search.openIn` | Open in {{name}} | פתיחה בתוך {{name}} | פתיחה ב־{{name}} | "בתוך" is a calque of "in"; plain ב־ is natural |
| `search.contextLyricPadPinned` | Lyric Pad · Pinned | פנקס מילים · מוצמד | פנקס מילים · נעוץ | Pinned pages are נעוצים elsewhere (modals.pinned, notepad.pinned) |
| `search.clipTitle` | Clip title | כותרת קטע | שם הקטע | A clip has a name; matches songDetail.clipTitle |

## modals

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `modals.clipTitle` | Clip title | כותרת הקטע | שם הקטע | Consistency with songDetail.clipTitle/songTitle (שם) |
| `modals.pinsDropped_one` | {{count}} pin | סיכה אחת | סמן אחד | Glossary: pin=סמן; סיכה appears nowhere else |
| `modals.pinsDropped_two` | {{count}} pins | {{count}} סיכות | שני סמנים | Glossary pin=סמן; dual form spelled out like other _two |
| `modals.pinsDropped_other` | {{count}} pins | {{count}} סיכות | {{count}} סמנים | Glossary: pin=סמן |
| `modals.pinNamePlaceholder` | Pin name | שם הסיכה | שם הסמן | Glossary: pin=סמן |
| `modals.saving` | Saving… | מתבצעת שמירה… | שמירה… | Officialese; short form matches app voice |

## activity

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `activity.itemCount_two` | {{count}} ideas | שני פריטים | שני רעיונות | Glossary: idea=רעיון; _one/_other already use it |
| `activity.onShelf` | Shelved for 7 days | במדף ל־7 ימים | על המדף ל־7 ימים | Things sit על המדף, as in setAsideHint |

## lyrics

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `lyrics.discardTitle` | Discard changes? | לבטל שינויים? | לבטל את השינויים? | Missing definite article; matches songDetail.discardChangesTitle |
| `lyrics.discard` | Discard | ביטול | ביטול שינויים | Bare ביטול reads as Cancel beside Keep editing |
| `lyrics.deleteCurrent` | Delete the current lyrics version? The next newest version will become current. | למחוק את גרסת המילים הנוכחית? הגרסה החדשה הבאה תהפוך לנוכחית. | למחוק את גרסת המילים הנוכחית? הגרסה הקודמת לה תהפוך לנוכחית. | "החדשה הבאה" misreads as a newer version; it's the previous one |
| `lyrics.refSetlists_one` | one setlist | רשימת שירים אחת | סטליסט אחד | Glossary: setlist=סטליסט |
| `lyrics.refSetlists_two` | {{count}} setlists | שתי רשימות שירים | שני סטליסטים | Glossary: setlist=סטליסט |
| `lyrics.refSetlists_other` | {{count}} setlists | {{count}} רשימות שירים | {{count}} סטליסטים | Glossary: setlist=סטליסט |
| `lyrics.refFallback` | Used by {{used}} — they’ll show the latest words instead. | בשימוש אצל {{used}} — יוצגו שם המילים העדכניות במקום. | מופיעה ב־{{used}} — שם יוצגו מעכשיו המילים העדכניות. | "בשימוש אצל" and dangling "במקום" are calques |

## chordEditor

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `chordEditor.helpThesis` | Place chords above the words, then fine-tune by dragging. | מקמו אקורדים מעל המילים וכוונו אותם בגרירה. | מקמו אקורדים מעל המילים ודייקו את המיקום בגרירה. | כוונו reads as tuning to a musician |
| `chordEditor.helpAddDesc` | Tap a word where you want the chord to sit. | לחצו על מילה במקום שבו האקורד צריך לשבת. | לחצו על המילה שמעליה יופיע האקורד. | "צריך לשבת" is a literal calque of "sit" |
| `chordEditor.textDesc` | Plain chords-over-lyrics to share or paste into other apps. | אקורדים מעל מילים בטקסט פשוט לשיתוף או להדבקה ביישומים אחרים. | אקורדים מעל מילים בטקסט פשוט לשיתוף או להדבקה באפליקציות אחרות. | יישומים is formal; everyone says אפליקציות |

## chordChart

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `chordChart.blankBody` | Lay out the sections, then tap a bar to add chords. | פרסו את החלקים, ואז הקישו על תיבה כדי להוסיף אקורדים. | סדרו את החלקים, ואז הקישו על תיבה כדי להוסיף אקורדים. | פרסו is a literal "lay out" |
| `chordChart.textBlockOptions` | Text block options | אפשרויות קטע הטקסט | אפשרויות בלוק הטקסט | קטע = clip in glossary; avoid collision |
| `chordChart.textBlockPlaceholder` | Write a free-form block — a spoken part, an arrangement note… | כתבו קטע חופשי — חלק מדובר, הערת עיבוד… | כתבו בלוק חופשי — קטע דיבור, הערת עיבוד… | Avoid קטע for block; חלק מדובר is stiff |
| `chordChart.deleteTextBlock` | Delete text block | מחיקת קטע טקסט | מחיקת בלוק טקסט | קטע = clip in glossary |
| `chordChart.deleteTextTitle` | Delete text block? | למחוק את קטע הטקסט? | למחוק את בלוק הטקסט? | קטע = clip in glossary |
| `chordChart.deleteTextBody` | This text block will be removed. | קטע הטקסט יוסר. | בלוק הטקסט יוסר. | קטע = clip in glossary |
| `chordChart.textBlock` | Text block | קטע טקסט | בלוק טקסט | קטע = clip in glossary |
| `chordChart.presets.Intro` | Intro | פתיחה | פתיח | Musicians call the intro פתיח |

## songDetail

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `songDetail.parentPrompt_two` | Tap the take these {{count}} grew from. | הקישו על הטייק שממנו צמחו שני אלה. | הקישו על הטייק שממנו צמחו שני הטייקים האלה. | "שני אלה" is broken; needs a noun |
| `songDetail.parentPrompt_other` | Tap the take these {{count}} grew from. | הקישו על הטייק שממנו צמחו {{count}} אלה. | הקישו על הטייק שממנו צמחו {{count}} הטייקים האלה. | "{{count}} אלה" is ungrammatical; needs a noun |
| `songDetail.branch` | Copy out | העתקה החוצה | הוצאת עותק | "העתקה החוצה" is a literal calque |
| `songDetail.split` | Move out | העברה החוצה | הוצאה מהשרשור | "העברה החוצה" is a calque; say what it leaves |
| `songDetail.branched` | Copied out “{{title}}” | „{{title}}” הועתק החוצה | הוצא עותק של „{{title}}” | Calque of "copied out"; matches הוצאת עותק |
| `songDetail.makePrimaryBody` | It plays for this sketch everywhere. Only one take is primary. | הוא מתנגן בשם הסקיצה בכל מקום. רק טייק אחד יכול להיות ראשי. | הוא יתנגן בכל מקום שבו הסקיצה מופיעה. רק טייק אחד יכול להיות ראשי. | "בשם הסקיצה" reads as "in the sketch's name" |
| `songDetail.sharing` | Sharing… | משתף… | שיתוף… | Avoid gendered present; neutral noun like other progress labels |
| `songDetail.startThread` | Stand alone | עמידה בפני עצמו | ניתוק מהשרשור | "עמידה בפני עצמו" is ungrammatical as a button |
| `songDetail.newestFirst` | Newest first — tap for oldest first | החדש ביותר קודם — לחצו להצגת הישן קודם | מהחדש לישן — לחצו להפוך את הסדר | Word-for-word; Hebrew says מהחדש לישן |
| `songDetail.oldestFirst` | Oldest first — tap for newest first | הישן ביותר קודם — לחצו להצגת החדש קודם | מהישן לחדש — לחצו להפוך את הסדר | Word-for-word; Hebrew says מהישן לחדש |
| `songDetail.collapseAll` | Collapse all | צמצום הכול | כיווץ הכול | Standard UI term for collapse is כיווץ |
| `songDetail.yesRemove` | Discard | ביטול | מחיקה | ביטול reads as Cancel on a destructive confirm |
| `songDetail.yesDiscard` | Discard | ביטול | ביטול שינויים | Bare ביטול reads as Cancel on a destructive confirm |

## wordSparks

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `wordSparks.saveUnfinishedTitle` | Save as unfinished? | לשמור כלא גמור? | לשמור כטיוטה? | "כלא גמור" is clumsy; button already says טיוטה |
| `wordSparks.keepWorking` | Keep working | להמשיך לעבוד | המשך עבודה | Button style; matches lyrics.keepEditing המשך עריכה |
| `wordSparks.redo` | Redo | ביצוע מחדש | ביצוע חוזר | Inconsistent with lyrics.redo / chordChart.redo |

## cutUp

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `cutUp.compose` | Compose | הלחנה | כתיבה | הלחנה means composing music; this step writes the draft |
| `cutUp.startingLyric` | Your starting lyric | טקסט המילים ההתחלתי | המילים שמהן מתחילים | Stiff, bureaucratic construct chain |
| `cutUp.remixDraft` | Remix draft | ערבוב הטיוטה | רמיקס לטיוטה | Collides with Shuffle (ערבוב); musicians say רמיקס |
| `cutUp.poolAll` | Pool all scraps | לאסוף את כל הפתקים | איסוף כל הפתקים | Button style: infinitive noun |
| `cutUp.tableReassure` | Don’t worry about tense, grammar, or perfect order — arrange the scraps loosely, and shape them into a real draft next. | אל תדאגו לזמן, לדקדוק או לסדר מושלם — סדרו את הפתקים בחופשיות, ובשלב הבא תעצבו מהם טיוטה אמיתית. | אל תדאגו להטיות, לדקדוק או לסדר מושלם — סדרו את הפתקים בחופשיות, ובשלב הבא תעצבו מהם טיוטה אמיתית. | "זמן" reads as time, not grammatical tense |
| `cutUp.tableHintShort` | Loose is fine. Scraps on one rule make a line. | בחופשיות. פתקים על אותו קו יוצרים שורה. | לא חייב להיות מדויק. פתקים על אותו קו יוצרים שורה. | A bare "בחופשיות." is a fragment that doesn't land |

## cutUpHelp

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `cutUpHelp.composeTitle` | Remix draft | ערבוב הטיוטה | רמיקס לטיוטה | Match cutUp.remixDraft; distinct from Shuffle |
| `cutUpHelp.pullTitle` | Pull from a page | משיכה מעמוד | ייבוא מעמוד | משיכה is a literal "pull" |
| `cutUpHelp.lockedBody` | editing it later restarts your cuts and table | עריכה מאוחרת יותר מתחילה מחדש את החיתוכים והשולחן | עריכה בהמשך מאפסת את החיתוכים והשולחן | Transitive "מתחילה מחדש את" is a calque |
| `cutUpHelp.lineTitle` | Line breaks always cut | שבירת שורה תמיד חותכת | ירידת שורה תמיד חותכת | Israelis say ירידת שורה, not שבירת שורה |

## magpie

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `magpie.pocketThis` | Collect | לאסוף את זה | איסוף | Button style; "את זה" is padding |
| `magpie.pocketCount_one` | Collect {{count}} word | לאסוף קטע אחד | איסוף מילה אחת | Meaning drift (word→קטע, which is clip); button style |
| `magpie.pocketCount_two` | Collect {{count}} words | לאסוף שני קטעים | איסוף שתי מילים | Meaning drift (word→קטע, which is clip); button style |
| `magpie.pocketCount_other` | Collect {{count}} words | לאסוף {{count}} קטעים | איסוף {{count}} מילים | Meaning drift (word→קטע, which is clip); button style |
| `magpie.genreSettings` | Source genres | סוגות המקור | ז׳אנרים | סוגות is academic; ז׳אנרים is what people say |
| `magpie.genre.memoir` | Memoir | זכרונות | זיכרונות | Standard full spelling is זיכרונות |
| `magpie.splitHere` | Split here | פצל כאן | פיצול כאן | Masculine imperative breaks house button style |
| `magpie.markUnused` | Mark unused | סמן כלא בשימוש | סימון כלא משומש | Masculine imperative breaks house button style |
| `magpie.markUsed` | Mark used | סמן כבשימוש | סימון כמשומש | Masculine imperative; "כבשימוש" is clumsy |
| `magpie.connectionTitle` | Borrowed Words needs a connection | מילים שאולות זקוק לחיבור לרשת | „מילים שאולות” דורש חיבור לרשת | Reads as plural noun with singular verb; quote the tool name |
| `magpie.rebuildBody` | This replaces the draft with the current fragment order. Your edits here will be lost. | הטיוטה תוחלף בסדר הנוכחי של הקטעים. העריכות כאן יאבדו. | הטיוטה תוחלף בסדר הנוכחי של המילים. העריכות כאן יאבדו. | קטעים = clips in glossary; these are words |

## magpieHelp

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `magpieHelp.pageBody` | Hum a melody and tap the words that sound right against it, or catch your eye. | זמזמו מנגינה ולחצו על המילים שנשמעות נכון מולה, או תופסות לכם את העין. | זמזמו מנגינה ולחצו על מילים שיושבות עליה טוב, או שתופסות לכם את העין. | Musicians say words יושבות על מנגינה; "מולה" is literal |
| `magpieHelp.pageExampleBefore` | …the  | …אור  | … | Marked phrase should be the whole "אור הנמל", as in pileExample |
| `magpieHelp.pageExampleMark1` | harbour light | הנמל | אור הנמל | Highlight must match the collected "אור הנמל" below |
| `magpieHelp.looseFragments` | From loose words | ממילים חופשיות | ממילים בודדות | "חופשיות" means free, not loose/scattered |

## wordLadder

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `wordLadder.sparkHint` | Tap one you’ve used | לחצו על זוג ששימש אתכם | לחצו על זוג שכבר השתמשתם בו | "ששימש אתכם" is stiff |
| `wordLadder.draftPlaceholder` | Write loosely. Bend them. | כתבו בחופשיות. כופפו אותם. | כתבו בחופשיות. שחקו איתם. | "כופפו" is a literal "bend"; meaningless for words |
| `wordLadder.titleBoth` | The {{role}} in the {{place}} | {{role}} בתוך {{place}} | {{role}} ב{{place}} | "בתוך" is stiff; matches nounsHint's ב{{place}} |
| `wordLadder.noPairs` | Tap a verb, then a noun. Or Shuffle. | לחצו על פועל ואז על שם עצם. או ערבוב. | לחצו על פועל ואז על שם עצם, או על ערבוב. | "או ערבוב." dangles; needs the verb |
| `wordLadder.unlock` | Unlock pair | פתיחת זוג | ביטול נעילת הזוג | "פתיחת זוג" reads as opening; matches cutUp.unlock |
| `wordLadder.removed` | Removed “{{word}}” | “{{word}}” הוסרה | „{{word}}” הוסרה | Hebrew quote style used everywhere else |
| `wordLadder.matchVerbs` | {{count}} more {{side}} to match your {{verbs}}. | עוד {{count}} {{side}} כדי להתאים ל{{verbs}}. | עוד {{count}} {{side}} כדי להתאים ל־{{verbs}}. | {{verbs}} may start with a digit; prefix needs maqaf |
| `wordLadder.overVerbs` | {{count}} more than your {{verbs}}. | {{count}} יותר מ{{verbs}}. | {{count}} יותר מ־{{verbs}}. | {{verbs}} may start with a digit; prefix needs maqaf |

## wordLadderHelp

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `wordLadderHelp.tapTitle` | Tap across | לחיצה לרוחב | לחיצה מצד לצד | "לרוחב" is a literal "across" |
| `wordLadderHelp.draftBody` | Write loose lines from your pairs. Bend them, drop some, forget meaning. | כתבו שורות חופשיות מהזוגות. כופפו אותם, וותרו על חלק, שכחו מהמשמעות. | כתבו שורות חופשיות מהזוגות. שחקו איתם, ותרו על חלק, שכחו מהמשמעות. | "כופפו" literal; ותרו spelling |
| `wordLadderHelp.sparksBody` | use a pair, bend it, or skip it | השתמשו בזוג, כופפו אותו או דלגו | השתמשו בזוג, שנו אותו או דלגו | "כופפו" is a literal "bend" |

## wordFinderUi

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `wordFinderUi.addThemeA11y` | Add a theme to bias results toward your song’s subject | הוספת נושא שיטה את התוצאות לעבר נושא השיר | הוספת נושא שיכוון את התוצאות לנושא השיר | "שיטה" reads as "method"; לעבר is stiff |
| `wordFinderUi.adverb` | adverb | תואר הפועל | תואר פועל | Part-of-speech label takes no definite article |
| `wordFinderUi.near` | Near | כמעט | קרובים | "כמעט" alone means "almost"; near rhymes = חרוזים קרובים |
| `wordFinderUi.llmFind` | Find words | מצא מילים | חיפוש מילים | Masculine imperative breaks house button style |
| `wordFinderUi.llmSub` | Meaning lookups run on demand. | חיפושי משמעות פועלים לפי בקשה. | חיפוש לפי משמעות רץ רק כשמבקשים. | "פועלים לפי בקשה" is translated-sounding |
| `wordFinderUi.soundSoon` | This sound tool isn’t available in Hebrew yet. | כלי הצליל הזה עדיין אינו זמין בעברית. | כלי הצליל הזה עדיין לא זמין בעברית. | "אינו" is formal register |
| `wordFinderUi.scriptUnsupported` | Word lookup isn’t available for this script yet. | חיפוש מילים אינו זמין עדיין עבור כתב זה. | חיפוש מילים עדיין לא זמין בכתב הזה. | Formal "אינו… עבור כתב זה" register |

## transferReceive

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `transferReceive.setlistSaved` | Setlist saved | רשימת השירים נשמרה | הסטליסט נשמר | Glossary: setlist=סטליסט, matches savesToSetlist |
| `transferReceive.parcel` | A parcel for you | חבילה עבורך | חבילה בשבילכם | Plural address per house style; עבורך is stiff |
| `transferReceive.sentMusic` | Someone sent you music | מישהו שלח לך מוזיקה | מישהו שלח לכם מוזיקה | Plural address per house style |
| `transferReceive.alreadySavedBody` | This transfer is in your library. | ההעברה הזו נמצאת בספרייה שלך. | ההעברה הזו כבר בספרייה שלכם. | Plural address per house style |

## defaults

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `defaults.untitledSetlist` | Untitled setlist | רשימת שירים ללא כותרת | סטליסט ללא כותרת | Glossary: setlist=סטליסט |
| `defaults.recoveredCollection` | Recovered | משוחזר | משוחזרים | Collection name of items; adjective should be plural |

## pro

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `pro.features.0.title` | Charts and setlists | תרשימים וסטים | תרשימים וסטליסטים | Setlists, not 'sets'; glossary סטליסט |
| `pro.features.4.title` | Lyric Spark | ניצוץ ליריקה | ניצוץ למילים | Lyric Spark is ניצוץ למילים everywhere else |
| `pro.features.2.blurb` | Loop a part, slow it down, change the key. | לחזור על קטע, להאט, לשנות סולם. | לנגן חלק בלולאה, להאט, לשנות סולם. | קטע=clip in glossary; loop=לולאה |
| `pro.getPro` | Get Pro | לקבל Pro | שדרוג ל־Pro | Buttons are infinitive nouns per house style |

## duplicateReview

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `duplicateReview.alreadyLibrary` | Already in your library | כבר בספרייה שלך | כבר בספרייה שלכם | Plural address per house style |
| `duplicateReview.subsetBody` | Ticked files are imported. Ones you already have start unticked. | הקבצים המסומנים ייובאו. מה שכבר קיים אצלכם מתחיל לא מסומן. | הקבצים המסומנים ייובאו. קבצים שכבר קיימים אצלכם לא מסומנים מראש. | 'מתחיל לא מסומן' is a word-for-word calque |

## workspaceArchive

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `workspaceArchive.lighter` | Your working library got {{size}} lighter. Restore it anytime. | הספרייה הפעילה שלך קלה יותר ב־{{size}}. אפשר לשחזר בכל עת. | הספרייה הפעילה שלכם קלה יותר ב־{{size}}. אפשר לשחזר בכל עת. | Plural address per house style |
| `workspaceArchive.offloadedFailure` | {{workspace}}: its package is in your storage — unarchive it on its own to pick the file. | {{workspace}}: החבילה נמצאת באחסון שלך — יש לשחזר אותו בנפרד כדי לבחור את הקובץ. | {{workspace}}: החבילה נמצאת באחסון שלכם — שחזרו אותו בנפרד כדי לבחור את הקובץ. | Plural address; drop bureaucratic יש ל |
| `workspaceArchive.workspaceActionFailed` | {{workspace}}: Could not {{action}} this workspace. | {{workspace}}: לא ניתן {{action}} את מרחב העבודה הזה. | {{workspace}}: ה{{action}} נכשל. | {{action}} is a noun (ארכוב); 'לא ניתן ארכוב' is ungrammatical |
| `workspaceArchive.actionSuccess_one` | One workspace {{action}}. | מרחב עבודה אחד {{action}}. | {{action}}: מרחב עבודה אחד. | {{action}} is plural (אורכבו); disagrees with singular subject |

## errorBoundary

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `errorBoundary.body` | SongNook hit an unexpected error. Your clips and library are safe on this device — restarting will bring everything back. | SongNook נתקל בשגיאה לא צפויה. הקטעים והספרייה שלך בטוחים במכשיר — הפעלה מחדש תחזיר הכול. | SongNook נתקל בשגיאה לא צפויה. הקטעים והספרייה שלכם שמורים במכשיר — הפעלה מחדש תחזיר הכול. | Match recovery.errorBody; plural address |

## reading

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `reading.capoForPlaybackA11y` | Keep the shapes with a capo on fret {{fret}} | שמירת הצורות עם קאפו בסריג {{fret}} | שמירת תנוחות האקורדים עם קאפו בסריג {{fret}} | 'צורות' is a calque; guitarists say תנוחות |

## setlistSong

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `setlistSong.pinCount_one` | 1 pin | סימון אחד | סמן אחד | Glossary: pin=סמן |
| `setlistSong.pinCount_two` | {{count}} pins | שני סימונים | שני סמנים | Glossary: pin=סמן |
| `setlistSong.pinCount_other` | {{count}} pins | {{count}} סימונים | {{count}} סמנים | Glossary: pin=סמן |

## mediaDock

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `mediaDock.previewPlaying` | Preview playing | תצוגה מקדימה מתנגנת | האזנה מקדימה מתנגנת | תצוגה is visual; audio preview is האזנה |

## importBanner

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `importBanner.done` | Imported | יובא | הייבוא הושלם | Bare 'יובא' reads as masculine-singular fragment |

## libraryProcess

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `libraryProcess.canMinimize` | Minimize to keep working. It waits at the bottom. | אפשר למזער ולהמשיך לעבוד. זה ימתין למטה. | אפשר למזער ולהמשיך לעבוד. התהליך ימתין בתחתית המסך. | 'זה ימתין למטה' is a literal calque |

## notepad

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `notepad.looseLines` | Verses, hooks, and lines that don’t have a song yet. | בתים, פזמונים ושורות שעדיין אין להם שיר. | בתים, הוקים ושורות שעדיין אין להם שיר. | Hooks are הוקים; פזמונים means choruses |
| `notepad.noSparksHint` | Short games that shake loose a line. | משחקים קצרים שמשחררים שורה. | משחקים קצרים שמחלצים שורה חדשה. | 'משחררים שורה' is a literal calque of shake loose |

## welcome

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `welcome.organizeTitle` | Workspaces hold collections | מרחבי עבודה מחזיקים אוספים | מרחבי עבודה מכילים אוספים | 'מחזיקים' is a calque of hold |
| `welcome.writeBody` | Lyric versions live in the sketch. Lyric Pad holds loose lines; Lyric Spark knocks new ones loose. | גרסאות המילים חיות בסקיצה. פנקס המילים שומר שורות חופשיות; ניצוץ למילים מקפיץ חדשות. | גרסאות המילים נשמרות בסקיצה. פנקס המילים אוסף שורות בודדות; ניצוץ למילים מחלץ חדשות. | 'חיות', 'מקפיץ' are calques; smoother verbs |
| `welcome.importEyebrow` | Bring it with you | לקחת אתכם | להביא איתכם | 'לקחת אתכם' means take you along, wrong sense |
| `welcome.importing` | Importing {{current}} of {{total}}… | ייבוא {{current}} מתוך {{total}}… | מייבא {{current}} מתוך {{total}}… | Progress uses present tense, like importBanner.progressMany |
| `welcome.importingHint` | You can tap Start — the import keeps going on its own. | אפשר ללחוץ על מתחילים — הייבוא ימשיך ברקע. | אפשר ללחוץ על „מתחילים” — הייבוא ימשיך ברקע. | Quote the button name; bare verb reads oddly |
| `welcome.paneA11y` | Go to pane {{number}} of {{total}} | מעבר ללוח {{number}} מתוך {{total}} | מעבר לשלב {{number}} מתוך {{total}} | לוח means board; onboarding panes are steps |

## takesHelp

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `takesHelp.primaryBody` | One take plays for the sketch everywhere. Set it from its menu. | טייק אחד מתנגן בשם הסקיצה בכל מקום. מגדירים אותו מהתפריט שלו. | טייק אחד מייצג את הסקיצה בכל מקום. מגדירים אותו מהתפריט שלו. | 'מתנגן בשם הסקיצה' is an unclear calque |
| `takesHelp.viewsBody` | Evolution stacks each take’s versions; off, every take by date. | התפתחות עורמת את גרסאות כל טייק; כבויה, כל הטייקים לפי תאריך. | בתצוגת התפתחות, הגרסאות של כל טייק נערמות; בלעדיה, כל הטייקים לפי תאריך. | Literal 'off' (כבויה) unclear; restructured naturally |
| `takesHelp.branchLabel` | Stand alone | עמידה בפני עצמו | טייק עצמאי | 'עמידה בפני עצמו' is an awkward noun calque |

## sendSheet

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `sendSheet.notePlaceholder` | ex: Learn song two first… | לדוגמה: קודם ללמוד את שיר שתיים… | לדוגמה: קודם ללמוד את השיר השני… | 'שיר שתיים' is a calque of 'song two' |

## shareLink

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `shareLink.tooLargeBody` | Links carry up to {{limit}}. Share as a file instead. | קישור נושא עד {{limit}}. שתפו כקובץ במקום. | בקישור אפשר לשלוח עד {{limit}}. שתפו כקובץ במקום. | 'קישור נושא' is a calque of 'links carry' |

## selection

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `selection.shelfOne` | Shelved for 7 days | במדף ל־7 ימים | על המדף ל־7 ימים | Hebrew idiom is על המדף, not במדף |
| `selection.shelfCount` | {{count}} shelved for 7 days | {{count}} במדף ל־7 ימים | {{count}} על המדף ל־7 ימים | Hebrew idiom is על המדף, not במדף |
| `selection.bookmark` | Bookmark | סימון | סימנייה | סימון clashes with pin; bookmark is סימנייה |
| `selection.removeBookmark` | Remove bookmark | הסרת סימון | הסרת סימנייה | Bookmark is סימנייה |

## clipLineage

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `clipLineage.versionTag` | v{{number}} | V{{number}} | v{{number}} | Lowercase v matches welcome v1/v2 and English |
| `clipLineage.olderShort_one` | {{count}} older | אחת קודמת | קודמת אחת | Number follows noun in Hebrew; 'אחת קודמת' sounds off |

## songClipboard

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `songClipboard.otherCount_one` |  and {{count}} other |  ועוד קטע אחד |  ועוד אחד | Items are takes/clips; neutral avoids wrong noun |
| `songClipboard.otherCount_two` |  and {{count}} others |  ועוד שני קטעים |  ועוד שניים | Items are takes/clips; neutral avoids wrong noun |
| `songClipboard.otherCount_other` |  and {{count}} others |  ועוד {{count}} קטעים |  ועוד {{count}} | Items are takes/clips; neutral avoids wrong noun |

## recovery

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `recovery.clipRecoveredBody` | “{{title}}” was saved after SongNook closed unexpectedly. | “{{title}}” נשמר אחרי ש-SongNook נסגר באופן לא צפוי. | „{{title}}” נשמר אחרי ש־SongNook נסגר באופן לא צפוי. | Hebrew quotes „” and maqaf, like rest of file |
| `recovery.clipRecoveryFailedBody` | An unfinished clip from last time couldn’t be restored. | לא ניתן היה לשחזר קטע שלא הסתיים מהפעם הקודמת. | לא ניתן היה לשחזר קטע לא גמור מהפעם הקודמת. | Clumsy relative clause word order |
| `recovery.clipEmptyBody` | SongNook closed before the last clip recorded any sound. | SongNook נסגר לפני שהקטע האחרון הקליט צליל כלשהו. | SongNook נסגר לפני שנקלט צליל כלשהו בקטע האחרון. | A clip doesn't record; calque of English subject |
| `recovery.degradedBody_one` | One workspace couldn’t be read and was set aside. Everything else loaded. A backup can restore it. | מרחב עבודה אחד לא נקרא והופרש בצד. כל השאר נטען. גיבוי יכול לשחזר אותו. | מרחב עבודה אחד לא נקרא והונח בצד. כל השאר נטען. גיבוי יכול לשחזר אותו. | 'הופרש בצד' is wrong idiom; הונח בצד |
| `recovery.degradedBody_two` | {{count}} workspaces couldn’t be read and were set aside. Everything else loaded. A backup can restore them. | שני מרחבי עבודה לא נקראו והופרשו בצד. כל השאר נטען. גיבוי יכול לשחזר אותם. | שני מרחבי עבודה לא נקראו והונחו בצד. כל השאר נטען. גיבוי יכול לשחזר אותם. | 'הופרשו בצד' is wrong idiom; הונחו בצד |
| `recovery.degradedBody_other` | {{count}} workspaces couldn’t be read and were set aside. Everything else loaded. A backup can restore them. | {{count}} מרחבי עבודה לא נקראו והופרשו בצד. כל השאר נטען. גיבוי יכול לשחזר אותם. | {{count}} מרחבי עבודה לא נקראו והונחו בצד. כל השאר נטען. גיבוי יכול לשחזר אותם. | 'הופרשו בצד' is wrong idiom; הונחו בצד |

## helpContent

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `helpContent.overdub.thesis` | Layers ride the take. The take stays untouched. | שכבות רוכבות על הטייק. הטייק עצמו נשאר כמו שהוא. | השכבות יושבות על הטייק. הטייק עצמו נשאר כמו שהוא. | 'רוכבות' is a literal calque of ride |
| `helpContent.overdub.layersLabel` | Layers ride the take | שכבות רוכבות על הטייק | השכבות יושבות על הטייק | 'רוכבות' is a literal calque of ride |
| `helpContent.overdub.soundBody` | Saved with the take as you set them. | נשמרים עם הטייק ברגע שמכוונים אותם. | נשמרים עם הטייק כפי שכיוונתם אותם. | 'as you set them' means how, not when |
| `helpContent.overdub.timingBody` | Grey wave is the take, coloured is the layer. Slide it until it locks. | הגל האפור הוא הטייק, הצבעוני הוא השכבה. הזיזו עד שיינעל. | הגל האפור הוא הטייק, הצבעוני הוא השכבה. הזיזו עד שהיא יושבת. | Musicians say a part 'יושב'; ננעל is literal |

## follow-ups

| Key | English | Before | After | Why |
|---|---|---|---|---|
| `workspaceArchive.actionSuccess_one` | One workspace {{action}}. | מרחב עבודה אחד {{action}}. | מרחב עבודה אחד {{actionOne}}. | Verb now agrees with one workspace (אורכב) |
| `storage / restart lines` | app | היישום | האפליקציה | App is אפליקציה everywhere |
| `metronome.pulse.click` | click | נקישה | קליק | Musicians say קליק |
| `overdub.reviewOverdubBody` | …end of the guide take | …לסוף הטייק המנחה | …לסוף הטייק | Drop the 'host' word |
| `collection.destinationSong` | …as one new song | …כשיר חדש אחד | …כסקיצה חדשה אחת | Import makes a sketch (English fixed too) |
