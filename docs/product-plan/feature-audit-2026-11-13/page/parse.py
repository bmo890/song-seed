import re, json, sys, glob, os, hashlib
SUGGEST = {
 "Add a pin": "Make it free (decision 1)",
 "Reset pitch": "Make it free (decision 6)",
 "Rhymes": "Make it free (decision 7)",
 "Export for DAW": "Make it Pro (decision 11)",
 "Move package to Files": "Take it off the Pro list until archiving returns (decision 17)",
 "Start a Word Ladder": "Count a try only once something is written (decision 4)",
 "Start a Cut-Up": "Count a try only once something is written (decision 4)",
 "Start a Borrowed Words": "Count a try only once something is written (decision 4)",
}
SEEN = {}
def rid(*parts):
    h = "f" + hashlib.md5("|".join(parts).encode()).hexdigest()[:10]
    n = SEEN.get(h, 0); SEEN[h] = n + 1
    return h if n == 0 else h + "-" + str(n)
SRC = "/Users/benmogerman/Projects/song-seed/docs/product-plan/feature-audit-2026-11-13"
AREAS = [
 ("Capture", ["Recording", "Recording with a click", "Recording a layer", "Bluetooth timing and calibration", "Importing audio and video"]),
 ("Instruments", ["Tuner", "Metronome"]),
 ("Library", ["Workspaces", "Collections", "The collection page", "Idea cards", "Sorting and filtering", "Tags, stages and bookmarks", "Selecting and bulk actions", "Sketches and takes", "Versions", "Playlists"]),
 ("Finding your way", ["Search", "Shelf", "Revisit", "Activity", "View in collection", "Recently deleted", "Side menu"]),
 ("Listening and practice", ["Playing back", "Queue", "The reel", "Marks", "Practice tools", "Tempo and grid", "Sound", "Pages under the reel", "Other rows"]),
 ("Layers and editing", ["Layers", "Editing a clip", "Exporting audio"]),
 ("Words", ["Lyrics on a sketch", "Lyric versions", "Words with the tape", "Lyric Pad", "Word Finder", "Lyric Spark"]),
 ("Charts and the stage", ["Chord charts", "Transpose and capo", "Compilations hub", "Chart books", "Setlists", "Stage reader", "Exporting words and charts"]),
 ("Sharing", ["SongNook Send", "Sharing and exporting files"]),
 ("Your data", ["Backup and restore", "Storage and archive", "Data safety"]),
 ("The app, settings and Pro", ["First run", "Settings", "Languages", "Pro, the free month", "Help and feedback", "What the app does not have"]),
]
SKIP_H2 = ("Built but not reachable", "Worth a decision", "Not sure", "Read this first")
SKIP_H3 = ("Every place the Pro page opens", "Dev-only")
def area_of(h2):
    for a, keys in AREAS:
        for k in keys:
            if h2.startswith(k): return a
    return None
def clean(s):
    s = s.replace("\x00", "|").strip()
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = s.replace("`", "")
    return s
def status(st, feat):
    st = clean(st)
    if feat.startswith("Eight-layer limit"): return ("free", "", "applies with Pro too")
    m = re.match(r"Free up to (.+?), then Pro\s*(.*)$", st)
    if m: return ("limit", m.group(1), m.group(2).strip(" ()·"))
    if st.startswith("Pro (the purchase"): return ("plan", "", "")
    if st.startswith("Pro"): return ("pro", "", st[3:].strip(" ()·,").replace(" · ", " · "))
    if st.startswith("Free"): return ("free", "", st[4:].strip(" ()·,"))
    return (None, "", st)
out = {a: {} for a, _ in AREAS}; order = {a: [] for a, _ in AREAS}
unknown = set(); bad = []
for f in sorted(glob.glob(SRC + "/0[1-5]-*.md")):
    h2 = h3 = None; valid = False
    for line in open(f, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("## "): h2 = line[3:].strip(); h3 = None; valid = False; continue
        if line.startswith("### "): h3 = line[4:].strip(); valid = False; continue
        if not line.startswith("|"): valid = False if not line.strip() else valid; continue
        cells = [c for c in line.replace("\\|", "\x00").strip().strip("|").split("|")]
        cells = [c.strip() for c in cells]
        if cells[:3] == ["Feature", "What it does", "Status"]: valid = True; continue
        if set("".join(cells)) <= set("-: "): continue
        if not valid or h2 is None or h2.startswith(SKIP_H2): continue
        if h3 and h3.startswith(SKIP_H3): continue
        if len(cells) < 3: bad.append((f, line)); continue
        feat, what, st = clean(cells[0]), clean(cells[1]), cells[2]
        kind, lim, note = status(st, feat)
        if kind is None: bad.append((os.path.basename(f), feat, st)); continue
        if "dev builds only" in note: continue
        a = area_of(h2)
        if a is None: unknown.add(h2); continue
        cat = re.sub(r"\s*\(.*\)$", "", h2)
        key = cat
        if key not in out[a]: out[a][key] = {}; order[a].append(key)
        sub = re.sub(r"\s*\(.*\)$", "", h3) if h3 else ""
        out[a][key].setdefault(sub, []).append([feat, what, kind, lim, note, rid(a, cat, sub, feat), SUGGEST.get(feat, "")])
data = []
tot = {"free": 0, "pro": 0, "limit": 0, "plan": 0}
for a, _ in AREAS:
    cats = []
    for c in order[a]:
        groups = [{"n": s, "r": rows} for s, rows in out[a][c].items()]
        for g in groups:
            for r in g["r"]: tot[r[2]] += 1
        cats.append({"n": c, "g": groups})
    data.append({"n": a, "c": cats})
json.dump(data, open(os.path.dirname(__file__) + "/data.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("totals", tot, "sum", sum(tot.values()))
print("unknown h2:", unknown)
print("bad:", bad[:12], len(bad))
for a in data:
    print(a["n"], sum(len(g["r"]) for c in a["c"] for g in c["g"]), [c["n"] for c in a["c"]])
notes = {}
for a in data:
    for c in a["c"]:
        for g in c["g"]:
            for r in g["r"]:
                if r[4]: notes[r[4]] = notes.get(r[4], 0) + 1
print(sorted(notes.items(), key=lambda x: -x[1])[:40])
