# ADR-0002: Free MIT calculation route

- Status: Accepted
- Date: 2026-07-23
- Product: Celestial ASTRO AI

## Context

The previously selected Swiss Ephemeris Professional Licence route requires a
paid licence before proprietary public activation. The licence has not been
purchased.

## Decision

Use the MIT-licensed Astronomy Engine 2.1.19 package as the pinned astronomical
kernel for Celestial Calculation Engine 1.0.0.

The application will:

1. identify the engine, kernel, version, licence, method IDs, and validation
   profile in every calculation receipt;
2. validate planetary longitudes against fixed NASA/JPL Horizons DE441 values;
3. keep sidereal, house, node, and timezone methods versioned separately;
4. avoid Swiss Ephemeris code, branding, and precision claims; and
5. preserve a calculation boundary so a future engine can be introduced under
   a new profile without rewriting the product.

## Consequences

- The proprietary application can continue without a Swiss Ephemeris licence.
- Results remain reproducible and testable.
- The stated accuracy is limited to the MIT kernel's documented target and the
  observed pinned reference set.
- Any future engine change requires a new receipt/profile version and new
  reference fixtures.
