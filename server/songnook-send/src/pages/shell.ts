/**
 * Shared HTML shell + the SongNook Send design system.
 *
 * Direction: "the letterpress parcel" — the page reads as a beautifully typeset
 * note that arrived wrapped around a parcel of songs. Warm paper with real
 * grain, espresso ink, terracotta letterpress accents, oversized Lora
 * display serif, hairline rules — and a living waveform of terracotta bars as
 * the brand signature. Staggered reveal on load; warm ember dark mode.
 *
 * Fully self-contained aside from Google Fonts. No secrets, no app JS here.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** The animated waveform signature — bar heights are fixed (server-rendered,
 *  deterministic), the gentle sway is CSS-only. */
export function waveformStrip(barCount = 36): string {
  let seed = 7;
  const bars: string[] = [];
  for (let i = 0; i < barCount; i++) {
    seed = (seed * 16807) % 2147483647;
    const h = 14 + (seed % 62); // 14..75%
    const d = (seed % 9) / 10; // 0..0.8s stagger
    bars.push(`<i style="height:${h}%;animation-delay:-${d}s"></i>`);
  }
  return `<div class="wave" aria-hidden="true">${bars.join("")}</div>`;
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * The pages' two faces, served by this Worker from public/fonts (the app's own Lora and
 * Plus Jakarta Sans, OFL), so a visitor's browser talks to no one but us
 * (store-truth.md D4; Google Fonts was loaded here before 2026-10-25).
 */
/**
 * Hebrew, the way the app does it: Frank Ruhl Libre stands in for Lora and Heebo for
 * Plus Jakarta Sans. Declared under the same family names with a Hebrew unicode-range,
 * so a Hebrew letter in any heading or line picks its face by itself and Latin text
 * keeps its own. Subsets of the app's fonts (OFL), Hebrew block only.
 */
const HE_RANGE = "U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F";
const heFace = (family: string, file: string, weight: number, style = "normal") =>
  `@font-face{font-family:"${family}";src:url(/fonts/${file}.woff2) format("woff2");font-weight:${weight};font-style:${style};font-display:swap;unicode-range:${HE_RANGE}}`;
const HEBREW_FACES = [
  heFace("Lora", "frank-ruhl-libre-hebrew-400", 400),
  heFace("Lora", "frank-ruhl-libre-hebrew-500", 500),
  heFace("Lora", "frank-ruhl-libre-hebrew-500", 600),
  // Hebrew has no italic: an italic Lora line shows its Hebrew upright.
  heFace("Lora", "frank-ruhl-libre-hebrew-400", 400, "italic"),
  heFace("Lora", "frank-ruhl-libre-hebrew-500", 500, "italic"),
  heFace("Plus Jakarta Sans", "heebo-hebrew-400", 400),
  heFace("Plus Jakarta Sans", "heebo-hebrew-500", 500),
  heFace("Plus Jakarta Sans", "heebo-hebrew-600", 600),
  heFace("Plus Jakarta Sans", "heebo-hebrew-700", 700),
].join("\n");

const FONT_FACES = `
@font-face{font-family:"Lora";src:url(/fonts/lora-latin-400-normal.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Lora";src:url(/fonts/lora-latin-500-normal.woff2) format("woff2");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:"Lora";src:url(/fonts/lora-latin-600-normal.woff2) format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"Lora";src:url(/fonts/lora-latin-400-italic.woff2) format("woff2");font-weight:400;font-style:italic;font-display:swap}
@font-face{font-family:"Lora";src:url(/fonts/lora-latin-500-italic.woff2) format("woff2");font-weight:500;font-style:italic;font-display:swap}
@font-face{font-family:"Plus Jakarta Sans";src:url(/fonts/plus-jakarta-sans-latin-400-normal.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Plus Jakarta Sans";src:url(/fonts/plus-jakarta-sans-latin-500-normal.woff2) format("woff2");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:"Plus Jakarta Sans";src:url(/fonts/plus-jakarta-sans-latin-600-normal.woff2) format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"Plus Jakarta Sans";src:url(/fonts/plus-jakarta-sans-latin-700-normal.woff2) format("woff2");font-weight:700;font-style:normal;font-display:swap}
${HEBREW_FACES}`;

