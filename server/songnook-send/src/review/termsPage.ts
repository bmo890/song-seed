/**
 * The terms review page (founder, 2026-11-24: "each item should be a row, clear as day").
 * One row per word: English, the Hebrew the app uses now, a real sentence from the app,
 * a box for the word a musician would say, a Fine key, a note. Then a few whole sentences
 * to hear the tone. A note opens under the word box. Saves each row a moment after typing stops; saves that cannot reach
 * the Worker wait in the browser and go out again. Downloads are always one click.
 */
import { FONT_FACES } from "../pages/shell.ts";

const CSS = `
:root{
  --paper:#f3ecdf; --paper-deep:#eae1cf; --card:#faf5ea; --ink:#2a2119; --ink-soft:#6f6252;
  --ink-faint:#9a8b74; --terra:#9a4f35; --terra-deep:#7c3e28; --terra-wash:#f0dccd; --rule:#ddd1bc;
  --ok:#4f6b3a; --ok-wash:#e3e8d3; --changed:#8a5a12; --changed-wash:#f3e5c6; --bad:#a3382c;
}
@media (prefers-color-scheme: dark){
  :root{
    --paper:#1d1712; --paper-deep:#241c15; --card:#2a2219; --ink:#f0e6d6; --ink-soft:#b3a28a;
    --ink-faint:#83735a; --terra:#d0764f; --terra-deep:#e08a60; --terra-wash:#3a261b; --rule:#3a3022;
    --ok:#9bb77f; --ok-wash:#28301f; --changed:#d6a85a; --changed-wash:#33281a; --bad:#e07a6b;
  }
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--paper);color:var(--ink);font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:15px;line-height:1.45}
button,input,textarea{font:inherit;color:inherit}
.top{position:sticky;top:0;z-index:6;background:var(--paper);border-bottom:1px solid var(--rule);padding:12px 24px;display:flex;flex-wrap:wrap;gap:10px 20px;align-items:center}
.brand{font-family:Lora,serif;font-size:20px;font-weight:500}
.brand b{font-weight:600;color:var(--terra)}
.count{color:var(--ink-soft);font-variant-numeric:tabular-nums;font-size:14px}
.count strong{color:var(--ink);font-weight:600}
.bar{flex:1 1 140px;min-width:120px;height:6px;border-radius:3px;background:var(--paper-deep);overflow:hidden}
.bar i{display:block;height:100%;background:var(--terra);width:0}
.saved{font-size:13px;color:var(--ink-soft);min-width:130px}
.saved.bad{color:var(--bad)}
.btn{border:0;background:var(--paper-deep);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:14px;font-weight:500;text-decoration:none;color:var(--ink)}
.btn:hover{background:var(--rule)}
main{padding:20px 24px 100px;max-width:1440px;margin:0 auto}
.intro{margin:4px 0 18px;max-width:760px}
.intro h1{font-family:Lora,serif;font-weight:500;font-size:24px;margin:0 0 8px}
.intro p{margin:0 0 8px}
.intro ul{margin:6px 0 0;padding-left:20px}
.intro li{margin:4px 0}
.filters{display:flex;gap:8px;margin:0 0 8px;flex-wrap:wrap}
.chip{border:1px solid var(--rule);background:none;border-radius:999px;padding:5px 12px;cursor:pointer;font-size:13px}
.chip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
h2{font-family:Lora,serif;font-weight:500;font-size:22px;margin:30px 0 2px;scroll-margin-top:76px;color:var(--ink)}
@media (min-width:1101px){ .jump{display:none} }
.jump{margin-inline-start:auto;border:1px solid var(--rule);background:var(--paper);color:var(--ink);border-radius:8px;padding:5px 10px;font:inherit;font-size:13px;max-width:100%}
.lede{color:var(--ink-soft);margin:0 0 10px}
.table{border-top:1px solid var(--rule)}
.row{display:grid;gap:12px;align-items:start;padding:12px 8px;border-bottom:1px solid var(--rule)}
.words .row{grid-template-columns:32px minmax(120px,1fr) minmax(100px,.8fr) minmax(180px,1.7fr) minmax(150px,1.2fr) 76px}
.lines .row{grid-template-columns:32px minmax(160px,1.3fr) minmax(160px,1.3fr) minmax(160px,1.3fr) 76px}
.head{position:sticky;top:61px;z-index:4;background:var(--paper);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);padding-top:10px;padding-bottom:8px}
.row.ok{background:linear-gradient(90deg,var(--ok-wash),transparent 60%)}
.row.changed{background:linear-gradient(90deg,var(--changed-wash),transparent 60%)}
.num{color:var(--ink-faint);font-size:13px;font-variant-numeric:tabular-nums;padding-top:9px}
.en{font-weight:600;padding-top:7px}
.mean{display:block;font-weight:400;font-size:13px;color:var(--ink-soft);margin-top:2px}
.he,.ex,.in{direction:rtl;text-align:right;font-family:Heebo,"Plus Jakarta Sans",sans-serif}
.he{font-size:17px;padding-top:6px}
.also{display:block;font-size:12.5px;color:var(--ink-soft);margin-top:2px}
.ex{font-size:14.5px;padding-top:7px;color:var(--ink)}
.ex small{display:block;direction:ltr;text-align:right;font-size:12.5px;color:var(--ink-faint);margin-top:3px;font-family:"Plus Jakarta Sans",sans-serif}
.lines .en{font-weight:400}
.lines .he{font-size:15.5px}
input.in,textarea.in,input.note,textarea.note{width:100%;border:1px solid var(--rule);background:var(--card);border-radius:8px;padding:8px 10px}
input.in{font-size:16px}
textarea.in,textarea.note{resize:vertical;min-height:40px}
.in:focus,.note:focus{outline:2px solid var(--terra);outline-offset:-1px}
.fine{border:1px solid var(--rule);background:none;border-radius:8px;padding:8px 0;width:100%;cursor:pointer;font-size:13.5px;font-weight:500}
.fine.on{background:var(--ok-wash);border-color:var(--ok);color:var(--ok);font-weight:600}
.lbl{display:none}
.addnote{border:0;background:none;padding:4px 0 0;cursor:pointer;font-size:12.5px;color:var(--ink-faint)}
.addnote:hover{color:var(--ink)}
textarea.note{margin-top:6px}
.intro p{color:var(--ink-soft)}
.empty{color:var(--ink-soft);padding:20px 8px}
/* The guide (founder, 2026-11-25: "a guide on the side so he knows where he is"). */
.layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:32px;align-items:start}
.guide{position:sticky;top:76px;max-height:calc(100vh - 92px);overflow:auto;padding:4px 4px 24px 0;font-size:13.5px}
.guide .gtools{display:flex;gap:12px;margin:0 0 10px}
.guide .gtools button{border:0;background:none;padding:0;cursor:pointer;color:var(--ink-faint);font-size:12.5px}
.guide .gtools button:hover{color:var(--ink)}
.guide .part{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);margin:16px 0 4px}
.guide a{display:flex;justify-content:space-between;gap:10px;padding:5px 8px;border-radius:6px;color:var(--ink-soft);text-decoration:none;border-inline-start:2px solid transparent}
.guide a:hover{background:var(--paper-deep);color:var(--ink)}
.guide a.here{color:var(--ink);font-weight:600;border-inline-start-color:var(--terra);background:var(--paper-deep)}
.guide .n{font-variant-numeric:tabular-nums;color:var(--ink-faint);font-weight:400;white-space:nowrap}
.guide a.full .n{color:var(--ok);font-weight:600}
.sec{margin-top:26px;scroll-margin-top:72px}
.sec>button.sh{display:flex;align-items:baseline;gap:10px;width:100%;border:0;background:none;padding:6px 0;cursor:pointer;text-align:left}
.sec>button.sh h2{margin:0;flex:0 1 auto}
.sec>button.sh .chev{display:inline-block;width:8px;height:8px;flex:none;border-right:2px solid var(--ink-soft);border-bottom:2px solid var(--ink-soft);transform:translateY(-3px) rotate(45deg);transition:transform .15s}
.sec.closed>button.sh .chev{transform:translateY(-1px) rotate(-45deg)}
.sec>button.sh .prog{margin-inline-start:auto;font-size:13px;color:var(--ink-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
.sec.full>button.sh .prog{color:var(--ok);font-weight:600}
.sec.closed .body{display:none}
.where{display:block;font-size:12.5px;color:var(--ink-faint);font-weight:400;margin-top:3px}
@media (max-width:1100px){
  .layout{grid-template-columns:1fr}
  .guide{display:none}
}
@media (prefers-reduced-motion: reduce){ .sec>button.sh .chev{transition:none} }
@media (max-width:900px){
  .head{display:none}
  .words .row,.lines .row{grid-template-columns:1fr;gap:6px;padding:14px 4px}
  .num{padding-top:0}
  .lbl{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);margin-top:4px}
  .top{position:static;padding:10px 16px;gap:8px 12px}
  .brand{flex-basis:100%}
  main{padding:16px 16px 80px}
}
`;

