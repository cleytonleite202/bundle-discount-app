import type { RunInput, FunctionRunResult } from "../generated/api";

type Configuration = {
  collection_ids: string[];
  discount_percentage: number;
};

export function run(input: RunInput): FunctionRunResult {
  const config: Configuration = JSON.parse(
    input.discountNode.metafield?.value ?? "{}"
  );

  if (!config.collection_ids?.length || !config.discount_percentage) {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  const { collection_ids, discount_percentage } = config;
  const lines = input.cart.lines;

  // Build map: collectionId → lines belonging to it
  const collectionLines = new Map<string, typeof lines>();
  for (const id of collection_ids) {
    collectionLines.set(id, []);
  }

  for (const line of lines) {
    const variant = line.merchandise as any;
    if (!variant?.product?.inCollections) continue;

    for (const membership of variant.product.inCollections) {
      if (membership.isMember && collectionLines.has(membership.collectionId)) {
        collectionLines.get(membership.collectionId)!.push(line);
      }
    }
  }

  // Sort ascending by price (discount cheapest first)
  for (const [id, colLines] of collectionLines) {
    collectionLines.set(
      id,
      [...colLines].sort((a, b) =>
        parseFloat(a.cost.amountPerQuantity.amount) -
        parseFloat(b.cost.amountPerQuantity.amount)
      )
    );
  }

  // Bundle count = min qty across all required collections
  const bundleCount = Math.min(
    ...collection_ids.map((id) =>
      (collectionLines.get(id) ?? []).reduce((sum, l) => sum + l.quantity, 0)
    )
  );

  if (bundleCount === 0) {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  // ✅ Use productVariant targets instead of cartLine
  const targets: { productVariant: { id: string } }[] = [];
  for (const id of collection_ids) {
    let remaining = bundleCount;
    for (const line of collectionLines.get(id)!) {
      if (remaining <= 0) break;
      const variant = line.merchandise as any;
      // Add the variant ID as target
      targets.push({
        productVariant: { id: variant.id },
      });
      remaining -= Math.min(line.quantity, remaining);
    }
  }

  return {
    discounts: [
      {
        targets,
        value: {
          percentage: { value: discount_percentage.toString() },
        },
        message: `Bundle ${discount_percentage}% off`,
      },
    ],
    discountApplicationStrategy: "FIRST",
  };
}