import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import {
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // TODO: Load from Automatos API
  return {
    settings: {
      apiKey: "ak_pub_••••••••",
      defaultModel: "claude-sonnet-4",
      theme: "auto",
      badgePosition: "bottom-right",
      language: "en",
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  // TODO: Save to Automatos API
  const theme = formData.get("theme") as string;
  const position = formData.get("badgePosition") as string;

  return { success: true };
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
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
          description="Your public API key for widget initialization. This is automatically configured in your theme extension."
        >
          <Card>
            <BlockStack gap="200">
              <TextField
                label="Public API Key"
                value={settings.apiKey}
                readOnly
                autoComplete="off"
              />
              <Text as="p" variant="bodySm" tone="subdued">
                This key is safe to expose in your storefront. It can only be used
                for widget chat sessions, not admin operations.
              </Text>
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
