import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";

/**
 * Post-install callback — provisions Automatos workspace and stores credentials.
 *
 * Flow:
 * 1. Shopify OAuth completes → we have access token + shop info
 * 2. POST /api/shopify/provision → creates workspace, seeds agents, mints public widget API key
 * 3. POST /api/shopify/connect   → stores Shopify access token for Composio to use
 * 4. Redirect to embedded app
 *
 * Failures are logged but don't block the install — the merchant can
 * re-trigger provisioning from app settings if anything failed.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

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
  const shopData = data?.shop || {};

  try {
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

  throw new Response(null, {
    status: 302,
    headers: { Location: "/app" },
  });
};
