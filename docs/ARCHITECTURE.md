# Celestial ASTRO AI — Current Architecture

- Status: Source of truth
- Jira: `KAN-16 / ASTRO-102`
- Repository: `Govi2435/Celestial-ASTRO-AI`
- Scope: Current P0–P8 implementation and P9 integration boundary
- Last verified against: `main` after ASTRO-101

This document describes what the repository actually implements today. It separates active runtime paths from P6–P8 foundations and from future architecture that has not yet been activated.

## Architecture rules

1. Calculations are performed on the server from submitted birth details.
2. Browser-supplied planetary positions and interpretations are not trusted.
3. Exact, approximate, and unknown birth times follow different calculation paths.
4. Every result carries a versioned calculation receipt.
5. The current interpretation and Ask My Chart systems are deterministic.
6. P6–P8 domain models are not equivalent to complete public product activation.
7. D1, R2, authentication, billing providers, generative AI, and professional UI must not be shown as active until their launch gates are complete.
8. Swiss Ephemeris, Python services, Redis, PostgreSQL, RAG, WebSockets, and multi-agent orchestration are future options, not current production dependencies.

## Status legend

```mermaid
flowchart LR
    A["Active runtime capability"]:::active
    F["Foundation in code or migration"]:::foundation
    G["Activation gate or future capability"]:::future

    classDef active fill:#16324f,stroke:#67e8f9,color:#ffffff,stroke-width:2px
    classDef foundation fill:#3b2f5a,stroke:#d8b4fe,color:#ffffff,stroke-width:2px
    classDef future fill:#3a3320,stroke:#f5d06f,color:#ffffff,stroke-width:2px,stroke-dasharray:5 5
```

## 1. System context

```mermaid
flowchart TB
    User["Customer or anonymous visitor"]:::actor
    Pro["Future professional user"]:::future
    Browser["Browser / mobile web"]:::active
    App["Vinext / Next.js application\nReact + TypeScript + Vite"]:::active
    Place["OpenStreetMap Nominatim\nplace search"]:::external
    Calc["Celestial Calculation Engine 1.0.0\nAstronomy Engine 2.1.19"]:::active
    Interpret["P4 deterministic interpretation\nrule packs + evidence"]:::active
    Ask["Ask My Chart\ndeterministic-evidence-router"]:::active
    Pdf["P5 PDF generator\npdf-lib"]:::active
    D1["Cloudflare D1\nDB binding not configured"]:::future
    R2["Private report storage\nR2 not configured"]:::future
    Billing["Razorpay / payment provider"]:::future
    AI["Tool-controlled generative AI / RAG"]:::future

    User --> Browser
    Pro -. future .-> Browser
    Browser --> App
    App --> Place
    App --> Calc
    Calc --> Interpret
    Interpret --> Ask
    Calc --> Pdf
    Interpret --> Pdf
    App -. P9 .-> D1
    Pdf -. P10 .-> R2
    App -. P10 .-> Billing
    App -. P12 .-> AI

    classDef actor fill:#1f2937,stroke:#e5e7eb,color:#ffffff
    classDef active fill:#16324f,stroke:#67e8f9,color:#ffffff,stroke-width:2px
    classDef external fill:#243b2f,stroke:#86efac,color:#ffffff,stroke-width:2px
    classDef future fill:#3a3320,stroke:#f5d06f,color:#ffffff,stroke-width:2px,stroke-dasharray:5 5
```

### Context interpretation

- The public web application, place lookup, calculation engine, interpretation rules, Ask My Chart router, and PDF generation are active.
- The D1 adapter and schemas exist, but the deployed hosting configuration currently has no D1 binding.
- R2 is not configured.
- No payment provider is connected.
- No generative model, RAG pipeline, or multi-agent runtime is active.
- The P8 professional workspace is a tested domain foundation, not a public dashboard.

## 2. Current application runtime

