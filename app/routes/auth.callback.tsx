import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";

/**
 * Post-install callback — provisions Automatos workspace and seeds agents.
 *
 * Flow:
 * 1. Shopify OAuth completes → we have access token + shop info
 * 2. Create/find Automatos workspace for this shop
 * 3. Seed Shopify marketplace agents into the workspace
 * 4. Store Shopify credentials for Composio connection
 * 5. Redirect to app dashboard
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Fetch shop info for workspace provisioning
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
    // 1. Provision workspace (idempotent — safe to call on re-install)
    const workspace = await automatosClient.provisionWorkspace(
      session.shop,
      {
        name: shopData.name,
        email: shopData.email,
        plan_name: shopData.plan?.displayName,
        is_dev: shopData.plan?.partnerDevelopment,
        currency: shopData.currencyCode,
        country_code: shopData.billingAddress?.countryCodeV2,
        domain: shopData.primaryDomain?.url,
      }
    );

    // 2. Seed Shopify agents from marketplace catalog
    await automatosClient.seedAgents(workspace.id);

    // 3. Store Shopify access token for API operations
    if (session.accessToken) {
      await automatosClient.storeShopifyCredentials(
        workspace.id,
        session.shop,
        session.accessToken
      );
    }

    console.log(
      `[automatos] Workspace provisioned for ${session.shop}: workspace_id=${workspace.id}`
    );
  } catch (error) {
    // Don't block the install — log and continue.
    // The merchant can re-trigger provisioning from settings.
    console.error(
      `[automatos] Failed to provision workspace for ${session.shop}:`,
      error
    );
  }

  // Redirect to app dashboard
  throw new Response(null, {
    status: 302,
    headers: { Location: "/app" },
  });
};
