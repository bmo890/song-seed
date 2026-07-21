/**
 * Recipient page (`/t/:id`). SSR, content-negotiated:
 *  - Desktop → download view (title, sender, tracklist) + a short "what SongNook is" note.
 *  - Mobile WITHOUT the app → the marketing funnel (this is an onboarding surface):
 *      hero → "Open in SongNook" CTA → what-is-SongNook + a living app-preview
 *      gallery → a quiet "take the raw files" disclosure at the very bottom.
 *  - Mobile WITH the app never reaches here — the universal link opens the app at the OS.
 *
 * Deferred deep link:
 *  - Android: the store link carries `referrer=<transferId>` (Play Install Referrer).
 *  - iOS: on "Open in SongNook" tap we copy the transfer URL to the clipboard with a
 *    visible notice; the app reads the pasteboard on first launch. (No SDK in v1.)
 */
import type { Config } from "../env";
import type { TransferPayload } from "../lib/serialize";
import { escapeHtml, formatBytes, page, waveformStrip } from "./shell";
import { GALLERY_CSS, GALLERY_HTML, GALLERY_SCRIPT, GALLERY_SPRITE } from "./appPreviewGallery";

export interface Platform {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

/** The locked one-line description — the same voice everywhere. */
const SONGNOOK_DESC =
  "SongNook is a quiet corner for songwriters and musicians — a place to catch an idea, " +
  "shape it into a song, and practice it till it's yours, wherever you are.";

/** Page-specific chrome for the mobile funnel (the gallery's own CSS ships in
 *  appPreviewGallery). Reuses the shared design tokens so dark mode holds. */
const FUNNEL_CSS = `
.about{margin-top:34px}
.about .eyebrow + .lede{margin-bottom:22px}
.lede{font-family:Newsreader,Georgia,serif;font-weight:400;font-size:20px;line-height:1.5;
  color:var(--ink);margin:0 0 22px;max-width:31ch}
.cta-fine{text-align:center;font-size:12.5px;color:var(--ink-faint);margin:12px 0 0}
.grab{margin-top:30px;text-align:center}
.grab summary{font-size:12.5px;color:var(--ink-faint);cursor:pointer;list-style:none;display:inline-block}
.grab summary::-webkit-details-marker{display:none}
.grab summary:hover{color:var(--ink-soft)}
.grab .tracklist{text-align:left;margin-top:16px}
`;

function expiresLabel(expiresAtIso: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(expiresAtIso) - Date.now()) / 86400000));
  if (days <= 0) return "expiring today";
  return days === 1 ? "1 day left" : `${days} days left`;
}

function songCount(t: TransferPayload): string {
  return `${t.items.length} ${t.items.length === 1 ? "song" : "songs"}`;
}

function tracklist(t: TransferPayload): string {
  return t.items
    .map(
      (it) => `<li>
        <span class="trk-name">${escapeHtml(it.fileName)}</span>
        <span class="trk-size">${formatBytes(it.size)}</span>
        <a class="trk-dl" href="${escapeHtml(it.downloadUrl)}">Download</a>
      </li>`
    )
    .join("");
}

export function renderRecipientPage(
  cfg: Config,
  t: TransferPayload,
  plat: Platform
): string {
  const senderName = t.sender.name || "Someone";
  const title = t.title || "some music";

  if (plat.isMobile && (plat.isIOS || plat.isAndroid)) {
    return renderMobileFunnel(cfg, t, plat, senderName, title);
  }
  return renderDesktop(t, senderName, title);
}