```mermaid
flowchart TB
    subgraph Client["Client boundary"]
        UI["Observatory UI"]:::active
        Forms["Birth data, place, time-confidence forms"]:::active
        Charts["North Indian, South Indian, zodiac wheel"]:::active
        Result["Evidence, uncertainty, receipt, report actions"]:::active
    end

    subgraph Worker["Vinext / Next.js application boundary"]
        PlacesRoute["GET /api/places"]:::active
        CalculateRoute["POST /api/calculate"]:::active
        AskRoute["GET and POST /api/ask-my-chart"]:::active
        ReportRoute["GET and POST /api/premium-report"]:::active
        CertificateRoute["GET /api/certification"]:::active

        Timezone["Timezone resolver\nMoment Timezone"]:::active
        Location["Coordinate-to-timezone lookup"]:::active
        Calculation["Calculation service"]:::active
        Receipt["Receipt + SHA-256 fingerprint"]:::active
        Interpretation["Approved P4 rule packs"]:::active
        QuestionRouter["Deterministic evidence router"]:::active
        ReportBuilder["A4 report builder"]:::active
    end

    subgraph Foundations["P6–P8 code foundations — not public routes"]
        AccountDomain["P6 account and Family Vault rules"]:::foundation
        BillingDomain["P7 subscriptions and entitlements"]:::foundation
        ProDomain["P8 workspace and consent rules"]:::foundation
        Schema["Drizzle schema + raw SQL migrations"]:::foundation
    end

    subgraph External["External services"]
        Nominatim["OpenStreetMap Nominatim"]:::external
    end

    Forms --> PlacesRoute
    PlacesRoute --> Nominatim
    PlacesRoute --> Location
    Forms --> CalculateRoute
    CalculateRoute --> Timezone
    Timezone --> Calculation
    Calculation --> Receipt
    Receipt --> Result
    Calculation --> Interpretation
    Interpretation --> Result
    Result --> Charts

    Forms --> AskRoute
    AskRoute --> Calculation
    AskRoute --> Interpretation
    Interpretation --> QuestionRouter
    QuestionRouter --> Result

    Forms --> ReportRoute
    ReportRoute --> Calculation
    ReportRoute --> Interpretation
    ReportRoute --> ReportBuilder

    CertificateRoute --> Receipt

    AccountDomain --> Schema
    BillingDomain --> Schema
    ProDomain --> Schema

    classDef active fill:#16324f,stroke:#67e8f9,color:#ffffff,stroke-width:2px
    classDef foundation fill:#3b2f5a,stroke:#d8b4fe,color:#ffffff,stroke-width:2px
    classDef external fill:#243b2f,stroke:#86efac,color:#ffffff,stroke-width:2px
```

## 3. Chart calculation flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Observatory UI
    participant API as POST /api/calculate
    participant TZ as Timezone resolver
    participant Engine as Calculation engine
    participant Receipt as Receipt builder

    User->>UI: Enter birth details and time confidence
    UI->>API: Submit calculation request
    API->>API: Validate date, place, timezone and coordinates
    API->>TZ: Resolve local time or complete local day

    alt Exact birth time
        TZ-->>API: One normalized UTC instant
        API->>Engine: Calculate timed chart
    else Approximate birth time
        TZ-->>API: Center UTC instant
        API->>Engine: Calculate center and window boundaries
        Engine-->>API: Stability results
    else Unknown birth time
        TZ-->>API: Start and end of local civil day
        loop Hourly samples plus day end
            API->>Engine: Calculate sample
        end
        Engine-->>API: Ranges and possible values
        API->>API: Suppress Ascendant, houses and dependent outputs
    end

    API->>Receipt: Canonicalize input, profile and engine fingerprint
    Receipt-->>API: Chart ID and SHA-256 receipt
    API-->>UI: Calculation result with no-store cache policy
```

### Calculation boundary

The calculation engine receives verified birth inputs, not client-computed chart positions. The active profile is:

- sidereal zodiac;
- Mean Lahiri/Chitrapaksha J2000 linear model;
- whole-sign houses for timed charts;
- mean lunar nodes;
- Astronomy Engine `2.1.19`;
- Celestial Calculation Engine `1.0.0` wrapper.

## 4. Ask My Chart flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Ask My Chart UI
    participant API as POST /api/ask-my-chart
    participant Engine as Calculation engine
    participant Rules as P4 interpretation rules
    participant Router as Deterministic evidence router

    User->>UI: Ask a supported chart question
    UI->>API: Question plus birth calculation input
    API->>API: Validate question length and input
    API->>Engine: Recalculate chart from birth details
    Engine-->>API: Chart and receipt
    API->>Rules: Build evidence-linked interpretation
    Rules-->>API: Approved insights, limitations and rule IDs
    API->>Router: Classify intent and select allowed evidence

    alt Supported reflective intent
        Router-->>API: Answer with evidence and limitations
    else Prediction, high-stakes or override attempt
        Router-->>API: Limited, unsupported or refused response
    end

    API-->>UI: Deterministic response
```

