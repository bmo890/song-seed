/**
 * Recipient page (`/t/:id`). SSR, content-negotiated:
 *  - Desktop → download view (title, sender, tracklist, per-item downloads).
 *  - Mobile WITHOUT the app → branded install funnel (this is an onboarding surface).
 *  - Mobile WITH the app never reaches here — the universal link opens the app at the OS.
 *
 * Deferred deep link:
 *  - Android: the store link carries `referrer=<transferId>` (Play Install Referrer).
 *  - iOS: on "Get Songnook" tap we copy the transfer URL to the clipboard with a
 *    visible notice; the app reads the pasteboard on first launch. (No SDK in v1.)
 */
import type { Config } from "../env";
import type { TransferPayload } from "../lib/serialize";
import { escapeHtml, formatBytes, page, waveformStrip } from "./shell";

export interface Platform {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

function expiresLabel(expiresAtIso: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(expiresAtIso) - Date.now()) / 86400000));
  if (days <= 0) return "expiring today";
  return days === 1 ? "1 day left" : `${days} days left`;
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
    ? `<p class="note rise d2">“${escapeHtml(t.message)}”</p>`
    : "";
  const body = `
<p class="eyebrow rise d1">A parcel from ${escapeHtml(senderName)}</p>
<h1 class="rise d1">${escapeHtml(senderName)} sent you <em>${escapeHtml(title)}</em>.</h1>
${note}
<div class="rise d2">${waveformStrip()}</div>

<section class="panel rise d3">
  <p class="meta-line"><b>${t.items.length} ${t.items.length === 1 ? "piece" : "pieces"}</b>
    <span>·</span> <span>${expiresLabel(t.expiresAt)}</span></p>
  <ul class="tracklist">${tracklist(t)}</ul>
</section>

<section class="panel rise d4">
  <p style="margin:0;color:var(--ink-soft);font-size:14.5px">Songnook files open best in the
  Songnook app — open this same link on your phone and it lands straight in your library.</p>
</section>`;
  return page({ title: `${senderName} · ${title} — Songnook Send`, body, noindex: true });
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

  const note = t.message ? `<p class="note rise d2">“${escapeHtml(t.message)}”</p>` : "";

  const body = `
<p class="eyebrow rise d1">A parcel for you</p>
<h1 class="rise d1">${escapeHtml(senderName)} sent you <em>music</em>.</h1>
${note}
<div class="rise d2">${waveformStrip(26)}</div>

<section class="panel rise d3">
  <p class="meta-line"><b>${escapeHtml(title)}</b> <span>·</span>
    <span>${t.items.length} ${t.items.length === 1 ? "piece" : "pieces"}</span> <span>·</span>
    <span>${expiresLabel(t.expiresAt)}</span></p>
  <a id="get" class="btn btn-block" href="${escapeHtml(storeUrl)}">Get Songnook — it opens there</a>
  <div id="ios-notice" class="notice" hidden>Link copied. After installing, open Songnook —
    your parcel will be waiting.</div>
</section>

<section class="panel rise d4">
  <p style="margin:0 0 10px;color:var(--ink-faint);font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700">
    Or take the files directly</p>
  <ul class="tracklist">${tracklist(t)}</ul>
</section>`;

  const script = plat.isIOS
    ? `
(function(){
  var get=document.getElementById('get');
  get.addEventListener('click', function(){
    // iOS deferred deep link (v1): copy the transfer URL with a visible notice;
    // the app checks the pasteboard on first launch.
    try{ navigator.clipboard && navigator.clipboard.writeText(${JSON.stringify(transferUrl)}); }catch(_){}
    document.getElementById('ios-notice').hidden=false;
  });
})();`
    : "";

  return page({
    title: `${senderName} sent you music — Songnook Send`,
    body,
    bodyScript: script,
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
