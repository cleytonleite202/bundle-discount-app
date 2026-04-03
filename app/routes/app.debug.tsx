import { data } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const dbConfig = await prisma.bundleConfig.findUnique({ where: { shop } });

  const functionsRes = await admin.graphql(`
    {
      shopifyFunctions(first: 10) {
        nodes { id title apiType }
      }
    }
  `);
  const functionsData = await functionsRes.json();

  const discountRes = await admin.graphql(`
    {
      automaticDiscountNodes(first: 10) {
        nodes {
          id
          automaticDiscount {
            __typename
            ... on DiscountAutomaticApp {
              title
              status
              appDiscountType {
                functionId
                title
              }
            }
          }
          metafield(namespace: "bundle-discount", key: "config") {
            value
          }
        }
      }
    }
  `);
  const discountData = await discountRes.json();

  let storedNodeLookup = null;
  if (dbConfig?.discountNodeId) {
    const metafieldRes = await admin.graphql(`
      query GetNode($id: ID!) {
        node(id: $id) {
          id
          ... on DiscountAutomaticNode {
            metafield(namespace: "bundle-discount", key: "config") {
              value
            }
            automaticDiscount {
              __typename
              ... on DiscountAutomaticApp {
                title
                status
              }
            }
          }
        }
      }
    `, { variables: { id: dbConfig.discountNodeId } });
    const storedData = await metafieldRes.json();
    storedNodeLookup = storedData.data;
  }

  return data({
    shop,
    dbConfig,
    functions: functionsData.data.shopifyFunctions.nodes,
    discountNodes: discountData.data.automaticDiscountNodes.nodes,
    storedNodeLookup,
  });
}

export default function Debug() {
  const data = useLoaderData<typeof loader>();
  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 12 }}>
      <h2>Bundle Discount Debug</h2>
      <pre style={{ background: "#f4f4f4", padding: 16, overflow: "auto", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}