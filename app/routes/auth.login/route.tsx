import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import {
  AppProvider,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { login, type LoginError } from "../../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = login(request);

  return {
    errors,
    polarisTranslations: require("@shopify/polaris/locales/en.json"),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);

  return {
    errors,
  };
};

export default function Auth() {
  const { polarisTranslations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { errors } = actionData || {};

  return (
    <AppProvider i18n={polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="e.g. my-shop.myshopify.com"
                autoComplete="on"
                error={(errors as LoginError)?.shop}
              />
              <Button submit>Log in</Button>
            </BlockStack>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
