/**
 * Songnook Send — entry point.
 * Wires the API, the ranged download proxy, the SSR web pages, the universal-link
 * association files, robots, an abuse-report funnel, and the nightly expiry sweep.
 */
import { Hono } from "hono";
import type { Env } from "./env";
import { loadConfig } from "./env";
import { billingKeyProblem, checkBilling } from "./lib/access";
import { getItems, getTransfer } from "./lib/db";
import { clientIp, underRateLimit } from "./lib/guard";
import { errorResponse, transferUsable } from "./lib/http";
import { toTransferPayload } from "./lib/serialize";
import { sweepExpired } from "./lib/sweep";
import { detectPlatform, renderRecipientPage } from "./pages/recipient";
import { renderSenderPage } from "./pages/sender";
import { renderLandingPage, renderLegalPage } from "./pages/legal";
import { escapeHtml, htmlPage, page } from "./pages/shell";
import { api } from "./routes/api";
import { download } from "./routes/download";
import { pairing } from "./routes/pairing";
import { wellKnown } from "./routes/wellknown";

const app = new Hono<{ Bindings: Env }>();

// Permissive preflight (the web sender page is same-origin; native clients send no Origin).
app.options("*", () =>
  new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, x-upload-token, authorization",
    },
  })
);

// ── JSON API ────────────────────────────────────────────────────────────────
app.route("/api", api);
app.route("/api", pairing);

// ── .well-known association files ────────────────────────────────────────────
app.route("/.well-known", wellKnown);

// ── Ranged download proxy (/t/:id/dl/:itemId) ────────────────────────────────
app.route("/t", download);

// ── The bare domain (songnook.app) vs the send host ──────────────────────────
// One Worker serves both. The apex is the app's public face; send.* is the tool.
const isApex = (host: string | undefined) => (host ?? "").replace(/^www\./, "").split(":")[0] === "songnook.app";

// ── Web sender page — or the landing page on the bare domain ─────────────────
app.get("/", (c) => htmlPage(isApex(c.req.header("host")) ? renderLandingPage() : renderSenderPage({ seal: loadConfig(c.env).sealWebSends })));

// ── Legal pages (the store listings link here; the app's Settings→About does too)
app.get("/privacy", () => htmlPage(renderLegalPage("privacy")));
app.get("/terms", () => htmlPage(renderLegalPage("terms")));

// ── Recipient page (/t/:id) — content-negotiated ─────────────────────────────
app.get("/t/:id", async (c) => {
  const cfg = loadConfig(c.env);
  const transferId = c.req.param("id");
  const transfer = await getTransfer(c.env, transferId);
  if (!transfer || !transferUsable(transfer.status, transfer.expires_at, Date.now())) {
    return htmlPage(
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
  return htmlPage(renderRecipientPage(cfg, payload, plat));
});

// ── Abuse report funnel ──────────────────────────────────────────────────────
app.get("/report/:id", (c) => {
  const cfg = loadConfig(c.env);
  const id = c.req.param("id");
  const subject = encodeURIComponent(`Report transfer ${id}`);
  const body = escapeHtml(
    `If this transfer contains abusive or infringing content, email ${cfg.abuseEmail} with the link and a brief description. We remove reported transfers promptly.`
  );
  return htmlPage(
    page({
      title: "Report a transfer",
      body: `<h1>Report a transfer</h1><p class="sub">${body}</p>
        <a class="btn" href="mailto:${cfg.abuseEmail}?subject=${subject}">Email a report</a>`,
      noindex: true,
    })
  );
});

// ── robots.txt — nothing here should be indexed ──────────────────────────────
app.get("/robots.txt", (c) =>
  new Response(
    isApex(c.req.header("host")) ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n",
    { headers: { "content-type": "text/plain" } }
  )
);

// Health. Once Pro is for sale the server must be able to ask RevenueCat who
// has it; without the key every subscriber reads as free, so that is a failure
// here, not a quiet default. `/healthz/billing` asks RevenueCat itself.
app.get("/healthz", (c) => {
  const cfg = loadConfig(c.env);
  const problem = billingKeyProblem(cfg);
  const selling = !cfg.proForAll;
  if (selling && problem) return c.json({ ok: false, selling, billing: problem }, 503);
  return c.json({ ok: true, selling, billing: problem ?? "key set" });
});

app.get("/healthz/billing", async (c) => {
  const cfg = loadConfig(c.env);
  if (!(await underRateLimit(c.env, "pair", clientIp(c), 30, 3600))) return errorResponse(429, "too many requests");
  const health = await checkBilling(cfg);
  return c.json(health, health.ok ? 200 : 503);
});

app.notFound(() => errorResponse(404, "not found"));

export default {
  fetch: app.fetch,
  // Nightly expiry sweep.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      sweepExpired(env, Date.now()).then((r) =>
        console.log(`sweep: removed ${r.transfers} transfers, ${r.objects} objects, ${r.failed} failed`)
      )
    );
  },
};
