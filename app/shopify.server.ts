import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  type LoginError as LoginErrorShape,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-04";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  restResources,
  hooks: {
    // Runs after every OAuth completion. (Re-)registers the app-specific
    // webhook subscriptions declared in shopify.app.toml so the catalog + GDPR
    // URIs actually resolve.
    //
    // Install-time provisioning (mint widget key, store Shopify token, cache
    // the key for Settings) happens once in auth.callback.tsx via
    // provisionAndStore — do NOT provision here as well or the shop would be
    // double-provisioned.
    afterAuth: async ({ session }) => {
      await shopify.registerWebhooks({ session });
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.April25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
export type LoginError = LoginErrorShape;