const BRAND_CSS = `
:root{
  --paper:#f3ecdf; --paper-deep:#eae1cf; --card:#faf5ea; --ink:#2a2119;
  --ink-soft:#7c6f5e; --ink-faint:#a3947e; --terra:#9a4f35; --terra-deep:#7c3e28;
  --terra-ink:#fdf7ef; --rule:#d8cbb4; --gold:#b98a4d;
}
@media (prefers-color-scheme:dark){
  :root{
    --paper:#1d1712; --paper-deep:#241c15; --card:#251e16; --ink:#f0e6d6;
    --ink-soft:#a6957e; --ink-faint:#78694f; --terra:#d0764f; --terra-deep:#e08a60;
    --terra-ink:#221108; --rule:#3a3022; --gold:#c79a5e;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
html,body{margin:0;padding:0}
body{
  background:var(--paper); color:var(--ink);
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; line-height:1.55; min-height:100vh; position:relative;
}
body::before{ /* paper grain — plain opacity; blend modes are too expensive to composite */
  content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
  background-image:${GRAIN}; opacity:.5;
}
@media (prefers-color-scheme:dark){ body::before{opacity:.3} }
.wrap{max-width:660px;margin:0 auto;padding:clamp(28px,6vw,64px) 22px 90px;position:relative;z-index:1}
.wrap.wide{max-width:1060px}

/* ── masthead ── */
.masthead{display:flex;align-items:baseline;justify-content:space-between;gap:16px;position:relative;z-index:10; /* its menus open over the page below */
  
  border-bottom:1px solid var(--rule);padding-bottom:18px;margin-bottom:clamp(34px,7vw,60px)}
.brand{font-family:Lora,Georgia,serif;font-style:italic;font-weight:500;
  font-size:21px;color:var(--ink);letter-spacing:.01em;text-decoration:none}
.brand b{color:var(--terra);font-style:normal;font-weight:600}
.masthead .tag{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-faint)}
.masthead .tag-link{color:var(--terra);font-weight:700;text-decoration:none;border-bottom:1px solid transparent}
.masthead .tag-link:hover{border-bottom-color:var(--terra)}

/* ── type ── */
.eyebrow{font-size:12px;letter-spacing:.26em;text-transform:uppercase;color:var(--terra);
  font-weight:700;margin:0 0 18px;display:flex;align-items:center;gap:14px}
.eyebrow::after{content:"";height:1px;flex:1;background:var(--rule)}
h1{font-family:Lora,Georgia,serif;font-weight:500;letter-spacing:-0.01em;
  font-size:clamp(38px,7.5vw,58px);line-height:1.04;margin:0 0 18px;text-wrap:balance}
h1 em{font-style:italic;color:var(--terra)}
.sub{color:var(--ink-soft);font-size:16.5px;margin:0 0 34px;max-width:46ch}
.note{font-family:Lora,Georgia,serif;font-style:italic;font-size:20px;color:var(--ink-soft);
  border-left:2px solid var(--terra);padding:2px 0 2px 18px;margin:0 0 34px}

/* ── waveform signature ── */
.wave{display:flex;align-items:center;gap:3px;height:44px;margin:0 0 34px}
.wave i{display:block;width:3px;border-radius:2px;background:var(--terra);opacity:.85;
  animation:sway 1.6s ease-in-out 6 alternate} /* settles after a few breaths */
.wave i:nth-child(3n){background:var(--gold)}
@keyframes sway{from{transform:scaleY(.55)}to{transform:scaleY(1.06)}}
@media (prefers-reduced-motion:reduce){.wave i{animation:none}}

/* ── panel ── */
.panel{background:var(--card);border:1px solid var(--rule);border-radius:4px;
  padding:clamp(22px,4.5vw,34px);position:relative}
.panel + .panel{margin-top:18px}
.panel::before{content:"";position:absolute;inset:6px;border:1px solid var(--rule);
  border-radius:2px;pointer-events:none;opacity:.55}
.panel > *{position:relative}

/* ── tracklist ── */
.tracklist{list-style:none;margin:0;padding:0;counter-reset:trk}
.tracklist li{display:flex;align-items:center;gap:16px;padding:15px 2px;counter-increment:trk;
  border-top:1px solid var(--rule)}
.tracklist li:first-child{border-top:none}
.tracklist li::before{content:counter(trk,decimal-leading-zero);
  font-family:Lora,Georgia,serif;font-style:italic;font-size:15px;color:var(--terra);
  min-width:26px}
.trk-name{flex:1;min-width:0;font-weight:600;font-size:15px;word-break:break-word}
.trk-size{font-size:12.5px;color:var(--ink-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
.trk-dl{font-size:12.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--terra);text-decoration:none;border-bottom:1px solid transparent;white-space:nowrap}
.trk-dl:hover{border-bottom-color:var(--terra)}
.trk-x{background:none;border:none;color:var(--ink-faint);cursor:pointer;font-size:15px;padding:2px 6px}
.trk-x:hover{color:var(--terra)}

/* ── buttons ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;
  background:var(--terra);color:var(--terra-ink);border:1px solid var(--terra-deep);
  border-radius:3px;padding:15px 26px;font:inherit;font-size:14px;font-weight:700;
  letter-spacing:.14em;text-transform:uppercase;cursor:pointer;text-decoration:none;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 1px 0 var(--terra-deep);
  transition:transform .12s ease, box-shadow .12s ease}
.btn:hover{transform:translateY(-1px)}
.btn:active{transform:translateY(1px);box-shadow:inset 0 1px 3px rgba(0,0,0,.2)}
.btn:disabled{opacity:.45;cursor:default;transform:none}
.btn-quiet{background:transparent;color:var(--ink);border:1px solid var(--rule);box-shadow:none}
.btn-quiet:hover{border-color:var(--ink-soft)}
.btn-block{width:100%}

/* ── forms ── */
.field{margin:0 0 16px}
.field label{display:block;font-size:11px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink-faint);margin-bottom:7px;font-weight:700}
.field input,.field textarea{width:100%;background:transparent;border:none;
  border-bottom:1px solid var(--rule);padding:8px 2px 10px;font:inherit;font-size:16px;
  color:var(--ink);resize:vertical;border-radius:0}
.field input:focus,.field textarea:focus{outline:none;border-bottom-color:var(--terra)}
.field ::placeholder{color:var(--ink-faint);font-style:italic;font-family:Lora,Georgia,serif}

/* ── dropzone ── */
.drop{border:1.5px dashed var(--rule);border-radius:4px;background:var(--paper-deep);
  padding:clamp(30px,6vw,48px) 20px;text-align:center;cursor:pointer;
  transition:border-color .15s, background .15s}
.drop:hover,.drop.over{border-color:var(--terra);background:var(--card)}
.drop strong{font-family:Lora,Georgia,serif;font-weight:500;font-size:22px;display:block;margin-bottom:6px}
.drop span{color:var(--ink-soft);font-size:13.5px}

/* ── link output ── */
.linkbox{display:flex;align-items:center;gap:12px;border:1px solid var(--rule);
  border-radius:3px;background:var(--paper-deep);padding:13px 16px;margin-top:14px}
.linkbox code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;
  word-break:break-all;flex:1;color:var(--ink)}
.copybtn{background:none;border:none;color:var(--terra);font:inherit;font-size:12px;
  font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;white-space:nowrap}

.notice{border:1px solid var(--rule);border-left:3px solid var(--gold);border-radius:3px;
  background:var(--card);padding:13px 16px;font-size:14px;color:var(--ink-soft);margin-top:16px}

.progress{height:3px;background:var(--paper-deep);border-radius:99px;overflow:hidden;margin-top:20px}
.progress > i{display:block;height:100%;width:0;background:var(--terra);transition:width .25s ease}

.meta-line{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-faint);
  display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}
.meta-line b{color:var(--ink-soft);font-weight:700}

/* ── footer ── */
.foot{margin-top:clamp(44px,8vw,70px);border-top:1px solid var(--rule);padding-top:16px;
  display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;
  font-size:12px;color:var(--ink-faint)}
.foot a{color:var(--ink-faint)}

/* ── staggered reveal ── */
@media (prefers-reduced-motion:no-preference){
  .rise{opacity:0;transform:translateY(14px);animation:rise .7s cubic-bezier(.2,.7,.2,1) forwards}
  .rise.d1{animation-delay:.08s}.rise.d2{animation-delay:.16s}.rise.d3{animation-delay:.26s}
  .rise.d4{animation-delay:.36s}
  @keyframes rise{to{opacity:1;transform:none}}
}
`;