function renderDesktop(t: TransferPayload, senderName: string, title: string): string {
  const note = t.message
    ? `<p class="note rise d2">"${escapeHtml(t.message)}"</p>`
    : "";
  const body = `
<p class="eyebrow rise d1">A parcel from ${escapeHtml(senderName)}</p>
<h1 class="rise d1">${escapeHtml(senderName)} sent you <em>${escapeHtml(title)}</em>.</h1>
${note}
<div class="rise d2">${waveformStrip()}</div>

<section class="panel rise d3">
  <p class="meta-line"><b>${songCount(t)}</b>
    <span>·</span> <span>${expiresLabel(t.expiresAt)}</span></p>
  <ul class="tracklist">${tracklist(t)}</ul>
</section>

<section class="panel rise d4">
  <p class="eyebrow" style="margin-bottom:12px">What's SongNook?</p>
  <p style="margin:0 0 14px;font-family:Newsreader,Georgia,serif;font-size:19px;line-height:1.5;color:var(--ink)">${SONGNOOK_DESC}</p>
  <p style="margin:0;color:var(--ink-soft);font-size:14px">Open this link on your phone and it lands straight in your library — with looping, speed, and chords built in.</p>
</section>`;
  return page({ title: `${senderName} · ${title} — SongNook Send`, body, noindex: true });
}

function renderMobileFunnel(
  cfg: Config,
  t: TransferPayload,
  plat: Platform,
  senderName: string,
  title: string
): string {
  const transferUrl = `${cfg.publicOrigin}/t/${t.transferId}`;

  // Android: pass the transferId via Play Install Referrer so first launch finds it.
  const androidStore = `https://play.google.com/store/apps/details?id=${encodeURIComponent(
    cfg.androidPackage
  )}&referrer=${encodeURIComponent("transferId=" + t.transferId)}`;
  const storeUrl = plat.isAndroid ? androidStore : cfg.iosAppStoreUrl;

  const note = t.message ? `<p class="note rise d2">"${escapeHtml(t.message)}"</p>` : "";

  // Action first — most people arriving here just want the parcel. The pitch
  // (what SongNook is + the living gallery) sits right under it for the curious,
  // and the raw-files escape hatch is a quiet disclosure at the very bottom.
  const body = `
${GALLERY_SPRITE}
<h1 class="rise d1">${escapeHtml(senderName)} sent you <em>${escapeHtml(title)}</em>.</h1>
${note}

<section class="panel rise d1">
  <p class="meta-line"><b>${escapeHtml(title)}</b> <span>·</span>
    <span>${songCount(t)}</span> <span>·</span> <span>${expiresLabel(t.expiresAt)}</span></p>
  <a id="get" class="btn btn-block" href="${escapeHtml(storeUrl)}">Open in SongNook</a>
  <p class="cta-fine">Installs the app, then opens straight to this parcel.</p>
  <div id="ios-notice" class="notice" hidden>Link copied. After installing, open SongNook —
    your parcel will be waiting.</div>
</section>

<section class="about rise d2">
  <p class="eyebrow">What's SongNook?</p>
  <p class="lede">${SONGNOOK_DESC}</p>
  <p class="eyebrow">See it in the app · swipe →</p>
</section>

${GALLERY_HTML}

<details class="grab rise d3">
  <summary>Prefer the raw files? Take them directly.</summary>
  <ul class="tracklist">${tracklist(t)}</ul>
</details>`;

  const iosScript = plat.isIOS
    ? `
;(function(){
  var get=document.getElementById('get');
  if(!get) return;
  get.addEventListener('click', function(){
    // iOS deferred deep link (v1): copy the transfer URL with a visible notice;
    // the app checks the pasteboard on first launch.
    try{ navigator.clipboard && navigator.clipboard.writeText(${JSON.stringify(transferUrl)}); }catch(_){}
    var n=document.getElementById('ios-notice'); if(n) n.hidden=false;
  });
})();`
    : "";

  return page({
    title: `${senderName} sent you music — SongNook Send`,
    body,
    bodyScript: GALLERY_SCRIPT + iosScript,
    extraStyle: GALLERY_CSS + FUNNEL_CSS,
    noindex: true,
  });
}

export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
  return { isMobile, isIOS, isAndroid };
}
