/**
 * songnook.app/review/he/<token>: the Hebrew review (reviewLib.ts). Every route checks the
 * link's token against REVIEW_HE_TOKEN_SHA256; a wrong or missing token is a plain 404,
 * so the page cannot be found by guessing. Nothing here is indexed or cached.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import { parseSave, readEdits, sheet, toCsv, toJson, tokenMatches, writeEdit } from "./reviewLib";
import { renderReviewPage } from "./reviewPage";
import { parseTermSave, readTermEdits, termsCsv, termsJson, termsSheet, writeTermEdit } from "./termsLib";
import { renderTermsPage } from "./termsPage";

export const review = new Hono<{ Bindings: Env }>();

const PRIVATE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

async function allowed(env: Env, token: string): Promise<boolean> {
  return tokenMatches(token, env.REVIEW_HE_TOKEN_SHA256);
}

review.get("/he/:token", async (c) => {
  const token = c.req.param("token");
  if (!(await allowed(c.env, token))) return c.notFound();
  const here = `/review/he/${encodeURIComponent(token)}`;
  return new Response(renderReviewPage(sheet.counts, `${here}/export.csv`, `${here}/export.json`), {
    headers: {
      ...PRIVATE_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "x-frame-options": "DENY",
      "content-security-policy": [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'unsafe-inline'",
        "connect-src 'self'",
        "form-action 'none'",
      ].join("; "),
    },
  });
});

review.get("/he/:token/sheet.json", async (c) => {
  if (!(await allowed(c.env, c.req.param("token")))) return c.notFound();
  const edits = await readEdits(c.env.DB);
  return new Response(JSON.stringify({ sheet, edits: [...edits.values()] }), {
    headers: { ...PRIVATE_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
});

review.post("/he/:token/save", async (c) => {
  if (!(await allowed(c.env, c.req.param("token")))) return c.notFound();
  const save = parseSave(await c.req.json().catch(() => null));
  if (!save) return c.json({ error: "bad_save" }, 400);
  await writeEdit(c.env.DB, save, Date.now());
  return c.json({ ok: true }, 200, PRIVATE_HEADERS);
});

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

review.get("/he/:token/export.csv", async (c) => {
  if (!(await allowed(c.env, c.req.param("token")))) return c.notFound();
  const csv = toCsv(await readEdits(c.env.DB));
  return new Response(csv, {
    headers: {
      ...PRIVATE_HEADERS,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="songnook-hebrew-review-${stamp()}.csv"`,
    },
  });
});

review.get("/he/:token/export.json", async (c) => {
  if (!(await allowed(c.env, c.req.param("token")))) return c.notFound();
  const json = toJson(await readEdits(c.env.DB));
  return new Response(json, {
    headers: {
      ...PRIVATE_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="songnook-hebrew-review-${stamp()}.json"`,
    },
  });
});

// ── The terms review (songnook.app/review/he-terms/<link>): its own link and token ──
const termsAllowed = (env: Env, token: string) => tokenMatches(token, env.REVIEW_HE_TERMS_TOKEN_SHA256);

review.get("/he-terms/:token", async (c) => {
  const token = c.req.param("token");
  if (!(await termsAllowed(c.env, token))) return c.notFound();
  const here = `/review/he-terms/${encodeURIComponent(token)}`;
  const total =
    termsSheet.rows.length +
    termsSheet.sentences.length +
    (termsSheet.web ?? []).reduce((sum, section) => sum + section.rows.length, 0);
  return new Response(renderTermsPage(total, `${here}/export.csv`, `${here}/export.json`), {
    headers: {
      ...PRIVATE_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "x-frame-options": "DENY",
      "content-security-policy": [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'unsafe-inline'",
        "connect-src 'self'",
        "form-action 'none'",
      ].join("; "),
    },
  });
});

review.get("/he-terms/:token/sheet.json", async (c) => {
  if (!(await termsAllowed(c.env, c.req.param("token")))) return c.notFound();
  const edits = await readTermEdits(c.env.DB);
  return new Response(JSON.stringify({ sheet: termsSheet, edits: [...edits.values()] }), {
    headers: { ...PRIVATE_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
});

review.post("/he-terms/:token/save", async (c) => {
  if (!(await termsAllowed(c.env, c.req.param("token")))) return c.notFound();
  const save = parseTermSave(await c.req.json().catch(() => null));
  if (!save) return c.json({ error: "bad_save" }, 400);
  await writeTermEdit(c.env.DB, save, Date.now());
  return c.json({ ok: true }, 200, PRIVATE_HEADERS);
});

review.get("/he-terms/:token/export.csv", async (c) => {
  if (!(await termsAllowed(c.env, c.req.param("token")))) return c.notFound();
  return new Response(termsCsv(await readTermEdits(c.env.DB)), {
    headers: {
      ...PRIVATE_HEADERS,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="songnook-hebrew-words-${stamp()}.csv"`,
    },
  });
});

review.get("/he-terms/:token/export.json", async (c) => {
  if (!(await termsAllowed(c.env, c.req.param("token")))) return c.notFound();
  return new Response(termsJson(await readTermEdits(c.env.DB)), {
    headers: {
      ...PRIVATE_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="songnook-hebrew-words-${stamp()}.json"`,
    },
  });
});
