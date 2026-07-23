# Celestial ASTRO AI

> Your chart. Calculated, explained, understood.

Celestial ASTRO AI is a trust-first astrology intelligence platform built around reproducible astronomical calculations, honest birth-time uncertainty handling, evidence-linked traditional interpretations, private reports, and consent-aware product foundations.

The project separates:

1. calculated astronomical and calendar data;
2. traditional astrological interpretation;
3. uncertainty caused by incomplete birth information; and
4. future AI-assisted functionality that is not yet active.

Celestial ASTRO AI does **not** claim that astrology is scientifically validated as a method for guaranteeing future events. It does not provide medical, legal, financial, or mental-health advice.

## Product status

The repository currently contains work from **P0 through P8**.

The customer-facing calculation and interpretation experience is substantially active through **P5**. Phases **P6, P7, and P8** currently provide domain rules, tests, database migrations, and architecture decisions, but still require production authentication, persistence, authorization, payment-provider, and UI integration before public activation.

| Phase | Outcome | Current status |
| --- | --- | --- |
| P0 | Trust contract, evidence policy, calculation profile, and product boundaries | Complete |
| P1 | Server-side birth-data pipeline, timezone handling, and MIT calculation engine | Active |
| P2 | Reference charts, NASA/JPL fixtures, regression tests, and calculation receipts | Active — internal certificate passed |
| P3 | Premium Observatory interface and chart visualizations | Active |
| P4 | Evidence-linked interpretations, career and relationship packs, and Ask My Chart | Active |
| P5 | Private server-generated premium PDF report | Active, but not yet protected by account or subscription checks |
| P6 | Accounts, family profiles, consent, export, and deletion controls | Foundation only |
| P7 | Plans, subscriptions, billing events, and premium entitlements | Foundation only |
| P8 | Professional workspaces, cases, appointments, consent, and report delivery rules | Foundation only |

The next milestone is **P9 — Production Integration and Secure Launch**.

## What works now

### Birth data and place resolution

The application accepts:

- a display name for the chart or report;
- birth date;
- exact, approximate, or unknown birth time;
- supported uncertainty windows of ±5, 10, 15, 30, or 60 minutes;
- birthplace search through OpenStreetMap Nominatim;
- automatic latitude, longitude, and IANA timezone detection;
- manual coordinates and timezone entry; and
- historical UTC offset and daylight-saving resolution.

The place API returns up to five candidate locations. A user may use the manual location fields when the external place provider is unavailable.

### Active calculation profile

The active profile uses:

- **Celestial Calculation Engine `1.0.0`**;
- **Astronomy Engine `2.1.19`** under the MIT licence;
- a sidereal zodiac;
- the versioned **Mean Lahiri/Chitrapaksha J2000 linear model**;
- whole-sign houses for timed charts; and
- mean Rahu and Ketu.

The active engine profile states approximately ±1 arcminute kernel accuracy. Internal validation currently includes 20 pinned NASA/JPL Horizons DE441 apparent geocentric longitude positions, with a maximum observed delta of `0.190′` in the pinned validation set.

This is **not** Swiss Ephemeris output. Swiss Ephemeris remains a possible future calculation service subject to licensing, implementation, and independent validation.

### Calculated chart information

For timed charts, the current engine calculates:

- Ascendant sign and degree;
- Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn;
- Uranus, Neptune, and Pluto;
- Rahu and Ketu;
- sign and degree positions;
- whole-sign houses;
- direct or retrograde motion;
- Moon Nakshatra and Pada;
- Tithi;
- Paksha;
- Yoga;
- Vimshottari Mahadasha; and
- Pythagorean numerology.

The current transparent Jyotish checks include:

1. Manglik rule;
2. Sade Sati transit;
3. Kaal Sarp enclosure;
4. Budhaditya rule; and
5. Gajakesari rule.

These are intentionally bounded rule implementations. Where traditional cancellation rules or broader variants are not included, the product should say so instead of overstating the result.

## Birth-time uncertainty

Birth-time uncertainty is handled as a product-level data constraint rather than hidden with a default time.

### Exact time

An exact-time chart resolves the submitted local time through the selected IANA timezone and calculates the full timed chart.

### Approximate time

For an approximate birth time, the application calculates the beginning and end of the selected uncertainty window and checks stability for:

