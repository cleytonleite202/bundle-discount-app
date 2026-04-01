// scripts/create-discount.ts  (run once with: npx ts-node scripts/create-discount.ts)
import { GraphQLClient } from "graphql-request";

const client = new GraphQLClient(
  `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`,
  { headers: { "X-Shopify-Access-Token": process.env.ADMIN_TOKEN! } }
);

const CREATE_DISCOUNT = `
  mutation CreateAutomaticDiscount($discount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $discount) {
      automaticAppDiscount { discountId title }
      userErrors { field message }
    }
  }
`;

await client.request(CREATE_DISCOUNT, {
  discount: {
    title: "Bundle Discount",
    functionId: process.env.FUNCTION_ID,   // from shopify app deploy output
    startsAt: new Date().toISOString(),
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: true,             // free shipping stacks ✓
    },
  },
});