### Current AI truth

```text
responseEngine: deterministic-evidence-router
generativeModel: none
```

There is no active LLM, agent handoff, vector search, model memory, or generative streaming path in the current feature.

## 5. Premium PDF flow and current protection gap

```mermaid
sequenceDiagram
    autonumber
    actor Caller
    participant API as POST /api/premium-report
    participant Engine as Calculation engine
    participant Rules as P4 interpretation
    participant PDF as pdf-lib report builder

    Caller->>API: Submit birth calculation input
    Note over Caller,API: Current route has no account or entitlement check
    API->>Engine: Recalculate chart
    Engine-->>API: Chart and receipt
    API->>Rules: Rebuild approved interpretation
    Rules-->>API: Evidence-linked report data
    API->>PDF: Build private no-store PDF response
    PDF-->>Caller: Downloaded PDF
```

### Required P9/P10 protection order

```mermaid
flowchart LR
    Request["Report request"] --> Auth["Authenticate session"]
    Auth --> Owner["Verify account and chart ownership"]
    Owner --> Entitlement["Verify subscription or report grant"]
    Entitlement --> Limit["Apply rate and usage limits"]
    Limit --> Recalculate["Recalculate chart"]
    Recalculate --> Interpret["Rebuild approved interpretation"]
    Interpret --> Generate["Generate report"]
    Generate --> Store["Store privately"]
    Store --> Download["Issue short-lived signed download"]
```

The entitlement helper exists in P7, but the current route does not call it.

## 6. Data architecture status

```mermaid
flowchart TB
    subgraph Typed["Typed Drizzle schema"]
        Accounts["accounts"]:::foundation
        Family["family_profiles"]:::foundation
        Audit["account_audit_events"]:::foundation
    end

    subgraph Raw["Raw SQL migrations"]
        Subs["subscriptions"]:::foundation
        Events["billing_events"]:::foundation
        Grants["premium_report_grants"]:::foundation
        Workspaces["professional_workspaces"]:::foundation
        Members["professional_members"]:::foundation
        Cases["professional_cases"]:::foundation
        Notes["professional_notes"]:::foundation
        Appointments["professional_appointments"]:::foundation
    end

    DB["Cloudflare D1 DB binding"]:::future

    Accounts --> Family
    Accounts --> Audit
    Accounts --> Subs
    Subs --> Grants
    Accounts --> Workspaces
    Workspaces --> Members
    Workspaces --> Cases
    Cases --> Notes
    Cases --> Appointments

    Typed -. P9 schema parity .-> DB
    Raw -. P9 migration deployment .-> DB

    classDef foundation fill:#3b2f5a,stroke:#d8b4fe,color:#ffffff,stroke-width:2px
    classDef future fill:#3a3320,stroke:#f5d06f,color:#ffffff,stroke-width:2px,stroke-dasharray:5 5
```

### Current persistence facts

- `db/index.ts` expects a Cloudflare Worker binding named `DB`.
- `.openai/hosting.json` currently sets `d1` to `null`.
- The typed schema includes only the P6 account tables.
- P7 and P8 tables exist through SQL migrations but are not represented in the main typed Drizzle schema.
- No public account, profile, billing, or professional API handlers currently persist these records.
- R2 is also unset, so generated reports are returned directly rather than stored in a private report library.

## 7. P6–P8 phase boundary