/** Plain browser JS, no template literals (it lives in one). */
const SCRIPT = String.raw`
(function(){
  var base = location.pathname.replace(/\/$/, "");
  var LS = "songnook-review-he-terms-pending";
  var state = { sheet: null, edits: {}, filter: "all" };
  var pending = {};
  try { pending = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { pending = {}; }
  var timer = null;
  var $ = function (s) { return document.querySelector(s); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function storePending() { try { localStorage.setItem(LS, JSON.stringify(pending)); } catch (e) {} }
  function savedLine(t, bad) { var s = $("#saved"); s.textContent = t; s.className = "saved" + (bad ? " bad" : ""); }
  function editOf(id) { return state.edits[id] || { text: "", note: "", status: "" }; }
  var LS_CLOSED = "songnook-review-he-terms-closed";
  var closed = {};
  try { closed = JSON.parse(localStorage.getItem(LS_CLOSED) || "{}") || {}; } catch (e) { closed = {}; }
  function storeClosed() { try { localStorage.setItem(LS_CLOSED, JSON.stringify(closed)); } catch (e) {} }
  /** Every section in reading order: the word groups, the sentences, then outside the app. */
  function sections() {
    var out = state.sheet.groups.map(function (g) {
      return { id: "g-" + g.id, part: "Words in the app", title: g.title, lede: g.lede, kind: "words",
        items: state.sheet.rows.filter(function (r) { return r.group === g.id; }) };
    });
    out.push({ id: "sentences", part: "Words in the app", title: "A few whole sentences", lede: "Only to hear the tone.", kind: "lines", items: state.sheet.sentences });
    (state.sheet.web || []).forEach(function (w) {
      out.push({ id: "w-" + w.id, part: "Outside the app", title: w.title, lede: w.lede, kind: "web", items: w.rows });
    });
    return out;
  }
  function allIds() { var ids = []; sections().forEach(function (sec) { sec.items.forEach(function (it) { ids.push(it.id); }); }); return ids; }
  function doneIn(sec) { var d = 0; sec.items.forEach(function (it) { if (editOf(it.id).status) d++; }); return d; }

  function renderTop() {
    var ids = allIds(), done = 0, changed = 0;
    ids.forEach(function (id) { var e = editOf(id); if (e.status) done++; if (e.status === "changed") changed++; });
    $("#count").innerHTML = "<strong>" + done + "</strong> of " + ids.length + " done · " + changed + " changed";
    $("#bar").style.width = (100 * done / ids.length) + "%";
  }

  function save(id) {
    var e = editOf(id);
    pending[id] = { itemId: id, text: e.text, note: e.note, status: e.status };
    storePending();
    clearTimeout(timer);
    timer = setTimeout(flush, 700);
    savedLine("Saving…");
    renderTop();
    updateProgress();
  }

  function flush() {
    var ids = Object.keys(pending);
    if (!ids.length) { savedLine("All changes saved"); return; }
    var id = ids[0], body = pending[id];
    fetch(base + "/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function () { if (pending[id] === body) delete pending[id]; storePending(); flush(); })
      .catch(function () { savedLine("Not saved yet — will retry", true); clearTimeout(timer); timer = setTimeout(flush, 5000); });
  }

  function shown(id) {
    var e = editOf(id);
    if (state.filter === "todo") return !e.status;
    if (state.filter === "changed") return e.status === "changed";
    return true;
  }

  function paint(row, id) {
    var e = editOf(id);
    row.className = "row" + (e.status === "ok" ? " ok" : e.status === "changed" ? " changed" : "");
  }

  function controls(row, id, isLine, current) {
    var e = editOf(id);
    var inWrap = el("div");
    inWrap.appendChild(el("span", "lbl", isLine ? "Your version" : "Your word"));
    var input = el(isLine ? "textarea" : "input", "in");
    if (!isLine) input.type = "text";
    input.rows = isLine ? 2 : undefined;
    input.value = e.text;
    input.placeholder = isLine ? "Your version" : "Your word";
    input.setAttribute("aria-label", isLine ? "Your version" : "Your word");
    inWrap.appendChild(input);

    var fineWrap = el("div");
    fineWrap.appendChild(el("span", "lbl", ""));
    var fine = el("button", "fine" + (e.status === "ok" ? " on" : ""), "✓ Fine");
    fine.type = "button";
    fine.setAttribute("aria-pressed", e.status === "ok" ? "true" : "false");
    fine.title = "The current Hebrew is right";
    fineWrap.appendChild(fine);

    var note = el("textarea", "note");
    note.rows = 2;
    note.value = e.note;
    note.placeholder = "Note";
    note.setAttribute("aria-label", "Note");
    var addNote = el("button", "addnote", "+ Note");
    addNote.type = "button";
    if (e.note) addNote.hidden = true; else note.hidden = true;
    addNote.addEventListener("click", function () { addNote.hidden = true; note.hidden = false; note.focus(); });
    inWrap.appendChild(addNote);
    inWrap.appendChild(note);

    input.addEventListener("input", function () {
      var cur = editOf(id);
      var text = input.value.trim();
      state.edits[id] = { text: input.value, note: cur.note, status: text && text !== current ? "changed" : (cur.status === "ok" ? "ok" : "") };
      fine.classList.toggle("on", state.edits[id].status === "ok");
      paint(row, id); save(id);
    });
    fine.addEventListener("click", function () {
      var cur = editOf(id);
      var on = cur.status !== "ok";
      state.edits[id] = { text: on ? "" : cur.text, note: cur.note, status: on ? "ok" : "" };
      if (on) input.value = "";
      fine.classList.toggle("on", on);
      fine.setAttribute("aria-pressed", on ? "true" : "false");
      paint(row, id); save(id);
    });
    note.addEventListener("input", function () {
      var cur = editOf(id);
      state.edits[id] = { text: cur.text, note: note.value, status: cur.status };
      save(id);
    });
    row.appendChild(inWrap); row.appendChild(fineWrap);
  }

  function wordRow(r, n) {
    var row = el("div", "row");
    row.appendChild(el("div", "num", String(n)));
    var en = el("div", "en", r.en);
    if (r.meaning) en.appendChild(el("span", "mean", r.meaning));
    row.appendChild(en);
    var he = el("div", "he");
    he.appendChild(el("span", "lbl", "Hebrew now"));
    he.appendChild(document.createTextNode(r.he));
    if (r.alsoHe && r.alsoHe.length) he.appendChild(el("span", "also", "also: " + r.alsoHe.join(" · ")));
    row.appendChild(he);
    var ex = el("div", "ex");
    ex.appendChild(el("span", "lbl", "In the app"));
    if (r.example) {
      ex.appendChild(document.createTextNode(r.example.he));
      ex.appendChild(el("small", "", r.example.en));
      if (r.example.where) ex.title = r.example.where;
    } else {
      ex.appendChild(el("small", "", "—"));
      if (r.seen) ex.title = r.seen;
    }
    row.appendChild(ex);
    controls(row, r.id, false, r.he);
    paint(row, r.id);
    return row;
  }

  function lineRow(s, n, showWhere) {
    var row = el("div", "row");
    row.appendChild(el("div", "num", String(n)));
    var en = el("div", "en", s.en);
    if (s.where && showWhere) en.appendChild(el("span", "where", s.where));
    else if (s.where) en.title = s.where;
    row.appendChild(en);
    var he = el("div", "he");
    he.appendChild(el("span", "lbl", "Hebrew now"));
    he.appendChild(document.createTextNode(s.he));
    row.appendChild(he);
    controls(row, s.id, true, s.he);
    paint(row, s.id);
    return row;
  }

  function header(cols, cls) {
    var h = el("div", "row head " + (cls || ""));
    cols.forEach(function (c) { h.appendChild(el("div", "", c)); });
    return h;
  }

  var secEls = {}, guideEls = {};
  function updateProgress() {
    sections().forEach(function (sec) {
      var d = doneIn(sec), t = sec.items.length, full = d === t;
      var se = secEls[sec.id], ge = guideEls[sec.id];
      if (se) { se.classList.toggle("full", full); se.querySelector(".prog").textContent = full ? "✓ All done" : d + " / " + t; }
      if (ge) { ge.classList.toggle("full", full); ge.querySelector(".n").textContent = full ? "✓" : d + " / " + t; }
    });
  }

  function render() {
    var list = $("#list"); list.innerHTML = "";
    var guide = $("#guide"); guide.innerHTML = "";
    secEls = {}; guideEls = {};
    var any = false, stops = [], n = 0, part = "";
    var tools = el("div", "gtools");
    var openAll = el("button", "", "Open all"); openAll.type = "button";
    var closeAll = el("button", "", "Close all"); closeAll.type = "button";
    openAll.onclick = function () { closed = {}; storeClosed(); render(); };
    closeAll.onclick = function () { sections().forEach(function (sec) { closed[sec.id] = true; }); storeClosed(); render(); };
    tools.appendChild(openAll); tools.appendChild(closeAll); guide.appendChild(tools);

    sections().forEach(function (sec) {
      var startN = n;
      if (sec.kind === "words") n += sec.items.length;
      if (sec.part !== part) { part = sec.part; guide.appendChild(el("div", "part", part)); }
      var link = el("a"); link.href = "#" + sec.id;
      link.appendChild(el("span", "", sec.title)); link.appendChild(el("span", "n", ""));
      guide.appendChild(link); guideEls[sec.id] = link;

      var visible = sec.items.filter(function (it) { return shown(it.id); });
      link.onclick = function (ev) {
        ev.preventDefault();
        if (closed[sec.id]) { delete closed[sec.id]; storeClosed(); }
        if (!secEls[sec.id]) { state.filter = "all"; document.querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-filter") === "all"); }); }
        render();
        var target = secEls[sec.id]; if (target) target.scrollIntoView({ block: "start" });
      };
      if (!visible.length) return;
      any = true;

      var box = el("section", "sec" + (closed[sec.id] ? " closed" : "")); box.id = sec.id;
      var head = el("button", "sh"); head.type = "button";
      head.setAttribute("aria-expanded", closed[sec.id] ? "false" : "true");
      head.appendChild(el("span", "chev", ""));
      head.appendChild(el("h2", "", sec.title));
      head.appendChild(el("span", "prog", ""));
      head.onclick = function () {
        var shut = !box.classList.contains("closed");
        box.classList.toggle("closed", shut); head.setAttribute("aria-expanded", shut ? "false" : "true");
        if (shut) closed[sec.id] = true; else delete closed[sec.id];
        storeClosed();
      };
      box.appendChild(head);
      var body = el("div", "body");
      if (sec.lede) body.appendChild(el("p", "lede", sec.lede));
      var t = el("div", "table " + (sec.kind === "words" ? "words" : "lines"));
      if (sec.kind === "words") {
        t.appendChild(header(["#", "English", "Hebrew now", "In the app", "Your word", ""]));
        sec.items.forEach(function (r, i) { if (shown(r.id)) t.appendChild(wordRow(r, startN + i + 1)); });
      } else {
        t.appendChild(header(["#", "English", "Hebrew now", "Your version", ""]));
        sec.items.forEach(function (r, i) { if (shown(r.id)) t.appendChild(lineRow(r, (sec.kind === "lines" ? "S" : "") + (i + 1), sec.kind === "web")); });
      }
      body.appendChild(t); box.appendChild(body);
      list.appendChild(box); secEls[sec.id] = box;
      stops.push([sec.title, box]);
    });
    if (!any) list.appendChild(el("p", "empty", "Nothing here with this filter."));

    // Small screens: the same sections as a "Go to…" list.
    var jump = $("#jump"); jump.innerHTML = "";
    var first = document.createElement("option"); first.textContent = "Go to…"; first.value = ""; jump.appendChild(first);
    stops.forEach(function (stop, i) { var o = document.createElement("option"); o.textContent = stop[0]; o.value = String(i); jump.appendChild(o); });
    jump.onchange = function () {
      var stop = stops[Number(jump.value)];
      if (jump.value !== "" && stop) { stop[1].classList.remove("closed"); stop[1].scrollIntoView({ block: "start" }); }
      jump.value = "";
    };
    jump.hidden = stops.length < 2;

    // Where am I: the guide marks the section at the top of the screen.
    if (window.IntersectionObserver) {
      if (state.io) state.io.disconnect();
      var seen = {};
      state.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
        var here = null;
        sections().some(function (sec) { if (seen[sec.id]) { here = sec.id; return true; } return false; });
        Object.keys(guideEls).forEach(function (id) { guideEls[id].classList.toggle("here", id === here); });
      }, { rootMargin: "-80px 0px -60% 0px" });
      Object.keys(secEls).forEach(function (id) { state.io.observe(secEls[id]); });
    }
    renderTop();
    updateProgress();
  }

  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      document.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on"); state.filter = c.getAttribute("data-filter"); render();
    });
  });

  fetch(base + "/sheet.json").then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (data) {
    state.sheet = data.sheet;
    data.edits.forEach(function (e) {
      var f = {}; try { f = JSON.parse(e.forms || "{}"); } catch (x) {}
      state.edits[e.item_id] = { text: f[""] || "", note: e.note || "", status: e.status || "" };
    });
    Object.keys(pending).forEach(function (id) { var p = pending[id]; state.edits[id] = { text: p.text, note: p.note, status: p.status }; });
    render();
    if (Object.keys(pending).length) flush(); else savedLine("All changes saved");
  }).catch(function () { savedLine("Couldn't load the list. Reload the page.", true); });
  window.addEventListener("beforeunload", function (ev) { if (Object.keys(pending).length) { ev.preventDefault(); ev.returnValue = ""; } });
})();
`;

