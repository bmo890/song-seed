/**
 * "In the app" gallery — three living cards rebuilt from today's player (2026-11-15):
 * play it (sections strip, a pin, practice chips), sing along (chords over lyrics), and
 * drill it (an A–B loop with Step up counting its passes and raising the speed).
 * Shown on the recipient page and on songnook.app. Pure inline CSS/SVG/JS: no image
 * or video bytes, CSP-safe. The waveforms and lyrics are illustrations, not sent audio.
 *
 * Colours are the app's own (src/design/tokens.ts, AudioReel's light palette):
 * reel #F0EBE4 · wave ahead #C7B9AF · played #B87D6B (#84736f once a loop owns the
 * terracotta) · playhead record-red #C0453B · section ink per role · pins in #524440.
 */

import { CARDS_EN, type CardStrings } from "./landingI18n";
import { escapeHtml } from "./shell";

const SECTION = { verse: "#856E20", chorus: "#A25853", bridge: "#576DA9", outro: "#0D7C99" };

/** Deterministic bar heights (0..1) with a song-like swell. */
function heights(count: number, seed: number, shape: (f: number) => number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    const jitter = 0.55 + (s % 1000) / 2222; // 0.55..1.0
    out.push(Math.max(0.08, Math.min(1, shape(i / count) * jitter)));
  }
  return out;
}

/** One waveform as a single SVG path of round-capped 3 px bars on a 5 px pitch. */
function wave(width: number, height: number, hs: number[], cls: string): string {
  const mid = height / 2;
  const d = hs
    .map((h, i) => {
      const x = i * 5 + 2;
      const half = Math.max(1, (h * height * 0.78) / 2);
      return `M${x} ${(mid - half).toFixed(1)}V${(mid + half).toFixed(1)}`;
    })
    .join("");
  return `<svg class="${cls}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`;
}

const swell = (f: number) => 0.45 + 0.55 * Math.abs(Math.sin(f * Math.PI * 3.1 + 0.4));

type Span = { name: string; ink: string; from: number; to: number };

/** Today's section strip: the part's name in its ink over a 3 px rule across its span. */
function sectionStrip(sections: Span[], offset: number, unit: "px" | "%"): string {
  return sections
    .map(
      (s) =>
        `<span class="ap-sec" style="left:${s.from + offset}${unit};width:${s.to - s.from}${unit};--c:${s.ink}"><span>${s.name}</span></span>`
    )
    .join("");
}

function transport(qClass: string): string {
  return `<div class="ap-foot">
    <span class="ap-x">✕</span>
    <span class="ap-skip"><svg width="20" height="20" viewBox="0 0 24 24"><use href="#ap-skipb"/></svg></span>
    <span class="ap-play"><i></i><i></i></span>
    <span class="ap-skip"><svg width="20" height="20" viewBox="0 0 24 24"><use href="#ap-skipf"/></svg></span>
    <span class="${qClass}"><svg width="16" height="16" viewBox="0 0 24 24"><use href="#ap-repeat"/></svg></span>
  </div>`;
}

function head(title: string, meta: string, timeId: string, time: string): string {
  return `<div class="ap-head"><div class="ap-grab"></div>
    <div class="ap-title">${title}</div>
    <div class="ap-meta"><span class="ap-meta-l">${meta}</span><span class="ap-time" id="${timeId}">${time}</span></div>
  </div>`;
}

// ── card 1: the scrolling reel, one 666 px pattern drawn twice so it loops seamlessly
const P = 666;
const REEL_H = 168;
const DOUBLE = (() => {
  const one = heights(P / 5, 7, swell);
  return [...one, ...one];
})();
function overlays1(c: CardStrings, offset: number): string {
  const sections: Span[] = [
    { name: c.verse, ink: SECTION.verse, from: 0, to: 188 },
    { name: c.chorus, ink: SECTION.chorus, from: 190, to: 420 },
    { name: c.bridge, ink: SECTION.bridge, from: 422, to: 560 },
    { name: c.outro, ink: SECTION.outro, from: 562, to: 666 },
  ];
  const ticks = Array.from({ length: P / 74 }, (_, i) => `<i class="ap-tick" style="left:${offset + i * 74 + 30}px"></i>`).join("");
  const pin = `<span class="ap-pin" style="left:${offset + 318}px"><i></i><b>${escapeHtml(c.harmonyHere)}</b></span>`;
  return ticks + sectionStrip(sections, offset, "px") + pin;
}

