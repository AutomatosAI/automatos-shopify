import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Badge,
  BlockStack,
  Card,
  IndexTable,
  Layout,
  Page,
  Text,
  useIndexResourceState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// TODO: Fetch from Automatos API once workspace provisioning is wired
const SEEDED_AGENTS = [
  { id: "1", name: "Operations Manager", slug: "shopify-ops", role: "Parent", category: "business", status: "active" },
  { id: "2", name: "Support Agent", slug: "shopify-support", role: "Widget", category: "support", status: "active" },
  { id: "3", name: "Product Expert", slug: "shopify-product-expert", role: "Widget", category: "sales", status: "active" },
  { id: "4", name: "Merchandiser", slug: "shopify-merchandiser", role: "Widget", category: "sales", status: "active" },
  { id: "5", name: "Review Analyst", slug: "shopify-review-analyst", role: "Widget", category: "research", status: "active" },
  { id: "6", name: "Gift Concierge", slug: "shopify-gift-concierge", role: "Widget", category: "sales", status: "active" },
  { id: "7", name: "SEO/Content", slug: "shopify-seo-content", role: "Widget", category: "marketing", status: "active" },
  { id: "8", name: "Business Analyst", slug: "shopify-business-analyst", role: "Widget", category: "research", status: "active" },
  { id: "9", name: "Inventory Watchdog", slug: "shopify-inventory-watchdog", role: "Widget", category: "business", status: "active" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { agents: SEEDED_AGENTS };
};

export default function Agents() {
  const { agents } = useLoaderData<typeof loader>();
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(agents);

  const rowMarkup = agents.map((agent, index) => (
    <IndexTable.Row
      id={agent.id}
      key={agent.id}
      selected={selectedResources.includes(agent.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="bold">
          {agent.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{agent.slug}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={agent.role === "Parent" ? "info" : undefined}>
          {agent.role}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{agent.category}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="success">{agent.status}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="AI Agents"
      subtitle="Your Automatos agent team. Each agent powers a specific widget or capability."
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "agent", plural: "agents" }}
              itemCount={agents.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Name" },
                { title: "Slug" },
                { title: "Role" },
                { title: "Category" },
                { title: "Status" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
