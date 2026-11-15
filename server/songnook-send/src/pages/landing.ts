/**
 * The bare-domain landing (songnook.app): what SongNook is, where to get it, what's
 * free and what Pro adds.
 *
 * Shown, not told: a live hero (the real app in a phone, a mini player that plays), a
 * tour that walks the six moments from a hum to a finished song with the matching real
 * screen, the Send page's living player cards for practice, and a plan picker.
 * Screens are raw simulator captures (docs/store-assets/raw, 640 px webp in
 * public/screens). Badges are Apple's and Google's official artwork (public/badges);
 * Google's shows only once Play is live (its rules: the badge links to a live listing).
 *
 * Its claims follow the store description (store-truth.md §6) and
 * pricing-and-marketing.md; a change there is a change here. Every word lives in
 * landingI18n.ts, in all five of the app's languages; Hebrew lays out right to left.
 */
import { GALLERY_CSS, GALLERY_SCRIPT, GALLERY_SPRITE, galleryHtml } from "./appPreviewGallery";
import { LANGS, STRINGS, type Lang, type LandingStrings } from "./landingI18n";
import { SITE_PARTS_CSS, SITE_PARTS_JS, androidSoon, langMenu, storeBadges } from "./siteParts";
import { escapeHtml, page } from "./shell";

/** The brand mark (assets/brand/songnook-mark.svg), inline so the hero needs no request. */
const MARK = `<svg class="mark" viewBox="0 0 120 120" aria-hidden="true"><rect x="57.5" y="42" width="5" height="44" rx="2.5" fill="#B87D6B"/><rect x="41" y="84" width="38" height="5" rx="2.5" fill="#B87D6B"/><path d="M60 32 A25 25 0 0 0 23 59 A25 25 0 0 0 60 32 Z" fill="#C9978A" stroke="#C9978A" stroke-width="3" stroke-linejoin="round"/><path d="M60 32 A25 25 0 0 1 97 59 A25 25 0 0 1 60 32 Z" fill="#B87D6B" stroke="#B87D6B" stroke-width="3" stroke-linejoin="round"/></svg>`;

/** The real screen beside each tour step, in the strings' order. */
const TOUR_SCREENS = ["recorder", "lyrics", "sketch", "revisit"];

/** Languages whose screens have been captured from the app in that language
 *  (public/screens/<lang>/); the rest show the English screens. */
const LOCALIZED_SCREENS: readonly Lang[] = ["es", "de", "pt", "he"];
const screen = (lang: Lang, name: string) =>
  LOCALIZED_SCREENS.includes(lang) ? `/screens/${lang}/${name}.webp` : `/screens/${name}.webp`;

const YOURS_ICONS = [
  `<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M10.5 18.5h3"/>`,
  `<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5"/><path d="M4 4l16 16"/>`,
  `<path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>`,
];

const PRICES = { year: "$24.99", month: "$3.99", life: "$59.99" } as const;

/** Deterministic bar heights (percent) for the hero's mini player. */
function miniBars(count: number): string {
  let seed = 11;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 16807) % 2147483647;
    const swell = 0.55 + 0.45 * Math.sin((i / count) * Math.PI * 2.4);
    out.push(`<i style="height:${Math.round(18 + (seed % 70) * swell)}%"></i>`);
  }
  return out.join("");
}

/** The masthead's right side: the language menu, then the way to the download. */
const mastRight = (t: LandingStrings, lang: Lang) =>
  `<div class="mast-right">${langMenu(lang, (l) => `/${l}`)}<a class="tag tag-link" href="#get">${escapeHtml(t.getApp)}</a></div>`;

const badges = (lang: Lang, appStoreUrl: string, playStoreUrl: string | null) =>
  storeBadges({ lang, appStoreUrl, playHref: playStoreUrl, instead: androidSoon(lang) });

