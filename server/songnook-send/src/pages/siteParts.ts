/**
 * The parts songnook.app and SongNook Send share, so every page wears the same ones:
 * the language menu (a globe with the language's code, flags in the list), Apple's and
 * Google's own store badges in the page's language, and the small script that closes
 * the menu on a click away and keeps a sealed link's #k= when the language changes.
 */
import { LANGS, STRINGS, type Lang } from "./landingI18n";
import { escapeHtml } from "./shell";

const GLOBE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>`;

const CHEVRON = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

/** The same flags the app's language picker shows, drawn rather than emoji so
 *  they look alike everywhere (Windows prints emoji flags as letters). */
const FLAGS: Record<Lang, string> = {
  en: `<rect width="20" height="14" fill="#fff"/>${[0, 2.15, 4.3, 6.45, 8.6, 10.75, 12.9].map((y) => `<rect y="${y}" width="20" height="1.1" fill="#B22234"/>`).join("")}<rect width="9" height="7.5" fill="#3C3B6E"/>`,
  es: `<rect width="20" height="14" fill="#AA151B"/><rect y="3.5" width="20" height="7" fill="#F1BF00"/>`,
  de: `<rect width="20" height="4.67" fill="#000"/><rect y="4.67" width="20" height="4.67" fill="#DD0000"/><rect y="9.33" width="20" height="4.67" fill="#FFCE00"/>`,
  pt: `<rect width="20" height="14" fill="#009C3B"/><path d="M2.4 7 10 1.9 17.6 7 10 12.1z" fill="#FFDF00"/><circle cx="10" cy="7" r="3.3" fill="#002776"/>`,
  he: `<rect width="20" height="14" fill="#fff"/><rect y="1.6" width="20" height="1.7" fill="#0038B8"/><rect y="10.7" width="20" height="1.7" fill="#0038B8"/><path d="M10 4.4l2.25 3.9h-4.5zM10 9.6l-2.25-3.9h4.5z" fill="none" stroke="#0038B8" stroke-width=".7"/>`,
};
const flag = (l: Lang) => `<svg class="flag" width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">${FLAGS[l]}</svg>`;

/** The language menu. `hrefFor` gives each language's address: the site's /es,
 *  Send's ?lang=es (the page script carries a sealed link's #k= along). */
export function langMenu(lang: Lang, hrefFor: (l: Lang) => string): string {
  const t = STRINGS[lang];
  const items = LANGS.map(
    (l) => `<li><a href="${escapeHtml(hrefFor(l))}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ""}>${flag(l)}<span>${escapeHtml(STRINGS[l].name)}</span></a></li>`
  ).join("");
  return `<details class="langs"><summary aria-label="${escapeHtml(t.language)}: ${escapeHtml(t.name)}">${GLOBE}<span class="code">${lang.toUpperCase()}</span>${CHEVRON}</summary><ul>${items}</ul></details>`;
}

/** Apple's and Google's own badge artwork, in the page's language. Without a Play
 *  address the second slot is `instead` (a quiet "coming soon"), or nothing. */
export function storeBadges(opts: {
  lang: Lang;
  appStoreUrl: string;
  playHref: string | null;
  instead?: string;
}): string {
  const t = STRINGS[opts.lang];
  const sfx = opts.lang === "en" ? "" : `-${opts.lang}`;
  const apple = `<a class="store" href="${escapeHtml(opts.appStoreUrl)}"><picture><source srcset="/badges/app-store-white${sfx}.svg" media="(prefers-color-scheme: dark)"><img src="/badges/app-store-black${sfx}.svg" width="150" height="50" alt="${escapeHtml(t.appStoreAlt)}"></picture></a>`;
  const play = opts.playHref
    ? `<a class="store" id="play-badge" href="${escapeHtml(opts.playHref)}"><img src="/badges/google-play${sfx}.png" width="168" height="50" alt="${escapeHtml(t.playAlt)}"></a>`
    : opts.instead ?? "";
  return `<div class="stores">${apple}${play}</div>`;
}

/** Android's "coming soon" slot beside the App Store badge. */
export const androidSoon = (lang: Lang) =>
  `<span class="store-soon">${escapeHtml(STRINGS[lang].androidSoon[0])}<br>${escapeHtml(STRINGS[lang].androidSoon[1])}</span>`;

export const SITE_PARTS_CSS = `
/* ── language menu ── */
.mast-right{display:flex;align-items:center;gap:22px}
.langs{position:relative}
.langs summary{list-style:none;display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--ink-soft);
  font-size:12px;font-weight:700;letter-spacing:.08em;padding:5px 9px;border:1px solid var(--rule);border-radius:99px}
.langs summary .code{direction:ltr}
.langs[open] summary svg:last-child{transform:rotate(180deg)}
.langs summary::-webkit-details-marker{display:none}
.langs summary:hover{color:var(--ink);border-color:var(--ink-faint)}
.langs summary:focus-visible{outline:2px solid var(--terra);outline-offset:4px;border-radius:3px}
.langs ul{position:absolute;top:calc(100% + 10px);inset-inline-end:-10px;z-index:20;list-style:none;margin:0;padding:6px 0;
  min-width:150px;background:var(--card);border:1px solid var(--rule);border-radius:10px;box-shadow:0 18px 36px -20px rgba(60,40,30,.45)}
.langs a{display:flex;align-items:center;gap:11px;padding:8px 16px;color:var(--ink);text-decoration:none;font-size:14px;white-space:nowrap}
.flag{flex:none;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.langs a:hover{background:var(--paper-deep)}
.langs a[aria-current]{color:var(--terra);font-weight:700}
@media (max-width:640px){.mast-right{gap:14px}}

/* ── store badges ── */
.stores{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.store{display:block;line-height:0;border-radius:9px;transition:transform .18s ease}
.store:hover{transform:translateY(-2px)}
.store:focus-visible{outline:2px solid var(--terra);outline-offset:3px}
.store img{display:block;height:50px;width:auto}
.store-soon{display:inline-flex;align-items:center;height:50px;padding:0 16px;border:1px dashed var(--rule);
  border-radius:9px;font-size:11px;line-height:1.25;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink-faint);font-weight:700}
:lang(he) .store-soon{letter-spacing:.02em}
`;

export const SITE_PARTS_JS = `
(function(){
  var langs = document.querySelector('.langs');
  if (!langs) return;
  document.addEventListener('click', function(e){ if (langs.open && !langs.contains(e.target)) langs.open = false; });
  /* a sealed parcel's key lives after the #: changing language keeps it */
  if (location.hash) langs.querySelectorAll('a').forEach(function(a){
    var h = a.getAttribute('href'); if (h && h.charAt(0) === '?') a.setAttribute('href', h + location.hash);
  });
})();
`;