- Ascendant sign;
- Moon sign;
- Nakshatra; and
- planetary house changes.

### Unknown time

When the birth time is unknown, the application evaluates the complete local civil day using hourly samples plus the end-of-day boundary.

It can show:

- planetary start and end positions;
- possible signs;
- possible Nakshatras;
- possible Tithis;
- possible Yogas; and
- numerology derived from the date.

It suppresses:

- Ascendant and Ascendant degree;
- house cusps and planetary houses;
- house-dependent Yoga and Dosha checks;
- exact Vimshottari dates; and
- divisional charts.

The system does not silently replace an unknown time with noon or another invented value.

## Calculation Receipt and P2 certification

Every result includes a reproducibility receipt containing information such as:

- deterministic chart ID;
- SHA-256 input fingerprint;
- birth-time confidence;
- local input;
- normalized UTC value or date range;
- coordinates;
- IANA timezone;
- historical offset and abbreviation;
- timezone-data version;
- calculation-profile ID;
- ayanamsa profile;
- house profile;
- node profile;
- engine and kernel versions;
- validation profile; and
- P2 certification metadata.

The chart ID is derived from the canonical calculation input, normalized time, calculation profile, engine fingerprint, and timezone-data version.

The P2 certificate is an **internal reproducibility certificate**, not third-party accreditation. NASA/JPL comparisons validate the pinned planetary-position fixtures only; they do not validate astrological interpretations or guarantee predictions.

Machine-readable method and certification data is available from `GET /api/certification`.

## Observatory interface

The active customer interface includes:

- North Indian chart;
- South Indian chart;
- zodiac wheel;
- Ascendant and Moon summary;
- Nakshatra and Pada;
- ayanamsa information;
- Panchang information;
- numerology;
- planetary table;
- Mahadasha timeline;
- rule-check results;
- calculation receipt; and
- raw-data download.

Current deployment:

[cosmicsphere.govinda2x7.chatgpt.site](https://cosmicsphere.govinda2x7.chatgpt.site)

## Explainable interpretation system

The P4 interpretation layer is a deterministic, approved-rule system.

It provides:

- core interpretation pack;
- career interpretation pack;
- relationship interpretation pack;
- visible rule IDs;
- visible chart evidence;
- confidence state; and
- limitations for each insight.

The career pack may reflect on factors such as the 10th whole-sign house, its traditional lord, Sun, Saturn, Jupiter, Mercury, Mars, and current Mahadasha context. It does not select a profession, guarantee employment, or predict salary.

The relationship pack may reflect on the 7th whole-sign house, its traditional lord, Venus, Moon, and Moon–Venus themes. It does not produce compatibility percentages or guarantee marriage outcomes.

## Ask My Chart

Ask My Chart currently uses:

```text
responseEngine: deterministic-evidence-router
generativeModel: none
```

The endpoint recalculates the chart from submitted birth details instead of trusting browser-supplied placements or interpretation data.

Supported categories include:

- chart overview;
- identity;
- emotions;
- communication;
- drive and motivation;
- current cycle;
- career decisions; and
- one-chart relationship themes.

The current router refuses or limits:

- guaranteed predictions;
- exact future outcomes;
- medical, legal, financial, or mental-health conclusions;
- compatibility percentages;
- unsupported relationship outcomes; and
- attempts to disable evidence guardrails.

No generative LLM or multi-agent orchestration is active in this feature today.

## Premium PDF report

The P5 report system uses `pdf-lib` to generate an A4 observatory-style PDF on demand.

The report can include:

- cover and trust statement;
- timed-chart overview or unknown-time date range;
- planetary positions;
- core interpretations;
- career interpretations;
- relationship interpretations;
- calculation receipt; and
- limitations and responsible-use information.

The server recalculates the chart and rebuilds the approved interpretation before rendering the PDF.

### Current commercial gap

`POST /api/premium-report` currently does **not** authenticate a user, verify chart ownership, or call the P7 entitlement function before generating the PDF.

Until P9 and P10 integration is complete, the premium report should be treated as a working report feature rather than a subscription-protected product.

## P6 — Accounts and Family Vault foundation

P6 currently provides domain and migration foundations for:

- accounts;
- saved personal and family profiles;
- relationship labels;
- exact, approximate, and unknown birth-time storage;
- consent confirmation;
- account audit events;
- sanitized data export; and
- account deletion challenges.

Important implemented rules include:

- another person’s profile requires consent confirmation;
- unknown birth time is stored as empty rather than invented;
- uncertainty minutes are retained only for approximate time;
- deletion requires an account-specific confirmation phrase; and
- the deletion confirmation window is 24 hours.

Public activation still requires verified identity, secure sessions, D1 deployment, API handlers, CSRF protection, and per-account authorization tests.

## P7 — Billing and subscriptions foundation

P7 currently defines:

- INR as the billing currency profile;
- provider-neutral billing rules;
- Free, Premium Monthly, Premium Yearly, and Professional plans;
- inactive, trialing, active, past-due, canceled, and expired states;
- subscription lifecycle event mapping;
- premium-access checks; and
- premium-report entitlement checks.

The current webhook helper only verifies that signature configuration exists and enforces a payload-size limit. It does **not** implement Razorpay- or Stripe-specific cryptographic verification.

Live billing requires provider credentials, product and price configuration, raw-body signature verification, idempotent webhook processing, refunds, invoices, taxes, customer billing UI, rate limiting, and sandbox tests.

## P8 — Professional dashboard foundation

P8 currently provides foundations for:

- professional workspaces;
- owner, astrologer, assistant, and viewer roles;
- workspace membership;
- client cases;
- assigned professionals;
- client consent;
- private professional notes;
- appointments; and
- report-to-case receipt matching.

Important implemented rules include:

- cases from another workspace are rejected;
- viewers cannot modify cases;
- astrologers may access only assigned cases;
- chart disclosure requires active client consent;
- completed or canceled appointments cannot return to an active state; and
- report delivery requires the report chart ID to match the case chart ID.

The professional dashboard is not yet publicly active. It still needs verified professional onboarding, workspace authorization middleware, client-consent UI, secure storage and backups, audit retention, notifications, appointment integration, legal review, and production UI.

## Current APIs

| Method | Endpoint | Purpose | Current protection |
| --- | --- | --- | --- |
| `GET` | `/api/places?q=` | Search places, coordinates, and IANA timezone | Public; external provider dependency |
| `POST` | `/api/calculate` | Calculate a timed, approximate, or unknown-time chart | Public; no persistence by default |
| `GET` | `/api/ask-my-chart` | Return the active Ask My Chart profile | Public |
| `POST` | `/api/ask-my-chart` | Recalculate and answer a supported evidence-linked question | Public; deterministic router |
| `GET` | `/api/premium-report` | Return the active report profile | Public |
| `POST` | `/api/premium-report` | Generate the PDF report | Public today; entitlement protection pending |
| `GET` | `/api/certification` | Return engine, method, validation, and certificate metadata | Public |

Responses containing personal calculations or reports use no-store or private caching headers where implemented.

## Current architecture

```text
Browser / mobile web
        |
        | HTTPS
        v
Vinext / Next.js application
        |
        +-- Place and timezone resolution
        +-- Calculation and receipt generation
        +-- Deterministic interpretation router
        +-- PDF report generation
        +-- P6 account domain foundation
        +-- P7 billing domain foundation
        +-- P8 professional domain foundation
        |
        v
Cloudflare-compatible runtime and D1 schema
```

The launch architecture remains intentionally simple. FastAPI, Python Swiss Ephemeris, Redis, PostgreSQL, Vectorize, RAG, WebSockets, and multi-agent orchestration are possible later additions, not current production dependencies.

## Database status

The typed Drizzle schema currently defines:

- `accounts`;
- `family_profiles`; and
- `account_audit_events`.

P7 and P8 add billing and professional tables through SQL migrations, but those tables are not yet represented in the main typed Drizzle schema.

Before production persistence is activated, P9 must reconcile schema and migration parity, bind the correct D1 environments, validate ordered migrations, test account/workspace isolation, and document backup restoration.

## Technology stack

### Runtime and application

- Next.js `16.2.6`
- React `19.2.6`
- TypeScript `5.9.3`
- Vinext `0.0.50`
- Vite `8.0.13`
- Cloudflare Vite plugin
- Wrangler
- Tailwind CSS 4

### Calculation and data

- Astronomy Engine `2.1.19`
- Moment Timezone
- `@photostructure/tz-lookup`
- Drizzle ORM
- Cloudflare D1-compatible SQLite schema
- `pdf-lib`

### Required development runtime

- Node.js `>=22.13.0`
- Linux tooling used by the project scripts, including `flock`, `curl`, and GNU `timeout`

## Testing

The repository includes unit or integration coverage for:

1. timezone handling;
2. Astronomy Engine reference positions;
3. reference-chart certification;
4. interpretation evidence;
5. career and relationship rule packs;
6. Ask My Chart;
7. premium reports;
8. account vault rules;
9. billing rules;
10. professional dashboard rules; and
11. rendered HTML.

The main test command runs unit tests, a production build, and the rendered-HTML test:

```bash
npm test
```

GitHub Actions CI is not yet configured. Automated pull-request verification, migration drift checks, staging deployment, artifact retention, and branch protection belong to P9-B.

## Development

Install and run:

```bash
npm run install:ci
npm run dev
```

Verification commands:

```bash
npm run lint
npm run test:unit
npm run build
npm test
npm run validate:artifact
npm run db:generate
```

Generated dependencies, build output, runtime state, and environment files should not be committed.

## Repository trust documents

Core P0 documents:

- [Trust Contract](docs/P0_TRUST_CONTRACT.md)
- [Calculation Profile V1](docs/CALCULATION_PROFILE_V1.md)
- [Evidence and Language Policy](docs/EVIDENCE_LANGUAGE_POLICY.md)
- [Calculation Receipt Specification](docs/CALCULATION_RECEIPT_SPEC.md)
- [P0 Approval Checklist](docs/P0_APPROVAL_CHECKLIST.md)
- [P0 Approval Decision](docs/DECISIONS/ADR-0001-P0-APPROVAL.md)

Later phase decisions include:

- [Premium Observatory UI](docs/DECISIONS/ADR-0004-PREMIUM-OBSERVATORY-UI.md)
- [Accounts and Family Vault](docs/DECISIONS/ADR-0009-ACCOUNTS-FAMILY-VAULT.md)
- [Payments and Subscriptions](docs/DECISIONS/ADR-0010-PAYMENTS-SUBSCRIPTIONS.md)
- [Professional Astrologer Dashboard](docs/DECISIONS/ADR-0011-PROFESSIONAL-ASTROLOGER-DASHBOARD.md)

## Production gaps

The product is suitable as an advanced prototype or controlled beta foundation, but open public accounts, paid subscriptions, and live professional-client data should remain blocked until the following are complete:

- authentication and verified sessions;
- CSRF and login abuse protection;
- production D1 binding and migration deployment;
- Drizzle schema and migration parity;
- saved-profile APIs and UI;
- account export and deletion workflow;
- provider-specific payment verification;
- billing idempotency and sandbox tests;
- entitlement-protected premium reports;
- private report storage and signed downloads;
- professional onboarding and consent UX;
- cross-account and cross-workspace authorization tests;
- automated GitHub CI and staging release flow;
- monitoring and audit retention;
- security, privacy, legal, and accessibility review.

## Roadmap

```text
P0-P8  Existing product and domain foundations
   |
   v
P9      Documentation, CI, authentication, D1 persistence,
        schema parity, Profile Vault, privacy, and security
   |
   v
P10     Razorpay billing activation and protected premium reports
   |
   v
P11     Professional dashboard activation
   |
   v
P12     Controlled tool-based generative AI and approved-source RAG
   |
   v
P13     Transits, relationship comparison, localization, and growth
   |
   v
P14     Enterprise scale, mobile applications, and partner APIs
```

Do not add expensive AI, 3D, or microservice complexity before authentication, database persistence, access control, CI, and payment protection are stable.

## Responsible-use statement

Celestial ASTRO AI provides astronomical calculations and traditional astrological interpretations for reflection and entertainment. Astrology is not scientifically validated as a method for guaranteeing future events or personal outcomes. The platform does not provide medical, legal, financial, or mental-health advice.

## Current product position

Celestial ASTRO AI is a strong calculation and explainability platform through P5, with tested SaaS domain foundations through P8.

Its strongest differentiators are:

- honest exact, approximate, and unknown birth-time handling;
- reproducible calculation receipts;
- visible evidence and limitations;
- deterministic guarded chart questions;
- private server-generated reports; and
- consent-aware foundations connecting personal and professional workflows.

The correct next move is **P9 — Production Integration and Secure Launch**, not a full technology rewrite.