const rolling = (h: number) =>
  `<div class="ap-half played"><div class="ap-strip ap-roll">${wave(P * 2, h, DOUBLE, "ap-wave")}</div></div>
    <div class="ap-half ahead"><div class="ap-strip ap-roll">${wave(P * 2, h, DOUBLE, "ap-wave")}</div></div>`;

/** "A • b • c" with the app's quiet bullets. */
const meta = (s: string) => escapeHtml(s).replace(/ • /g, " <i>•</i> ");

const card1 = (c: CardStrings) => `<div class="ap-card">
  ${head("Chorus lift", meta(c.meta1), "ap1t", "00:42 / 01:41")}
  <div class="ap-reel" style="height:${REEL_H}px">
    ${rolling(REEL_H)}
    <div class="ap-strip ap-roll ap-over">${overlays1(c, 0)}${overlays1(c, P)}</div>
    <div class="ap-ph" style="left:50%"></div>
    <span class="ap-zoom"><svg width="15" height="15" viewBox="0 0 24 24"><use href="#ap-search"/></svg></span>
  </div>
  <div class="ap-chips">
    <span class="ap-chip"><svg width="18" height="18" viewBox="0 0 24 24"><use href="#ap-loop"/></svg><b>A–B</b><small>${escapeHtml(c.loop)}</small></span>
    <span class="ap-chip"><svg width="18" height="18" viewBox="0 0 24 24"><use href="#ap-speed"/></svg><b>1.0×</b><small>${escapeHtml(c.speed)}</small></span>
    <span class="ap-chip"><svg width="18" height="18" viewBox="0 0 24 24"><use href="#ap-note"/></svg><b>±0</b><small>${escapeHtml(c.pitch)}</small></span>
  </div>
  ${transport("ap-q")}
</div>`;

// ── card 2: chords over the words, scrolling with the song
const COMPACT_H = 96;
const LYRICS: { sec?: "verse" | "chorus"; segs?: [string, string][] }[] = [
  { sec: "verse" },
  { segs: [["G", "Harbor lights are "], ["Em", "burning low"]] },
  { segs: [["C", "tell me where the "], ["D", "night boats go"]] },
  { segs: [["G", "Kept your letter "], ["Em", "folded twice"]] },
  { segs: [["C", "like a map to "], ["D", "paradise"]] },
  { sec: "chorus" },
  { segs: [["Em", "Hold on to the "], ["C", "turning tide"]] },
  { segs: [["G", "every light we "], ["D", "leave behind"]] },
  { segs: [["Em", "burns a little "], ["C", "longer"]] },
  { segs: [["G", "on the "], ["D", "other side"]] },
];

const lyricsHtml = (c: CardStrings) => LYRICS.map((l) =>
  l.sec
    ? `<div class="ap-lsec">${escapeHtml(c[l.sec])}</div>`
    : `<div class="ap-line">${l.segs!.map(([c, w]) => `<span class="ap-seg"><b>${c}</b>${w}</span>`).join("")}</div>`
).join("");

const card2 = (c: CardStrings) => `<div class="ap-card">
  ${head("Harbor Lights", meta(c.meta2), "ap2t", "00:31 / 01:41")}
  <div class="ap-reel" style="height:${COMPACT_H}px">
    ${rolling(COMPACT_H)}
    <div class="ap-ph" style="left:50%"></div>
  </div>
  <div class="ap-lyr"><div class="ap-lyrroll">${lyricsHtml(c)}${lyricsHtml(c)}</div></div>
  ${transport("ap-q")}
</div>`;

