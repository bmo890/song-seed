/**
 * The review page itself: one HTML document with its own small script. The page asks
 * the Worker for the lines and the saved edits (sheet.json), shows one section at a time,
 * and saves each line on its own a moment after typing stops. Saves that cannot reach
 * the Worker wait in the browser and go out again; the downloads are always one click.
 */
import { FONT_FACES } from "../pages/shell.ts";

const CSS = `
:root{
  --paper:#f3ecdf; --paper-deep:#eae1cf; --card:#faf5ea; --ink:#2a2119; --ink-soft:#7c6f5e;
  --ink-faint:#a3947e; --terra:#9a4f35; --terra-deep:#7c3e28; --terra-wash:#f0dccd; --rule:#d8cbb4;
  --ok:#4f6b3a; --ok-wash:#e3e8d3; --warn:#9a6a1f; --warn-wash:#f3e5c6; --bad:#a3382c;
}
@media (prefers-color-scheme: dark){
  :root{
    --paper:#1d1712; --paper-deep:#241c15; --card:#251e16; --ink:#f0e6d6; --ink-soft:#a6957e;
    --ink-faint:#78694f; --terra:#d0764f; --terra-deep:#e08a60; --terra-wash:#3a261b; --rule:#3a3022;
    --ok:#9bb77f; --ok-wash:#28301f; --warn:#d6a85a; --warn-wash:#33281a; --bad:#e07a6b;
  }
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--paper);color:var(--ink);font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:15px;line-height:1.5}
button,input,textarea,select{font:inherit;color:inherit}
.top{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--rule);padding:12px 20px;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center}
.brand{font-family:Lora,serif;font-size:20px;font-weight:500}
.brand b{font-weight:600;color:var(--terra)}
.count{color:var(--ink-soft);font-variant-numeric:tabular-nums;font-size:14px}
.count strong{color:var(--ink);font-weight:600}
.bar{flex:1 1 140px;min-width:120px;height:6px;border-radius:3px;background:var(--paper-deep);overflow:hidden}
.bar i{display:block;height:100%;background:var(--terra);width:0}
.saved{font-size:13px;color:var(--ink-soft);min-width:120px}
.saved.bad{color:var(--bad)}
.dl{display:flex;gap:8px}
.btn{border:0;background:var(--paper-deep);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:14px;font-weight:500;text-decoration:none;color:var(--ink)}
.btn:hover{background:var(--rule)}
.btn.primary{background:var(--terra-wash);color:var(--terra-deep)}
.layout{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 62px)}
nav{border-right:1px solid var(--rule);padding:12px 0;position:sticky;top:62px;align-self:start;max-height:calc(100vh - 62px);overflow:auto}
nav button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;border:0;background:none;padding:7px 20px;cursor:pointer;font-size:14px}
nav button:hover{background:var(--paper-deep)}
nav button.on{background:var(--terra-wash);color:var(--terra-deep);font-weight:600}
nav button span:last-child{color:var(--ink-faint);font-variant-numeric:tabular-nums;font-size:13px}
nav button.on span:last-child{color:var(--terra-deep)}
nav .group{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);padding:14px 20px 4px}
main{padding:20px 24px 80px;max-width:1100px}
h1{font-family:Lora,serif;font-weight:500;font-size:28px;margin:0 0 4px}
.lede{color:var(--ink-soft);margin:0 0 16px}
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 16px}
.tools input{flex:1 1 220px;border:1px solid var(--rule);background:var(--card);border-radius:8px;padding:8px 10px}
.chip{border:1px solid var(--rule);background:none;border-radius:999px;padding:5px 11px;cursor:pointer;font-size:13px}
.chip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.kind{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);margin:22px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--rule)}
.row{display:grid;grid-template-columns:44px 1fr 1fr;gap:4px 16px;padding:12px 0;border-bottom:1px solid var(--rule)}
.row.done .num{color:var(--ok)}
.num{color:var(--ink-faint);font-size:13px;font-variant-numeric:tabular-nums;padding-top:2px}
.en{white-space:pre-wrap}
.meta{grid-column:2/4;display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12px;color:var(--ink-faint)}
.tag{background:var(--paper-deep);border-radius:4px;padding:1px 6px}
.tag.flag{background:var(--warn-wash);color:var(--warn)}
.cur{direction:rtl;text-align:right;white-space:pre-wrap;color:var(--ink-soft);font-family:Heebo,"Plus Jakarta Sans",sans-serif}
.form{font-size:12px;color:var(--ink-faint)}
.edit{grid-column:2/4;display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
.edit textarea{width:100%;border:1px solid var(--rule);background:var(--card);border-radius:8px;padding:8px 10px;min-height:40px;resize:vertical}
.edit textarea.he{direction:rtl;text-align:right;font-family:Heebo,"Plus Jakarta Sans",sans-serif}
.edit textarea:focus{outline:2px solid var(--terra);outline-offset:-1px}
.actions{grid-column:2/4;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.keep{border:1px solid var(--rule);background:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:13px}
.keep.on{background:var(--ok-wash);border-color:var(--ok);color:var(--ok);font-weight:600}
.state{font-size:12px;color:var(--ink-faint)}
.warn{grid-column:2/4;font-size:12px;color:var(--warn)}
.warn.bad{color:var(--bad)}
.intro{background:var(--card);border-radius:12px;padding:16px 18px;margin:0 0 18px}
.intro h2{font-family:Lora,serif;font-weight:500;font-size:18px;margin:0 0 6px}
.intro ul{margin:6px 0 0;padding-left:18px}
.intro li{margin:3px 0}
.empty{color:var(--ink-soft);padding:30px 0}
.more{display:block;margin:18px auto 0}
@media (max-width:820px){
  .layout{grid-template-columns:1fr}
  nav{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--rule);display:flex;overflow-x:auto;padding:6px}
  nav .group{display:none}
  nav button{white-space:nowrap;width:auto;padding:6px 12px;border-radius:999px}
  .row{grid-template-columns:34px 1fr}
  .row .cur,.meta,.edit,.actions,.warn{grid-column:2/3}
  .edit{grid-template-columns:1fr}
  main{padding:16px}
}
`;