const LAND_CSS = `
:root{--bezel:#2a2119;--screen:#fdfbf7;--played:#B87D6B;--ahead:#dcc8bd}
@media (prefers-color-scheme:dark){:root{--bezel:#0f0b08;--ahead:#5a463b}}
.wrap.wide{max-width:1120px}
main > section{margin-bottom:clamp(72px,11vw,128px)}
.eyebrow{margin-bottom:14px}
h2{font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(30px,4.6vw,46px);line-height:1.08;
  letter-spacing:-.01em;margin:0 0 14px;text-wrap:balance}
.lead{color:var(--ink-soft);font-size:17px;margin:0;max-width:52ch}
.sec-head{margin-bottom:clamp(30px,5vw,52px)}
.sec-head.center{text-align:center}
.sec-head.center .lead{margin:0 auto}

/* ── phone ── */
.phone{position:relative;width:var(--pw,300px);padding:9px;border-radius:50px;background:var(--bezel);
  box-shadow:0 40px 70px -38px rgba(60,40,30,.55),0 0 0 1px rgba(255,255,255,.06) inset}
.screen{position:relative;aspect-ratio:640/1391;border-radius:41px;overflow:hidden;background:var(--screen)}
.screen img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}

/* ── hero ── */
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(28px,5vw,72px);align-items:center}
.hero .mark{width:58px;height:58px;display:block;margin:0 0 18px;margin-inline-start:-6px}
.hero h1{font-size:clamp(42px,6.6vw,74px);line-height:1.02;margin:0 0 20px}
.hero h1 em{display:block}
.hero .sub{font-size:18px;max-width:40ch;margin:0 0 30px}
.hero .fine{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-faint);font-weight:600;margin:20px 0 0}
.stage{position:relative;justify-self:center;padding:0 0 26px;padding-inline-start:40px}
.stage .phone{--pw:clamp(250px,26vw,300px);transform:rotate(2deg)}
.mini{position:absolute;inset-inline-start:-8px;bottom:56px;width:272px;display:flex;gap:12px;align-items:center;
  background:var(--card);border-radius:14px;padding:12px 14px 12px 12px;
  box-shadow:0 22px 44px -22px rgba(60,40,30,.5),0 0 0 1px var(--rule);transform:rotate(-2deg)}
.mini-play{flex:none;width:40px;height:40px;border-radius:50%;background:var(--terra);display:flex;
  align-items:center;justify-content:center;gap:4px}
.mini-play i{display:block;width:3.5px;height:14px;border-radius:1px;background:var(--terra-ink)}
.mini-body{flex:1;min-width:0}
.mini-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.mini-title{font-family:Lora,Georgia,serif;font-weight:500;font-size:16px;color:var(--ink);
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mini-time{font-size:11.5px;color:var(--ink-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
.mini-wave{position:relative;height:30px;margin-top:6px;direction:ltr}
.mini-time{direction:ltr}
.mini-wave .bars{position:absolute;inset:0;display:flex;align-items:center;gap:2px}
.mini-wave .bars i{display:block;flex:1;border-radius:1px;background:var(--ahead)}
.mini-wave .played{clip-path:inset(0 calc(100% - var(--p,42%)) 0 0)}
.mini-wave .played i{background:var(--played)}
.mini-wave .head{position:absolute;top:-2px;bottom:-2px;left:var(--p,42%);width:2px;margin-left:-1px;
  background:var(--terra-deep);border-radius:1px}

/* ── tour ── */
.tour-grid{display:grid;grid-template-columns:1fr auto;gap:clamp(32px,7vw,110px);align-items:center}
.chapters{list-style:none;margin:0;padding:0;border-top:1px solid var(--rule);position:relative}
.chapters li{border-bottom:1px solid var(--rule)}
.chapter{display:block;width:100%;text-align:start;background:none;border:0;padding:22px 2px;
  font:inherit;color:inherit;cursor:pointer;position:relative}
.chapter:focus-visible{outline:2px solid var(--terra);outline-offset:2px;border-radius:2px}
.ch-title{display:block;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(26px,3.4vw,40px);
  line-height:1.1;color:var(--ink-faint);transition:color .3s ease}
.chapter:hover .ch-title{color:var(--ink-soft)}
.ch-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s cubic-bezier(.2,.7,.2,1)}
.ch-in{overflow:hidden;display:block}
.ch-p{display:block;color:var(--ink-soft);font-size:17px;line-height:1.55;max-width:46ch}
.ch-p:first-child{padding-top:8px;color:var(--ink)}
.ch-p + .ch-p{padding-top:4px}
.ch-bar{position:absolute;left:0;right:0;bottom:-1px;height:2px;overflow:hidden}
.ch-bar b{display:block;height:100%;width:100%;background:var(--terra);transform:scaleX(0);transform-origin:left}
[dir="rtl"] .ch-bar b{transform-origin:right}
.on .ch-title{color:var(--ink)}
.on .ch-body{grid-template-rows:1fr}
.on .ch-bar b{animation:fill var(--dur,6.5s) linear forwards}
.tour.manual .on .ch-bar b,.tour.still .on .ch-bar b{animation:none;transform:none}
.tour.paused .on .ch-bar b{animation-play-state:paused}
@keyframes fill{to{transform:none}}
.tour-stage .phone{--pw:clamp(260px,25vw,300px)}
.tour-caption{display:none;margin:0;min-height:3.2em}
.tour-stage .screen img{opacity:0;transform:scale(1.03);transition:opacity .55s ease,transform .8s cubic-bezier(.2,.7,.2,1)}
.tour-stage .screen img.on{opacity:1;transform:none}

/* ── practice: the Send page's living cards ── */
.learn .gallery{margin:0 -22px}
@media (min-width:1080px){.learn .gallery{justify-content:center;overflow:visible;margin:0;padding:2px 0 6px}.learn .dots{display:none}}

/* ── band ── */
.band-grid{display:grid;grid-template-columns:auto 1fr;gap:clamp(36px,7vw,110px);align-items:center}
.band-stage .phone{--pw:clamp(250px,24vw,290px);transform:rotate(-2deg)}
.points{list-style:none;margin:0;padding:0;border-top:1px solid var(--rule)}
.points li{padding:20px 0;border-bottom:1px solid var(--rule)}
.points b{display:block;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(21px,2.4vw,26px);color:var(--ink);margin-bottom:4px}
.points span{color:var(--ink-soft);font-size:16px}

/* ── yours ── */
.yours{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(22px,4vw,48px);
  border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:clamp(30px,5vw,48px) 0}
.yours svg{width:30px;height:30px;color:var(--terra);display:block;margin-bottom:16px}
.yours h3{font-family:Lora,Georgia,serif;font-weight:500;font-size:22px;margin:0 0 6px}
.yours p{margin:0;color:var(--ink-soft);font-size:15.5px;max-width:30ch}

/* ── plans ── */
.plans{display:grid;grid-template-columns:.85fr 1.15fr;gap:20px;align-items:stretch}
.plan{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:clamp(24px,4vw,36px)}
.plan.pro{border-top:3px solid var(--terra)}
.plan h3{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-soft);font-weight:700;margin:0 0 18px}
.plan.pro h3{color:var(--terra)}
.price{display:flex;align-items:baseline;gap:10px;margin:0 0 4px;font-variant-numeric:tabular-nums}
.price b{font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(44px,5.4vw,56px);line-height:1;color:var(--ink)}
.price span{color:var(--ink-soft);font-size:16px}
.plan .pnote{color:var(--ink-faint);font-size:13.5px;margin:0 0 22px;min-height:1.4em}
.plan ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--rule)}
.plan li{padding:11px 0;padding-inline-start:26px;border-bottom:1px solid var(--rule);font-size:15px;position:relative}
.plan li::before{content:"";position:absolute;inset-inline-start:3px;top:17px;width:9px;height:5px;
  border-left:2px solid var(--terra);border-bottom:2px solid var(--terra);transform:rotate(-45deg)}
.plan li:last-child{border-bottom:none}
.adds b{display:block;font-weight:700;color:var(--ink)}
.adds span{color:var(--ink-soft)}
.tabs{display:flex;gap:22px;border-bottom:1px solid var(--rule);margin:0 0 20px;position:relative}
.tab{background:none;border:0;padding:0 0 10px;font:inherit;font-size:14px;font-weight:600;color:var(--ink-faint);
  cursor:pointer;position:relative}
.tab:hover{color:var(--ink-soft)}
.tab:focus-visible{outline:2px solid var(--terra);outline-offset:3px;border-radius:2px}
.tab[aria-selected="true"]{color:var(--ink)}
.tab[aria-selected="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--ink)}
.plans-fine{text-align:center;color:var(--ink-faint);font-size:13px;margin:18px 0 0}

/* ── closing ── */
.closing{text-align:center;padding:clamp(40px,7vw,72px) 0 0;border-top:1px solid var(--rule)}
.closing h2{font-size:clamp(36px,6vw,64px);margin-bottom:12px}
.closing h2 em{font-style:italic;color:var(--terra)}
.closing .lead{margin:0 auto 30px}
.closing .stores{justify-content:center}

/* ── Hebrew: no italic in the script, and wide tracking breaks its letterforms ── */
:lang(he) em{font-style:normal}
:lang(he) .eyebrow,:lang(he) .masthead .tag,:lang(he) .plan h3,:lang(he) .store-soon{letter-spacing:.02em}

/* ── scroll reveal (only when the script runs; resting state is visible) ── */
@media (prefers-reduced-motion:no-preference){
  .js .reveal{opacity:0;transform:translateY(18px);transition:opacity .8s ease,transform .8s cubic-bezier(.2,.7,.2,1)}
  .js .reveal.in{opacity:1;transform:none}
  .js .reveal.d2{transition-delay:.12s}.js .reveal.d3{transition-delay:.24s}
  .stage .phone{animation:float 7s ease-in-out infinite alternate}
  .mini{animation:float2 6s ease-in-out infinite alternate}
  @keyframes float{from{transform:rotate(2deg) translateY(0)}to{transform:rotate(2deg) translateY(-8px)}}
  @keyframes float2{from{transform:rotate(-2deg) translateY(0)}to{transform:rotate(-2deg) translateY(5px)}}
}

@media (max-width:900px){
  .hero{grid-template-columns:1fr;text-align:start}
  .stage{justify-self:center;margin-top:8px}
  /* the tour becomes ink tabs over one caption and the phone, so all three fit one screen */
  .tour-grid{grid-template-columns:1fr;gap:16px}
  .tour-stage{justify-self:center}
  .tour-stage .phone{--pw:228px}
  .chapters{display:flex;gap:22px;overflow-x:auto;scrollbar-width:none;border-top:0;
    border-bottom:1px solid var(--rule);margin:0 -22px;padding:0 22px}
  .chapters::-webkit-scrollbar{display:none}
  .chapters li{flex:none;border:0}
  .chapter{padding:0 0 11px}
  .ch-title{font-size:18px;white-space:nowrap}
  .ch-body{display:none}
  .ch-bar{bottom:0}
  .tour-caption{display:block}
  .plans{grid-template-columns:1fr}
  .band-grid{grid-template-columns:1fr}
  .band-stage{order:1;justify-self:center}
  .band-stage .phone{--pw:228px}
}
@media (max-width:640px){
  .yours{grid-template-columns:1fr;gap:26px}
  .stage{padding-inline-start:24px}
  .mini{width:258px;inset-inline-start:-16px;bottom:40px}
  .mini-title{font-size:15px}
  .hero .sub{font-size:17px}
  .tabs{gap:16px}
}
`;