// ── card 3: the loop, with Step up raising the speed a pass at a time
const LOOP_H = 120;
const LOOP_W = 313;
const LOOP_A = 34;
const LOOP_B = 66;
const STEPS = 6;
const LOOP_WAVE = heights(Math.floor(LOOP_W / 5), 23, swell);

const card3 = (c: CardStrings) => `<div class="ap-card">
  ${head("Chorus lift", meta(c.meta3), "ap3t", "00:49 / 01:41")}
  <div class="ap-reel ap-loopreel" id="ap3" style="height:${LOOP_H}px;--p:${LOOP_A}%">
    <div class="ap-band" style="left:${LOOP_A}%;width:${LOOP_B - LOOP_A}%"></div>
    <div class="ap-fixed ahead-all">${wave(LOOP_W, LOOP_H, LOOP_WAVE, "ap-wave")}</div>
    <div class="ap-fixed played-to">${wave(LOOP_W, LOOP_H, LOOP_WAVE, "ap-wave")}</div>
    ${sectionStrip(
      [
        { name: c.verse, ink: SECTION.verse, from: 0, to: 33.6 },
        { name: c.chorus, ink: SECTION.chorus, from: LOOP_A, to: LOOP_B },
        { name: c.bridge, ink: SECTION.bridge, from: 66.4, to: 100 },
      ],
      0,
      "%"
    )}
    <i class="ap-h" style="left:${LOOP_A}%"></i><i class="ap-h" style="left:${LOOP_B}%"></i>
    <div class="ap-ph" id="ap3ph" style="left:${LOOP_A}%"></div>
  </div>
  <div class="ap-drawer">
    <div class="ap-row"><span class="ap-label">${escapeHtml(c.loop)}</span><span class="ap-switch on"></span></div>
    <div class="ap-row ap-divider"><span class="ap-label">${escapeHtml(c.stepUp)}</span>
      <svg class="ap-glyph" width="16" height="16" viewBox="0 0 24 24"><use href="#ap-refresh"/></svg>
      <svg class="ap-glyph" width="16" height="16" viewBox="0 0 24 24"><use href="#ap-options"/></svg>
      <span class="ap-switch on"></span></div>
    <div class="ap-steps"><span class="ap-dots" id="ap3dots">${Array.from({ length: STEPS }, (_, i) => `${i ? '<i class="ap-link"></i>' : ""}<i class="ap-dot${i === 0 ? " cur" : ""}"></i>`).join("")}</span>
      <span class="ap-count" id="ap3n">1 / ${STEPS}</span><span class="ap-rate" id="ap3r">0.70×</span></div>
  </div>
  ${transport("ap-q on")}
</div>`;

