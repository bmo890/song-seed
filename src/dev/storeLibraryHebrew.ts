// __DEV__ only: the Hebrew store library (founder 2026-11-16: the Hebrew
// screenshots must show Hebrew work, not the English library in a Hebrew app).
// Every English string the staging uses, keyed by itself; chords stay Latin, as
// Israeli chord sheets write them. Chord offsets are per line, since the words
// differ in length.

export const HEBREW_STORE_COPY: Record<string, string> = {
  // Workspaces and collections
  "My Songs": "השירים שלי",
  "The Night Boats": "סירות הלילה",
  "Album demos": "דמואים לאלבום",
  "Co-writes with Maya": "כתיבה משותפת עם מאיה",
  "Voice memos": "תזכירים קוליים",
  Rehearsals: "חזרות",
  Live: "הופעות",

  // Sketches
  "Harbor Lights": "אורות הנמל",
  "Paper Moon Motel": "מוטל ירח של נייר",
  "Salt and Cedar": "מלח וארז",
  Northbound: "צפונה",
  "Glass Orchard": "פרדס של זכוכית",
  "Summer in Reverse": "קיץ הפוך",
  "Lantern Street": "רחוב הפנסים",
  "Slow Rivers": "נהרות איטיים",

  // Takes
  "First hum": "זמזום ראשון",
  "Slower, with capo": "לאט יותר, עם קאפו",
  "Chorus lift": "הפזמון עולה",
  "Live at rehearsal": "לייב בחזרה",
  "Acoustic, porch": "אקוסטי, במרפסת",
  "Bridge idea from Maya": "רעיון לגשר ממאיה",
  "Verse idea": "רעיון לבית",
  "Chorus, faster": "פזמון, מהר יותר",
  Final: "סופי",
  Riff: "ריף",
  "With words": "עם מילים",
  Hum: "זמזום",
  Demo: "דמו",
  "Maya's verse": "הבית של מאיה",
  "Both of us": "שנינו",
  Idea: "רעיון",
  Harmony: "הרמוניה",
  "Harmony here": "כאן ההרמוניה",

  // Clips
  "Night drive riff": "ריף לנסיעת לילה",
  "Bridge idea for Maya": "רעיון לגשר בשביל מאיה",
  "Kitchen piano, 2am": "פסנתר במטבח, שתיים בלילה",
  "Full run, new ending": "ריצה מלאה, סיום חדש",
  "Soundcheck groove": "גרוב מהסאונדצ׳ק",
  "Hotel room chords": "אקורדים בחדר מלון",
  "Whistled melody": "מנגינה בשריקה",
  "Falsetto hook": "הוק בפלסט",
  "Train window lyric": "שורה מחלון הרכבת",
  "Morning coffee riff": "ריף של קפה בבוקר",
  "Chorus melody, humming": "מנגינת פזמון, בזמזום",
  "Blue Room encore": "הדרן בחדר הכחול",

  // Notes and messages
  "Capo 2. Keep the chorus lift soft, let the harmony carry it.": "קאפו 2. הפזמון נשאר רך, ההרמוניה נושאת אותו.",
  "Maya's descending line. Try it before the last chorus.": "הקו היורד של מאיה. לנסות לפני הפזמון האחרון.",
  "Learn the bridge before Friday. The harmony comes in on the chorus.": "ללמוד את הגשר עד שישי. ההרמוניה נכנסת בפזמון.",
  "New chorus. Learn the bridge before Friday.": "פזמון חדש. ללמוד את הגשר עד שישי.",
  "Soft, let it lift": "רך, שיעלה לבד",
  Sam: "נועם",

  // Sections
  Verse: "בית",
  Chorus: "פזמון",
  Bridge: "גשר",
  Outro: "סיום",

  // Lyrics
  "Harbor lights are burning low": "אורות הנמל כמעט כבים",
  "tell me where the night boats go": "לאן הולכות סירות הלילה",
  "Kept your letter folded twice": "שמרתי את המכתב שלך מקופל",
  "like a map to paradise": "כמו מפה לגן עדן",
  "Hold on to the turning tide": "תחזיקי חזק כשהגאות מתהפכת",
  "every light we leave behind": "כל אור שאנחנו משאירים",
  "burns a little longer": "בוער עוד קצת",
  "on the other side": "בצד השני",
  "And the ferry bell is ringing": "ופעמון המעבורת מצלצל",
  "like it knows your name": "כאילו הוא יודע את שמך",
  "Northbound on the evening train": "צפונה ברכבת של הערב",
  "counting stations in the rain": "סופר תחנות בגשם",
  "We ran the summer backwards": "רצנו את הקיץ אחורה",
  "till the fireflies went home": "עד שהגחליליות הלכו הביתה",
  "Lantern Street at closing time": "רחוב הפנסים בשעת סגירה",
  "your coat on my shoulders": "המעיל שלך על הכתפיים שלי",

  // Setlists, playlists, songbook
  "Friday at the Blue Room": "שישי בחדר הכחול",
  "Late night listening": "להאזנה בשעות הקטנות",
  "Rooftop, Oct 4": "על הגג, 4 באוקטובר",
  "Ideas to finish": "רעיונות לסיים",
  "Album running order": "סדר השירים באלבום",
  "Gig book": "ספר ההופעה",
};

/** Where each chord sits in the Hebrew line (character offset), by line id. */
export const HEBREW_CHORD_AT: Record<string, number[]> = {
  "l2-1": [0, 12],
  "l2-2": [0, 13],
  "l2-3": [0, 15],
  "l2-4": [0, 9],
  "l2-6": [0, 15],
  "l2-7": [0, 13],
  "l2-8": [0, 7],
  "l2-9": [0, 5],
  "l2-11": [0, 13],
  "l2-12": [0, 12],
};