const LAND_JS = `
(function(){
  document.documentElement.classList.add('js');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* scroll reveal */
  var rv = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); }, {rootMargin:'0px 0px -8% 0px'});
    rv.forEach(function(el){ io.observe(el); });
  } else rv.forEach(function(el){ el.classList.add('in'); });

  /* hero mini player: one clock for the playhead and the time */
  var mw = document.getElementById('mini-wave'), mt = document.getElementById('mini-time');
  if (mw && mt) {
    var LEN = 101, start = 42, t0 = Date.now();
    var fmt = function(s){ s = Math.floor(s); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
    var tick = function(){
      var t = still ? start : (start + (Date.now()-t0)/1000) % LEN;
      mw.style.setProperty('--p', (t/LEN*100).toFixed(2) + '%');
      mt.textContent = fmt(t) + ' / 1:41';
    };
    tick(); if (!still) setInterval(tick, 250);
  }

  /* tour: the active chapter's rule fills, then the next one opens */
  var tour = document.getElementById('tour');
  if (tour) {
    var list = tour.querySelector('.chapters'), items = list.querySelectorAll('li'), shots = tour.querySelectorAll('.screen img'), cap = document.getElementById('tour-caption');
    var cur = 0;
    var show = function(i){
      cur = i;
      items.forEach(function(li, k){ li.classList.toggle('on', k===i); li.querySelector('button').setAttribute('aria-selected', k===i ? 'true' : 'false'); });
      shots.forEach(function(im, k){ im.classList.toggle('on', k===i); });
      cap.innerHTML = items[i].querySelector('.ch-in').innerHTML;
      if (list.scrollWidth > list.clientWidth) { var lr = list.getBoundingClientRect(), ir = items[i].getBoundingClientRect(); list.scrollBy({left: (document.dir === 'rtl' ? ir.right - lr.right + 22 : ir.left - lr.left - 22), behavior: still ? 'auto' : 'smooth'}); }
    };
    if (still) tour.classList.add('still');
    items.forEach(function(li, k){
      li.querySelector('button').addEventListener('click', function(){ tour.classList.add('manual'); show(k); });
      li.querySelector('.ch-bar b').addEventListener('animationend', function(){ if(!tour.classList.contains('manual')) show((cur+1) % items.length); });
    });
    if ('IntersectionObserver' in window) {
      tour.classList.add('paused');
      new IntersectionObserver(function(es){ tour.classList.toggle('paused', !es[0].isIntersecting); }, {threshold:.35}).observe(tour);
    }
  }

  /* plan picker */
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function(tb){
    tb.addEventListener('click', function(){
      tabs.forEach(function(o){ o.setAttribute('aria-selected', o===tb ? 'true' : 'false'); });
      document.getElementById('pp').textContent = tb.dataset.price;
      document.getElementById('pper').textContent = tb.dataset.per;
      document.getElementById('pnote').textContent = tb.dataset.note;
    });
  });
})();
`;