export const GALLERY_CSS = `
  .ap-card{width:333px;height:416px;background:#FDFBF7;display:flex;flex-direction:column;overflow:hidden;
    font-family:'Plus Jakarta Sans',ui-sans-serif,sans-serif;color:#1b1c1a}
  .ap-head{padding:8px 16px 10px}
  .ap-grab{width:36px;height:4px;border-radius:2px;background:#C9BCB6;margin:0 auto 12px}
  .ap-title{font-weight:700;font-size:21px;line-height:26px;margin-bottom:4px}
  .ap-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:#84736f}
  .ap-meta-l{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ap-meta i{font-style:normal;color:#a89994;padding:0 2px}
  .ap-time{flex:none;color:#524440;font-weight:500;font-variant-numeric:tabular-nums}
  .ap-reel,.ap-foot,.ap-lyr,.ap-time{direction:ltr}
  /* numbers with a sign or a unit (×, ±, 3 / 6) keep their order inside a right-to-left line */
  .ap-chip b,.ap-count,.ap-rate{direction:ltr;unicode-bidi:isolate}
  .ap-reel{position:relative;flex:none;background:#F0EBE4;overflow:hidden;margin:0 10px;border-radius:6px}
  .ap-strip{position:absolute;top:0;bottom:0;left:0;width:${P * 2}px}
  .ap-roll{animation:aproll 24s linear infinite}
  @keyframes aproll{to{transform:translateX(-${P}px)}}
  .ap-wave{display:block}
  .ap-half{position:absolute;inset:0}
  .ap-half.played{clip-path:inset(0 50% 0 0);color:#B87D6B}
  .ap-half.ahead{clip-path:inset(0 0 0 50%);color:#C7B9AF}
  .ap-over{z-index:2}
  .ap-tick{position:absolute;top:0;width:1px;height:7px;background:#D7C2BD}
  .ap-sec{position:absolute;bottom:0;height:24px;border-bottom:3px solid var(--c);z-index:2}
  .ap-sec span{position:absolute;left:6px;bottom:3px;font-size:12px;color:var(--c);white-space:nowrap}
  .ap-pin{position:absolute;top:18px;bottom:30px;width:1px;background:rgba(82,68,64,.35)}
  .ap-pin i{position:absolute;top:-3px;left:-3px;width:7px;height:7px;border-radius:50%;background:#524440}
  .ap-pin b{position:absolute;left:8px;top:-9px;font-weight:400;font-size:12.5px;color:#524440;white-space:nowrap}
  .ap-ph{position:absolute;top:0;bottom:0;width:2.5px;margin-left:-1.25px;background:#C0453B;z-index:6}
  .ap-ph::before{content:"";position:absolute;top:0;left:-4px;width:0;height:0;
    border-left:5.25px solid transparent;border-right:5.25px solid transparent;border-top:7px solid #C0453B}
  .ap-zoom{position:absolute;right:8px;bottom:32px;width:30px;height:30px;border-radius:50%;background:#fff;
    border:1px solid #D7C2BD;display:flex;align-items:center;justify-content:center;color:#524440;z-index:7}
  .ap-chips{display:flex;gap:8px;padding:12px 10px 4px}
  .ap-chip{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0;
    border:.5px solid #E8E4DF;border-radius:4px;background:#fff;color:#524440}
  .ap-chip b{font-size:15px;font-weight:700;color:#1b1c1a;line-height:1.2}
  .ap-chip small{font-size:11px;font-weight:500;color:#84736f;line-height:1.2}
  .ap-foot{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:12px;
    border-top:1px solid #E8E4DF;padding:10px 16px 14px;background:#FDFBF7;position:relative;z-index:2}
  .ap-x,.ap-q{width:34px;height:34px;border-radius:50%;background:#F4F1ED;display:flex;align-items:center;justify-content:center;color:#84736f;font-size:14px}
  .ap-q.on{background:#B87D6B;color:#fff}
  .ap-skip{width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:#524440}
  .ap-play{width:54px;height:54px;border-radius:50%;background:#824F3F;display:flex;align-items:center;justify-content:center;gap:4px}
  .ap-play i{display:block;width:4.5px;height:19px;border-radius:1px;background:#FDFBF7}

  /* card 2 — chords ride above the words, the way a chart reads */
  .ap-lyr{position:relative;flex:1;overflow:hidden;margin-top:4px;
    -webkit-mask-image:linear-gradient(transparent,#000 12%,#000 86%,transparent);mask-image:linear-gradient(transparent,#000 12%,#000 86%,transparent)}
  .ap-lyrroll{position:absolute;left:20px;right:12px;top:0;animation:aplyr 34s linear infinite}
  @keyframes aplyr{to{transform:translateY(-50%)}}
  .ap-lsec{font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#a89994;margin:14px 0 0}
  .ap-line{padding-top:17px;font-family:Lora,Georgia,serif;font-size:15.5px;line-height:21px;color:#1b1c1a;white-space:nowrap}
  .ap-seg{position:relative}
  .ap-seg b{position:absolute;left:0;top:-17px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:12.5px;line-height:16px;color:#824F3F}

  /* card 3 — the loop owns the terracotta, so the played side goes quiet */
  .ap-fixed{position:absolute;left:0;top:0;z-index:1}
  .ahead-all{color:#C7B9AF}
  .played-to{color:#84736f;clip-path:inset(0 calc(100% - var(--p)) 0 0);width:100%;height:100%}
  .ap-band{position:absolute;top:0;bottom:0;background:rgba(184,125,107,.14);
    border-left:1.5px solid #C08A79;border-right:1.5px solid #C08A79;z-index:0}
  .ap-h{position:absolute;top:50%;width:8px;height:26px;margin:-13px 0 0 -4px;border-radius:4px;background:#B87D6B;z-index:5}
  .ap-drawer{padding:6px 16px 0}
  .ap-row{display:flex;align-items:center;gap:12px;height:42px}
  .ap-divider{border-top:1px solid #E8E4DF}
  .ap-label{flex:1;font-weight:600;font-size:15px;color:#1b1c1a}
  .ap-glyph{color:#a89994;flex:none}
  .ap-switch{width:40px;height:24px;border-radius:12px;background:#EDE9E4;position:relative;flex:none}
  .ap-switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(60,40,30,.2)}
  .ap-switch.on{background:#B87D6B}
  .ap-switch.on::after{left:18px}
  .ap-steps{display:flex;align-items:center;gap:10px;padding:0 0 8px}
  .ap-dots{display:flex;align-items:center}
  .ap-dot{display:block;width:7px;height:7px;border-radius:50%;border:1px solid #D7C2BD;box-sizing:border-box;transition:background .3s,border-color .3s}
  .ap-dot.done{background:#B87D6B;border-color:#B87D6B}
  .ap-dot.cur{border:2px solid #B87D6B}
  .ap-link{display:block;width:9px;height:1px;background:#E8E4DF;transition:background .3s}
  .ap-link.done{background:#B87D6B}
  .ap-count{margin-left:auto;font-size:13px;color:#84736f;font-variant-numeric:tabular-nums}
  .ap-rate{font-size:13px;font-weight:600;color:#824F3F;font-variant-numeric:tabular-nums;min-width:40px;text-align:right}

  @media (prefers-reduced-motion:reduce){.ap-roll{animation:none;transform:translateX(-200px)}.ap-lyrroll{animation:none}}

  /* the side padding lets the first and last card snap to the centre too (a padding %
     reads the parent's width; the gallery is that plus its two 22 px bleeds) */
  .gallery{--sw:335px;display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -22px;
    padding:2px max(22px,calc(50% + 22px - var(--sw) / 2)) 6px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .gallery::-webkit-scrollbar{display:none}
  .slide{flex:0 0 auto;scroll-snap-align:center;width:var(--sw)}
  /* the cards are drawn at the app's own size; on a narrow phone they shrink whole
     rather than clip */
  @media (max-width:380px){.gallery{--sw:302px}.slide .inner{zoom:.9}}
  @media (max-width:340px){.gallery{--sw:268px}.slide .inner{zoom:.8}}
  .slide .inner{border:1px solid var(--rule);border-radius:16px;overflow:hidden;background:#FDFBF7}
  .slide .cap{text-align:center;font-size:12.5px;color:var(--ink-soft);margin-top:10px;line-height:1.4}
  .slide .cap b{color:var(--ink);font-weight:600}
  .dots{display:flex;gap:6px;justify-content:center;margin:14px 0 4px}
  .dot{width:6px;height:6px;border-radius:99px;background:var(--rule);transition:width .2s,background .2s}
  .dot.on{width:18px;background:var(--terra)}`;

