#!/usr/bin/env node
/**
 * Safe introspection of the @composio/core SDK surface.
 *
 * Runs without a Shopify access token — only probes method names and lists
 * existing auth configs so PRD-004's spike can be scoped with confidence.
 *
 * Usage:
 *   nvm use 20
 *   node --env-file=.env.local scripts/composio-surface-probe.mjs
 */

import { Composio } from "@composio/core";

const { COMPOSIO_API_KEY } = process.env;
if (!COMPOSIO_API_KEY) {
  console.error("MISSING ENV: COMPOSIO_API_KEY");
  process.exit(1);
}

const composio = new Composio({
  apiKey: COMPOSIO_API_KEY,
  toolkitVersions: { shopify: "20260414_00" },
});

const methodsOf = (obj) =>
  Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
    .filter((m) => typeof obj[m] === "function" && m !== "constructor")
    .sort();

const section = (label) =>
  console.log(`\n──── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`);

async function main() {
  section("connectedAccounts methods");
  console.log(methodsOf(composio.connectedAccounts));

  section("authConfigs methods");
  console.log(methodsOf(composio.authConfigs));

  section("tools methods");
  console.log(methodsOf(composio.tools));

  section("toolkits methods");
  console.log(methodsOf(composio.toolkits));

  section("Existing SHOPIFY auth configs");
  try {
    const configs = await composio.authConfigs.list({ toolkit: "SHOPIFY" });
    console.log(JSON.stringify(configs, null, 2));
  } catch (err) {
    console.log("list({toolkit:'SHOPIFY'}) failed:", err?.message || err);
    console.log("Retrying with no filter…");
    try {
      const all = await composio.authConfigs.list({});
      const shopify = (all.items || all).filter?.(
        (c) => c.toolkit === "shopify" || c.toolkit?.slug === "shopify"
      );
      console.log("Shopify-tagged entries:", JSON.stringify(shopify, null, 2));
    } catch (err2) {
      console.log("fallback also failed:", err2?.message || err2);
    }
  }
}

main().catch((err) => {
  console.error("FATAL:", err?.message || err);
  if (err?.cause) console.error("Cause:", err.cause?.message || err.cause);
  process.exit(1);
});
