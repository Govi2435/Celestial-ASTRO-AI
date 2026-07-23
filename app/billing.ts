export const BILLING_PROFILE = {
  id: "celestial-billing-p7-v1",
  phase: "P7",
  currency: "INR",
  provider: "provider-neutral",
} as const;

export type SubscriptionStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled" | "expired";
export type PlanId = "free" | "premium-monthly" | "premium-yearly" | "professional";

export type SubscriptionRecord = {
  accountId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingEvent = {
  id: string;
  type: string;
  accountId: string;
  planId?: PlanId;
  occurredAt: string;
  periodEnd?: string | null;
};

export function hasPremiumAccess(subscription: SubscriptionRecord | null, now = new Date()) {
  if (!subscription) return false;
  if (!['trialing', 'active', 'past_due'].includes(subscription.status)) return false;
  if (!subscription.currentPeriodEnd) return subscription.status !== 'past_due';
  const end = new Date(subscription.currentPeriodEnd);
  return !Number.isNaN(end.getTime()) && end.getTime() > now.getTime();
}

export function applyBillingEvent(current: SubscriptionRecord | null, event: BillingEvent): SubscriptionRecord {
  const base: SubscriptionRecord = current ?? {
    accountId: event.accountId,
    planId: event.planId ?? 'free',
    status: 'inactive',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
  if (base.accountId !== event.accountId) throw new Error('Billing event account mismatch.');

  switch (event.type) {
    case 'subscription.trial_started':
      return { ...base, planId: event.planId ?? base.planId, status: 'trialing', currentPeriodEnd: event.periodEnd ?? null };
    case 'subscription.activated':
    case 'invoice.paid':
      return { ...base, planId: event.planId ?? base.planId, status: 'active', currentPeriodEnd: event.periodEnd ?? base.currentPeriodEnd };
    case 'invoice.payment_failed':
      return { ...base, status: 'past_due' };
    case 'subscription.cancel_scheduled':
      return { ...base, cancelAtPeriodEnd: true };
    case 'subscription.canceled':
      return { ...base, status: 'canceled', cancelAtPeriodEnd: false };
    case 'subscription.expired':
      return { ...base, status: 'expired', cancelAtPeriodEnd: false };
    default:
      throw new Error(`Unsupported billing event: ${event.type}`);
  }
}

export function assertPremiumReportEntitlement(subscription: SubscriptionRecord | null, now = new Date()) {
  if (!hasPremiumAccess(subscription, now)) throw new Error('An active premium subscription is required for this report.');
  return true;
}

export function verifyWebhookEnvelope(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) throw new Error('Webhook signature configuration is missing.');
  if (rawBody.length > 1_000_000) throw new Error('Webhook payload is too large.');
  return { rawBody, signature };
}
