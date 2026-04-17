import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  Grid,
  Icon,
  InlineStack,
  Layout,
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
  GiftCardIcon,
  SearchIcon,
  CartIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

interface WidgetDef {
  slug: string;
  name: string;
  description: string;
  icon: typeof ChatIcon;
  surface: "storefront" | "admin";
  tier: 1 | 2 | 3;
  agent: string;
  status: "active" | "available" | "coming";
}

const WIDGETS: WidgetDef[] = [
  // Tier 1 — Storefront
  { slug: "chat", name: "Support Chat", description: "Floating chat button answering shopper questions 24/7", icon: ChatIcon, surface: "storefront", tier: 1, agent: "shopify-support", status: "available" },
  { slug: "product-qa", name: "Product Q&A", description: "Inline Q&A on product pages from specs and reviews", icon: ProductIcon, surface: "storefront", tier: 1, agent: "shopify-product-expert", status: "available" },
  { slug: "blog", name: "Blog", description: "AI-authored blog posts for organic SEO traffic", icon: BlogIcon, surface: "storefront", tier: 1, agent: "shopify-seo-content", status: "available" },
  // Tier 1 — Admin
  { slug: "daily-brief", name: "Daily Brief", description: "Morning snapshot of sales, traffic, and alerts", icon: AnalyticsIcon, surface: "admin", tier: 1, agent: "shopify-business-analyst", status: "available" },
  { slug: "inventory", name: "Inventory Watchdog", description: "Stockout alerts and reorder suggestions", icon: InventoryIcon, surface: "admin", tier: 1, agent: "shopify-inventory-watchdog", status: "available" },
  // Tier 2
  { slug: "reviews", name: "Review Summarizer", description: "Honest pros/cons from customer reviews", icon: PersonIcon, surface: "storefront", tier: 2, agent: "shopify-review-analyst", status: "coming" },
  { slug: "gift-finder", name: "Gift Finder Quiz", description: "Conversational quiz matching shoppers to gifts", icon: GiftCardIcon, surface: "storefront", tier: 2, agent: "shopify-gift-concierge", status: "coming" },
  { slug: "shopper", name: "Conversational Shopper", description: "Natural language product discovery", icon: SearchIcon, surface: "storefront", tier: 2, agent: "shopify-merchandiser", status: "coming" },
  { slug: "cart-save", name: "Save the Sale", description: "Exit-intent agent recovering abandoned carts", icon: CartIcon, surface: "storefront", tier: 2, agent: "shopify-support", status: "coming" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { widgets: WIDGETS };
};

export default function Widgets() {
  const { widgets } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const storefront = widgets.filter((w) => w.surface === "storefront");
  const admin = widgets.filter((w) => w.surface === "admin");

  return (
    <Page
      title="Widgets"
      subtitle="Drop AI-powered widgets into your storefront and admin."
    >
      <BlockStack gap="500">
        <Text as="h2" variant="headingMd">Storefront Widgets</Text>
        <Grid>
          {storefront.map((w) => (
            <Grid.Cell key={w.slug} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
              <WidgetTile widget={w} onConfigure={() => navigate(`/app/widgets/${w.slug}`)} />
            </Grid.Cell>
          ))}
        </Grid>

        <Text as="h2" variant="headingMd">Admin Widgets</Text>
        <Grid>
          {admin.map((w) => (
            <Grid.Cell key={w.slug} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
              <WidgetTile widget={w} onConfigure={() => navigate(`/app/widgets/${w.slug}`)} />
            </Grid.Cell>
          ))}
        </Grid>
      </BlockStack>
    </Page>
  );
}

function WidgetTile({ widget, onConfigure }: { widget: WidgetDef; onConfigure: () => void }) {
  const toneMap = {
    active: "success" as const,
    available: "info" as const,
    coming: "subdued" as const,
  };

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={widget.icon} />
            <Text as="h3" variant="headingSm">{widget.name}</Text>
          </InlineStack>
          <Badge tone={toneMap[widget.status]}>
            {widget.status === "active" ? "Active" : widget.status === "available" ? "Available" : "Coming"}
          </Badge>
        </InlineStack>
        <Text as="p" variant="bodySm">{widget.description}</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Agent: {widget.agent}
        </Text>
        {widget.status !== "coming" && (
          <Button onClick={onConfigure} size="slim">
            Configure
          </Button>
        )}
      </BlockStack>
    </Card>
  );
}
