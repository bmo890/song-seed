/**
 * The terms review page (founder, 2026-11-24: "each item should be a row, clear as day").
 * One row per word: English, the Hebrew the app uses now, a real sentence from the app,
 * a box for the word a musician would say, a Fine key, a note. Then a few whole sentences
 * to hear the tone. Saves each row a moment after typing stops; saves that cannot reach
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
.intro{background:var(--card);border-radius:12px;padding:18px 20px;margin:0 0 22px;max-width:900px}
.intro h1{font-family:Lora,serif;font-weight:500;font-size:24px;margin:0 0 8px}
.intro p{margin:0 0 8px}
.intro ul{margin:6px 0 0;padding-left:20px}
.intro li{margin:4px 0}
.filters{display:flex;gap:8px;margin:0 0 8px;flex-wrap:wrap}
.chip{border:1px solid var(--rule);background:none;border-radius:999px;padding:5px 12px;cursor:pointer;font-size:13px}
.chip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
h2{font-family:Lora,serif;font-weight:500;font-size:22px;margin:30px 0 2px}
.lede{color:var(--ink-soft);margin:0 0 10px}
.table{border-top:1px solid var(--rule)}
.row{display:grid;gap:12px;align-items:start;padding:12px 8px;border-bottom:1px solid var(--rule)}
.words .row{grid-template-columns:32px minmax(110px,1fr) minmax(100px,.8fr) minmax(170px,1.6fr) minmax(140px,1.1fr) 76px minmax(110px,1fr)}
.lines .row{grid-template-columns:32px minmax(160px,1.3fr) minmax(160px,1.3fr) minmax(160px,1.3fr) 76px minmax(110px,1fr)}
.head{position:sticky;top:61px;z-index:4;background:var(--paper);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);padding-top:10px;padding-bottom:8px}
.row.ok{background:linear-gradient(90deg,var(--ok-wash),transparent 60%)}
.row.changed{background:linear-gradient(90deg,var(--changed-wash),transparent 60%)}
.num{color:var(--ink-faint);font-size:13px;font-variant-numeric:tabular-nums;padding-top:9px}
.en{font-weight:600;padding-top:7px}
.mean{display:block;font-weight:400;font-size:13px;color:var(--ink-soft);margin-top:2px}
.he,.ex,.in{direction:rtl;text-align:right;font-family:Heebo,"Plus Jakarta Sans",sans-serif}
.he{font-size:17px;padding-top:6px}
.also{display:block;font-size:12.5px;color:var(--ink-soft);margin-top:2px}
.uses{display:block;direction:ltr;text-align:right;font-size:12px;color:var(--ink-faint);margin-top:2px;font-family:"Plus Jakarta Sans",sans-serif}
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
.empty{color:var(--ink-soft);padding:20px 8px}
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
  function allIds() { return state.sheet.rows.map(function (r) { return r.id; }).concat(state.sheet.sentences.map(function (s) { return s.id; })); }

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
    if (state.filter === "notes") return !!e.note;
    return true;
  }

  function paint(row, id) {
    var e = editOf(id);
    row.className = "row" + (e.status === "ok" ? " ok" : e.status === "changed" ? " changed" : "");
  }

  function controls(row, id, isLine, current) {
    var e = editOf(id);
    var inWrap = el("div");
    inWrap.appendChild(el("span", "lbl", isLine ? "Your version" : "The word a musician would say"));
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

    var noteWrap = el("div");
    noteWrap.appendChild(el("span", "lbl", "Note (optional)"));
    var note = el("textarea", "note");
    note.rows = 1;
    note.value = e.note;
    note.placeholder = "Note (optional)";
    note.setAttribute("aria-label", "Note");
    noteWrap.appendChild(note);

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
    row.appendChild(inWrap); row.appendChild(fineWrap); row.appendChild(noteWrap);
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
    if (r.uses > 1) he.appendChild(el("span", "uses", "in about " + r.uses + " lines"));
    row.appendChild(he);
    var ex = el("div", "ex");
    ex.appendChild(el("span", "lbl", "In the app"));
    if (r.example) { ex.appendChild(document.createTextNode(r.example.he)); ex.appendChild(el("small", "", r.example.en)); }
    else ex.appendChild(el("small", "", "—"));
    row.appendChild(ex);
    controls(row, r.id, false, r.he);
    paint(row, r.id);
    return row;
  }

  function lineRow(s, n) {
    var row = el("div", "row");
    row.appendChild(el("div", "num", "S" + n));
    row.appendChild(el("div", "en", s.en));
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

  function render() {
    var list = $("#list"); list.innerHTML = "";
    var n = 0, any = false;
    state.sheet.groups.forEach(function (g) {
      var rows = state.sheet.rows.filter(function (r) { return r.group === g.id; });
      var startN = n;
      var visible = rows.filter(function (r, i) { return shown(r.id); });
      n += rows.length;
      if (!visible.length) return;
      any = true;
      list.appendChild(el("h2", "", g.title));
      list.appendChild(el("p", "lede", g.lede));
      var t = el("div", "table words");
      t.appendChild(header(["#", "English", "Hebrew now", "In the app", "The word a musician would say", "", "Note"]));
      rows.forEach(function (r, i) { if (shown(r.id)) t.appendChild(wordRow(r, startN + i + 1)); });
      list.appendChild(t);
    });
    var lines = state.sheet.sentences.filter(function (s) { return shown(s.id); });
    if (lines.length) {
      any = true;
      list.appendChild(el("h2", "", "A few whole sentences"));
      list.appendChild(el("p", "lede", "From the screens people use most. Only to hear whether the tone sounds natural; fix a line only if it sounds off."));
      var t = el("div", "table lines");
      t.appendChild(header(["#", "English", "Hebrew now", "Your version", "", "Note"]));
      state.sheet.sentences.forEach(function (s, i) { if (shown(s.id)) t.appendChild(lineRow(s, i + 1)); });
      list.appendChild(t);
    }
    if (!any) list.appendChild(el("p", "empty", "Nothing here with this filter."));
    renderTop();
  }

  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      document.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on"); state.filter = c.getAttribute("data-filter"); render();
    });
  });
  $("#introToggle").addEventListener("click", function () { var i = $("#intro"); i.hidden = !i.hidden; });

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

export function renderTermsPage(total: number, csvHref: string, jsonHref: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Hebrew words · SongNook</title>
<link rel="icon" type="image/png" href="/favicon.png">
<style>${FONT_FACES}${CSS}</style>
</head>
<body>
<header class="top">
  <div class="brand">Song<b>Nook</b> · Hebrew words</div>
  <div class="count" id="count">${total} rows</div>
  <div class="bar" aria-hidden="true"><i id="bar"></i></div>
  <div class="saved" id="saved" role="status" aria-live="polite">Loading…</div>
  <a class="btn" href="${csvHref}" download>Download spreadsheet</a>
  <a class="btn" href="${jsonHref}" download>Download backup</a>
  <button class="btn" id="introToggle" type="button">How this works</button>
</header>
<main>
  <section class="intro" id="intro">
    <h1>Do these words sound like a musician?</h1>
    <p>SongNook is an app for songwriters and working musicians: record ideas, write lyrics and chords, rehearse the set. The Hebrew is already written. What we need is an ear: some words may sound like a dictionary, not like something a musician would actually say.</p>
    <ul>
      <li><b>One row per word.</b> You see the English, the Hebrew the app uses now, and a real sentence from the app that uses it.</li>
      <li><b>If the Hebrew is right,</b> press <b>✓ Fine</b>. <b>If you'd say it differently,</b> type your word. We change it everywhere in the app.</li>
      <li><b>Notes are optional:</b> for "it depends", a question, or a better idea.</li>
      <li>At the end, <b>a few whole sentences</b>, only to check the tone sounds natural.</li>
      <li>Everything saves by itself. You can stop and come back any time.</li>
    </ul>
  </section>
  <div class="filters">
    <button class="chip on" data-filter="all" type="button">All</button>
    <button class="chip" data-filter="todo" type="button">Not done yet</button>
    <button class="chip" data-filter="changed" type="button">Changed</button>
    <button class="chip" data-filter="notes" type="button">With notes</button>
  </div>
  <div id="list"></div>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}
