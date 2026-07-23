# Celestial ASTRO AI

> Your chart. Calculated, explained, understood.

Celestial ASTRO AI is a trust-first astrology platform designed around
reproducible astronomical calculations, transparent astrological methods, and
explainable AI.

The product does **not** promise scientifically proven or guaranteed
predictions. It separates calculated chart data from traditional
interpretation, AI-generated explanation, and results limited by uncertain
input.

## Product status

The project is currently at **P0: Trust Contract and Product Boundaries**.

P1 engineering must not begin until the P0 contract and initial calculation
profile are approved.

| Phase | Outcome | Status |
| --- | --- | --- |
| P0 | Trust contract and product boundaries | Proposed for approval |
| P1 | Professional ephemeris and birth-data pipeline | Blocked by P0 |
| P2 | Reference tests and calculation receipt | Planned |
| P3 | Celestial Observatory customer experience | Planned |
| P4 | Explainable AI and creative chart experiences | Planned |
| P5 | Revenue and professional astrologer platform | Planned |

## P0 documents

- [Trust Contract](docs/P0_TRUST_CONTRACT.md)
- [Calculation Profile V1](docs/CALCULATION_PROFILE_V1.md)
- [Evidence and Language Policy](docs/EVIDENCE_LANGUAGE_POLICY.md)
- [Calculation Receipt Specification](docs/CALCULATION_RECEIPT_SPEC.md)
- [P0 Approval Checklist](docs/P0_APPROVAL_CHECKLIST.md)

## Current prototype

The current prototype calculates chart data in the browser with Astronomy
Engine and a documented mean-Lahiri approximation. It is not presented as
Swiss Ephemeris output.

P1 will replace this prototype calculation path with a versioned professional
backend after the Swiss Ephemeris licensing route is selected.

Live prototype:
[cosmicsphere.govinda2x7.chatgpt.site](https://cosmicsphere.govinda2x7.chatgpt.site)

## P1 licensing gate

Swiss Ephemeris uses a dual-licensing model: AGPL or a professional licence.
The project must select and document one route before a public service using
Swiss Ephemeris is activated.

Official reference:
[Astrodienst Swiss Ephemeris](https://www.astro.com/swisseph/swephinfo_e.htm)

## Development

Requirements:

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

Common commands:

```bash
npm run install:ci
npm run dev
npm run build
npm test
```

The project uses Vinext and is configured for its existing Sites deployment.
Generated dependencies, build output, runtime state, and environment files are
not committed.
