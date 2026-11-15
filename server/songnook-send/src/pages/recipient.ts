/**
 * The parcel page (`/t/:id`): what someone sees when a SongNook Send link opens in a
 * browser instead of the app. In the voice and the look of songnook.app, in the
 * reader's language (sendI18n.ts).
 *
 * Who lands here, and the one door each gets:
 *  - The app is installed: a tap on the link usually opens the app before this page
 *    loads (universal / app links). In-app browsers (WhatsApp, Instagram, Gmail) often
 *    don't, so the page's one big key is "Open in SongNook": the app's own scheme on
 *    iPhone (the App Store if nothing answers), an Android intent that falls back to
 *    the store.
 *  - The app isn't installed: that same key, and Apple's / Google's badge under "New to
 *    SongNook?". Google's only once SongNook is on Play (ANDROID_LIVE); until then
 *    Android is told it's coming.
 * The raw files are one quiet line at the foot with a small download glyph (founder,
 * 2026-11-15): there for whoever needs them, never louder than SongNook.
 *  - A computer: a QR code back to this same link, for the phone.
 * After installing, the person opens the link again and the app takes it: no deferred
 * deep link in v1 (the iOS clipboard handoff was removed, founder 2026-10-23). The Play
 * address still carries `referrer=transferId=…` for a future Install Referrer reader.
 * In the app, the first-run welcome plays over the parcel screen, and nothing is saved
 * until the person taps Save on it.
 */
import type { Config } from "../env";
import type { TransferPayload } from "../lib/serialize";
import { qrSvgPath } from "../lib/qr";
import { escapeHtml, formatBytes, page } from "./shell";
import { GALLERY_CSS, GALLERY_SCRIPT, GALLERY_SPRITE, galleryHtml } from "./appPreviewGallery";
import { SEAL_JS } from "./sealJs";
import { STRINGS, type Lang } from "./landingI18n";
import { SEND_STRINGS, fill, plural, type SendStrings } from "./sendI18n";
import { SITE_PARTS_CSS, SITE_PARTS_JS, langMenu, storeBadges } from "./siteParts";

export interface Platform {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
  return { isMobile, isIOS, isAndroid };
}

const RECIPIENT_CSS = `
/* a title keeps itself together when the headline wraps around it */
#hero-title{display:inline-block}
.parcel .meta-line{margin-bottom:6px}
.parcel .meta-line:empty{display:none}
.items{list-style:none;margin:6px 0 0;padding:0;border-top:1px solid var(--rule)}
.items li{padding:11px 0;border-bottom:1px solid var(--rule);font-family:Lora,Georgia,serif;font-size:18px;
  color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.items li.more{font-family:inherit;font-size:13.5px;color:var(--ink-faint)}
.items:empty{display:none}
.cta{margin-top:18px}
.items:empty + .cta{margin-top:4px}
.open{font-size:16px;padding:15px 26px}
[dir="rtl"] .open svg{transform:scaleX(-1)}
.new-here{font-size:14px;color:var(--ink-soft);line-height:1.5;margin:22px 0 12px;max-width:40ch}
.cta-fine{font-size:12.5px;color:var(--ink-faint);margin:12px 0 0}
.soon{color:var(--ink-soft);font-size:14px;line-height:1.55;margin:16px 0 0}
.qr-cta{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.qr-card{background:#fff;padding:12px;border-radius:10px;line-height:0;border:1px solid var(--rule)}
.qr-cta .cta-fine{margin:0;max-width:24ch;font-size:14px;color:var(--ink-soft)}
.qr-cta + .stores{margin-top:20px}
.about{margin-top:clamp(52px,9vw,80px)}
.about h2{font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(27px,4.4vw,36px);line-height:1.12;margin:0 0 10px;text-wrap:balance}
.about .sub{margin:0 0 30px}
.see{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-faint);font-weight:700;margin:0 0 14px}
:lang(he) .see{letter-spacing:.02em}
.more-at{display:inline-block;margin-top:18px;font-size:14px;color:var(--terra);font-weight:600;text-decoration:none}
.more-at:hover{text-decoration:underline}
.grab{margin-top:40px;border-top:1px solid var(--rule);padding-top:14px}
.grab-line{display:flex;align-items:center;gap:6px;margin:0;font-size:14px;color:var(--ink-soft)}
.dl{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;
  background:none;border:0;border-radius:8px;padding:0;color:var(--ink-soft);cursor:pointer;text-decoration:none}
.dl:hover{color:var(--ink);background:var(--paper-deep)}
.dl:focus-visible{outline:2px solid var(--terra);outline-offset:2px}
.dl[disabled]{opacity:.4;cursor:default;background:none}
.dl.retry{color:var(--terra)}
.grab .tracklist{margin-top:8px}
`;

