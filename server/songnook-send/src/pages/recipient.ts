/**
 * The parcel page (`/t/:id`): what someone sees when a SongNook Send link opens in a
 * browser instead of the app. In the voice and the look of songnook.app, in the
 * reader's language (sendI18n.ts).
 *
 * Who lands here, and the one door each gets:
 *  - The app is installed: a tap on the link usually opens the app before this page
 *    loads (universal / app links). In-app browsers (WhatsApp, Instagram, Gmail) often
 *    don't, so the page offers "Have SongNook? Open it there": the app's own scheme on
 *    iPhone, an Android intent that falls back to the store.
 *  - The app isn't installed: Apple's / Google's badge for this phone. Google's only
 *    once SongNook is on Play (ANDROID_LIVE); until then Android is told it's coming
 *    and the files open right below.
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
import type { ShareKind } from "../lib/shareKind";
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
.parcel .meta-line{margin-bottom:6px}
.items{list-style:none;margin:6px 0 0;padding:0;border-top:1px solid var(--rule)}
.items li{padding:11px 0;border-bottom:1px solid var(--rule);font-family:Lora,Georgia,serif;font-size:18px;
  color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.items li.more{font-family:inherit;font-size:13.5px;color:var(--ink-faint)}
.items:empty{display:none}
.cta{margin-top:22px}
.open-lead{color:var(--ink-soft);font-size:15.5px;line-height:1.55;margin:0 0 18px;max-width:46ch}
.have{display:inline-flex;align-items:center;gap:6px;margin-top:16px;color:var(--terra);font-weight:600;font-size:14.5px;text-decoration:none}
.have:hover{text-decoration:underline}
[dir="rtl"] .have svg{transform:scaleX(-1)}
.cta-fine{font-size:12.5px;color:var(--ink-faint);margin:12px 0 0}
.soon{color:var(--ink-soft);font-size:15px;line-height:1.55;margin:0}
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
.grab{margin-top:40px;border-top:1px solid var(--rule);padding-top:18px}
.grab summary{font-size:14px;color:var(--ink-soft);cursor:pointer;list-style:none}
.grab summary::-webkit-details-marker{display:none}
.grab summary:hover{color:var(--ink)}
.grab .tracklist{margin-top:12px}
.grab .trk-dl{background:none;border:none;padding:0;font:inherit;font-size:12.5px;font-weight:700;color:var(--terra);cursor:pointer}
.grab .trk-dl[disabled]{color:var(--ink-faint);cursor:default}
`;

const ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

/** "A War In Me.wav" reads as a song, not a file. The download keeps the real name. */
const displayName = (fileName: string) => fileName.replace(/\.[a-z0-9]{1,8}$/i, "") || fileName;
const isPackageFile = (fileName: string) => /\.songnook$/i.test(fileName);

function expiresLabel(S: SendStrings, expiresAtIso: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(expiresAtIso) - Date.now()) / 86400000));
  return days <= 0 ? S.expiresToday : plural(S.daysLeft, days);
}

const kindLabel = (S: SendStrings, kind: ShareKind) => (kind === "clips" ? null : S.kinds[kind]);

/** "3 songs" or "1 SongNook package", then what the sender says it is. Songs beside a
 *  package are its plain copies, so they aren't counted twice. */
function countLine(S: SendStrings, names: string[], kind: ShareKind): string {
  const packages = names.filter(isPackageFile).length;
  const songs = names.length - packages;
  const parts: string[] = [];
  if (songs > 0) parts.push(plural(S.songs, songs));
  if (packages > 0 && songs === 0) parts.push(plural(S.packages, packages));
  const k = kindLabel(S, kind);
  if (k) parts.push(k);
  return parts.join(" · ");
}