export function renderTermsPage(total: number, csvHref: string, _jsonHref?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Hebrew review · SongNook</title>
<link rel="icon" type="image/png" href="/favicon.png">
<style>${FONT_FACES}${CSS}</style>
</head>
<body>
<header class="top">
  <div class="brand">Song<b>Nook</b> · Hebrew review</div>
  <div class="count" id="count">${total} rows</div>
  <div class="bar" aria-hidden="true"><i id="bar"></i></div>
  <div class="saved" id="saved" role="status" aria-live="polite">Loading…</div>
  <a class="btn" href="${csvHref}" download>Download</a>
</header>
<main>
  <section class="intro">
    <h1>Does the Hebrew sound right?</h1>
    <p>First SongNook's key words, then the website and the Send pages. If the Hebrew is right, press ✓ Fine. If you'd say it differently, type your version. Everything saves by itself.</p>
    <p>The list on the left shows every section and how much of it is done. Click a section's title to fold it away.</p>
  </section>
  <div class="filters">
    <button class="chip on" data-filter="all" type="button">All</button>
    <button class="chip" data-filter="todo" type="button">Not done</button>
    <button class="chip" data-filter="changed" type="button">Changed</button>
    <select class="jump" id="jump" aria-label="Go to a group"></select>
  </div>
  <div class="layout">
    <nav class="guide" id="guide" aria-label="Sections"></nav>
    <div id="list"></div>
  </div>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}
