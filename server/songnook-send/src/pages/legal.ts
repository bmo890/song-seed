/**
 * The public face of songnook.app itself — the legal pages the stores link to,
 * and Support. The landing lives in landing.ts.
 *
 * Served by the same Worker as Send so there is exactly one deploy and one
 * domain to reason about. The prose comes from docs/*.md via build-legal.mjs.
 */
import { LEGAL } from "./legal.generated";
import { escapeHtml, page } from "./shell";

const LEGAL_CSS = `
.legal{max-width:62ch;margin:0 auto}
.legal h1{font-size:clamp(28px,5vw,36px);line-height:1.15;margin:0 0 6px}
.legal .eff{color:var(--ink-faint);font-size:13px;margin:0 0 28px}
.legal h2{font-size:19px;margin:30px 0 10px}
.legal p{margin:0 0 14px;line-height:1.65}
.legal ul{margin:0 0 14px;padding-inline-start:22px}
.legal li{margin-bottom:8px;line-height:1.6}
.legal strong{color:var(--ink)}
.legal nav{margin-top:40px;padding-top:16px;border-top:1px solid var(--rule);font-size:13px}
.legal nav a{color:var(--ink-faint);margin-inline-end:16px;text-decoration:none;border-bottom:1px solid var(--rule)}
.legal .lede{font-size:17px;margin:0 0 22px}
.legal .mail{margin:0 0 10px}
.legal .addr{color:var(--ink-soft);font-size:14px;margin:0 0 28px}

`;

type LegalKind = keyof typeof LEGAL;

export function renderLegalPage(kind: LegalKind): string {
  const doc = LEGAL[kind];
  const other = kind === "privacy" ? { href: "/terms", label: LEGAL.terms.title } : { href: "/privacy", label: LEGAL.privacy.title };
  return page({
    title: doc.title,
    variant: "site",
    extraStyle: LEGAL_CSS,
    body: `<article class="legal rise">
  <h1>${escapeHtml(doc.title)}</h1>
  ${doc.effective ? `<p class="eff">Effective ${escapeHtml(doc.effective)}</p>` : ""}
  ${doc.html}
  <nav><a href="/">SongNook</a><a href="${other.href}">${escapeHtml(other.label)}</a><a href="/support">Support</a></nav>
</article>`,
  });
}

/**
 * The support page the store listings link to. Hand-written, not from docs:
 * it names where things are in the app, so a rename there is a change here.
 */
export function renderSupportPage(email: string): string {
  const mail = escapeHtml(email);
  return page({
    title: "Support",
    variant: "site",
    extraStyle: LEGAL_CSS,
    body: `<article class="legal rise">
  <h1>Support</h1>
  <p class="lede">A question, a problem, an idea for SongNook: write to us and a person answers.</p>
  <p class="mail"><a class="btn" href="mailto:${mail}?subject=SongNook%20support">Email support</a></p>
  <p class="addr">${mail}</p>
  <h2>From inside the app</h2>
  <p>Settings → Feedback and feature requests sends us a note without leaving SongNook. A note carries no name, so we can’t answer it. Write by email when you want a reply.</p>
  <h2>SongNook Pro</h2>
  <ul>
    <li>Yearly and monthly plans are managed in your App Store or Google Play account. In the app: Settings → SongNook Pro → Manage subscription.</li>
    <li>Bought Pro and it isn’t showing? Open Settings → SongNook Pro and tap Restore.</li>
  </ul>
  <h2>Your library</h2>
  <p>Your library stays on your phone. Keep a copy somewhere safe from Settings → Data &amp; storage.</p>
  <nav><a href="/">SongNook</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
</article>`,
  });
}
