#!/usr/bin/env node
/**
 * Per-merchant Composio connection: initiate fresh connection against the
 * merchant's auth config, poll for ACTIVE, smoke-test with read-only tools.
 *
 * Required env (.env.local):
 *   COMPOSIO_API_KEY      ak_*
 *   AUTH_CONFIG_ID        ac_*  — per-merchant auth config (from composio-setup.mjs).
 *                                 Falls back to ac_iOROGtpG6qVR (1lovefragrance) if unset.
 *   SHOPIFY_DEV_STORE     subdomain only, no .myshopify.com (e.g. "innobuilduk")
 *   COMPOSIO_ENTITY_ID    workspace public_id from /api/shopify/provision
 *
 * Usage:
 *   node --env-file=.env.local scripts/composio-resume.mjs
 *
 * Toolkit version pinned per gotcha #1 in docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md.
 * Per-merchant auth config requirement per gotcha #9.
 */

import { Composio } from "@composio/core";

const TOOLKIT_VERSION = "20260414_00";
const FALLBACK_AUTH_CONFIG_ID = "ac_iOROGtpG6qVR"; // 1lovefragrance PoC

const {
  COMPOSIO_API_KEY,
  AUTH_CONFIG_ID,
  SHOPIFY_DEV_STORE,
  COMPOSIO_ENTITY_ID,
} = process.env;

const authConfigId = AUTH_CONFIG_ID || FALLBACK_AUTH_CONFIG_ID;

for (const [k, v] of Object.entries({
  COMPOSIO_API_KEY,
  SHOPIFY_DEV_STORE,
  COMPOSIO_ENTITY_ID,
})) {
  if (!v) {
    console.error(`MISSING ENV: ${k}`);
    process.exit(1);
  }
}

if (!AUTH_CONFIG_ID) {
  console.warn(
    `⚠️  AUTH_CONFIG_ID not set — falling back to ${FALLBACK_AUTH_CONFIG_ID} (1lovefragrance PoC). ` +
      `Per-merchant onboarding should set AUTH_CONFIG_ID to the merchant's own ac_* from composio-setup.mjs.`,
  );
}

const composio = new Composio({
  apiKey: COMPOSIO_API_KEY,
  toolkitVersions: { shopify: TOOLKIT_VERSION },
});

const divider = (l) =>
  console.log(`\n─── ${l} ${"─".repeat(Math.max(0, 60 - l.length))}`);

async function main() {
  divider("1. Initiate fresh connection");
  console.log(`Auth config: ${authConfigId}`);
  const connection = await composio.connectedAccounts.initiate(
    COMPOSIO_ENTITY_ID,
    authConfigId,
    {
      config: {
        authScheme: "OAUTH2",
        val: { shop: SHOPIFY_DEV_STORE },
      },
    },
  );
  console.log(JSON.stringify(connection, null, 2));

  divider("2. Authorize");
  const url = connection.redirectUrl || connection.redirect_url;
  console.log(`\n🔗 OPEN THIS URL NOW:\n\n   ${url}\n`);
  console.log(
    "After Shopify install + approve, this script detects ACTIVE and smoke-tests.\n",
  );

  console.log("Polling every 3s (10 min window)...");
  const deadline = Date.now() + 10 * 60 * 1000;
  let active = null;
  let lastStatus = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const status = await composio.connectedAccounts.get(connection.id);
      if (status.status !== lastStatus) {
        console.log(
          `  [${new Date().toISOString().slice(11, 19)}] status=${status.status}`,
        );
        lastStatus = status.status;
      } else {
        process.stdout.write(".");
      }
      if (status.status === "ACTIVE") {
        active = status;
        console.log("\n✅ ACTIVE");
        break;
      }
      if (status.status === "FAILED" || status.status === "EXPIRED") {
        console.error(`\n❌ Connection ${status.status}`);
        console.error(JSON.stringify(status, null, 2));
        process.exit(1);
      }
    } catch (err) {
      console.error("poll err:", err?.message || err);
    }
  }

  if (!active) {
    console.error("\n❌ Timeout waiting for ACTIVE.");
    process.exit(1);
  }

  divider("3a. Smoke test: SHOPIFY_GET_SHOP_DETAILS");
  try {
    const shopDetails = await composio.tools.execute(
      "SHOPIFY_GET_SHOP_DETAILS",
      { userId: COMPOSIO_ENTITY_ID, arguments: {} },
    );
    console.log("✅ shop details OK");
    console.log(JSON.stringify(shopDetails, null, 2));
  } catch (err) {
    console.error("❌ SHOPIFY_GET_SHOP_DETAILS failed:", err?.message || err);
    console.error("Full:", err);
    process.exit(1);
  }

  divider("3b. Smoke test: SHOPIFY_COUNT_PRODUCTS");
  try {
    const productCount = await composio.tools.execute(
      "SHOPIFY_COUNT_PRODUCTS",
      { userId: COMPOSIO_ENTITY_ID, arguments: {} },
    );
    console.log("✅ product count OK");
    console.log(JSON.stringify(productCount, null, 2));
  } catch (err) {
    console.error("❌ SHOPIFY_COUNT_PRODUCTS failed:", err?.message || err);
    console.error("Full:", err);
    process.exit(1);
  }

  divider("DONE 🎉");
  console.log(`auth_config_id:    ${authConfigId}`);
  console.log(`connected_account: ${active.id}`);
  console.log(`entity_id:         ${COMPOSIO_ENTITY_ID}`);
  console.log(`shop:              ${SHOPIFY_DEV_STORE}.myshopify.com`);
  console.log(`toolkit_version:   ${TOOLKIT_VERSION}`);
}

main().catch((err) => {
  console.error("\nFATAL:", err?.message || err);
  if (err?.cause) console.error("Cause:", err.cause?.message || err.cause);
  console.error("\nFull:", err);
  process.exit(1);
});
