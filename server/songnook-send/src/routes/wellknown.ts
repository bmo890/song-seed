/**
 * Universal / App Link association files. Served from the transfer domain so a
 * tap on https://send.songnook.app/t/... opens the app directly when installed.
 *
 * Team ID + Android signing fingerprints come from the app team (brief §6). Until
 * supplied, the files serve with clearly-marked REPLACE_* placeholders so the
 * shape is deployable and reviewable now.
 */
import { Hono } from "hono";
import type { Env } from "../env";

export const wellKnown = new Hono<{ Bindings: Env }>();

const APP_PATHS = ["/t/*"];
const BUNDLE_IDS = ["com.bmostudio.songnook", "com.bmostudio.songnook.dev"];

wellKnown.get("/apple-app-site-association", (c) => {
  const teamId = c.env.APPLE_TEAM_ID || "REPLACE_WITH_APPLE_TEAM_ID";
  const aasa = {
    applinks: {
      apps: [],
      details: BUNDLE_IDS.map((bundle) => ({
        appID: `${teamId}.${bundle}`,
        paths: APP_PATHS,
      })),
    },
  };
  // MUST be application/json and served with no extension.
  return new Response(JSON.stringify(aasa), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
});

wellKnown.get("/assetlinks.json", (c) => {
  const fingerprints = (c.env.ANDROID_CERT_FINGERPRINTS || "REPLACE_WITH_ANDROID_SHA256_FINGERPRINT")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const links = BUNDLE_IDS.filter((b) => !b.endsWith(".dev")).map((pkg) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: pkg,
      sha256_cert_fingerprints: fingerprints,
    },
  }));

  return new Response(JSON.stringify(links), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
});
