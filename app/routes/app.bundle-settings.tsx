// app/routes/app.bundle-settings.tsx
import { useState } from "react";
import { data, redirect } from "react-router";                    // ✅ was @remix-run/node
import { useLoaderData, useSubmit } from "react-router";          // ✅ was @remix-run/react
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router"; // ✅ new
import { authenticate } from "../shopify.server";
import {
  Page, Card, Layout, TextField, Button, Banner,
  InlineStack, Text, Divider, BlockStack,
} from "@shopify/polaris";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(`
    query {
      shop {
        metafield(namespace: "bundle-discount", key: "config") {
          value
        }
      }
    }
  `);
  const result = await res.json();
  const raw = result?.data?.shop?.metafield?.value;
  const config = raw
    ? JSON.parse(raw)
    : { collection_ids: ["", "", ""], discount_percentage: 20 };

  return data({ config });                                         // ✅ was json()
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const collection_ids = [
    formData.get("col1"),
    formData.get("col2"),
    formData.get("col3"),
  ].filter(Boolean) as string[];

  const discount_percentage = parseInt(
    formData.get("discount_percentage") as string
  );

  // Step 1 — find the existing automatic discount node
  const discountRes = await admin.graphql(`
    {
      automaticDiscountNodes(first: 10) {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticApp {
              title
            }
          }
        }
      }
    }
  `);
  const discountData = await discountRes.json();
  const discountNode = discountData.data.automaticDiscountNodes.nodes.find(
    (n: any) => n.automaticDiscount?.title === "Bundle Discount"
  );

  if (!discountNode) {
    return data({ error: "Bundle Discount not found. Please create it first." }, { status: 400 });
  }

  // Step 2 — save config metafield on the discount node
  await admin.graphql(`
    mutation SetMetafield($input: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $input) {
        metafields { key value }
        userErrors { field message }
      }
    }
  `, {
    variables: {
      input: [{
        ownerId: discountNode.id,                          // ✅ discount node, not shop
        namespace: "bundle-discount",
        key: "config",
        type: "json",
        value: JSON.stringify({ collection_ids, discount_percentage }),
      }],
    },
  });

  return redirect("/app/bundle-settings?saved=true");
}

export default function BundleSettings() {
  const { config } = useLoaderData<typeof loader>();
  const [cols, setCols] = useState<string[]>(config.collection_ids);
  const [pct, setPct] = useState<string>(
    String(config.discount_percentage ?? 20)
  );
  const [saved, setSaved] = useState(false);
  const submit = useSubmit();

  return (
    <Page title="Bundle Discount Settings">
      <Layout>
        <Layout.Section>
          {saved && (
            <Banner tone="success" onDismiss={() => setSaved(false)}>
              Settings saved successfully!
            </Banner>
          )}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Bundle collections
              </Text>
              <Text as="p" tone="subdued">
                Customer gets {pct}% off when cart has at least 1 item from
                each collection below.
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
              <TextField
                label="Discount percentage"
                type="number"
                value={pct}
                onChange={setPct}
                suffix="%"
                autoComplete="off"
              />
              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={() => {
                    const fd = new FormData();
                    cols.forEach((c, i) => fd.append(`col${i + 1}`, c));
                    fd.set("discount_percentage", pct);
                    submit(fd, { method: "post" });
                    setSaved(true);
                  }}
                >
                  Save settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">How it works</Text>
              <Text as="p" tone="subdued">
                The function counts the minimum number of complete bundles in
                the cart, then discounts the lowest-priced qualifying items.
              </Text>
              <Text as="p" tone="subdued">
                Example: 2 jeans + 2 tops + 2 sneakers = 2× bundle discount.
              </Text>
              <Text as="p" tone="success" fontWeight="semibold">✓ Works on all Shopify plans</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}