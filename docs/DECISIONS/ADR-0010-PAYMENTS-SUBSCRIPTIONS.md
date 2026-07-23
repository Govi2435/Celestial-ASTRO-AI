# ADR-0010: Payments, premium reports, and subscriptions

- Status: Accepted
- Phase: P7
- Profile: `celestial-billing-p7-v1`

## Decision

Billing is provider-neutral at the domain layer. Provider SDK objects must be translated into a small internal event model before changing entitlements. Webhook events are stored idempotently by provider event ID and payload hash.

Premium report access is granted only by an active or trialing subscription whose entitlement window has not expired. A temporary past-due grace window may be honored only while the recorded period remains valid. Cancellation scheduling does not immediately remove paid access; cancellation or expiry does.

Raw card details are never accepted or stored by Celestial ASTRO AI. Checkout and payment-method collection must be hosted or tokenized by the configured payment provider.

## Activation gate

Live checkout remains blocked until provider credentials, verified webhook signatures, product/price IDs, tax configuration, refund policy, invoice support, customer portal, rate limiting, and end-to-end sandbox tests are configured.