/** The page's script: plain browser JS, no template literals (it lives in one). */
const SCRIPT = String.raw`
(function(){
  var base = location.pathname.replace(/\/$/, "");
  var LS = "songnook-review-he-pending";
  var state = { sheet: null, edits: {}, section: "Key terms", filter: "all", query: "", shown: 120 };
  var pending = {};
  try { pending = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { pending = {}; }
  var timers = {};
  var $ = function (sel) { return document.querySelector(sel); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function placeholders(t) { var m = (t || "").match(/\{\{\s*\w+\s*\}\}/g) || []; return m.map(function (x) { return x.replace(/\s/g, ""); }).sort().join(","); }
  function storePending() { try { localStorage.setItem(LS, JSON.stringify(pending)); } catch (e) {} }
  function savedLine(text, bad) { var s = $("#saved"); s.textContent = text; s.className = "saved" + (bad ? " bad" : ""); }

  function editOf(id) { return state.edits[id] || { forms: {}, note: "", status: "" }; }
  function isDone(id) { var e = editOf(id); return e.status === "ok" || e.status === "changed"; }

  function lines() {
    var s = state.sheet;
    var terms = s.terms.map(function (t, i) {
      return { id: t.id, num: "T" + (i + 1), section: "Key terms", page: "", kind: "Key term", keys: [], where: [], otherHebrew: [],
        forms: [{ form: "", en: t.term, he: t.he }], meaning: t.meaning };
    });
    var items = s.items.map(function (it, i) { var x = Object.assign({}, it); x.num = String(i + 1); return x; });
    return terms.concat(items);
  }

  function sections() {
    var map = {}, order = [];
    state.all.forEach(function (l) {
      if (!map[l.section]) { map[l.section] = { name: l.section, total: 0, done: 0 }; order.push(l.section); }
      map[l.section].total++; if (isDone(l.id)) map[l.section].done++;
    });
    return order.map(function (n) { return map[n]; });
  }

  function counts() {
    var c = { lines: state.sheet.items.length, done: 0, changed: 0, notes: 0 };
    state.sheet.items.forEach(function (it) {
      var e = state.edits[it.id]; if (!e) return;
      if (e.status === "ok" || e.status === "changed") c.done++;
      if (e.status === "changed") c.changed++;
      if (e.note) c.notes++;
    });
    return c;
  }

  function renderTop() {
    var c = counts();
    $("#count").innerHTML = "<strong>" + c.done.toLocaleString() + "</strong> of " + c.lines.toLocaleString() +
      " lines reviewed · " + c.changed.toLocaleString() + " changed · " + c.notes.toLocaleString() + " with notes";
    $("#bar").style.width = (c.lines ? (100 * c.done / c.lines) : 0) + "%";
  }

  function renderNav() {
    var nav = $("#nav"); nav.innerHTML = "";
    var secs = sections();
    var groups = [["Start here", ["Key terms", "Headlines"]], ["Pages", null], ["Everywhere", ["Shared across the app"]]];
    groups.forEach(function (g) {
      var names = g[1] || secs.map(function (s) { return s.name; }).filter(function (n) { return n !== "Key terms" && n !== "Headlines" && n !== "Shared across the app"; });
      nav.appendChild(el("div", "group", g[0]));
      names.forEach(function (n) {
        var s = secs.filter(function (x) { return x.name === n; })[0]; if (!s) return;
        var b = el("button", s.name === state.section ? "on" : "");
        b.appendChild(el("span", "", s.name));
        b.appendChild(el("span", "", s.done + " / " + s.total));
        b.onclick = function () { state.section = s.name; state.shown = 120; render(); window.scrollTo(0, 0); };
        nav.appendChild(b);
      });
    });
  }

  function visible() {
    var q = state.query.trim().toLowerCase();
    return state.all.filter(function (l) {
      if (!q && l.section !== state.section) return false;
      var e = editOf(l.id);
      if (state.filter === "todo" && isDone(l.id)) return false;
      if (state.filter === "changed" && e.status !== "changed") return false;
      if (state.filter === "notes" && !e.note) return false;
      if (state.filter === "flagged" && !(l.otherHebrew && l.otherHebrew.length)) return false;
      if (q) {
        var hay = l.forms.map(function (f) { return f.en + " " + f.he + " " + (e.forms[f.form] || ""); }).join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  var FORM_LABEL = { "": "", one: "1 —", two: "2 —", many: "many —", other: "more —", few: "few —", zero: "0 —" };

  function save(line) {
    var e = editOf(line.id);
    pending[line.id] = { itemId: line.id, forms: e.forms, note: e.note, status: e.status };
    storePending();
    clearTimeout(timers[line.id]);
    timers[line.id] = setTimeout(flush, 700);
    savedLine("Saving…");
  }

  function flush() {
    var ids = Object.keys(pending);
    if (!ids.length) { savedLine("All changes saved"); return; }
    var id = ids[0], body = pending[id];
    fetch(base + "/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function () {
        if (pending[id] === body) delete pending[id];
        storePending(); flush();
      })
      .catch(function () {
        savedLine("Not saved yet — will retry (your work is kept in this browser)", true);
        setTimeout(flush, 5000);
      });
  }

  function rowFor(line) {
    var e = editOf(line.id);
    var row = el("div", "row" + (isDone(line.id) ? " done" : ""));
    row.appendChild(el("div", "num", line.num));
    var left = el("div", ""), right = el("div", "cur");
    line.forms.forEach(function (f) {
      var a = el("div", "en"); if (FORM_LABEL[f.form]) a.appendChild(el("span", "form", FORM_LABEL[f.form] + " ")); a.appendChild(document.createTextNode(f.en)); left.appendChild(a);
      right.appendChild(el("div", "", f.he));
    });
    row.appendChild(left); row.appendChild(right);

    var meta = el("div", "meta");
    if (line.meaning) meta.appendChild(el("span", "", line.meaning));
    if (line.page && line.section !== line.page) meta.appendChild(el("span", "tag", line.page));
    if (line.kind && line.kind !== "Key term") meta.appendChild(el("span", "tag", line.kind));
    if (line.keys && line.keys.length > 1) meta.appendChild(el("span", "tag", "Used in " + line.keys.length + " places"));
    if (line.otherHebrew && line.otherHebrew.length) meta.appendChild(el("span", "tag flag", "Same English elsewhere: " + line.otherHebrew.join(" · ")));
    row.appendChild(meta);

    var edit = el("div", "edit");
    var warn = el("div", "warn");
    var boxes = [];
    line.forms.forEach(function (f) {
      var ta = el("textarea", "he");
      ta.rows = 1; ta.dir = "rtl"; ta.lang = "he";
      ta.placeholder = (FORM_LABEL[f.form] ? FORM_LABEL[f.form] + " " : "") + "Your version (empty keeps the current one)";
      ta.value = e.forms[f.form] || "";
      ta.oninput = function () {
        var cur = editOf(line.id);
        var forms = Object.assign({}, cur.forms); if (ta.value.trim()) forms[f.form] = ta.value; else delete forms[f.form];
        var changed = Object.keys(forms).length > 0;
        state.edits[line.id] = { forms: forms, note: cur.note, status: changed ? "changed" : (cur.status === "changed" ? "" : cur.status) };
        check(); save(line); refreshRow();
      };
      boxes.push({ ta: ta, f: f });
      edit.appendChild(ta);
    });
    var note = el("textarea", "");
    note.rows = 1; note.placeholder = "Note (optional)"; note.value = e.note || "";
    note.oninput = function () { var cur = editOf(line.id); state.edits[line.id] = { forms: cur.forms, note: note.value, status: cur.status }; save(line); renderTop(); };
    edit.appendChild(note);
    row.appendChild(edit);

    var actions = el("div", "actions");
    var keep = el("button", "keep", "✓ Looks right");
    var st = el("span", "state", "");
    keep.onclick = function () {
      var cur = editOf(line.id);
      if (Object.keys(cur.forms).length) return;
      state.edits[line.id] = { forms: cur.forms, note: cur.note, status: cur.status === "ok" ? "" : "ok" };
      save(line); refreshRow();
    };
    actions.appendChild(keep); actions.appendChild(st);
    row.appendChild(actions);
    row.appendChild(warn);

    function check() {
      var msgs = [], bad = false;
      boxes.forEach(function (b) {
        var v = b.ta.value.trim(); if (!v) return;
        // Against the Hebrew the app has now: a Hebrew singular may rightly leave {{count}} out.
        var model = b.f.he || b.f.en;
        if (placeholders(v) !== placeholders(model)) {
          var need = model.match(/\{\{\s*\w+\s*\}\}/g);
          msgs.push(need ? "Keep " + need.join(" ") + " exactly as written." : "This line has no {{…}} — leave them out.");
          bad = true;
        }
        var ref = b.f.he || b.f.en;
        if (v.length > Math.max(20, ref.length * 1.6)) msgs.push("Longer than the current line — it may not fit on screen.");
      });
      warn.textContent = msgs.join(" ");
      warn.className = "warn" + (bad ? " bad" : "");
    }
    function refreshRow() {
      var cur = editOf(line.id);
      keep.className = "keep" + (cur.status === "ok" ? " on" : "");
      keep.disabled = Object.keys(cur.forms).length > 0;
      st.textContent = cur.status === "changed" ? "Changed" : cur.status === "ok" ? "Kept as is" : "";
      row.className = "row" + (isDone(line.id) ? " done" : "");
      renderTop(); renderNavCounts();
    }
    check(); refreshRow();
    return row;
  }

  var navTimer;
  function renderNavCounts() { clearTimeout(navTimer); navTimer = setTimeout(renderNav, 300); }

  function renderList() {
    var list = $("#list"); list.innerHTML = "";
    var rows = visible();
    $("#title").textContent = state.query.trim() ? "Search" : state.section;
    $("#lede").textContent = rows.length.toLocaleString() + (rows.length === 1 ? " line" : " lines") + (state.filter !== "all" ? " (filtered)" : "");
    if (!rows.length) { list.appendChild(el("div", "empty", "Nothing here with this filter.")); return; }
    var lastKind = null;
    rows.slice(0, state.shown).forEach(function (l) {
      var k = state.query.trim() ? l.section : l.kind;
      if (k !== lastKind) { list.appendChild(el("div", "kind", k)); lastKind = k; }
      list.appendChild(rowFor(l));
    });
    if (rows.length > state.shown) {
      var more = el("button", "btn more", "Show " + Math.min(120, rows.length - state.shown) + " more of " + (rows.length - state.shown).toLocaleString());
      more.onclick = function () { state.shown += 120; renderList(); };
      list.appendChild(more);
    }
  }

  function render() { renderTop(); renderNav(); renderList(); }

  document.querySelectorAll("[data-filter]").forEach(function (b) {
    b.onclick = function () {
      state.filter = b.getAttribute("data-filter"); state.shown = 120;
      document.querySelectorAll("[data-filter]").forEach(function (x) { x.className = "chip" + (x === b ? " on" : ""); });
      renderList();
    };
  });
  var qTimer;
  $("#q").oninput = function (ev) { clearTimeout(qTimer); qTimer = setTimeout(function () { state.query = ev.target.value; state.shown = 120; renderList(); }, 200); };
  $("#introToggle").onclick = function () { var i = $("#intro"); i.hidden = !i.hidden; };

  fetch(base + "/sheet.json").then(function (r) { return r.json(); }).then(function (data) {
    state.sheet = data.sheet;
    data.edits.forEach(function (e) { state.edits[e.item_id] = { forms: JSON.parse(e.forms || "{}"), note: e.note || "", status: e.status || "" }; });
    // A save that never reached the Worker (offline, a closed tab) is put back first.
    Object.keys(pending).forEach(function (id) { var p = pending[id]; state.edits[id] = { forms: p.forms, note: p.note, status: p.status }; });
    state.all = lines();
    render();
    if (Object.keys(pending).length) flush(); else savedLine("All changes saved");
  }).catch(function () { savedLine("Couldn't load the lines. Reload the page.", true); });
  window.addEventListener("beforeunload", function (ev) { if (Object.keys(pending).length) { ev.preventDefault(); ev.returnValue = ""; } });
})();
`;

