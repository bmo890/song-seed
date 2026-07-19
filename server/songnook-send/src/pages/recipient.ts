/**
 * Recipient page (`/t/:id`). SSR, content-negotiated:
 *  - Desktop → download view (title, sender, item list, per-item downloads).
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
import { escapeHtml, formatBytes, page } from "./shell";

export interface Platform {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export function renderRecipientPage(
  cfg: Config,
  t: TransferPayload,
  plat: Platform
): string {
  const senderName = t.sender.name || "Someone";
  const title = t.title || "Shared music";

  const itemsHtml = t.items
    .map(
      (it) => `<li>
        <span class="name">${escapeHtml(it.fileName)}</span>
        <span class="muted">${formatBytes(it.size)}
          &nbsp;<a class="btn btn-secondary" style="padding:6px 14px" href="${escapeHtml(
            it.downloadUrl
          )}">Download</a></span>
      </li>`
    )
    .join("");

  if (plat.isMobile && (plat.isIOS || plat.isAndroid)) {
    return renderMobileFunnel(cfg, t, plat, senderName, title, itemsHtml);
  }
  return renderDesktop(t, senderName, title, itemsHtml);
}

function renderDesktop(
  t: TransferPayload,
  senderName: string,
  title: string,
  itemsHtml: string
): string {
  const msg = t.message
    ? `<p class="sub">“${escapeHtml(t.message)}”</p>`
    : "";
  const body = `
<h1>${escapeHtml(senderName)} sent you ${escapeHtml(title)}.</h1>
${msg}
<div class="card">
  <ul class="items">${itemsHtml}</ul>
</div>
<div class="card">
  <p class="muted" style="margin:0">Songnook files open best in the Songnook app —
  open this link on your phone to load them straight into your library.</p>
</div>`;
  return page({ title: `${senderName} · ${title}`, body, noindex: true });
}

function renderMobileFunnel(
  cfg: Config,
  t: TransferPayload,
  plat: Platform,
  senderName: string,
  title: string,
  itemsHtml: string
): string {
  const transferUrl = `${cfg.publicOrigin}/t/${t.transferId}`;

  // Android: pass the transferId via Play Install Referrer so first launch finds it.
  const androidStore = `https://play.google.com/store/apps/details?id=${encodeURIComponent(
    cfg.androidPackage
  )}&referrer=${encodeURIComponent("transferId=" + t.transferId)}`;
  const storeUrl = plat.isAndroid ? androidStore : cfg.iosAppStoreUrl;

  const msg = t.message ? `<p class="sub">“${escapeHtml(t.message)}”</p>` : "";

  const body = `
<h1>${escapeHtml(senderName)} sent you music.</h1>
${msg}
<div class="card">
  <p style="margin:0 0 14px"><strong>${escapeHtml(title)}</strong> · ${t.items.length} item${
    t.items.length === 1 ? "" : "s"
  }</p>
  <a id="get" class="btn" style="width:100%" href="${escapeHtml(storeUrl)}">Get Songnook</a>
  <div id="ios-notice" class="notice" hidden>Link copied. After installing, open Songnook — it’ll pick up right where you left off.</div>
</div>
<div class="card">
  <p class="muted" style="margin:0 0 8px">Or download the files directly:</p>
  <ul class="items">${itemsHtml}</ul>
</div>`;

  const script = plat.isIOS
    ? `
(function(){
  var get=document.getElementById('get');
  get.addEventListener('click', function(e){
    // iOS deferred deep link (v1): copy the transfer URL with a visible notice;
    // the app checks the pasteboard on first launch.
    try{ navigator.clipboard && navigator.clipboard.writeText(${JSON.stringify(transferUrl)}); }catch(_){}
    document.getElementById('ios-notice').hidden=false;
  });
})();`
    : "";

  return page({ title: `${senderName} sent you music`, body, bodyScript: script, noindex: true });
}

export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);
  return { isMobile, isIOS, isAndroid };
}
