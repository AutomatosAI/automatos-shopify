/**
 * Provision + persist — single source of truth for minting an Automatos
 * workspace and caching its public widget key.
 *
 * Called from two places so the behaviour is identical:
 *   1. auth.callback.tsx — on app install (OAuth callback)
 *   2. app.settings.tsx   — merchant clicks "Re-provision" if install failed
 *
 * Persisting the key (Prisma `WorkspaceCredential`) is what lets the embedded
 * admin show the merchant their real ak_pub_ key to paste into the theme
 * App-embed — replacing the developer-only curl step.
 */

import { authenticate } from "./shopify.server";
import { automatosClient, type ProvisionResponse } from "./automatos.server";
import db from "./db.server";

// Derive the admin context type from the configured instance so we don't
// depend on the package's exported type-name (it differs across versions).
type AdminContext = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

const SHOP_INFO_QUERY = `
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
`;

interface ProvisionSession {
  shop: string;
  accessToken?: string;
}

/**
 * Provision the workspace, store the Shopify access token, and cache the
 * minted public key against the shop. Throws on provisioning failure — the
 * caller decides whether to swallow (install) or surface (settings retry).
 */
export async function provisionAndStore(
  admin: AdminContext,
  session: ProvisionSession,
): Promise<ProvisionResponse> {
  const shopResponse = await admin.graphql(SHOP_INFO_QUERY);
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

  await db.workspaceCredential.upsert({
    where: { shop: session.shop },
    update: {
      workspacePublicId: workspace.public_id,
      apiKey: workspace.api_key,
      agentsInstalled: workspace.agents_installed,
    },
    create: {
      shop: session.shop,
      workspacePublicId: workspace.public_id,
      apiKey: workspace.api_key,
      agentsInstalled: workspace.agents_installed,
    },
  });

  return workspace;
}
