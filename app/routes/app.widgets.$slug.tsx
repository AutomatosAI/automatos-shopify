import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useParams } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
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

interface WidgetConfig {
  slug: string;
  name: string;
  enabled: boolean;
  agentId: string;
  theme: string;
  position: string;
  primaryColor: string;
}

const WIDGET_DEFAULTS: Record<string, Partial<WidgetConfig>> = {
  chat: { name: "Support Chat", position: "bottom-right", theme: "light", primaryColor: "#6366f1" },
  "product-qa": { name: "Product Q&A", theme: "light", primaryColor: "#6366f1" },
  blog: { name: "Blog", theme: "light", primaryColor: "#6366f1" },
  "daily-brief": { name: "Daily Brief", theme: "light", primaryColor: "#6366f1" },
  inventory: { name: "Inventory Watchdog", theme: "light", primaryColor: "#6366f1" },
  reviews: { name: "Review Summarizer", theme: "light", primaryColor: "#6366f1" },
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const slug = params.slug || "";
  const defaults = WIDGET_DEFAULTS[slug] || { name: slug };

  // TODO: Load saved config from Automatos API
  return {
    config: {
      slug,
      enabled: false,
      agentId: "",
      theme: "light",
      position: "bottom-right",
      primaryColor: "#6366f1",
      ...defaults,
    } as WidgetConfig,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  // TODO: Save config to Automatos API
  const enabled = formData.get("enabled") === "on";
  const agentId = formData.get("agentId") as string;
  const theme = formData.get("theme") as string;

  return { success: true, message: "Widget configuration saved." };
};

export default function WidgetConfig() {
  const { config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { slug } = useParams();

  return (
    <Page
      title={config.name}
      backAction={{ url: "/app/widgets" }}
      subtitle={`Configure the ${config.name} widget`}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner title="Saved" tone="success" onDismiss={() => {}}>
              {actionData.message}
            </Banner>
          </Layout.Section>
        )}

        <Layout.AnnotatedSection
          title="Widget Settings"
          description="Enable the widget and configure its behaviour."
        >
          <Card>
            <Form method="post">
              <FormLayout>
                <Checkbox
                  label="Enable widget"
                  name="enabled"
                  checked={config.enabled}
                  helpText="Toggle the widget on your storefront"
                />

                <Divider />

                <TextField
                  label="Agent ID"
                  name="agentId"
                  value={config.agentId}
                  autoComplete="off"
                  helpText="The agent powering this widget. Leave blank for default."
                />

                <Select
                  label="Theme"
                  name="theme"
                  value={config.theme}
                  options={[
                    { label: "Light", value: "light" },
                    { label: "Dark", value: "dark" },
                  ]}
                />

                {slug === "chat" && (
                  <Select
                    label="Position"
                    name="position"
                    value={config.position}
                    options={[
                      { label: "Bottom right", value: "bottom-right" },
                      { label: "Bottom left", value: "bottom-left" },
                    ]}
                  />
                )}

                <Button submit variant="primary">Save</Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Installation"
          description="How to add this widget to your storefront."
        >
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Theme Editor (recommended)</Text>
              <Text as="p" variant="bodyMd">
                Go to <strong>Online Store &gt; Customize</strong> and add the{" "}
                <strong>{config.name}</strong> block from the Automatos section.
                Your API key and agent ID are auto-configured.
              </Text>
              <Divider />
              <Text as="h3" variant="headingSm">Manual (script tag)</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                For custom integrations, add to your theme's layout:
              </Text>
              <Card>
                <pre style={{ fontSize: "12px", overflow: "auto" }}>
{`<script src="https://sdk.automatos.app/v1/widget.js" defer></script>
<script>
  AutomatosWidget.init({
    apiKey: 'YOUR_API_KEY',
    widget: '${slug}',
    agentId: '${config.agentId || "AGENT_UUID"}',
  });
</script>`}
                </pre>
              </Card>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}