const DL_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>`;

const ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

/** "A War In Me.wav" reads as a song, not a file. The download keeps the real name. */
const displayName = (fileName: string) => fileName.replace(/\.[a-z0-9]{1,8}$/i, "") || fileName;
const isPackageFile = (fileName: string) => /\.songnook$/i.test(fileName);

function expiresLabel(S: SendStrings, expiresAtIso: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(expiresAtIso) - Date.now()) / 86400000));
  return days <= 0 ? S.expiresToday : plural(S.daysLeft, days);
}

/** The card's one line: "3 songs · 7 days left". The title is the headline already,
 *  and what kind of parcel it is shows once it opens in SongNook (founder 2026-11-15:
 *  fewer details). One song, or a package alone, says only how long it stays. */
function metaLine(S: SendStrings, names: string[], expiresAtIso: string): string {
  const songs = names.filter((n) => !isPackageFile(n)).length;
  const left = expiresLabel(S, expiresAtIso);
  return songs > 1 ? `${plural(S.songs, songs)} · ${left}` : left;
}

/** The songs, by name, as the card's list: three, then "and 4 more", so the Open key
 *  stays near the top. A package alone
 *  isn't listed: its file name is a stamp, and the title already says what it is. */
function itemsList(S: SendStrings, names: string[]): string {
  const shown = names.filter((n) => !isPackageFile(n)).map(displayName);
  if (shown.length < 2) return "";
  // People's names for things keep their own direction inside a Hebrew page (bdi).
  const head = shown.slice(0, 3).map((n) => `<li><bdi>${escapeHtml(n)}</bdi></li>`).join("");
  return head + (shown.length > 3 ? `<li class="more">${escapeHtml(fill(S.moreItems, { n: shown.length - 3 }))}</li>` : "");
}

/** "{sender} sent you {title}." with the names as spans the sealed script can fill. */
function heroHtml(S: SendStrings, sender: string, title: string): string {
  return S.sentYou
    .split(/(\{sender\}|\{title\})/)
    .map((part) =>
      part === "{sender}"
        ? `<span id="hero-sender" dir="auto">${escapeHtml(sender)}</span>`
        : part === "{title}"
          ? `<em id="hero-title" dir="auto">${escapeHtml(title)}</em>`
          : escapeHtml(part)
    )
    .join("");
}

/**
 * The way in: one key, "Open in SongNook", for every phone. Under it, for whoever
 * doesn't have the app yet, the store badge. A computer gets a QR code back to this
 * link. `appPath` is the app's own route (`t/<id>`); a sealed link's key is added by
 * the page script.
 */
function ctaBlock(cfg: Config, S: SendStrings, lang: Lang, t: TransferPayload, plat: Platform, transferUrl: string): string {
  const appPath = `t/${encodeURIComponent(t.transferId)}`;
  const playStore = `https://play.google.com/store/apps/details?id=${encodeURIComponent(cfg.androidPackage)}&referrer=${encodeURIComponent("transferId=" + t.transferId)}`;
  // Android: the intent opens SongNook when it's there, and the fallback when it isn't.
  const androidIntent = (fallback: string) =>
    `intent://${appPath}#Intent;scheme=songnook;package=${cfg.androidPackage};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
  const open = (href: string, store?: string) =>
    `<a class="btn open" id="open-app" data-path="${escapeHtml(appPath)}"${store ? ` data-store="${escapeHtml(store)}"` : ""} href="${escapeHtml(href)}">${escapeHtml(S.openInApp)} ${ARROW}</a>`;
  const newHere = `<p class="new-here">${escapeHtml(S.newHere)}</p>`;

  if (plat.isIOS) {
    return `${open(`songnook://${appPath}`, cfg.iosAppStoreUrl)}
  ${newHere}
  ${storeBadges({ lang, appStoreUrl: cfg.iosAppStoreUrl, playHref: null })}`;
  }
  if (plat.isAndroid) {
    if (cfg.playStoreUrl) {
      return `${open(androidIntent(playStore))}
  ${newHere}
  <div class="stores"><a class="store" id="play-badge" data-path="${escapeHtml(appPath)}" href="${escapeHtml(androidIntent(playStore))}"><img src="/badges/google-play${lang === "en" ? "" : "-" + lang}.png" width="168" height="50" alt="${escapeHtml(STRINGS[lang].playAlt)}"></a></div>`;
    }
    // Not on Play yet: the key still opens the app for the testers who have it.
    return `${open(androidIntent(transferUrl + "#files"))}
  <p class="soon">${escapeHtml(S.androidSoon)}</p>`;
  }
  const { d, modules } = qrSvgPath(transferUrl);
  return `<div class="qr-cta">
    <div class="qr-card" id="qr-slot"><svg class="qr" width="120" height="120" viewBox="0 0 ${modules} ${modules}" role="img" aria-label="${escapeHtml(S.qrLabel)}"><path d="${d}" fill="#1b1208"/></svg></div>
    <p class="cta-fine">${escapeHtml(S.scan)}</p>
  </div>
  ${storeBadges({ lang, appStoreUrl: cfg.iosAppStoreUrl, playHref: cfg.playStoreUrl })}`;
}

/** iPhone: the app's scheme, and the App Store when nothing answers. Safari holds the
 *  timer while its own dialog is up ("Open in SongNook?", or "cannot open" when the
 *  app isn't there), so the store follows that dialog; if the app opened, the page
 *  went to the background and the store is skipped. */
const OPEN_JS = `
(function(){
  var a = document.getElementById('open-app');
  if (!a || !a.getAttribute('data-store')) return;
  var left = false;
  document.addEventListener('visibilitychange', function(){ if (document.hidden) left = true; });
  window.addEventListener('pagehide', function(){ left = true; });
  a.addEventListener('click', function(e){
    e.preventDefault();
    var store = a.getAttribute('data-store');
    left = false;
    location.href = a.getAttribute('href');
    setTimeout(function(){ if (!left && !document.hidden) location.href = store; }, 1200);
  });
})();
`;

/** The raw files: one quiet line and a small download glyph. One file downloads
 *  straight away; several open a quiet list, each with its own glyph. Landing on
 *  #files (Android's way back when the app isn't there) opens the list. */
const GRAB_JS = `
(function(){
  var b = document.getElementById('grab-btn'), list = document.getElementById('tracklist');
  if (!b || !list) return;
  function rows(){ return list.querySelectorAll('.trk-dl'); }
  b.addEventListener('click', function(){
    var r = rows();
    if (r.length === 1){ list.hidden = false; r[0].click(); return; }
    list.hidden = !list.hidden; b.setAttribute('aria-expanded', String(!list.hidden));
  });
  if (location.hash === '#files') list.hidden = false;
})();
`;

function grabBlock(S: SendStrings, rowsHtml: string): string {
  return `<div class="grab" id="files">
  <p class="grab-line"><span>${escapeHtml(S.rawFiles)}</span><button type="button" class="dl" id="grab-btn" aria-controls="tracklist" aria-expanded="false" aria-label="${escapeHtml(S.download)}">${DL_ICON}</button></p>
  <ul class="tracklist" id="tracklist" hidden>${rowsHtml}</ul>
