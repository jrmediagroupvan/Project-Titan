import { db } from "@/lib/db";
import materialRates from "@/config/material-rates.json";

export type MaterialRate = (typeof materialRates.materials)[number];

export function materialRateCatalog() {
  return materialRates;
}

export function configuredMaterialRate(materialCode: string) {
  return materialRates.materials.find(
    (material) => material.code.toLowerCase() === materialCode.toLowerCase(),
  );
}

export async function currentMaterialPricing(materialType: string) {
  const latest = await db.materialMarketPrice.findFirst({
    where: { materialType: { equals: materialType, mode: "insensitive" } },
    orderBy: { observedAt: "desc" },
    include: { source: { select: { name: true } } },
  });
  if (latest) return {
    costPerKgCents: Math.round(latest.priceCents * 1000 / latest.spoolGrams),
    source: latest.source.name,
    observedAt: latest.observedAt,
    productUrl: latest.productUrl,
    currency: latest.currency,
    basis: "MARKET" as const,
  };
  const inventory = await db.material.findFirst({
    where: { type: { equals: materialType, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
  });
  if (inventory?.costPerKgCents) return {
    costPerKgCents: inventory.costPerKgCents,
    source: `${inventory.brand||"Inventory"} ${inventory.name}`.trim(),
    observedAt: inventory.updatedAt,
    productUrl: null,
    currency: "CAD",
    basis: "INVENTORY" as const,
  };
  const configured = configuredMaterialRate(materialType);
  return {
    costPerKgCents: configured ? Math.round(configured.marketCostPerKgCad * 100) : 0,
    source: configured ? "Configured material catalog" : "No price source",
    observedAt: null,
    productUrl: null,
    currency: "CAD",
    basis: "CONFIG" as const,
  };
}

export async function currentMaterialCostPerKg(materialType: string) {
  return (await currentMaterialPricing(materialType)).costPerKgCents;
}

export function quoteUnitPrice(baseCostCents: number, markupPercent = 13) {
  return Math.max(0, Math.ceil(baseCostCents * (1 + markupPercent / 100)));
}

export function materialWasteMultiplier(materialCode: string) {
  return 1 + (configuredMaterialRate(materialCode)?.wastePercent ?? 12) / 100;
}

export type QuotePricingInput = {
  costPerKgCents: number;
  gramsPerItem: number;
  minutesPerItem: number;
  quantity: number;
  wasteMultiplier: number;
  hourlyRateCents: number;
  setupFeeCents: number;
  markupPercent: number;
  minimumQuoteCents: number;
};

export function calculateQuotePricing(input: QuotePricingInput) {
  const quantity = Math.max(1, input.quantity);
  const materialCostPerItem = Math.ceil(
    Math.max(0, input.costPerKgCents)
      * Math.max(0, input.gramsPerItem)
      / 1000
      * Math.max(1, input.wasteMultiplier),
  );
  const machineCostPerItem = Math.ceil(
    Math.max(0, input.hourlyRateCents)
      * Math.max(0, input.minutesPerItem)
      / 60,
  );
  const jobBaseCents =
    (materialCostPerItem + machineCostPerItem) * quantity
    + Math.max(0, input.setupFeeCents);
  const automaticJobTotalCents = Math.max(
    Math.max(0, input.minimumQuoteCents),
    quoteUnitPrice(jobBaseCents, input.markupPercent),
  );
  const automaticUnitPriceCents = Math.ceil(automaticJobTotalCents / quantity);

  return {
    materialCostPerItem,
    machineCostPerItem,
    jobBaseCents,
    baseCostPerItemCents: Math.ceil(jobBaseCents / quantity),
    automaticJobTotalCents,
    automaticUnitPriceCents,
  };
}