/** The songs, by name, as the card's list: five, then "and 3 more". */
function itemsList(S: SendStrings, names: string[]): string {
  const audio = names.filter((n) => !isPackageFile(n));
  const shown = (audio.length ? audio : names).map(displayName);
  // People's names for things keep their own direction inside a Hebrew page (bdi).
  const head = shown.slice(0, 5).map((n) => `<li><bdi>${escapeHtml(n)}</bdi></li>`).join("");
  return head + (shown.length > 5 ? `<li class="more">${escapeHtml(fill(S.moreItems, { n: shown.length - 5 }))}</li>` : "");
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
 * The way in. Phones get the store badge for their platform and the door into an
 * installed app; a computer gets a QR code back to this link. `appPath` is the app's own
 * route (`t/<id>`); a sealed link's key is added by the page script.
 */
function ctaBlock(cfg: Config, S: SendStrings, lang: Lang, t: TransferPayload, plat: Platform, transferUrl: string): string {
  const appPath = `t/${encodeURIComponent(t.transferId)}`;
  const playStore = `https://play.google.com/store/apps/details?id=${encodeURIComponent(cfg.androidPackage)}&referrer=${encodeURIComponent("transferId=" + t.transferId)}`;
  // Android: the intent opens SongNook when it's there, and the store when it isn't.
  const androidIntent = (fallback: string) =>
    `intent://${appPath}#Intent;scheme=songnook;package=${cfg.androidPackage};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
  const have = (href: string) =>
    `<a class="have" id="open-app" data-path="${escapeHtml(appPath)}" href="${escapeHtml(href)}">${escapeHtml(S.haveApp)} ${ARROW}</a>`;

  if (plat.isIOS) {
    return `<p class="open-lead">${escapeHtml(S.openLead)}</p>
  ${storeBadges({ lang, appStoreUrl: cfg.iosAppStoreUrl, playHref: null })}
  <p class="cta-fine">${escapeHtml(S.openAgain)}</p>
  ${have(`songnook://${appPath}`)}`;
  }
  if (plat.isAndroid) {
    if (cfg.playStoreUrl) {
      return `<p class="open-lead">${escapeHtml(S.openLead)}</p>
  <div class="stores"><a class="store" id="play-badge" data-path="${escapeHtml(appPath)}" href="${escapeHtml(androidIntent(playStore))}"><img src="/badges/google-play${lang === "en" ? "" : "-" + lang}.png" width="168" height="50" alt="${escapeHtml(STRINGS[lang].playAlt)}"></a></div>
  <p class="cta-fine">${escapeHtml(S.openAgain)}</p>
  ${have(androidIntent(playStore))}`;
    }
    // Not on Play yet: say so, and keep the door for the testers who have the app.
    return `<p class="soon">${escapeHtml(S.androidSoon)}</p>
  ${have(androidIntent(transferUrl + "#files"))}`;
  }
  const { d, modules } = qrSvgPath(transferUrl);
  return `<p class="open-lead">${escapeHtml(S.openLead)}</p>
  <div class="qr-cta">
    <div class="qr-card" id="qr-slot"><svg class="qr" width="120" height="120" viewBox="0 0 ${modules} ${modules}" role="img" aria-label="${escapeHtml(S.qrLabel)}"><path d="${d}" fill="#1b1208"/></svg></div>
    <p class="cta-fine">${escapeHtml(S.scan)}</p>
  </div>
  ${storeBadges({ lang, appStoreUrl: cfg.iosAppStoreUrl, playHref: cfg.playStoreUrl })}`;
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
  const android = plat.isAndroid && !cfg.playStoreUrl;

  const body = `
${GALLERY_SPRITE}
<p class="eyebrow rise d1">${escapeHtml(S.sendTitle)}</p>
<h1 class="rise d1">${heroHtml(S, sender, title)}</h1>
${noteHtml}

<section class="panel parcel rise d2">
  <p class="meta-line"><b dir="auto">${escapeHtml(title)}</b> <span>·</span> <span>${escapeHtml(countLine(S, names, t.kind))}</span> <span>·</span> <span>${escapeHtml(expiresLabel(S, t.expiresAt))}</span></p>
  <ul class="items">${itemsList(S, names)}</ul>
  <div class="cta">${ctaBlock(cfg, S, lang, t, plat, transferUrl)}</div>
</section>

${aboutBlock(S, lang)}

<details class="grab" id="files"${android ? " open" : ""}>
  <summary>${escapeHtml(S.rawFiles)}</summary>
  <ul class="tracklist">${(names.some((n) => !isPackageFile(n)) ? t.items.filter((it) => !isPackageFile(it.fileName)) : t.items)
    .map(
      (it) => `<li><span class="trk-name" dir="auto">${escapeHtml(displayName(it.fileName))}</span><span class="trk-size">${formatBytes(it.size)}</span><a class="trk-dl" href="${escapeHtml(it.downloadUrl)}">${escapeHtml(S.download)}</a></li>`
    )
    .join("")}</ul>
</details>`;

  return pageFor(lang, {
    title: `${fill(S.sentYou, { sender, title }).replace(/\.$/, "")} · ${S.sendTitle}`,
    body,
    script: GALLERY_SCRIPT + KEY_DOOR_JS,
    style: GALLERY_CSS + RECIPIENT_CSS,
    reportHref: `/report/${encodeURIComponent(t.transferId)}`,
  });
}

/** The page for a link that has run out or been taken back. */
export function renderGonePage(lang: Lang = "en"): string {
  const S = SEND_STRINGS[lang];
  return page({
    title: `${S.goneHead} · ${S.sendTitle}`,
    body: `<p class="eyebrow">${escapeHtml(S.sendTitle)}</p><h1>${escapeHtml(S.goneHead)}</h1><p class="sub">${escapeHtml(S.goneSub)}</p>`,
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
    $('meta-title').textContent = title;
    var names = items.map(function(it){ return it.meta.name; });
    var packages = names.filter(isPackage).length, songs = names.length - packages, count = [];
    if (songs > 0) count.push(plural(T.songs, songs));
    if (packages > 0 && songs === 0) count.push(plural(T.packages, packages));
    if (data.kindLabel) count.push(data.kindLabel);
    $('meta-count').textContent = count.join(' · ');

    var audio = items.filter(function(it){ return !isPackage(it.meta.name); }), shown = audio.length ? audio : items;
    var list = $('items');
    shown.slice(0, 5).forEach(function(it){ var li = document.createElement('li'), b = document.createElement('bdi'); b.textContent = stem(it.meta.name); li.appendChild(b); list.appendChild(li); });
    if (shown.length > 5){ var more = document.createElement('li'); more.className = 'more'; more.textContent = T.moreItems.replace('{n}', shown.length - 5); list.appendChild(more); }

    var tl = $('tracklist');
    shown.forEach(function(it){
      var li = document.createElement('li');
      var name = document.createElement('span'); name.className = 'trk-name'; name.dir = 'auto'; name.textContent = stem(it.meta.name);
      var size = document.createElement('span'); size.className = 'trk-size'; size.textContent = bytes(it.meta.size);
      var dl = document.createElement('button'); dl.type = 'button'; dl.className = 'trk-dl'; dl.textContent = T.download;
      dl.addEventListener('click', function(){
        dl.disabled = true; dl.textContent = T.opening;
        fetch(it.file.downloadUrl).then(function(res){ if (!res.ok) throw new Error(res.status); return res.blob(); })
          .then(function(blob){ return Seal.openBlob(key, blob, it.meta.mime); })
          .then(function(plain){
            var url = URL.createObjectURL(plain), a = document.createElement('a');
            a.href = url; a.download = it.meta.name || 'song'; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
            dl.disabled = false; dl.textContent = T.download;
          })
          .catch(function(){ dl.disabled = false; dl.textContent = T.tryAgain; });
      });
      li.appendChild(name); li.appendChild(size); li.appendChild(dl); tl.appendChild(li);
    });
  }).catch(function(){ fail(T.badKeyHead, T.badKeySub); });
})();
`;

function renderSealedRecipientPage(cfg: Config, t: TransferPayload, plat: Platform, lang: Lang): string {
  const S = SEND_STRINGS[lang];
  const transferUrl = `${cfg.publicOrigin}/t/${t.transferId}`;
  const android = plat.isAndroid && !cfg.playStoreUrl;
  const mobile = plat.isIOS || plat.isAndroid;
  // What the browser needs to open the parcel; `<` escaped so no name can end the script.
  const parcelData = JSON.stringify({
    sealedMeta: t.sealedMeta,
    kindLabel: kindLabel(S, t.kind),
    items: t.items.map((it) => ({ downloadUrl: it.downloadUrl })),
    t: {
      sentYou: S.sentYou, someone: S.someone, someMusic: S.someMusic, sendTitle: S.sendTitle, songs: S.songs,
      packages: S.packages, moreItems: S.moreItems, download: S.download, opening: S.opening, tryAgain: S.tryAgain,
      noKeyHead: S.noKeyHead, noKeySub: S.noKeySub, badKeyHead: S.badKeyHead, badKeySub: S.badKeySub, qrLabel: S.qrLabel,
    },
  }).replace(/</g, "\\u003c");

  const body = `
${GALLERY_SPRITE}
<p class="eyebrow rise d1">${escapeHtml(S.sendTitle)}</p>
<h1 class="rise d1" id="hero">${heroHtml(S, S.someone, S.someMusic)}</h1>
<p class="sub" id="hero-sub" hidden></p>
<p class="note rise d2" id="note" dir="auto" hidden></p>

<section class="panel parcel rise d2" id="parcel-panel">
  <p class="meta-line"><b id="meta-title" dir="auto">${escapeHtml(S.opening)}</b> <span>·</span> <span id="meta-count"></span> <span>·</span> <span>${escapeHtml(expiresLabel(S, t.expiresAt))}</span></p>
  <ul class="items" id="items"></ul>
  <div class="cta">${ctaBlock(cfg, S, lang, t, plat, transferUrl)}</div>
</section>

${aboutBlock(S, lang)}

<details class="grab" id="files"${android ? " open" : ""}>
  <summary>${escapeHtml(S.rawFiles)}</summary>
  <ul class="tracklist" id="tracklist"></ul>
</details>
<script type="application/json" id="parcel-data">${parcelData}</script>
${mobile ? "" : `<script src="/vendor/qrcode-generator.js"></script>`}`;

  return pageFor(lang, {
    title: S.sendTitle,
    body,
    script: SEAL_JS + GALLERY_SCRIPT + KEY_DOOR_JS + SEALED_JS,
    style: GALLERY_CSS + RECIPIENT_CSS,
    reportHref: `/report/${encodeURIComponent(t.transferId)}`,
  });
}
