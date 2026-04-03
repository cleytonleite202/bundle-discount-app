import { data } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Step 1 — get function
  const functionsRes = await admin.graphql(`
    {
      shopifyFunctions(first: 25) {
        nodes { id title apiType }
      }
    }
  `);
  const functionsData = await functionsRes.json();
  console.log("FUNCTIONS:", JSON.stringify(functionsData.data.shopifyFunctions.nodes, null, 2));

  const fn = functionsData.data.shopifyFunctions.nodes.find(
    (f: any) => f.title === "bundle-discount" && f.apiType === "order_discounts"
  );

  if (!fn) {
    return data({ success: false, message: "Function not found. Is the app running with shopify app dev?" }, { status: 404 });
  }

  console.log("USING FUNCTION ID:", fn.id);

  const discountTitle = `Bundle Discount ${Date.now()}`;

  // Step 2 — create discount
  const createRes = await admin.graphql(`
    mutation CreateDiscount($functionId: String!, $discountTitle: String!) {
      discountAutomaticAppCreate(automaticAppDiscount: {
        title: $discountTitle
        functionId: $functionId
        startsAt: "2024-01-01T00:00:00Z"
      }) {
        automaticAppDiscount {
          discountId
        }
        userErrors { field message }
      }
    }
  `, { variables: { functionId: fn.id, discountTitle } });

  const createData = await createRes.json();
  console.log("CREATE RESULT:", JSON.stringify(createData, null, 2));

  const errors = createData.data?.discountAutomaticAppCreate?.userErrors;
  if (errors?.length > 0) {
    return data({ success: false, message: errors[0].message, errors }, { status: 400 });
  }

  const discountId = createData.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
  if (!discountId) {
    return data({ success: false, message: "No discountId returned from Shopify" }, { status: 500 });
  }

  console.log("DISCOUNT ID RETURNED:", discountId);

  // discountId is "gid://shopify/DiscountAutomatic/XXXXX"
  // discountNode ID is "gid://shopify/DiscountAutomaticNode/XXXXX" — same number
  const numericId = discountId.split("/").pop();
  const discountNodeId = `gid://shopify/DiscountAutomaticNode/${numericId}`;

  console.log("STORING DISCOUNT NODE ID:", discountNodeId);

  await prisma.bundleConfig.upsert({
    where: { shop },
    create: { shop, discountNodeId },
    update: { discountNodeId },
  });

  return data({ success: true, discountId, discountNodeId });
}

export default function Setup() {
  return null;
}