export function renderLandingPage(lang: Lang, appStoreUrl: string, playStoreUrl: string | null = null): string {
  const t = STRINGS[lang];
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="https://songnook.app/${l}">`).join("\n");
  const head = `<meta name="description" content="${escapeHtml(t.description)}">
<link rel="canonical" href="https://songnook.app/${lang}">
${alternates}
<link rel="alternate" hreflang="x-default" href="https://songnook.app/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://songnook.app/${lang}">
<meta property="og:title" content="SongNook">
<meta property="og:description" content="${escapeHtml(t.description)}">
<meta property="og:image" content="https://songnook.app/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="apple-itunes-app" content="app-id=6810435199">
<link rel="preload" href="${screen(lang, "collection")}" as="image">`;
  const bars = miniBars(48);
  const chapters = t.tour
    .map(
      (c, i) => `<li${i === 0 ? ' class="on"' : ""}><button class="chapter" type="button" role="tab" aria-selected="${i === 0}" aria-controls="tour-screen"><span class="ch-title">${escapeHtml(c.title)}</span><span class="ch-body"><span class="ch-in"><span class="ch-p">${escapeHtml(c.line)}</span></span></span><span class="ch-bar"><b></b></span></button></li>`
    )
    .join("");
  const shots = t.tour
    .map(
      (c, i) => `<img${i === 0 ? ' class="on"' : ""} src="${screen(lang, TOUR_SCREENS[i])}" width="640" height="1391" alt="${escapeHtml(c.alt)}"${i === 0 ? "" : ' loading="lazy"'}>`
    )
    .join("");
  const yours = t.yours
    .map(
      (y, i) => `<div class="reveal${i ? ` d${i + 1}` : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${YOURS_ICONS[i]}</svg><h3>${escapeHtml(y.title)}</h3><p>${escapeHtml(y.line)}</p></div>`
    )
    .join("");
  const plans = (["year", "month", "life"] as const).map((k) => ({ ...t.plans[k], price: PRICES[k] }));
  const tabs = plans
    .map(
      (p, i) => `<button class="tab" type="button" role="tab" aria-selected="${i === 0}" data-price="${p.price}" data-per="${escapeHtml(p.per)}" data-note="${escapeHtml(p.note)}">${escapeHtml(p.label)}</button>`
    )
    .join("");
  const li = (xs: string[]) => xs.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  const pair = (xs: { title: string; line: string }[]) =>
    xs.map((x) => `<li><b>${escapeHtml(x.title)}</b> <span>${escapeHtml(x.line)}</span></li>`).join("");
  const band = t.band
    .map((b, i) => `<li class="reveal${i ? ` d${i + 1}` : ""}"><b>${escapeHtml(b.title)}</b> <span>${escapeHtml(b.line)}</span></li>`)
    .join("");

  return page({
    title: t.title,
    variant: "site",
    wide: true,
    lang,
    dir: t.dir,
    head,
    mastRight: mastRight(t, lang),
    footLabels: { support: t.support, privacy: t.privacy, terms: t.terms },
    extraStyle: GALLERY_CSS + SITE_PARTS_CSS + LAND_CSS,
    bodyScript: GALLERY_SCRIPT + SITE_PARTS_JS + LAND_JS,
    body: `${GALLERY_SPRITE}<main>
<section class="hero">
  <div class="rise d1">
    ${MARK}
    <h1>${escapeHtml(t.heroH1)} <em>${escapeHtml(t.heroEm)}</em></h1>
    <p class="sub">${escapeHtml(t.heroSub)}</p>
    ${badges(lang, appStoreUrl, playStoreUrl)}
  </div>
  <div class="stage rise d2">
    <div class="phone"><div class="screen"><img src="${screen(lang, "collection")}" width="640" height="1391" alt="${escapeHtml(t.heroAlt)}"></div></div>
    <div class="mini" aria-hidden="true">
      <span class="mini-play"><i></i><i></i></span>
      <div class="mini-body">
        <div class="mini-top"><span class="mini-title">Harbor Lights</span><span class="mini-time" id="mini-time">0:42 / 1:41</span></div>
        <div class="mini-wave" id="mini-wave"><div class="bars">${bars}</div><div class="bars played">${bars}</div><span class="head"></span></div>
      </div>
    </div>
  </div>
</section>

<section class="tour" id="tour">
  <div class="sec-head reveal"><p class="eyebrow">${escapeHtml(t.tourEyebrow)}</p><h2>${escapeHtml(t.tourH2)}</h2></div>
  <div class="tour-grid">
    <ol class="chapters reveal" role="tablist" aria-label="${escapeHtml(t.tourH2)}">${chapters}</ol>
    <p class="tour-caption reveal" id="tour-caption"><span class="ch-p">${escapeHtml(t.tour[0].line)}</span></p>
    <div class="tour-stage reveal d2"><div class="phone"><div class="screen" id="tour-screen" role="tabpanel">${shots}</div></div></div>
  </div>
</section>

<section class="band">
  <div class="band-grid">
    <div class="band-stage reveal"><div class="phone"><div class="screen"><img src="${screen(lang, "received-player")}" width="640" height="1391" loading="lazy" alt="${escapeHtml(t.bandAlt)}"></div></div></div>
    <div class="band-copy">
      <div class="sec-head reveal"><p class="eyebrow">${escapeHtml(t.bandEyebrow)}</p><h2>${escapeHtml(t.bandH2)}</h2>
        <p class="lead">${escapeHtml(t.bandLead)}</p></div>
      <ul class="points">${band}</ul>
    </div>
  </div>
</section>

<section class="learn">
  <div class="sec-head center reveal"><p class="eyebrow">${escapeHtml(t.learnEyebrow)}</p><h2>${escapeHtml(t.learnH2)}</h2>
    <p class="lead">${escapeHtml(t.learnLead)}</p></div>
  <div class="reveal d2">${galleryHtml(t.cards)}</div>
</section>

<section>
  <div class="sec-head reveal"><p class="eyebrow">${escapeHtml(t.yoursEyebrow)}</p><h2>${escapeHtml(t.yoursH2)}</h2></div>
  <div class="yours">${yours}</div>
</section>

<section>
  <div class="sec-head center reveal"><p class="eyebrow">${escapeHtml(t.plansEyebrow)}</p><h2>${escapeHtml(t.plansH2)}</h2>
    <p class="lead">${escapeHtml(t.plansLead)}</p></div>
  <div class="plans">
    <div class="plan reveal">
      <h3>${escapeHtml(t.freeH3)}</h3>
      <p class="price"><b><bdi>$0</bdi></b><span>${escapeHtml(t.forever)}</span></p>
      <p class="pnote">${escapeHtml(t.freeNote)}</p>
      <ul>${li(t.free)}</ul>
    </div>
    <div class="plan pro reveal d2">
      <h3>SongNook Pro</h3>
      <div class="tabs" role="tablist" aria-label="SongNook Pro">${tabs}</div>
      <p class="price" aria-live="polite"><b><bdi id="pp">${plans[0].price}</bdi></b><span id="pper">${escapeHtml(plans[0].per)}</span></p>
      <p class="pnote" id="pnote">${escapeHtml(plans[0].note)}</p>
      <ul class="adds">${pair(t.proAdds)}</ul>
    </div>
  </div>
  <p class="plans-fine">${escapeHtml(t.plansFine)}</p>
</section>

<section class="closing reveal" id="get">
  <h2>${escapeHtml(t.closingH2)} <em>${escapeHtml(t.closingEm)}</em></h2>
  <p class="lead">${escapeHtml(t.closingLead)}</p>
  ${badges(lang, appStoreUrl, playStoreUrl)}
</section>
</main>`,
  });
}
