#!/usr/bin/env node
/**
 * PRD-004 spike — Composio token-import API exploration.
 *
 * Goal: determine whether the Composio SDK accepts a *pre-obtained* OAuth
 * access token to create a `connected_account` without bouncing the user
 * through a hosted OAuth flow. If yes, we can collapse the Shopify App
 * Store install → Composio-connected flow into one transparent step.
 *
 * This script:
 *   1. Enumerates methods on `composio.connectedAccounts` (detects SDK surface).
 *   2. Attempts `.create()` with credentials shape based on SDK docs.
 *   3. Falls back to `.initiate()` with a `noRedirect: true` / `skipOauth: true`
 *      style flag if such a thing exists.
 *   4. Reports exactly what worked, what didn't, and what the returned object
 *      looked like so PRD-004 can be updated with the confirmed API.
 *
 * Non-destructive: it tries to create a connection, but you can point it at a
 * throwaway dev-store token. If it succeeds, delete the resulting connected
 * account afterwards via Composio dashboard.
 *
 * Usage:
 *   nvm use 20
 *   node --env-file=.env.local scripts/composio-token-import-spike.mjs
 *
 * Required env (in .env.local):
 *   COMPOSIO_API_KEY=ak_...
 *   COMPOSIO_ENTITY_ID=<any test workspace public_id>
 *   SHOPIFY_ACCESS_TOKEN=shpua_...   (pre-obtained from a test store; rotate after)
 *   SHOPIFY_SHOP_DOMAIN=teststore.myshopify.com
 *
 * Optional env:
 *   COMPOSIO_AUTH_CONFIG_ID=ac_...   (reuse existing; otherwise script will reuse the SHOPIFY default or create one)
 */

import { Composio } from "@composio/core";

const env = process.env;

const required = [
  "COMPOSIO_API_KEY",
  "COMPOSIO_ENTITY_ID",
  "SHOPIFY_ACCESS_TOKEN",
  "SHOPIFY_SHOP_DOMAIN",
];
for (const key of required) {
  if (!env[key]) {
    console.error(`MISSING ENV: ${key}`);
    process.exit(1);
  }
}

const composio = new Composio({
  apiKey: env.COMPOSIO_API_KEY,
  toolkitVersions: { shopify: "20260414_00" },
});

const section = (title) =>
  console.log(`\n──── ${title} ${"─".repeat(Math.max(0, 70 - title.length))}`);

const safe = async (label, fn) => {
  try {
    const result = await fn();
    console.log(`✅ ${label}:`, typeof result === "object" ? JSON.stringify(result, null, 2) : result);
    return { ok: true, result };
  } catch (err) {
    console.log(`❌ ${label}: ${err?.message || err}`);
    if (err?.meta) console.log(`   meta:`, JSON.stringify(err.meta, null, 2));
    if (err?.cause?.message) console.log(`   cause: ${err.cause.message}`);
    return { ok: false, err };
  }
};

