/**
 * Shared HTML shell + Songnook brand styling for the SSR web surfaces.
 * Warm paper palette, terracotta accent, tonal layering, no borders/shadows,
 * Newsreader (display) + Plus Jakarta Sans (text) — the app's design language.
 * Fully self-contained: no external assets, no secrets.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const BRAND_CSS = `
:root{
  --paper:#f4efe7; --paper-2:#ece5da; --card:#faf7f1; --ink:#2b2622;
  --ink-soft:#6b6157; --terracotta:#824f3f; --terracotta-ink:#fbf6f1;
  --line:#e2d9cc;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:var(--paper); color:var(--ink);
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  -webkit-font-smoothing:antialiased; line-height:1.5;
}
.wrap{max-width:640px;margin:0 auto;padding:40px 20px 80px}
.brand{font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--terracotta);font-weight:700;margin-bottom:28px}
h1{font-family:Newsreader,Georgia,serif;font-weight:600;font-size:30px;line-height:1.2;margin:0 0 8px}
.sub{color:var(--ink-soft);margin:0 0 28px}
.card{background:var(--card);border-radius:18px;padding:22px}
.card + .card{margin-top:14px}
.muted{color:var(--ink-soft);font-size:14px}
.btn{display:inline-block;background:var(--terracotta);color:var(--terracotta-ink);
  border:none;border-radius:999px;padding:13px 22px;font-size:15px;font-weight:600;
  cursor:pointer;text-decoration:none;text-align:center}
.btn:disabled{opacity:.5;cursor:default}
.btn-secondary{background:var(--paper-2);color:var(--ink)}
.field{display:block;margin:0 0 12px}
.field label{display:block;font-size:13px;color:var(--ink-soft);margin-bottom:5px}
.field input,.field textarea{width:100%;background:var(--paper);border:none;border-radius:12px;
  padding:12px 14px;font:inherit;color:var(--ink);resize:vertical}
.drop{background:var(--paper-2);border-radius:18px;padding:38px 20px;text-align:center;
  color:var(--ink-soft);cursor:pointer;transition:background .15s}
.drop.over{background:#e3d6c4}
.items{list-style:none;margin:14px 0 0;padding:0}
.items li{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--line)}
.items li:first-child{border-top:none}
.name{font-weight:600;word-break:break-word}
.foot{margin-top:40px;font-size:12px;color:var(--ink-soft)}
.foot a{color:var(--ink-soft)}
.link-out{display:flex;gap:10px;align-items:center;background:var(--paper);border-radius:12px;padding:12px 14px;margin-top:6px}
.link-out code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;word-break:break-all}
.progress{height:6px;background:var(--paper-2);border-radius:999px;overflow:hidden;margin-top:14px}
.progress > i{display:block;height:100%;width:0;background:var(--terracotta);transition:width .2s}
.notice{background:#efe4d3;border-radius:12px;padding:12px 14px;font-size:14px;margin-top:14px}
@media (prefers-color-scheme:dark){
  :root{--paper:#211d1a;--paper-2:#2a251f;--card:#26221d;--ink:#efe7dc;--ink-soft:#b3a89a;
    --terracotta:#c67c63;--terracotta-ink:#20140f;--line:#3a332b}
}
`;

export function page(opts: {
  title: string;
  body: string;
  bodyScript?: string;
  noindex?: boolean;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${opts.noindex ? '<meta name="robots" content="noindex,nofollow">' : ""}
<title>${escapeHtml(opts.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@500;600&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>${BRAND_CSS}</style>
</head>
<body>
<div class="wrap">
<div class="brand">Songnook Send</div>
${opts.body}
<div class="foot">Songnook — a home for song ideas. Files are held for a limited time, then deleted.</div>
</div>
${opts.bodyScript ? `<script>${opts.bodyScript}</script>` : ""}
</body>
</html>`;
}