</div>`;
}

/** The app's door carries a sealed link's key: songnook://t/<id>?key=…, and the same
 *  inside an Android intent. */
const KEY_DOOR_JS = `
(function(){
  var m = /(?:^|[#&])k=([A-Za-z0-9_-]{43})/.exec(location.hash || '');
  if (!m) return;
  ['open-app','play-badge'].forEach(function(id){
    var a = document.getElementById(id); if (!a) return;
    var path = a.getAttribute('data-path');
    a.setAttribute('href', a.getAttribute('href').replace(path, path + '?key=' + m[1]));
  });
})();
`;

function aboutBlock(S: SendStrings, lang: Lang): string {
  return `<section class="about">
  <p class="eyebrow">${escapeHtml(S.aboutEyebrow)}</p>
  <h2>${escapeHtml(S.aboutH2)}</h2>
  <p class="sub">${escapeHtml(S.aboutSub)}</p>
  <p class="see">${escapeHtml(S.seeIt)}</p>
  ${galleryHtml(STRINGS[lang].cards)}
  <a class="more-at" href="https://songnook.app/${lang}">${escapeHtml(S.moreAt)}</a>
</section>`;
}

/** Everything every parcel page shares: language, direction, menu, footer. */
function pageFor(lang: Lang, opts: { title: string; body: string; script: string; style: string; reportHref: string }) {
  const S = SEND_STRINGS[lang];
  return page({
    title: opts.title,
    body: opts.body,
    bodyScript: SITE_PARTS_JS + opts.script,
    extraStyle: SITE_PARTS_CSS + opts.style,
    noindex: true,
    lang,
    dir: STRINGS[lang].dir,
    mastRight: `<div class="mast-right">${langMenu(lang, (l) => `?lang=${l}`)}</div>`,
    sendFoot: { hold: S.holdNote, tagline: S.tagline, report: S.report },
    reportHref: opts.reportHref,
  });
}

export function renderRecipientPage(cfg: Config, t: TransferPayload, plat: Platform, lang: Lang = "en"): string {
  if (t.sealed) return renderSealedRecipientPage(cfg, t, plat, lang);
  const S = SEND_STRINGS[lang];
  const sender = t.sender.name || S.someone;
  const title = t.title || S.someMusic;
  const transferUrl = `${cfg.publicOrigin}/t/${t.transferId}`;
  const names = t.items.map((it) => it.fileName);
  const noteHtml = t.message ? `<p class="note rise d2" dir="auto">“${escapeHtml(t.message)}”</p>` : "";
  const files = names.some((n) => !isPackageFile(n)) ? t.items.filter((it) => !isPackageFile(it.fileName)) : t.items;
  const rows = files
    .map(
      (it) => `<li><span class="trk-name" dir="auto">${escapeHtml(displayName(it.fileName))}</span><span class="trk-size">${formatBytes(it.size)}</span><a class="dl trk-dl" href="${escapeHtml(it.downloadUrl)}" aria-label="${escapeHtml(S.download)}">${DL_ICON}</a></li>`
    )
    .join("");

  const body = `
${GALLERY_SPRITE}
<h1 class="rise d1">${heroHtml(S, sender, title)}</h1>
${noteHtml}

<section class="panel parcel rise d2">
  <p class="meta-line">${escapeHtml(metaLine(S, names, t.expiresAt))}</p>
  <ul class="items">${itemsList(S, names)}</ul>
  <div class="cta">${ctaBlock(cfg, S, lang, t, plat, transferUrl)}</div>
</section>

${aboutBlock(S, lang)}

${grabBlock(S, rows)}`;

  return pageFor(lang, {
    title: `${fill(S.sentYou, { sender, title }).replace(/\.$/, "")} · ${S.sendTitle}`,
    body,
    script: GALLERY_SCRIPT + KEY_DOOR_JS + OPEN_JS + GRAB_JS,
    style: GALLERY_CSS + RECIPIENT_CSS,
    reportHref: `/report/${encodeURIComponent(t.transferId)}`,
  });
}

/** The page for a link that has run out or been taken back. */
export function renderGonePage(lang: Lang = "en"): string {
  const S = SEND_STRINGS[lang];
  return page({
    title: `${S.goneHead} · ${S.sendTitle}`,
    body: `<h1>${escapeHtml(S.goneHead)}</h1><p class="sub">${escapeHtml(S.goneSub)}</p>`,
    noindex: true,
    lang,
    dir: STRINGS[lang].dir,
    extraStyle: SITE_PARTS_CSS,
    bodyScript: SITE_PARTS_JS,
    mastRight: `<div class="mast-right">${langMenu(lang, (l) => `?lang=${l}`)}</div>`,
    sendFoot: { hold: S.holdNote, tagline: S.tagline, report: S.report },
  });
}

// ── Sealed parcels (docs/product-plan/send-e2e-encryption.md) ────────────────
// The server can't read a sealed parcel, so it sends the same page with its words
// left blank; the visitor's browser takes the key from the link's #k=, opens the
// envelope and fills them in. Every name goes in as text, never as markup.

/** Runs after SEAL_JS. Reads #parcel-data, opens the envelope, fills the page. */
const SEALED_JS = `
(function(){
  var Seal = window.SongNookSeal;
  var $ = function(id){ return document.getElementById(id); };
  var data = JSON.parse($('parcel-data').textContent), T = data.t;
  function bytes(n){ if(!(n>0)) return '0 B'; var u=['B','KB','MB','GB'], i=Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));
    return (n/Math.pow(1024,i)).toFixed(i===0?0:1)+' '+u[i]; }
  function stem(name){ return String(name).replace(/\\.[a-z0-9]{1,8}$/i,'') || name; }
  function isPackage(name){ return /\\.songnook$/i.test(name); }
  function plural(p, n){ return (n === 1 ? p.one : p.other).replace('{n}', n); }
  function fail(head, sub){
    $('hero').textContent = head; $('hero-sub').textContent = sub; $('hero-sub').hidden = false;
    $('parcel-panel').hidden = true; $('files').hidden = true; $('note').hidden = true;
  }
  var key = Seal.keyFromHash(location.hash);
  if (!key) return fail(T.noKeyHead, T.noKeySub);

  var slot = $('qr-slot');
  if (slot && window.qrcode){
    var q = window.qrcode(0, 'M'); q.addData(location.href); q.make();
    var n = q.getModuleCount(), quiet = 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M'+(c+quiet)+' '+(r+quiet)+'h1v1h-1z';
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('width','120'); svg.setAttribute('height','120'); svg.setAttribute('viewBox','0 0 '+(n+quiet*2)+' '+(n+quiet*2));
    svg.setAttribute('role','img'); svg.setAttribute('aria-label', T.qrLabel);
    path.setAttribute('d', d); path.setAttribute('fill', '#1b1208'); svg.appendChild(path); slot.innerHTML = ''; slot.appendChild(svg);
  }

  Seal.openJson(key, data.sealedMeta).then(function(env){
    var items = (env.items || []).map(function(meta, i){ return { meta: meta, file: data.items[i] }; })
      .filter(function(it){ return it.file; });
    var sender = env.senderName || T.someone, title = env.title || T.someMusic;
    $('hero-sender').textContent = sender; $('hero-title').textContent = title;
    document.title = T.sentYou.replace('{sender}', sender).replace('{title}', title).replace(/\\.$/, '') + ' · ' + T.sendTitle;
    if (env.message){ $('note').textContent = '“' + env.message + '”'; $('note').hidden = false; }
    var audio = items.filter(function(it){ return !isPackage(it.meta.name); }), shown = audio.length ? audio : items;
    if (audio.length > 1) $('meta-count').textContent = plural(T.songs, audio.length) + ' · ';
    var list = $('items');
    if (audio.length > 1) audio.slice(0, 3).forEach(function(it){ var li = document.createElement('li'), b = document.createElement('bdi'); b.textContent = stem(it.meta.name); li.appendChild(b); list.appendChild(li); });
    if (audio.length > 3){ var more = document.createElement('li'); more.className = 'more'; more.textContent = T.moreItems.replace('{n}', audio.length - 3); list.appendChild(more); }

    var tl = $('tracklist');
    shown.forEach(function(it){
      var li = document.createElement('li');
      var name = document.createElement('span'); name.className = 'trk-name'; name.dir = 'auto'; name.textContent = stem(it.meta.name);
      var size = document.createElement('span'); size.className = 'trk-size'; size.textContent = bytes(it.meta.size);
      var dl = document.createElement('button'); dl.type = 'button'; dl.className = 'dl trk-dl'; dl.innerHTML = data.icon;
      dl.setAttribute('aria-label', T.download);
      dl.addEventListener('click', function(){
        dl.disabled = true; dl.classList.remove('retry'); dl.setAttribute('aria-label', T.opening);
        fetch(it.file.downloadUrl).then(function(res){ if (!res.ok) throw new Error(res.status); return res.blob(); })
          .then(function(blob){ return Seal.openBlob(key, blob, it.meta.mime); })
          .then(function(plain){
            var url = URL.createObjectURL(plain), a = document.createElement('a');
            a.href = url; a.download = it.meta.name || 'song'; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
            dl.disabled = false; dl.setAttribute('aria-label', T.download);
          })
          .catch(function(){ dl.disabled = false; dl.classList.add('retry'); dl.setAttribute('aria-label', T.tryAgain); });
      });
      li.appendChild(name); li.appendChild(size); li.appendChild(dl); tl.appendChild(li);
    });
  }).catch(function(){ fail(T.badKeyHead, T.badKeySub); });
})();
`;

function renderSealedRecipientPage(cfg: Config, t: TransferPayload, plat: Platform, lang: Lang): string {
  const S = SEND_STRINGS[lang];
  const transferUrl = `${cfg.publicOrigin}/t/${t.transferId}`;
  const mobile = plat.isIOS || plat.isAndroid;
  // What the browser needs to open the parcel; `<` escaped so no name can end the script.
  const parcelData = JSON.stringify({
    sealedMeta: t.sealedMeta,
    icon: DL_ICON,
    items: t.items.map((it) => ({ downloadUrl: it.downloadUrl })),
    t: {
      sentYou: S.sentYou, someone: S.someone, someMusic: S.someMusic, sendTitle: S.sendTitle, songs: S.songs,
      moreItems: S.moreItems, download: S.download, opening: S.opening, tryAgain: S.tryAgain,
      noKeyHead: S.noKeyHead, noKeySub: S.noKeySub, badKeyHead: S.badKeyHead, badKeySub: S.badKeySub, qrLabel: S.qrLabel,
    },
  }).replace(/</g, "\\u003c");

  const body = `
${GALLERY_SPRITE}
<h1 class="rise d1" id="hero">${heroHtml(S, S.someone, S.someMusic)}</h1>
<p class="sub" id="hero-sub" hidden></p>
<p class="note rise d2" id="note" dir="auto" hidden></p>

<section class="panel parcel rise d2" id="parcel-panel">
  <p class="meta-line"><span id="meta-count"></span>${escapeHtml(expiresLabel(S, t.expiresAt))}</p>
  <ul class="items" id="items"></ul>
  <div class="cta">${ctaBlock(cfg, S, lang, t, plat, transferUrl)}</div>
</section>

${aboutBlock(S, lang)}

${grabBlock(S, "")}
<script type="application/json" id="parcel-data">${parcelData}</script>
${mobile ? "" : `<script src="/vendor/qrcode-generator.js"></script>`}`;

  return pageFor(lang, {
    title: S.sendTitle,
    body,
    script: SEAL_JS + GALLERY_SCRIPT + KEY_DOOR_JS + OPEN_JS + SEALED_JS + GRAB_JS,
    style: GALLERY_CSS + RECIPIENT_CSS,
    reportHref: `/report/${encodeURIComponent(t.transferId)}`,
  });
}
