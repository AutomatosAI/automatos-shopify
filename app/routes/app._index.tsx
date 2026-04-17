import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  BlockStack,
  Box,
  Card,
  Grid,
  Icon,
  InlineStack,
  Layout,
  Link,
  Page,
  Text,
} from "@shopify/polaris";
import {
  ChatIcon,
  ProductIcon,
  BlogIcon,
  InventoryIcon,
  AnalyticsIcon,
  PersonIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch shop info for dashboard context
  const response = await admin.graphql(`
    query shopInfo {
      shop {
        name
        myshopifyDomain
        plan { displayName }
        currencyCode
      }
    }
  `);

  const { data } = await response.json();

  return {
    shop: data?.shop,
    shopDomain: session.shop,
  };
};

export default function Index() {
  const { shop, shopDomain } = useLoaderData<typeof loader>();

  return (
    <Page title={`Welcome to Automatos AI`}>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Your AI Team is Ready
                </Text>
                <Text as="p" variant="bodyMd">
                  Automatos has set up your AI agent team for{" "}
                  <Text as="span" fontWeight="bold">{shop?.name || shopDomain}</Text>.
                  Your agents are trained on your store data and ready to help
                  with support, product recommendations, content, and operations.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Text as="h2" variant="headingMd">Storefront Widgets</Text>
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
            <WidgetCard
              title="Support Chat"
              description="24/7 AI support answering shopper questions from your policies and product data."
              icon={ChatIcon}
              status="active"
              link="/app/widgets/chat"
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
            <WidgetCard
              title="Product Q&A"
              description="Inline Q&A on product pages. Answers from specs, reviews, and descriptions."
              icon={ProductIcon}
              status="ready"
              link="/app/widgets/product-qa"
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
            <WidgetCard
              title="Blog"
              description="AI-authored blog posts for SEO traffic. Auto-published to your store."
              icon={BlogIcon}
              status="ready"
              link="/app/widgets/blog"
            />
          </Grid.Cell>
        </Grid>

        <Text as="h2" variant="headingMd">Admin Widgets</Text>
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
            <WidgetCard
              title="Daily Brief"
              description="Morning snapshot: sales, traffic, inventory alerts, and recommended actions."
              icon={AnalyticsIcon}
              status="ready"
              link="/app/widgets/daily-brief"
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
            <WidgetCard
              title="Inventory Watchdog"
              description="Stockout alerts, reorder suggestions, and slow-mover flags."
              icon={InventoryIcon}
              status="ready"
              link="/app/widgets/inventory"
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
            <WidgetCard
              title="Review Summarizer"
              description="Honest pros/cons summaries from customer reviews with cited quotes."
              icon={PersonIcon}
              status="coming"
              link="/app/widgets/reviews"
            />
          </Grid.Cell>
        </Grid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Your Agents</Text>
                <Text as="p" variant="bodyMd">
                  Manage the AI agents powering your widgets. Customize their
                  behaviour, train them on your data, or add new specialists.
                </Text>
                <InlineStack gap="200">
                  <Link url="/app/agents">Manage Agents</Link>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function WidgetCard({
  title,
  description,
  icon,
  status,
  link,
}: {
  title: string;
  description: string;
  icon: typeof ChatIcon;
  status: "active" | "ready" | "coming";
  link: string;
}) {
  const statusLabels = {
    active: "Active",
    ready: "Ready to activate",
    coming: "Coming soon",
  };

  const statusTones = {
    active: "success" as const,
    ready: "info" as const,
    coming: "subdued" as const,
  };

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" align="start" blockAlign="center">
          <Icon source={icon} />
          <Text as="h3" variant="headingSm">{title}</Text>
        </InlineStack>
        <Text as="p" variant="bodySm">{description}</Text>
        <Box>
          <Text as="span" variant="bodySm" tone={statusTones[status]}>
            {statusLabels[status]}
          </Text>
        </Box>
        {status !== "coming" && (
          <Link url={link}>Configure</Link>
        )}
      </BlockStack>
    </Card>
  );
}
