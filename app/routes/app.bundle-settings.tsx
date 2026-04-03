// app/routes/app.bundle-settings.tsx
import { useState } from "react";
import { data, redirect } from "react-router";                    // ✅ was @remix-run/node
import { useLoaderData, useSubmit, useFetcher } from "react-router";          // ✅ was @remix-run/react
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router"; // ✅ new
import { authenticate } from "../shopify.server";
import {
  Page, Card, Layout, TextField, Button, Banner,
  InlineStack, Text, Divider, BlockStack,
} from "@shopify/polaris";
import prisma from "../db.server";


export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const config = await prisma.bundleConfig.findUnique({ where: { shop } });

  return data({
    config: {
      collection_ids: config?.collectionIds
        ? JSON.parse(config.collectionIds)
        : ["", "", ""],
      discount_percentage: config?.discountPercentage ?? 20,
    },
    hasDiscount: !!config?.discountNodeId,
  });
}


export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const collection_ids = [
    formData.get("col1"),
    formData.get("col2"),
    formData.get("col3"),
  ].filter(Boolean) as string[];

  const discount_percentage = parseInt(formData.get("discount_percentage") as string);

  // Get discount node ID from DB
  const config = await prisma.bundleConfig.findUnique({ where: { shop } });

  if (!config?.discountNodeId) {
    return data(
      { error: "Bundle Discount not found. Please click 'Create Bundle Discount Function' first." },
      { status: 400 }
    );
  }

  // Save metafield on discount node
  const result = await admin.graphql(`
    mutation SetMetafield($input: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $input) {
        metafields { key value }
        userErrors { field message }
      }
    }
  `, {
    variables: {
      input: [{
        ownerId: config.discountNodeId,
        namespace: "bundle-discount",
        key: "config",
        type: "json",
        value: JSON.stringify({ collection_ids, discount_percentage }),
      }],
    },
  });

  const resultData = await result.json();
  const userErrors = resultData.data?.metafieldsSet?.userErrors;
  if (userErrors?.length > 0) {
    return data({ error: userErrors[0].message }, { status: 400 });
  }

  // ✅ Also update DB so loader reads correct values on reload
  await prisma.bundleConfig.update({
    where: { shop },
    data: {
      collectionIds: JSON.stringify(collection_ids),
      discountPercentage: discount_percentage,
    },
  });

  return redirect("/app/bundle-settings?saved=true");
}

export default function BundleSettings() {
  const { config, hasDiscount } = useLoaderData<typeof loader>();
  const [cols, setCols] = useState<string[]>(config.collection_ids);
  const [pct, setPct] = useState<string>(String(config.discount_percentage ?? 20));
  const submit = useSubmit();
  const setupFetcher = useFetcher<{ success: boolean; message?: string }>();
  const isSettingUp = setupFetcher.state !== "idle";

  // ✅ Read saved state from URL param instead of local state
  const [searchParams] = useState(() => new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  ));
  const justSaved = searchParams.get("saved") === "true";

  return (
    <Page title="Bundle Discount Settings">
      <Layout>

        {/* Setup Card — only show if no discount created yet */}
        {!hasDiscount && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Initial Setup</Text>
                <Text as="p" tone="subdued">
                  Click below to register the bundle discount function with your store.
                  Only needs to be done once.
                </Text>
                {setupFetcher.data && (
                  <Banner tone={setupFetcher.data.success ? "success" : "critical"}>
                    {setupFetcher.data.success
                      ? "Bundle Discount created successfully! Now save your settings below."
                      : setupFetcher.data.message ?? "Something went wrong."}
                  </Banner>
                )}
                <Button
                  onClick={() => setupFetcher.submit({}, { method: "post", action: "/app/setup" })}
                  loading={isSettingUp}
                  variant="primary"
                >
                  Create Bundle Discount Function
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Settings Card */}
        <Layout.Section>
          {justSaved && (
            <div style={{ marginBottom: "16px" }}>
              <Banner tone="success">
                Settings saved successfully!
              </Banner>
            </div>
          )}

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Bundle Collections</Text>
              <Text as="p" tone="subdued">
                Customer gets {pct}% off when cart contains at least 1 item
                from each collection below.
              </Text>
              <Divider />

              {[0, 1, 2].map((i) => (
                <TextField
                  key={i}
                  label={`Collection ${i + 1} GID`}
                  value={cols[i] ?? ""}
                  onChange={(v) => {
                    const next = [...cols];
                    next[i] = v;
                    setCols(next);
                  }}
                  placeholder="gid://shopify/Collection/123456789"
                  autoComplete="off"
                  helpText="Paste the collection GID from your Shopify admin URL"
                />
              ))}

              {/* ✅ Fixed: constrained width for number input */}
              <div style={{ maxWidth: "160px" }}>
                <TextField
                  label="Discount percentage"
                  type="number"
                  value={pct}
                  onChange={setPct}
                  suffix="%"
                  autoComplete="off"
                  min={1}
                  max={100}
                />
              </div>

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={() => {
                    const fd = new FormData();
                    cols.forEach((c, i) => fd.append(`col${i + 1}`, c));
                    fd.set("discount_percentage", pct);
                    submit(fd, { method: "post" });
                  }}
                >
                  Save Settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* How it works */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">How it works</Text>
              <Text as="p" tone="subdued">
                The function counts the minimum number of complete bundles in
                the cart, then applies the discount to qualifying items.
              </Text>
              <Text as="p" tone="subdued">
                Example: 2 items from each collection = 2× bundle discount.
              </Text>
              <Divider />
              <Text as="p" tone="subdued">
                Discount applies to the lowest-priced items first.
              </Text>
              <Text as="p" fontWeight="semibold">
                ✓ Works on all Shopify plans
              </Text>
              {hasDiscount && (
                <Text as="p" tone="success" fontWeight="semibold">
                  ✓ Bundle discount is active
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}
