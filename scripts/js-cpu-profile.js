#!/usr/bin/env node
// Capture a Hermes CPU profile of the running dev app over Metro's inspector
// (CDP Tracing domain — the same feed Chrome DevTools' Performance panel uses)
// and print self time by function and module. Attribution the React profiler
// cannot give: Fabric's native commit (`completeRoot`), Reanimated worklet setup,
// Skia draw calls, GC, dev-only overhead.
//
//   node scripts/js-cpu-profile.js [seconds=12] [out.trace.json] [metro=http://localhost:8081]
//
// Start it, perform the interaction while it records, read the summary. The
// JSON trace can be dropped into chrome://tracing or DevTools → Performance.
const path = require("path");
const WebSocket = require(path.join(__dirname, "..", "node_modules", "ws"));
const fs = require("fs");
const http = require("http");

const seconds = Number(process.argv[2] || 12);
const out = process.argv[3] || "js-cpu-profile.trace.json";
const metro = process.argv[4] || "http://localhost:8081";

function discoverTarget() {
  return new Promise((resolve, reject) => {
    http
      .get(metro + "/json", (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try {
            const pages = JSON.parse(body);
            const page =
              pages.find((p) => /Bridgeless/.test(p.description || "") && !/UI|video/.test(p.description || "")) ||
              pages[0];
            if (!page) return reject(new Error("no inspector target — is the dev app running?"));
            resolve(page.webSocketDebuggerUrl);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const url = await discoverTarget();
  console.log("target", url);
  run(url);
}

function run(url) {
const ws = new WebSocket(url);
ws.on("error", (e) => {
  console.error("ws error", e.message);
  process.exit(1);
});
let nextId = 1;
const pending = new Map();
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
  }
});
const chunks = [];
let tracingComplete = null;
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.method === "Tracing.dataCollected") chunks.push(...(msg.params.value || []));
  if (msg.method === "Tracing.tracingComplete" && tracingComplete) tracingComplete();
});
ws.on("open", async () => {
  try {
    await send("Runtime.enable").catch(() => {});
    await send("Tracing.start", {
      traceConfig: { includedCategories: ["disabled-by-default-v8.cpu_profiler", "v8.execute", "devtools.timeline"], recordMode: "recordUntilFull" },
    });
    console.log("tracing for " + seconds + "s...");
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const done = new Promise((r) => (tracingComplete = r));
    await send("Tracing.end");
    await Promise.race([done, new Promise((r) => setTimeout(r, 15000))]);
    fs.writeFileSync(out, JSON.stringify(chunks));
    const profile = mergeProfile(chunks);
    if (!profile) {
      console.log("no cpu profile in trace; event names:", [...new Set(chunks.map((e) => e.name))].slice(0, 40));
      return;
    }
    summarize(profile);
  } catch (e) {
    console.error("error", e);
  } finally {
    ws.close();
    process.exit(0);
  }
});

}

function mergeProfile(events) {
  const nodes = [];
  const samples = [];
  const timeDeltas = [];
  let found = false;
  for (const e of events) {
    if (e.name === "Profile" && e.args && e.args.data && e.args.data.cpuProfile) {
      found = true;
      const cp = e.args.data.cpuProfile;
      if (cp.nodes) nodes.push(...cp.nodes);
      if (cp.samples) samples.push(...cp.samples);
      if (cp.timeDeltas) timeDeltas.push(...cp.timeDeltas);
    }
    if (e.name === "ProfileChunk" && e.args && e.args.data) {
      found = true;
      const cp = e.args.data.cpuProfile || {};
      if (cp.nodes) nodes.push(...cp.nodes);
      if (cp.samples) samples.push(...cp.samples);
      if (e.args.data.timeDeltas) timeDeltas.push(...e.args.data.timeDeltas);
    }
  }
  if (!found) return null;
  // ProfileChunk nodes carry `parent` instead of children; normalize.
  const byId = new Map();
  for (const n of nodes) {
    const existing = byId.get(n.id);
    if (existing) {
      if (n.children) existing.children = [...(existing.children || []), ...n.children];
      continue;
    }
    byId.set(n.id, { ...n, children: n.children ? [...n.children] : [] });
  }
  for (const n of nodes) {
    if (n.parent != null) {
      const p = byId.get(n.parent);
      if (p && !p.children.includes(n.id)) p.children.push(n.id);
    }
  }
  return { nodes: [...byId.values()], samples, timeDeltas };
}


function summarize(profile) {
  const nodes = new Map();
  for (const n of profile.nodes) nodes.set(n.id, n);
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const self = new Map();
  const total = new Map();
  let sum = 0;
  const deltas = profile.timeDeltas || [];
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (deltas[i] || 0) / 1000; // ms
    sum += dt;
    const id = profile.samples[i];
    self.set(id, (self.get(id) || 0) + dt);
    let cur = id;
    const seen = new Set();
    while (cur != null && !seen.has(cur)) {
      seen.add(cur);
      total.set(cur, (total.get(cur) || 0) + dt);
      cur = parent.get(cur);
    }
  }
  const label = (n) => {
    const f = n.callFrame;
    const file = (f.url || "").split("/").slice(-2).join("/");
    return (f.functionName || "(anonymous)") + " @ " + file + ":" + f.lineNumber;
  };
  const bySelfFn = new Map();
  const byFile = new Map();
  for (const [id, ms] of self) {
    const n = nodes.get(id);
    const l = label(n);
    bySelfFn.set(l, (bySelfFn.get(l) || 0) + ms);
    const file = (n.callFrame.url || "(native)").split("/").slice(-3).join("/");
    byFile.set(file, (byFile.get(file) || 0) + ms);
  }
  const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
  console.log("total sampled ms:", sum.toFixed(0));
  console.log("\n== top self time by function ==");
  for (const [l, ms] of top(bySelfFn, 45)) console.log(ms.toFixed(1).padStart(8), l);
  console.log("\n== top self time by file ==");
  for (const [l, ms] of top(byFile, 30)) console.log(ms.toFixed(1).padStart(8), l);
  // total (inclusive) time for a few interesting names
  const byTotalFn = new Map();
  for (const [id, ms] of total) {
    const l = label(nodes.get(id));
    byTotalFn.set(l, Math.max(byTotalFn.get(l) || 0, ms));
  }
  console.log("\n== top inclusive time by function (max over nodes) ==");
  for (const [l, ms] of top(byTotalFn, 60)) console.log(ms.toFixed(1).padStart(8), l);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
