# ADR-0005: Explainable interpretation evidence foundation

- Status: Accepted
- Date: 2026-07-23
- Phase: P4 — Explainable AI and creative chart experiences

## Context

Celestial ASTRO AI must never turn a calculated chart into generic, random, or
untraceable prose. P2 certified the calculation layer and P3 changed only its
presentation. P4 therefore needs an interpretation contract before any
open-ended model is connected.

## Decision

Add a separate deterministic interpretation layer identified as
`celestial-interpretation-p4-v1`.

Every interpretation record must include:

1. an approved, versioned rule ID;
2. one or more visible calculated or derived chart factors;
3. a source path for every evidence value;
4. a supported or limited confidence state;
5. a plain-language limitation;
6. a link to the chart's Calculation Receipt.

Calculated facts, deterministic rules, traditional interpretations, and
limitations remain visibly distinct. The P2 calculation engine, engine profile,
receipt schema, reference fixtures, and certification tolerances are unchanged.

## Birth-time policy

- Exact time: show interpretations supported by the calculated chart.
- Approximate time: mark an interpretation limited when its Ascendant, Moon,
  Nakshatra, or planetary house factor changes within the declared uncertainty
  window.
- Unknown time: suppress Ascendant, house, and exact Dasha interpretations.
  Never invent a time to complete a reading.

## Language policy

Interpretations use non-deterministic wording such as “traditionally read” and
“traditionally used to discuss.” They must not promise events, create fear,
state scientific validity, or provide medical, legal, financial, or
mental-health certainty.

## AI gate

Open-ended Ask My Chart answers remain disabled in this foundation release.
Future model output may ship only when it is constrained to the P4 evidence
schema, rejects unsupported claims, exposes cited chart factors, and passes
grounding tests.

## Consequences

- Customers can inspect why each interpretation appears.
- Unknown or unstable data produces visible limitations rather than false
  precision.
- Future AI and creative experiences have a machine-readable grounding
  contract.
- Interpretation vocabulary and rules require versioned review and regression
  coverage.

