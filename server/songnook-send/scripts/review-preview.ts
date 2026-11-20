// Local preview of the Hebrew review page (the Worker's local dev cannot load its email
// binding): the same page, lines and save rules, with saves kept in memory.
//   node --experimental-strip-types scripts/review-preview.ts   → http://localhost:8790/review/he/local-preview-token
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { parseSave, sheet, toCsv, toJson, type ReviewEdit } from "../src/review/reviewLib.ts";
import { renderReviewPage } from "../src/review/reviewPage.ts";

const edits = new Map<string, ReviewEdit>();
const base = "/review/he/local-preview-token";
createServer(async (req, res) => {
  const url = req.url ?? "/";
  if (url === base) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(renderReviewPage(sheet.counts, `${base}/export.csv`, `${base}/export.json`));
  }
  if (url === `${base}/sheet.json`) {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ sheet, edits: [...edits.values()] }));
  }
  if (url === `${base}/save` && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const save = parseSave(JSON.parse(body));
    if (!save) { res.writeHead(400); return res.end("bad"); }
    edits.set(save.itemId, { item_id: save.itemId, forms: JSON.stringify(save.forms), note: save.note, status: save.status, updated_at: Date.now() });
    res.writeHead(200, { "content-type": "application/json" });
    return res.end('{"ok":true}');
  }
  if (url === `${base}/export.csv`) { res.writeHead(200, { "content-type": "text/csv; charset=utf-8" }); return res.end(toCsv(edits)); }
  if (url === `${base}/export.json`) { res.writeHead(200, { "content-type": "application/json" }); return res.end(toJson(edits)); }
  if (url.startsWith("/fonts/")) {
    try { res.writeHead(200, { "content-type": "font/woff2" }); return res.end(readFileSync(new URL(`../public${url}`, import.meta.url))); } catch { res.writeHead(404); return res.end(); }
  }
  res.writeHead(404); res.end();
}).listen(Number(process.env.PORT ?? 8790), () => console.log(`http://localhost:${process.env.PORT ?? 8790}${base}`));