export function page(opts: {
  title: string;
  body: string;
  bodyScript?: string;
  noindex?: boolean;
  /** Page-specific CSS appended after the shared design system (e.g. the
   *  recipient page's app-preview gallery). */
  extraStyle?: string;
  /** When set, the footer carries a quiet "Report" link to the abuse funnel —
   *  every page that shows someone else's content must offer one. */
  reportHref?: string;
  /** "send" (default) wears the Send masthead and transfer footer; "site" is the
   *  bare domain — SongNook itself, with the legal links in the footer. */
  variant?: "send" | "site";
  /** Extra tags for <head>: the landing's description and share card. */
  head?: string;
  /** A wider column, for the landing's screenshots. */
  wide?: boolean;
  /** The page's language and direction (the landing speaks five; everything else English). */
  lang?: string;
  dir?: "ltr" | "rtl";
  /** The site masthead's right side, when the page brings its own (the landing's
   *  language menu and download link); otherwise a plain "Get the app". */
  mastRight?: string;
  /** The site footer's link words in the page's language. */
  footLabels?: { support: string; privacy: string; terms: string };
}): string {
  const site = opts.variant === "site";
  const foot = opts.footLabels ?? { support: "Support", privacy: "Privacy", terms: "Terms" };
  return `<!doctype html>
<html lang="${escapeHtml(opts.lang ?? "en")}" dir="${opts.dir ?? "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${opts.noindex ? '<meta name="robots" content="noindex,nofollow">' : ""}
<title>${escapeHtml(opts.title)}</title>
<link rel="icon" type="image/png" href="/favicon.png">
${opts.head ?? ""}
<meta name="theme-color" content="#f3ecdf" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1d1712" media="(prefers-color-scheme: dark)">
<link rel="preload" href="/fonts/lora-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/plus-jakarta-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${FONT_FACES}${BRAND_CSS}${opts.extraStyle ?? ""}</style>
</head>
<body>
<div class="wrap${opts.wide ? " wide" : ""}">
<header class="masthead rise">
  <a class="brand" href="/">Song<b>Nook</b>${site ? "" : " · Send"}</a>
  ${site ? opts.mastRight ?? '<a class="tag tag-link" href="/#get">Get the app</a>' : '<span class="tag">Music, passed along</span>'}
</header>
${opts.body}
<footer class="foot">
  <span>${site ? `<a href="/support">${escapeHtml(foot.support)}</a> · <a href="/privacy">${escapeHtml(foot.privacy)}</a> · <a href="/terms">${escapeHtml(foot.terms)}</a>` : "Files are held for a limited time, then quietly let go."}</span>
  <span>${site ? "© 2026 bmostudio" : "SongNook — a quiet corner for songwriting and practice"}${
    opts.reportHref ? ` · <a href="${escapeHtml(opts.reportHref)}">Report</a>` : ""
  }</span>
</footer>
</div>
${opts.bodyScript ? `<script>${opts.bodyScript}</script>` : ""}
</body>
</html>`;
}

export function htmlPage(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      "content-security-policy": [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self' https://*.r2.cloudflarestorage.com",
        "form-action 'none'",
      ].join("; "),
    },
  });
}
