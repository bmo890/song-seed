/**
 * The public face of songnook.app itself — the legal pages the stores link to,
 * and the one-screen landing that greets anyone who types the bare domain.
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
.land{max-width:44ch;margin:8vh auto 0;text-align:center}
.land h1{font-size:clamp(34px,7vw,52px);line-height:1.05;margin:0 0 14px}
.land p{font-size:17px;line-height:1.55;margin:0 0 10px}
.land .quiet{color:var(--ink-faint);font-size:14px;margin-top:26px}
.land nav{margin-top:34px;font-size:14px}
.land nav a{margin:0 10px;color:var(--terra-deep);text-decoration:none;border-bottom:1px solid var(--rule)}
.land nav a:hover{border-color:var(--terra-deep)}
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
  <nav><a href="/">SongNook</a><a href="${other.href}">${escapeHtml(other.label)}</a></nav>
</article>`,
  });
}

/** The bare-domain landing: what SongNook is, that it's coming, and where the rules live. */
export function renderLandingPage(): string {
  return page({
    title: "SongNook",
    variant: "site",
    extraStyle: LEGAL_CSS,
    body: `<section class="land rise">
  <h1>A quiet place to finish creative work.</h1>
  <p>SongNook is a musician's sketchbook — record the idea, keep the takes, write the words, and hand it to the band with a link.</p>
  <p class="quiet">Coming to the App Store and Google Play.</p>
  <nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
</section>`,
  });
}