export const GALLERY_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <g id="ap-loop" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 14-5.3L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-14 5.3L4 16"/><path d="M4 20v-4h4"/></g>
  <g id="ap-speed" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.3" fill="currentColor" stroke="none"/></g>
  <g id="ap-note" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="7" cy="18" r="2.4"/><circle cx="17" cy="16" r="2.4"/><path d="M9.4 18V6l10-2v12"/></g>
  <g id="ap-search" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></g>
  <g id="ap-skipb" fill="currentColor"><path d="M20 5v14l-9-7z"/><rect x="5" y="5" width="2.4" height="14" rx="1"/></g>
  <g id="ap-skipf" fill="currentColor"><path d="M4 5v14l9-7z"/><rect x="16.6" y="5" width="2.4" height="14" rx="1"/></g>
  <g id="ap-repeat" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/></g>
  <g id="ap-refresh" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></g>
  <g id="ap-options" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.4" fill="#FDFBF7"/><circle cx="15" cy="17" r="2.4" fill="#FDFBF7"/></g>
</defs></svg>`;

const cap = ([lead, rest]: [string, string]) => `<div class="cap"><b>${escapeHtml(lead)}</b> — ${escapeHtml(rest)}</div>`;

/** The three cards in the page's language (the app's own labels; the song stays in English). */
export function galleryHtml(c: CardStrings = CARDS_EN): string {
  return `<div class="gallery" id="gallery">
    <div class="slide"><div class="inner">${card1(c)}</div>${cap(c.cap1)}</div>
    <div class="slide"><div class="inner">${card2(c)}</div>${cap(c.cap2)}</div>
    <div class="slide"><div class="inner">${card3(c)}</div>${cap(c.cap3)}</div>
  </div>
  <div class="dots" id="dots"><span class="dot on"></span><span class="dot"></span><span class="dot"></span></div>`;
}

export const GALLERY_HTML = galleryHtml();

export const GALLERY_SCRIPT = `(function(){
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var two = function(n){ return (n<10?'0':'')+n; };
  var mmss = function(s){ s=Math.floor(s); return two(Math.floor(s/60))+':'+two(s%60); };
  /* cards 1 and 2: a clock that walks with the scrolling reel */
  [['ap1t',42],['ap2t',31]].forEach(function(c){
    var el=document.getElementById(c[0]); if(!el||still) return;
    var t=c[1]; setInterval(function(){ t=t+1>=101?c[1]:t+1; el.textContent=mmss(t)+' / 01:41'; },1000);
  });
  /* card 3: one clock drives the playhead, the time, and Step up's passes */
  var reel=document.getElementById('ap3'), ph=document.getElementById('ap3ph'), tm=document.getElementById('ap3t'),
      n=document.getElementById('ap3n'), r=document.getElementById('ap3r'), dots=document.getElementById('ap3dots');
  if(!reel||!ph||!dots) return;
  var A=${LOOP_A}, B=${LOOP_B}, tA=49, tB=57, STEPS=${STEPS}, RATES=[0.70,0.75,0.80,0.85,0.90,1.00];
  var ds=dots.querySelectorAll('.ap-dot'), ls=dots.querySelectorAll('.ap-link');
  var pass=0, start=Date.now();
  function paint(){
    for(var i=0;i<ds.length;i++) ds[i].className='ap-dot'+(i<pass?' done':i===pass?' cur':'');
    for(var k=0;k<ls.length;k++) ls[k].className='ap-link'+(k<pass?' done':'');
    n.textContent=(pass+1)+' / '+STEPS;
    r.textContent=RATES[pass].toFixed(2)+'\\u00d7';
  }
  function at(f){ var p=A+f*(B-A); ph.style.left=p+'%'; reel.style.setProperty('--p',p+'%'); tm.textContent=mmss(tA+f*(tB-tA))+' / 01:41'; }
  paint(); at(still?0.45:0);
  if(still) return;
  /* each pass is a little quicker than the last; after the last, the drill starts over */
  setInterval(function(){
    var dur=2800/RATES[pass], f=(Date.now()-start)/dur;
    if(f>=1){ start=Date.now(); pass=(pass+1)%STEPS; paint(); f=0; }
    at(f);
  },40);
})();
(function(){
  var g=document.getElementById('gallery'), dots=document.getElementById('dots');
  if(!g||!dots) return; dots=dots.children;
  g.addEventListener('scroll', function(){
    var i=Math.round(g.scrollLeft/(g.scrollWidth/3));
    for(var k=0;k<dots.length;k++) dots[k].className=(k===Math.min(i,2))?'dot on':'dot';
  });
})();`;
