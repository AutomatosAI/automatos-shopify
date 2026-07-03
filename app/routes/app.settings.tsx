import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Divider,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { provisionAndStore } from "../provision.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const credential = await db.workspaceCredential.findUnique({
    where: { shop: session.shop },
  });

  return {
    provisioned: Boolean(credential),
    apiKey: credential?.apiKey ?? null,
    workspacePublicId: credential?.workspacePublicId ?? null,
    agentsInstalled: credential?.agentsInstalled ?? 0,
    settings: {
      defaultModel: "claude-sonnet-4",
      theme: "auto",
      badgePosition: "bottom-right",
      language: "en",
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "reprovision") {
    try {
      await provisionAndStore(admin, session);
      return { intent: "reprovision", ok: true, error: null };
    } catch (error) {
      console.error(`[automatos] re-provision failed for ${session.shop}:`, error);
      return {
        intent: "reprovision",
        ok: false,
        error: "Provisioning failed. Try again, or contact support if it persists.",
      };
    }
  }

  // Appearance / model selections are not yet persisted server-side.
  return { intent: "settings", ok: true, error: null };
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export default function Settings() {
  const { provisioned, apiKey, workspacePublicId, agentsInstalled, settings } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page title="Settings">
      <Layout>
        <Layout.AnnotatedSection
          title="Widget Appearance"
          description="Configure how Automatos widgets look on your storefront."
        >
          <Card>
            <Form method="post">
              <FormLayout>
                <Select
                  label="Theme"
                  name="theme"
                  options={[
                    { label: "Auto (match store theme)", value: "auto" },
                    { label: "Light", value: "light" },
                    { label: "Dark", value: "dark" },
                  ]}
                  value={settings.theme}
                />
                <Select
                  label="Chat position"
                  name="badgePosition"
                  options={[
                    { label: "Bottom right", value: "bottom-right" },
                    { label: "Bottom left", value: "bottom-left" },
                  ]}
                  value={settings.badgePosition}
                />
                <Select
                  label="Language"
                  name="language"
                  options={[
                    { label: "English", value: "en" },
                    { label: "French", value: "fr" },
                    { label: "German", value: "de" },
                    { label: "Spanish", value: "es" },
                  ]}
                  value={settings.language}
                />
                <Button submit>Save</Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="AI Model"
          description="Choose the AI model powering your agents. Higher-tier models provide better quality at higher cost."
        >
          <Card>
            <Form method="post">
              <FormLayout>
                <Select
                  label="Default model"
                  name="defaultModel"
                  options={[
                    { label: "Claude Sonnet 4 (recommended)", value: "claude-sonnet-4" },
                    { label: "Claude Haiku 4.5 (faster, cheaper)", value: "claude-haiku-4.5" },
                    { label: "GPT-4o", value: "gpt-4o" },
                  ]}
                  value={settings.defaultModel}
                />
                <Button submit>Save</Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="API Key"
          description="Paste this public key into the Automatos app-embed in your theme editor to activate the widget on your storefront."
        >
          <Card>
            <BlockStack gap="300">
              {actionData?.intent === "reprovision" && actionData.ok ? (
                <Banner tone="success" title="Workspace provisioned. Your API key is ready below." />
              ) : null}
              {actionData?.intent === "reprovision" && actionData.error ? (
                <Banner tone="critical" title="Provisioning failed">
                  <Text as="p" variant="bodyMd">
                    {actionData.error}
                  </Text>
                </Banner>
              ) : null}

              {provisioned && apiKey ? (
                <>
                  <TextField
                    label="Public API Key"
                    value={apiKey}
                    readOnly
                    autoComplete="off"
                    connectedRight={<CopyButton value={apiKey} />}
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    Safe to expose in your storefront — it can only start widget chat
                    sessions, not admin operations.
                  </Text>
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {agentsInstalled} agent{agentsInstalled === 1 ? "" : "s"} installed
                      {workspacePublicId ? ` · workspace ${workspacePublicId}` : ""}
                    </Text>
                    <Form method="post">
                      <input type="hidden" name="intent" value="reprovision" />
                      <Button submit variant="plain">
                        Re-provision
                      </Button>
                    </Form>
                  </InlineStack>
                </>
              ) : (
                <Banner tone="warning" title="Not provisioned yet">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                      Your Automatos workspace hasn&rsquo;t been set up yet. This
                      normally happens automatically when you install the app — click
                      below to retry.
                    </Text>
                    <Form method="post">
                      <input type="hidden" name="intent" value="reprovision" />
                      <Button submit variant="primary">
                        Provision now
                      </Button>
                    </Form>
                  </BlockStack>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Subscription"
          description="Manage your Automatos subscription and usage."
        >
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">Current plan</Text>
                <Text as="span" variant="bodyMd" fontWeight="bold">Starter</Text>
              </InlineStack>
              <Divider />
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">Interactions this month</Text>
                <Text as="span" variant="bodyMd">0 / 10,000</Text>
              </InlineStack>
              <Divider />
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">Active widgets</Text>
                <Text as="span" variant="bodyMd">0 / 3</Text>
              </InlineStack>
              <Button url="/app/billing">Manage subscription</Button>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}
