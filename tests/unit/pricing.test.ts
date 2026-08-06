import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuotePricing, quoteUnitPrice } from "../../lib/pricing";

test("applies the default 13 percent markup", () => {
  assert.equal(quoteUnitPrice(1000), 1130);
});

test("rounds up to the nearest cent", () => {
  assert.equal(quoteUnitPrice(101, 13), 115);
});

test("never returns a negative price", () => {
  assert.equal(quoteUnitPrice(-100, 13), 0);
});

test("calculates a whole job and applies setup only once", () => {
  const result = calculateQuotePricing({
    costPerKgCents: 2599,
    gramsPerItem: 65,
    minutesPerItem: 60,
    quantity: 2,
    wasteMultiplier: 1.12,
    hourlyRateCents: 300,
    setupFeeCents: 500,
    markupPercent: 13,
    minimumQuoteCents: 1000,
  });
  assert.equal(result.baseCostPerItemCents, 740);
  assert.equal(result.automaticUnitPriceCents, 837);
  assert.equal(result.automaticJobTotalCents, 1673);
});

test("minimum price applies once to the whole quote", () => {
  const result = calculateQuotePricing({
    costPerKgCents: 0,
    gramsPerItem: 0,
    minutesPerItem: 0,
    quantity: 4,
    wasteMultiplier: 1,
    hourlyRateCents: 0,
    setupFeeCents: 0,
    markupPercent: 13,
    minimumQuoteCents: 1000,
  });
  assert.equal(result.automaticJobTotalCents, 1000);
  assert.equal(result.automaticUnitPriceCents, 250);
});
