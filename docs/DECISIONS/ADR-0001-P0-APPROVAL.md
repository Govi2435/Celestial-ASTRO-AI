# ADR-0001: P0 Approval and Swiss Ephemeris Licensing Route

Status: **Accepted**  
Decision date: **2026-07-23**  
Decision owner: **Govinda Prajapati**

## Context

Celestial ASTRO AI requires a stable trust contract before professional
calculation-engine work, customer-facing interpretations, AI explanations, or
commercial features are expanded.

Swiss Ephemeris is available under AGPL or a Professional Licence. The project
is intended to support a commercial product without requiring the complete
product to adopt AGPL solely because of the ephemeris integration.

## Decision

1. Approve P0 Trust Contract v1.0.
2. Approve the Evidence and Language Policy v1.0.
3. Approve the Calculation Receipt Specification v1.0.
4. Approve profile `vedic-lahiri-ws-mean-node-v1`.
5. Approve Vedic sidereal, Lahiri ayanamsa, whole-sign houses, mean lunar nodes,
   and Vimshottari Dasha as the V1 defaults.
6. Approve `365.2425` days per year as the V1 Dasha conversion convention,
   subject to P2 reference validation and profile versioning if changed.
7. Select the **Swiss Ephemeris Professional Licence** route.
8. Authorize P1 implementation planning and non-public engineering.
9. Prohibit public activation of a Swiss Ephemeris-backed service until the
   Professional Licence is obtained and recorded.

## Consequences

- P0 is complete and P1 engineering is unblocked.
- The current prototype must continue to identify its existing calculation
  method accurately.
- No code or marketing may imply that a Professional Licence has already been
  acquired.
- P1 must include a licence verification gate before production activation.
- Calculation, traditional interpretation, AI explanation, limited output, and
  expert review remain visibly separated.
- Unknown birth time must never be silently replaced with an exact invented
  time.
