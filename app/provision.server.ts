import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { Session } from "@shopify/shopify-api";
import { automatosClient } from "./automatos.server";

/**
 * Install-time provisioning (PRD-183 S6, Flow I).
 *
 * Runs from the `afterAuth` hook (see shopify.server.ts) after every OAuth
 * completion. Idempotent on the shop domain, so re-installs and re-auths are safe.
 *
 * 1. Fetch shop metadata via the Admin GraphQL API.
 * 2. POST /api/verticals/shopify/provision → workspace + agents + public widget API key (S5).
 * 3. POST /api/shopify/connect → store the Shopify access token for Composio.
 *
 * Failures are logged but never thrown — a provisioning hiccup must not block the
 * install. The merchant can re-trigger provisioning from app settings.
 */
export async function provisionShopFromSession(
  session: Session,
  admin: AdminApiContext,
): Promise<void> {
  try {
    const shopResponse = await admin.graphql(`
      query shopInfo {
        shop {
          name
          email
          myshopifyDomain
          plan { displayName partnerDevelopment }
          currencyCode
          primaryDomain { url }
          billingAddress { countryCodeV2 }
        }
      }
    `);
    const { data } = await shopResponse.json();
    const shopData = data?.shop ?? {};

    const workspace = await automatosClient.provisionWorkspace(session.shop, {
      name: shopData.name,
      email: shopData.email,
      plan_name: shopData.plan?.displayName,
      is_dev: shopData.plan?.partnerDevelopment,
      currency: shopData.currencyCode,
      country_code: shopData.billingAddress?.countryCodeV2,
      domain: shopData.primaryDomain?.url,
    });

    if (session.accessToken) {
      await automatosClient.storeShopifyCredentials(
        workspace.public_id,
        session.shop,
        session.accessToken,
      );
    }

    console.log(
      `[automatos] provisioned ${session.shop}: workspace=${workspace.public_id} ` +
        `agents=${workspace.agents_installed} is_new=${workspace.is_new} ` +
        `key_prefix=${workspace.api_key.slice(0, 12)}...`,
    );
  } catch (error) {
    console.error(
      `[automatos] provisioning failed for ${session.shop} — install will continue, retry from app settings:`,
      error,
    );
  }
}
