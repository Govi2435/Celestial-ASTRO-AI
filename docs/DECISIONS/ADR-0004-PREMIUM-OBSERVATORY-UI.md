# ADR-0004: Premium Celestial Observatory interface

Status: Accepted
Date: 2026-07-23

## Decision

Celestial ASTRO AI uses a premium observatory visual system instead of the
common neon astrology aesthetic.

The interface combines:

- midnight navy foundations;
- warm ivory text;
- antique-gold calculation accents;
- restrained indigo and cyan instrument lighting;
- Cinzel display typography with Manrope interface text;
- subtle grid, orbit, and constellation geometry; and
- a chart-first information hierarchy inspired by scientific instruments and
  modern financial dashboards.

## Trust hierarchy

The first viewport must communicate, in order:

1. the product calculates rather than invents;
2. the engine and internal reference-validation record are visible;
3. current calculation routes do not persist birth data;
4. the calculator is the primary action; and
5. methodology and internal validation remain directly inspectable.

## Accessibility rules

- Keyboard focus remains visible on every interactive control.
- Important interface copy is not rendered at decorative micro-text sizes.
- Mobile form controls use a readable input size.
- Motion stops when reduced-motion is requested.
- The page includes a skip link and polite result announcements.

## Consequences

- P3 changes presentation only; P2 engine behavior and fixtures remain frozen.
- Decorative orbital motion cannot communicate essential information.
- Future customer-facing pages should reuse this observatory system.
