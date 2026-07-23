import assert from "node:assert/strict";
import test from "node:test";
import { applyBillingEvent, assertPremiumReportEntitlement, hasPremiumAccess } from "../app/billing.ts";

test("paid invoice activates premium access", () => {
  const subscription = applyBillingEvent(null, {
    id: "evt_1",
    type: "invoice.paid",
    accountId: "acct_1",
    planId: "premium-monthly",
    occurredAt: "2026-07-23T00:00:00Z",
    periodEnd: "2026-08-23T00:00:00Z",
  });
  assert.equal(hasPremiumAccess(subscription, new Date("2026-07-24T00:00:00Z")), true);
  assert.equal(assertPremiumReportEntitlement(subscription, new Date("2026-07-24T00:00:00Z")), true);
});

test("expired or canceled subscriptions lose access", () => {
  const expired = {
    accountId: "acct_1",
    planId: "premium-monthly" as const,
    status: "expired" as const,
    currentPeriodEnd: "2026-07-01T00:00:00Z",
    cancelAtPeriodEnd: false,
  };
  assert.equal(hasPremiumAccess(expired, new Date("2026-07-24T00:00:00Z")), false);
  assert.throws(() => assertPremiumReportEntitlement(expired), /active premium/);
});

test("billing events cannot cross account boundaries", () => {
  assert.throws(
    () => applyBillingEvent({ accountId: "acct_a", planId: "free", status: "inactive", currentPeriodEnd: null, cancelAtPeriodEnd: false }, {
      id: "evt_2", type: "subscription.activated", accountId: "acct_b", planId: "premium-yearly", occurredAt: "2026-07-23T00:00:00Z",
    }),
    /mismatch/,
  );
});
