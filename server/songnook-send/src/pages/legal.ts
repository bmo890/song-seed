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

/** The brand mark (assets/brand/songnook-mark.svg), inline so the hero needs no request. */
const MARK = `<svg class="mark" viewBox="0 0 120 120" aria-hidden="true"><rect x="57.5" y="42" width="5" height="44" rx="2.5" fill="#B87D6B"/><rect x="41" y="84" width="38" height="5" rx="2.5" fill="#B87D6B"/><path d="M60 32 A25 25 0 0 0 23 59 A25 25 0 0 0 60 32 Z" fill="#C9978A" stroke="#C9978A" stroke-width="3" stroke-linejoin="round"/><path d="M60 32 A25 25 0 0 1 97 59 A25 25 0 0 1 60 32 Z" fill="#B87D6B" stroke="#B87D6B" stroke-width="3" stroke-linejoin="round"/></svg>`;

/** The store screenshots (docs/store-assets/apple, 600 px webp in public/shots), each with
 *  the caption baked in; alt text repeats it. */
const SHOTS: { file: string; alt: string }[] = [
  { file: "01-capture", alt: "Catch it before it's gone. Tap once and you're recording." },
  { file: "02-sketch", alt: "Every idea grows into a song. Takes, versions and side ideas in one sketch." },
  { file: "03-write", alt: "Lyrics and chords, every draft kept. Write, chart and transpose in one place." },
  { file: "04-practice", alt: "Learn it, then layer it. Loop the hard part, slow it down, add another part." },
  { file: "05-words", alt: "Stuck on a line? Lyric Spark: writing exercises to get past the block." },
  { file: "06-organize", alt: "Get organized. Workspaces and collections for every project." },
  { file: "07-revisit", alt: "Never lose a gem. Revisit brings back the ones you forgot." },
  { file: "08-send", alt: "Send the song, not just the audio. Lyrics, chords, notes and marks go with it." },
];

/** What SongNook does, in the store description's words (store-truth.md section 6). */
const FEATURES: { title: string; lines: string[] }[] = [
  { title: "Capture", lines: ["Record in one tap. A take keeps going when the screen locks.", "Import voice memos, audio files, or the sound from a video.", "Stuck for a title? Get a name suggestion."] },
  { title: "Find it again", lines: ["Revisit brings back unfinished sketches and ideas you forgot.", "Shelf sets one aside so it doesn't get lost again.", "Activity shows what you worked on, any week, any year."] },
  { title: "Finish the song", lines: ["Every take of a song in one sketch, with version history.", "Lyrics, chord charts, and lyrics with chords.", "Record another part over a take and solo any of them."] },
  { title: "Practice", lines: ["Learn other people's songs: slow them down, change the key, loop the hard part.", "Step up speeds the loop a little each pass.", "Tuner, metronome and count-in, built in."] },
  { title: "Write", lines: ["Word Finder: rhymes, near rhymes, synonyms.", "Lyric Spark: writing exercises for when you're stuck.", "Lyric Pad: a home for loose lines."] },
  { title: "Share", lines: ["Send a clip or a whole sketch by private link, with its lyrics, chords, notes and pins.", "Only people with the link can open it, not even SongNook.", "Setlists and chart books, with an autoscrolling stage reader."] },
];

const PRO_ADDS = [
  "Word Finder, and unlimited Lyric Spark (one free try of each game)",
  "Speed, pitch and Step up",
  "Transpose, capo, setlists, chart books and PDF charts",
  "Unlimited Send links (one a month free)",
  "Unlimited workspaces (two free)",
  "Up to 8 layers on a take (one free)",
  "Export for DAW",
];