```mermaid
flowchart LR
    P6["P6 Accounts and Family Vault\nvalidation, consent, export, deletion, schema"]:::foundation
    P7["P7 Billing\nplans, subscription states, entitlement rules, migrations"]:::foundation
    P8["P8 Professional workspace\nroles, cases, consent, appointments, report matching"]:::foundation

    Auth["Identity provider and secure sessions"]:::future
    D1["D1 binding and deployed migrations"]:::future
    APIs["Authenticated APIs and authorization middleware"]:::future
    UI["Customer and professional application UI"]:::future
    Payments["Verified provider checkout and webhooks"]:::future

    Auth --> P6
    D1 --> P6
    APIs --> P6
    P6 --> UI

    Auth --> P7
    D1 --> P7
    Payments --> P7
    P7 --> UI

    Auth --> P8
    D1 --> P8
    APIs --> P8
    P8 --> UI

    classDef foundation fill:#3b2f5a,stroke:#d8b4fe,color:#ffffff,stroke-width:2px
    classDef future fill:#3a3320,stroke:#f5d06f,color:#ffffff,stroke-width:2px,stroke-dasharray:5 5
```

A domain rule, test, migration, or ADR is a foundation. A feature becomes active only when its route, identity boundary, authorization, persistence, UI, security tests, and deployment configuration are complete.

## 8. P9 launch target architecture

P9 should extend the existing application rather than replace it.

```mermaid
flowchart TB
    subgraph Client["Browser / mobile web"]
        Public["Public Observatory"]
        AccountUI["Account and Profile Vault"]
        Settings["Privacy, security, export and deletion"]
    end

    subgraph Edge["Vinext / Next.js on Cloudflare"]
        Middleware["Authentication and authorization middleware"]
        Routes["Validated API route handlers"]
        Limits["CSRF, rate limits and request-size controls"]
        Calc["Existing calculation and receipt engine"]
        Rules["Existing deterministic interpretation"]
        Reports["Entitlement-protected report service"]
        Audit["Structured audit events without raw birth data"]
    end

    subgraph Platform["Cloudflare platform"]
        D1["D1 application database"]
        R2["R2 private reports and export artifacts"]
        Workflow["Durable report, export and deletion workflows"]
        Queue["Idempotent asynchronous events"]
    end

    subgraph Providers["External providers"]
        Identity["Google OAuth and email magic link provider"]
        Place["OpenStreetMap Nominatim"]
        Payment["Razorpay sandbox then production"]
    end

    Public --> Middleware
    AccountUI --> Middleware
    Settings --> Middleware
    Middleware --> Identity
    Middleware --> Routes
    Routes --> Limits
    Limits --> Calc
    Limits --> Rules
    Limits --> Reports
    Routes --> D1
    Routes --> Audit
    Reports --> Workflow
    Workflow --> R2
    Workflow --> Queue
    Routes --> Place
    Routes --> Payment
    Payment --> Queue
    Queue --> D1
```

### P9 target responsibilities

| Layer | Responsibility |
| --- | --- |
| Client | Accessible forms, charts, profile vault, consent and privacy controls |
| Middleware | Session verification, account/workspace authorization and sensitive-action reauthentication |
| Route handlers | Runtime validation, stable errors, ownership checks, rate limits and no sensitive logging |
| Calculation | Preserve current versioned chart and receipt behavior |
| D1 | Accounts, identities, sessions, profiles, subscriptions, grants, workspace records and audit events |
| R2 | Private reports and temporary export artifacts only after access controls are implemented |
| Workflows/Queues | Idempotent, retry-safe report, webhook, export and deletion operations |
| External providers | Tokenized identity and payment operations; secrets remain outside source control |

## 9. Security and trust zones

```mermaid
flowchart LR
    Untrusted["Untrusted input\nbrowser, query, webhook"]:::untrusted
    Validation["Runtime validation\nsize and format controls"]:::control
    Identity["Session and identity verification"]:::control
    Authorization["Account, workspace, assignment and entitlement checks"]:::control
    Domain["Calculation, interpretation and business domains"]:::trusted
    Data["D1 / R2 private data"]:::sensitive
    Logs["Structured logs and audit metadata"]:::control

    Untrusted --> Validation
    Validation --> Identity
    Identity --> Authorization
    Authorization --> Domain
    Domain --> Data
    Domain --> Logs
    Data -. no raw secrets or birth data .-> Logs

    classDef untrusted fill:#4a1f2d,stroke:#fb7185,color:#ffffff,stroke-width:2px
    classDef control fill:#3a3320,stroke:#f5d06f,color:#ffffff,stroke-width:2px
    classDef trusted fill:#16324f,stroke:#67e8f9,color:#ffffff,stroke-width:2px
    classDef sensitive fill:#3b2f5a,stroke:#d8b4fe,color:#ffffff,stroke-width:2px
```