export function renderReviewPage(counts: Record<string, number>, csvHref: string, jsonHref: string): string {
  const lines = counts.lines.toLocaleString("en-US");
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
  <div class="count" id="count">${lines} lines</div>
  <div class="bar" aria-hidden="true"><i id="bar"></i></div>
  <div class="saved" id="saved" role="status" aria-live="polite">Loading…</div>
  <div class="dl">
    <a class="btn" href="${csvHref}" download>Download spreadsheet</a>
    <a class="btn" href="${jsonHref}" download>Download backup</a>
    <button class="btn" id="introToggle" type="button">How this works</button>
  </div>
</header>
<div class="layout">
  <nav id="nav" aria-label="Sections"></nav>
  <main>
    <section class="intro" id="intro">
      <h2>Thank you for going over SongNook's Hebrew</h2>
      <p>SongNook is a songwriting app for musicians: record ideas, write lyrics and chords, practise, share with the band. Every line the app shows in Hebrew is here once, grouped by the page it appears on.</p>
      <ul>
        <li><b>Start with Key terms.</b> They are the app's own words (sketch, take, collection…). Decide them first; the other lines should use the same words.</li>
        <li><b>A line that reads well:</b> press <b>✓ Looks right</b>. <b>A line to fix:</b> type your version in the box; it counts as reviewed. Empty means keep the current Hebrew.</li>
        <li><b>Notes are optional</b> — for anything worth explaining or a question.</li>
        <li>Everything saves by itself as you type. "Used in N places" means one line covers several screens.</li>
        <li><b>Keep {{count}}, {{title}} and the like exactly as written</b> (they become numbers and names). Keep it short: buttons one or two words.</li>
        <li><b>Voice:</b> a calm, brief studio companion. No exclamation marks. Address the reader without gender where Hebrew allows (as the app does now).</li>
        <li>Lines in a few forms (1 —, 2 —, more —) are counted as one line.</li>
      </ul>
    </section>
    <h1 id="title">Key terms</h1>
    <p class="lede" id="lede"></p>
    <div class="tools">
      <input id="q" type="search" placeholder="Search English or Hebrew in every section" aria-label="Search">
      <button class="chip on" data-filter="all" type="button">All</button>
      <button class="chip" data-filter="todo" type="button">Not yet reviewed</button>
      <button class="chip" data-filter="changed" type="button">Changed</button>
      <button class="chip" data-filter="notes" type="button">With notes</button>
      <button class="chip" data-filter="flagged" type="button">Translated differently elsewhere</button>
    </div>
    <div id="list"></div>
  </main>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
}