const LAND_CSS = `
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(28px,5vw,64px);align-items:center;margin-bottom:clamp(40px,7vw,72px)}
.hero .mark{width:64px;height:64px;display:block;margin:0 0 14px -6px}
.hero h1{font-size:clamp(38px,6.2vw,62px)}
.hero .sub{font-size:17.5px;max-width:42ch}
.hero .fine{font-size:13px;color:var(--ink-faint);margin:14px 0 0}
.hero figure{margin:0;justify-self:center;width:min(100%,340px)}
.shot{display:block;width:100%;height:auto;border-radius:18px;border:1px solid var(--rule);background:var(--card);
  box-shadow:0 18px 40px -24px rgba(60,40,30,.35)}
.facts{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);
  padding:16px 0;margin:0 0 clamp(44px,8vw,80px);font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);font-weight:600}
.facts span{padding:0 clamp(12px,3vw,28px)}
.facts span + span{border-left:1px solid var(--rule)}
.sec{margin-bottom:clamp(48px,8vw,88px)}
.sec h2{font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(26px,4vw,36px);line-height:1.15;margin:0 0 10px;text-wrap:balance}
.sec .lead{color:var(--ink-soft);margin:0 0 26px;max-width:56ch}
.gallery{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(200px,1fr);gap:18px;overflow-x:auto;
  scroll-snap-type:x mandatory;padding:4px 2px 18px;margin:0 -2px}
.gallery img{scroll-snap-align:start}
.features{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(22px,3vw,34px) clamp(22px,3.5vw,44px)}
.feature h3{font-family:Lora,Georgia,serif;font-weight:500;font-size:21px;margin:0 0 10px;padding-top:12px;border-top:2px solid var(--terra)}
.feature ul{list-style:none;margin:0;padding:0}
.feature li{color:var(--ink-soft);font-size:15px;line-height:1.55;margin:0 0 8px}
.yours{max-width:62ch}
.yours p{font-size:17px;line-height:1.65;margin:0 0 12px}
.plans{display:grid;grid-template-columns:1fr 1.25fr;gap:18px;align-items:start}
.plans h3{font-family:Lora,Georgia,serif;font-weight:500;font-size:22px;margin:0 0 10px}
.plans p,.plans li{font-size:15px;line-height:1.6;color:var(--ink-soft)}
.plans p{margin:0 0 10px}
.plans ul{margin:0 0 14px;padding-inline-start:18px}
.plans li{margin:0 0 6px}
.prices{display:flex;flex-wrap:wrap;gap:8px 22px;border-top:1px solid var(--rule);padding-top:14px;margin-top:6px;font-variant-numeric:tabular-nums}
.prices b{font-weight:700;color:var(--ink)}
.prices span{color:var(--ink-soft);font-size:15px}
.plans .fine{font-size:12.5px;color:var(--ink-faint);margin:10px 0 0}
.closing{text-align:center;border-top:1px solid var(--rule);padding-top:clamp(36px,6vw,56px)}
.closing p{color:var(--ink-faint);font-size:13px;margin:14px 0 0}
@media (max-width:820px){
  .hero{grid-template-columns:1fr}
  .hero figure{width:min(78%,320px)}
  .features{grid-template-columns:1fr 1fr}
  .plans{grid-template-columns:1fr}
}
@media (max-width:540px){
  .features{grid-template-columns:1fr}
  .facts{flex-direction:column;align-items:center;gap:8px}
  .facts span{padding:0;font-size:11px;letter-spacing:.14em}
  .facts span + span{border-left:none}
  .gallery{grid-auto-columns:68%}
}
`;

/** The bare-domain landing: what SongNook is, where to get it, what's free and what Pro
 *  adds, and where the rules live. Its claims follow the store description and
 *  pricing-and-marketing.md; a change there is a change here. */
export function renderLandingPage(appStoreUrl: string): string {
  const store = escapeHtml(appStoreUrl);
  const description =
    "A quiet corner for songwriting and practice. SongNook records your song ideas, keeps them organized, helps you finish them, and brings back the ones you forgot.";
  const head = `<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://songnook.app/">
<meta property="og:title" content="SongNook">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="https://songnook.app/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="apple-itunes-app" content="app-id=6810435199">`;
  const gallery = SHOTS.slice(1)
    .map((s) => `<img class="shot" src="/shots/${s.file}.webp" width="600" height="1304" loading="lazy" alt="${escapeHtml(s.alt)}">`)
    .join("");
  const features = FEATURES.map(
    (f) => `<div class="feature"><h3>${escapeHtml(f.title)}</h3><ul>${f.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul></div>`
  ).join("");
  const proAdds = PRO_ADDS.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  return page({
    title: "SongNook: a quiet corner for songwriting and practice",
    variant: "site",
    wide: true,
    head,
    extraStyle: LAND_CSS,
    body: `<section class="hero">
  <div class="rise d1">
    ${MARK}
    <h1>A quiet corner for songwriting and practice.</h1>
    <p class="sub">SongNook records your song ideas, keeps them organized, helps you finish them, and brings back the ones you forgot, so a good idea never gets lost.</p>
    <a class="btn" href="${store}">Get SongNook for iPhone</a>
    <p class="fine">Free to download. Android is on the way.</p>
  </div>
  <figure class="rise d2"><img class="shot" src="/shots/${SHOTS[0].file}.webp" width="600" height="1304" alt="${escapeHtml(SHOTS[0].alt)}"></figure>
</section>
<div class="facts rise d3"><span>No account</span><span>No ads</span><span>Your songs stay on your phone</span></div>
<section class="sec">
  <h2>From a hum to a finished song</h2>
  <p class="lead">Capture the idea, find it again, write the words, learn the part, and hand it to the band.</p>
  <div class="gallery">${gallery}</div>
</section>
<section class="sec"><div class="features">${features}</div></section>
<section class="sec yours">
  <h2>Yours, and only yours</h2>
  <p>Your songs stay on your phone. We never see them, and they are never used to train AI.</p>
  <p>There is no account to make. Back up your library whenever you like, to wherever you keep things.</p>
</section>
<section class="sec">
  <h2>Free, with a free month of Pro</h2>
  <p class="lead">Your first month includes every tool, no card needed. After that, recording, writing, organizing and sharing your songs stay free.</p>
  <div class="plans">
    <div class="panel"><h3>Free for good</h3><p>Recording, your whole library, lyrics, chord charts, looping, pins and sections, backup and export, and one Send link a month.</p></div>
    <div class="panel"><h3>SongNook Pro adds</h3><ul>${proAdds}</ul>
      <div class="prices"><span><b>$24.99</b> a year</span><span><b>$3.99</b> a month</span><span><b>$59.99</b> once, for life</span></div>
      <p class="fine">Lifetime is a launch price until February 9, 2027. Prices in US dollars; your store shows yours.</p>
    </div>
  </div>
</section>
<section class="closing">
  <a class="btn" href="${store}">Get SongNook for iPhone</a>
  <p>Android is on the way.</p>
</section>`,
  });
}