Required invariant:

> No account-owned profile, premium report, professional case, note, appointment, subscription, or AI conversation may be loaded solely by record ID. The authenticated account and, where relevant, workspace, assignment, consent, and entitlement scope must be part of every query and action.

## 10. Deployment state

```mermaid
flowchart LR
    Repo["GitHub main"]:::active
    Build["Local verified build and tests"]:::active
    Sites["Existing Sites / Cloudflare-compatible deployment"]:::active
    CI["GitHub Actions required checks"]:::future
    Staging["Separated staging environment"]:::future
    D1["Configured D1 environments"]:::future
    R2["Configured private R2 storage"]:::future
    Monitor["Production monitoring and alerts"]:::future

    Repo --> Build
    Build --> Sites
    Repo -. P9-B .-> CI
    CI -. P9-B .-> Staging
    Staging -. P9-D .-> D1
    Staging -. P10-B .-> R2
    Sites -. P9-B .-> Monitor

    classDef active fill:#16324f,stroke:#67e8f9,color:#ffffff,stroke-width:2px
    classDef future fill:#3a3320,stroke:#f5d06f,color:#ffffff,stroke-width:2px,stroke-dasharray:5 5
```

The repository contains a comprehensive local `npm test` command, but required GitHub Actions checks, branch protection, staging promotion, migration drift validation, and production smoke tests remain P9-B work.

## 11. Technology decisions

### Keep for P9 launch

- TypeScript
- React
- Next.js / Vinext
- Vite
- Cloudflare Workers-compatible deployment
- Astronomy Engine
- Moment Timezone
- coordinate-to-timezone lookup
- Drizzle ORM
- D1-compatible SQLite
- `pdf-lib`
- deterministic P4 rule engine

### Add during P9/P10 only when activated

- Authentication provider and session middleware
- D1 environment bindings and migrations
- R2 private storage
- durable workflow or queue processing
- Razorpay checkout and verified webhooks
- CI, staging, monitoring, rate limits and audit infrastructure

### Deferred technologies

These are not required for P9 and should be introduced only after a measured need:

- FastAPI or a Python calculation service
- Swiss Ephemeris
- PostgreSQL
- Redis
- Vectorize or another vector database
- OpenAI Agents SDK or LangGraph
- RAG
- WebSockets or Durable Objects
- Three.js 3D universe
- native mobile applications

## 12. Traceability to repository paths

| Architecture area | Primary source paths |
| --- | --- |
| Calculation route | `app/api/calculate/route.ts` |
| Calculation orchestration | `app/calculation.ts` |
| Engine profile | `app/engine-profile.ts` |
| Timezone handling | `app/timezone.ts` |
| Place search | `app/api/places/route.ts` |
| Certification | `app/api/certification/route.ts`, `app/certification-profile.ts` |
| Interpretations | `app/interpretation.ts`, `app/interpretation-rule-packs.ts` |
| Ask My Chart | `app/ask-my-chart.ts`, `app/api/ask-my-chart/route.ts` |
| Premium report | `app/premium-report.ts`, `app/api/premium-report/route.ts` |
| P6 account foundation | `app/account-vault.ts`, `db/schema.ts`, `drizzle/0000_p6_account_vault.sql` |
| P7 billing foundation | `app/billing.ts`, `drizzle/0001_p7_billing.sql` |
| P8 professional foundation | `app/professional-dashboard.ts`, `drizzle/0002_p8_professional_dashboard.sql` |
| Database adapter | `db/index.ts` |
| Hosting bindings | `.openai/hosting.json` |
| Tests | `tests/` and `package.json` scripts |
| Architecture decisions | `docs/DECISIONS/` |

ASTRO-103 will provide the exhaustive API and database inventory. This document defines architecture boundaries and flow rather than replacing that inventory.

## 13. Change control

Update this document whenever any of the following changes:

- a public route is added, removed, or protected;
- the active calculation profile changes;
- a database or storage binding becomes active;
- an identity or payment provider is connected;
- a P6–P8 foundation becomes publicly activated;
- generative AI or RAG becomes active;
- a new service or deployment environment is introduced;
- the security boundary or retention model changes.

Architecture claims in the README, pitch material, product UI, and external documentation must remain consistent with this source of truth.
