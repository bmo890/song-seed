/**
 * Songnook Send — entry point.
 * Wires the API, the ranged download proxy, the SSR web pages, the universal-link
 * association files, robots, an abuse-report funnel, and the nightly expiry sweep.
 */
import { Hono } from "hono";
import type { Env } from "./env";
import { loadConfig } from "./env";
import { getItems, getTransfer } from "./lib/db";
import { errorResponse, transferUsable } from "./lib/http";
import { toTransferPayload } from "./lib/serialize";
import { sweepExpired } from "./lib/sweep";
import { detectPlatform, renderRecipientPage } from "./pages/recipient";
import { renderSenderPage } from "./pages/sender";
import { escapeHtml, page } from "./pages/shell";
import { api } from "./routes/api";
import { download } from "./routes/download";
import { wellKnown } from "./routes/wellknown";

const app = new Hono<{ Bindings: Env }>();

// Permissive preflight (the web sender page is same-origin; native clients send no Origin).
app.options("*", () =>
  new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  })
);

// ── JSON API ────────────────────────────────────────────────────────────────
app.route("/api", api);

// ── .well-known association files ────────────────────────────────────────────
app.route("/.well-known", wellKnown);

// ── Ranged download proxy (/t/:id/dl/:itemId) ────────────────────────────────
app.route("/t", download);

// ── Web sender page ──────────────────────────────────────────────────────────
app.get("/", (c) => c.html(renderSenderPage()));

// ── Recipient page (/t/:id) — content-negotiated ─────────────────────────────
app.get("/t/:id", async (c) => {
  const cfg = loadConfig(c.env);
  const transferId = c.req.param("id");
  const transfer = await getTransfer(c.env, transferId);
  if (!transfer || !transferUsable(transfer.status, transfer.expires_at, Date.now())) {
    return c.html(
      page({
        title: "Link unavailable",
        body: `<h1>This link isn’t available.</h1><p class="sub">It may have expired or been removed. Ask the sender for a fresh link.</p>`,
        noindex: true,
      }),
      transfer && transfer.status === "finalized" ? 410 : 404
    );
  }
  const items = await getItems(c.env, transferId);
  const payload = toTransferPayload(cfg, transfer, items);
  const plat = detectPlatform(c.req.header("user-agent") || "");
  return c.html(renderRecipientPage(cfg, payload, plat));
});

// ── Abuse report funnel ──────────────────────────────────────────────────────
app.get("/report/:id", (c) => {
  const cfg = loadConfig(c.env);
  const id = c.req.param("id");
  const subject = encodeURIComponent(`Report transfer ${id}`);
  const body = escapeHtml(
    `If this transfer contains abusive or infringing content, email ${cfg.abuseEmail} with the link and a brief description. We remove reported transfers promptly.`
  );
  return c.html(
    page({
      title: "Report a transfer",
      body: `<h1>Report a transfer</h1><p class="sub">${body}</p>
        <a class="btn" href="mailto:${cfg.abuseEmail}?subject=${subject}">Email a report</a>`,
      noindex: true,
    })
  );
});

// ── robots.txt — nothing here should be indexed ──────────────────────────────
app.get("/robots.txt", () =>
  new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } })
);

app.get("/healthz", (c) => c.json({ ok: true }));

app.notFound(() => errorResponse(404, "not found"));

export default {
  fetch: app.fetch,
  // Nightly expiry sweep.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      sweepExpired(env, Date.now()).then((r) =>
        console.log(`sweep: removed ${r.transfers} transfers, ${r.objects} objects`)
      )
    );
  },
};