async function main() {
  section("0. SDK surface introspection");
  const caMethods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(composio.connectedAccounts)
  ).filter((m) => typeof composio.connectedAccounts[m] === "function" && m !== "constructor");
  console.log("composio.connectedAccounts methods:", caMethods);

  section("1. Resolve auth config");
  let authConfigId = env.COMPOSIO_AUTH_CONFIG_ID;
  if (!authConfigId) {
    console.log("No COMPOSIO_AUTH_CONFIG_ID provided; listing SHOPIFY auth configs…");
    const { ok, result } = await safe("authConfigs.list({ toolkit: 'SHOPIFY' })", () =>
      composio.authConfigs.list({ toolkit: "SHOPIFY" })
    );
    if (ok && result?.items?.length) {
      authConfigId = result.items[0].id;
      console.log(`Using existing auth config: ${authConfigId}`);
    } else {
      console.error("No existing Shopify auth config and none supplied. Run composio-setup.mjs first.");
      process.exit(1);
    }
  }
  console.log(`auth_config_id = ${authConfigId}`);

  section("2. Try `connectedAccounts.create` with pre-obtained token");
  // Guess A: SDK v3 shape from docs — `create(userId, authConfigId, { data })`
  const createAttempts = [
    {
      label: "create({ entityId, authConfigId, credentials })",
      call: () =>
        composio.connectedAccounts.create({
          entityId: env.COMPOSIO_ENTITY_ID,
          authConfigId,
          credentials: {
            access_token: env.SHOPIFY_ACCESS_TOKEN,
            shop: env.SHOPIFY_SHOP_DOMAIN,
          },
          status: "ACTIVE",
        }),
    },
    {
      label: "create(userId, authConfigId, { credentials })",
      call: () =>
        composio.connectedAccounts.create(
          env.COMPOSIO_ENTITY_ID,
          authConfigId,
          {
            credentials: {
              access_token: env.SHOPIFY_ACCESS_TOKEN,
              shop: env.SHOPIFY_SHOP_DOMAIN,
            },
          }
        ),
    },
    {
      label: "create({ userId, authConfigId, data })",
      call: () =>
        composio.connectedAccounts.create({
          userId: env.COMPOSIO_ENTITY_ID,
          authConfigId,
          data: {
            access_token: env.SHOPIFY_ACCESS_TOKEN,
            shop: env.SHOPIFY_SHOP_DOMAIN,
          },
        }),
    },
  ];

  let createdAccount = null;
  for (const attempt of createAttempts) {
    const { ok, result } = await safe(attempt.label, attempt.call);
    if (ok) {
      createdAccount = result;
      console.log("🎉 Token-import via .create() is SUPPORTED with this shape.");
      break;
    }
  }

  if (!createdAccount) {
    section("3. Fallback: try `.initiate` with no-redirect flags");
    const initiateAttempts = [
      {
        label: "initiate(userId, authConfigId, { config: { authScheme, val: { accessToken, shop } } })",
        call: () =>
          composio.connectedAccounts.initiate(
            env.COMPOSIO_ENTITY_ID,
            authConfigId,
            {
              config: {
                authScheme: "OAUTH2",
                val: {
                  accessToken: env.SHOPIFY_ACCESS_TOKEN,
                  access_token: env.SHOPIFY_ACCESS_TOKEN,
                  shop: env.SHOPIFY_SHOP_DOMAIN,
                },
              },
            }
          ),
      },
      {
        label: "initiate(userId, authConfigId, { credentials, skipOauth: true })",
        call: () =>
          composio.connectedAccounts.initiate(
            env.COMPOSIO_ENTITY_ID,
            authConfigId,
            {
              credentials: {
                access_token: env.SHOPIFY_ACCESS_TOKEN,
                shop: env.SHOPIFY_SHOP_DOMAIN,
              },
              skipOauth: true,
            }
          ),
      },
    ];

    for (const attempt of initiateAttempts) {
      const { ok, result } = await safe(attempt.label, attempt.call);
      if (ok) {
        // If it returned a redirectUrl it's still a hosted OAuth — not what we want.
        if (result?.redirectUrl || result?.redirect_url) {
          console.log("⚠️  initiate() returned a redirectUrl — this is NOT a silent import.");
        } else if (result?.status === "ACTIVE") {
          createdAccount = result;
          console.log("🎉 Token-import via .initiate() is SUPPORTED silently.");
          break;
        } else {
          console.log(`ℹ️  initiate() returned status=${result?.status} — not ACTIVE, treating as non-silent.`);
        }
      }
    }
  }

  section("4. Verification");
  if (createdAccount) {
    const id = createdAccount.id || createdAccount.connectionId;
    console.log(`Created connected_account: ${id}`);
    await safe("connectedAccounts.get(id)", () =>
      composio.connectedAccounts.get(id)
    );
    await safe("tools.execute SHOPIFY_GET_SHOP_DETAILS", () =>
      composio.tools.execute("SHOPIFY_GET_SHOP_DETAILS", {
        userId: env.COMPOSIO_ENTITY_ID,
        arguments: {},
        version: "20260414_00",
      })
    );
    console.log(`\nClean up: delete ${id} from Composio dashboard when done.`);
  } else {
    console.log("\n❌ No working token-import path found via the attempted shapes.");
    console.log("   → PRD-004 must take the fallback path: server-side silent OAuth by");
    console.log("     re-using the merchant's active Shopify session to auto-approve");
    console.log("     the Composio hosted flow invisibly in a server-side fetch.");
  }

  section("5. Summary for PRD-004");
  console.log("Record in PRD-004 under 'Spike result':");
  console.log(" - SDK method that worked (or confirmed none did):", createdAccount ? "see above" : "NONE");
  console.log(" - Exact argument shape:", createdAccount ? "see step 2/3 logs" : "N/A");
  console.log(" - Returned object fields:", createdAccount ? Object.keys(createdAccount).join(", ") : "N/A");
}

main().catch((err) => {
  console.error("\nFATAL:", err?.message || err);
  if (err?.cause) console.error("Cause:", err.cause?.message || err.cause);
  console.error("Full:", err);
  process.exit(1);
});
