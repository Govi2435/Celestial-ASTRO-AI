# Celestial ASTRO AI — Production Environment and Launch Checklist

- Status: Source of truth
- Jira: `KAN-16 / ASTRO-105`
- Repository: `Govi2435/Celestial-ASTRO-AI`
- Scope: P9 production integration and the launch gates for P10–P12
- Created: `2026-07-24`
- Current launch decision: **Blocked — advanced prototype / controlled-beta foundation only**

This document defines the evidence required before Celestial ASTRO AI can activate accounts, persistence, payments, professional-client data, stored reports, or generative AI.

It is an operational checklist, not a statement that the listed systems are already implemented.

## 1. Non-negotiable launch rule

A domain model, migration, test, ADR, UI mock, provider account, or successful local build does not make a capability production-ready.

A capability may be called active only when all applicable items are complete:

1. deployed route or worker;
2. verified identity boundary;
3. authorization and ownership checks;
4. environment-specific persistence;
5. runtime validation and abuse controls;
6. security and privacy tests;
7. monitoring and incident handling;
8. backup or recovery procedure;
9. staging evidence;
10. production approval and post-deploy verification.

The following must remain blocked until their named gates pass:

| Capability | Required gate |
| --- | --- |
| Public account creation and saved profiles | Gate 1 — Controlled account beta |
| Paid subscriptions and protected premium reports | Gate 2 — Paid customer launch |
| Live professional-client records | Gate 3 — Professional beta |
| Generative model, RAG, or agent consultation | Gate 4 — Controlled generative AI |

## 2. How to use this checklist

Use one checklist copy for every release candidate that changes production configuration, migrations, authentication, billing, storage, authorization, or sensitive data handling.

### Checklist notation

- `[ ]` — not completed;
- `[x]` — completed with evidence;
- `[N/A]` — reviewed and not applicable, with written reason;
- `BLOCKED` — release must not proceed;
- `WAIVED` — allowed only with named approver, expiry date, risk statement, and remediation ticket.

### Evidence rule

A checked item must link to or identify evidence such as:

- pull request;
- commit SHA;
- CI run;
- staging URL;
- migration run ID;
- provider event ID with secrets removed;
- test report;
- screenshot containing no personal data;
- monitoring dashboard;
- restore-drill record;
- legal or privacy review record;
- Jira issue.

Never paste secrets, raw session tokens, webhook signatures, full birth profiles, professional notes, payment credentials, or private report contents into Jira, GitHub, logs, screenshots, or this document.

### Release record template

```text
Release name:
Release commit SHA:
Target environment:
Release owner:
Product approver:
Security/privacy approver:
Database migration set:
Feature flags changed:
Planned start:
Actual completion:
Rollback owner:
Evidence links:
Final decision: APPROVED / REJECTED / ROLLED BACK
```

## 3. Current repository baseline

The following is the verified baseline at ASTRO-105 creation.

| Area | Current state | Launch meaning |
| --- | --- | --- |
| Application | Vinext / Next.js application with working P1–P5 runtime | Suitable for controlled prototype use |
| Node runtime | `>=22.13.0` | Must be pinned in CI and deployment |
| Local verification | `npm test` runs unit tests, build, and rendered HTML test | Required but insufficient by itself |
| Claim integrity | Automated claim-integrity regression test exists | Must remain in required CI |
| GitHub Actions | Not configured | Production promotion blocked |
| Branch protection | Not verified/configured | Production promotion blocked |
| Staging environment | Not separated and verified | Account and payment activation blocked |
| D1 binding | `.openai/hosting.json` records `d1: null` | Persistence activation blocked |
| R2 binding | `.openai/hosting.json` records `r2: null` | Private report library blocked |
| Typed schema parity | P7/P8 migration tables are not in `db/schema.ts` | Production migrations blocked |
| Authentication | No verified session system | Saved profiles blocked |
| CSRF protection | Not active | Cookie-authenticated writes blocked |
| Central rate limiting | Not active | Public launch blocked for costly/sensitive routes |
| Payment verification | Provider-specific cryptographic verification not active | Paid launch blocked |
| Premium PDF | Direct-download route is public and unentitled | Must not be marketed as protected premium access |
| Professional UI/API | Domain foundation only | Live client use blocked |
| Generative AI | Not active; deterministic router only | Must remain labelled non-generative |
| Monitoring and alerts | No production evidence recorded | Public launch blocked |
| Backup restoration | No completed restore-drill evidence recorded | Persistent sensitive data blocked |

## 4. Environment model

Celestial ASTRO AI must maintain separate configuration and data boundaries.

### 4.1 Required environments

| Environment | Purpose | Real customer data | Payment mode | Access |
| --- | --- | --- | --- | --- |
| Local development | Developer implementation and unit testing | Prohibited | Test doubles or sandbox only | Developer machine |
| CI | Reproducible build and automated tests | Prohibited | Mocked or sandbox fixtures only | GitHub Actions |
| Preview | Pull-request UI and integration review | Prohibited | Disabled | Restricted reviewers where possible |
| Staging | Production-like end-to-end verification | Synthetic or explicitly consented test data only | Provider sandbox | Restricted team/test users |
| Production | Approved customer service | Allowed under approved policies | Production provider | Public and role-controlled surfaces |

### 4.2 Separation requirements

- [ ] Separate application/project identifiers exist for staging and production.
- [ ] Separate D1 databases exist for local, staging, and production.
- [ ] Separate R2 buckets exist for staging and production when report storage is activated.
- [ ] Separate OAuth applications or environment-specific redirect configurations exist.
- [ ] Separate email-provider credentials and sender domains exist where required.
- [ ] Separate payment sandbox and production credentials exist.
- [ ] Separate payment webhook endpoints and secrets exist.
- [ ] Separate monitoring environments or release tags exist.
- [ ] Staging cannot read or write production D1 or R2 resources.
- [ ] Preview deployments cannot access production secrets.
- [ ] CI cannot access production customer data.
- [ ] Local development cannot use production credentials.
- [ ] Production credentials are unavailable to untrusted pull-request workflows.

### 4.3 Environment identity

Every runtime must expose a non-secret environment identity for logs and diagnostics.

Recommended logical values:

```text
local
ci
preview
staging
production
```

- [ ] Environment identity is set explicitly rather than inferred from hostname alone.
- [ ] Production refuses to start when required production bindings are absent.
- [ ] Staging refuses to start when staging bindings accidentally reference production resources.
- [ ] User-facing error responses never reveal internal resource IDs or environment secrets.

## 5. Configuration and secret inventory

Exact variable names must be finalized with the selected providers. The logical secrets below must be managed outside source control.

| Logical secret/configuration | Local | Staging | Production | Required before |
| --- | --- | --- | --- | --- |
| Session signing/encryption secret | Test-only | Unique staging secret | Unique production secret | Gate 1 |
| Google OAuth client ID/secret | Dev app | Staging app/config | Production app/config | Gate 1 |
| Magic-link email credentials | Test/sandbox | Staging sender | Production sender | Gate 1 |
| Application base URL | Local URL | Staging URL | Production URL | Gate 1 |
| D1 `DB` binding | Local DB | Staging DB | Production DB | Gate 1 |
| R2 report bucket binding | Optional | Staging bucket | Production private bucket | Gate 2 |
| Razorpay key ID/secret | Sandbox | Sandbox | Production | Gate 2 |
| Razorpay webhook secret | Sandbox | Sandbox | Production unique secret | Gate 2 |
| Monitoring DSN/token | Dev project | Staging project | Production project | Gate 1 |
| Email notification credentials | Optional | Staging | Production | Gate 1/3 |
| AI provider secret | Prohibited unless test spike | Restricted evaluation | Production only after Gate 4 | Gate 4 |

### Secret-management checklist

- [ ] No `.env*` file is committed.
- [ ] No private key, certificate, provider secret, or webhook secret is committed.
- [ ] Secrets are stored using the deployment platform’s secret mechanism.
- [ ] Secret access is limited by least privilege.
- [ ] Secret values differ between staging and production.
- [ ] A named owner exists for every production secret.
- [ ] Rotation procedure exists for every production secret.
- [ ] Compromise response includes immediate revocation and replacement.
- [ ] Provider dashboards use multi-factor authentication for privileged users.
- [ ] Removed team members lose provider and deployment access promptly.
- [ ] Logs show secret names or redacted identifiers only, never values.
- [ ] Support screenshots and exported diagnostics redact credentials and tokens.

## 6. Repository and source-control gate

- [ ] `main` is protected against direct production-code pushes.
- [ ] Pull requests are required.
- [ ] Required CI checks must pass before merge.
- [ ] Unresolved review conversations block merge.
- [ ] The branch must be current with `main` before production merge.
- [ ] Force-push access to protected branches is restricted.
- [ ] Production deployment is attributable to a commit SHA.
- [ ] Release tags or equivalent immutable release references are used.
- [ ] Secret scanning is active.
- [ ] Dependency alerts are reviewed.
- [ ] Generated runtime folders remain ignored.
- [ ] No temporary workflow, cleanup script, test credential, or debugging bypass remains in the final diff.
- [ ] README, architecture, API inventory, claim policy, and this checklist are updated when behavior changes.
- [ ] Unsupported public claims are rejected by the claim-integrity test.

## 7. Continuous-integration gate

Every pull request must run on the supported Node version and clean dependencies.

### Required checks

- [ ] Checkout uses the exact pull-request commit.
- [ ] Node `>=22.13.0` is installed and recorded in logs.
- [ ] Dependency installation uses the repository lockfile.
- [ ] `npm run lint` passes.
- [ ] `npm run test:unit` passes.
- [ ] Claim-integrity regression tests pass.
- [ ] `npm run build` passes.
- [ ] Rendered HTML test passes.
- [ ] `npm run validate:artifact` passes when applicable.
- [ ] TypeScript errors fail the workflow.
- [ ] Test failures cannot be bypassed by editing workflow conditions in the same unreviewed change.
- [ ] Test artifacts or logs are retained long enough for release review.
- [ ] CI uses synthetic fixtures only.
- [ ] CI logs do not contain birth data, OAuth tokens, payment payloads, or secrets.

### Required persistence checks before D1 activation

- [ ] `db/schema.ts` contains every production table.
- [ ] P7 and P8 typed-schema parity is complete.
- [ ] Generated migration diff is reviewed.
- [ ] Migration order is deterministic.
- [ ] A clean database can migrate from zero to current.
- [ ] An existing previous-version database can migrate forward.
- [ ] Foreign keys are enabled and verified.
- [ ] Migration drift check compares expected and deployed schema.
- [ ] Data-access tests prove cross-account isolation.
- [ ] Data-access tests prove cross-workspace isolation.

## 8. Build and artifact gate

- [ ] Build output comes from the approved release commit.
- [ ] Build uses production dependency versions from the lockfile.
- [ ] No local uncommitted file is included.
- [ ] Source maps follow the approved exposure policy.
- [ ] Public client bundles contain no secrets.
- [ ] Public client bundles contain no server-only provider credentials.
- [ ] Build metadata records release SHA and environment without exposing secrets.
- [ ] Generated PDFs remain selectable text where designed.
- [ ] Static and dynamic route behavior matches the architecture document.
- [ ] Current deterministic Ask My Chart profile still reports `generativeModel: none` until Gate 4.

## 9. Cloudflare/runtime preparation

### 9.1 Application deployment

- [ ] Staging application exists independently of production.
- [ ] Production application exists under controlled ownership.
- [ ] Custom production domain and TLS are configured.
- [ ] Redirects force HTTPS.
- [ ] Preview deployments do not receive production secrets.
- [ ] Runtime compatibility with Vinext and current Next.js APIs is verified in staging.
- [ ] Worker/runtime limits are measured for calculation and PDF requests.
- [ ] Request timeout behavior is documented.
- [ ] Deployment rollback to the previous application version is tested.

### 9.2 D1 binding

The application adapter expects a binding named `DB`.

- [ ] Local `DB` binding is configured.
- [ ] Staging `DB` binding points only to staging D1.
- [ ] Production `DB` binding points only to production D1.
- [ ] Missing `DB` fails clearly for routes that require persistence.
- [ ] Public calculation-only routes remain intentionally independent or their dependency is documented.
- [ ] D1 resource IDs are recorded in restricted operational documentation.
- [ ] No resource ID is treated as a secret, but modification access remains restricted.

### 9.3 R2 binding

R2 is not required for the current direct-download P5 route. It becomes required only when private report or export storage is activated.

- [ ] Staging and production report buckets are separate.
- [ ] Buckets are private by default.
- [ ] Public bucket listing is disabled.
- [ ] Object keys do not contain raw names, birth dates, email addresses, or chart content.
- [ ] Downloads use short-lived authorized access.
- [ ] Download authorization rechecks account, ownership, and entitlement.
- [ ] Object retention and deletion are documented.
- [ ] Deleted accounts lose report access immediately.
- [ ] Export objects expire automatically.
- [ ] Stored objects are excluded from public caching.

### 9.4 Queues and workflows

Activate asynchronous processing only when the corresponding implementation exists.

- [ ] Message schemas are versioned.
- [ ] Consumers are idempotent.
- [ ] Duplicate delivery is safe.
- [ ] Retry limits and dead-letter handling are defined.
- [ ] Sensitive payloads are minimized.
- [ ] Queue messages do not contain secrets.
- [ ] Failed report, export, deletion, or billing jobs create actionable alerts.
- [ ] Operations can be safely replayed by an authorized operator.

## 10. Database and migration launch gate

### 10.1 Schema decisions

- [ ] P7 tables are represented in `db/schema.ts`.
- [ ] P8 tables are represented in `db/schema.ts`.
- [ ] `account_audit_events.account_id` retention/FK decision is documented.
- [ ] `billing_events.account_id` retention/FK decision is documented.
- [ ] `professional_cases.assigned_professional_id` reference target is resolved.
- [ ] Subscription-history requirements replace or approve the one-row-per-account constraint.
- [ ] Allowed state values are enforced consistently in domain code and database design.
- [ ] Consent is versioned where required.
- [ ] Soft-delete and purge behavior is defined.
- [ ] Chart/report persistence model is explicitly approved.

### 10.2 Migration execution

- [ ] Migration files are immutable after release.
- [ ] Migration checksums or equivalent review evidence are recorded.
- [ ] Staging migration completes successfully.
- [ ] Staging application passes smoke tests after migration.
- [ ] Production database backup/recovery point is verified before migration.
- [ ] Production migration owner is named.
- [ ] Migration start and completion are recorded.
- [ ] Long-running migration risk is assessed.
- [ ] Destructive changes require explicit approval.
- [ ] Forward-fix plan exists because automatic schema rollback may be unsafe.
- [ ] Application rollback compatibility with the migrated schema is documented.

### 10.3 Data integrity and isolation

- [ ] Account-owned queries always include authenticated account scope.
- [ ] Workspace-owned queries always include workspace membership scope.
- [ ] Assigned-case queries include the assignment rule.
- [ ] Client chart disclosure includes active-consent verification.
- [ ] Report delivery verifies matching chart IDs.
- [ ] Foreign-key behavior is tested for deletion and archival.
- [ ] Uniqueness and idempotency constraints are tested.
- [ ] Timestamp format and timezone policy are consistent.
- [ ] No test seed creates realistic personal profiles from real people.

## 11. Backup, recovery, and deletion gate

- [ ] Provider-supported D1 backup/recovery capability is verified for the production plan.
- [ ] Recovery objectives are documented.
- [ ] Restore procedure identifies owner, access, and validation steps.
- [ ] A staging restore drill has completed successfully.
- [ ] Restored data is checked for referential integrity.
- [ ] Restore logs contain no sensitive record payloads.
- [ ] R2 recovery or regeneration strategy is documented.
- [ ] Report objects can be deleted by account/profile/report lifecycle.
- [ ] Account deletion removes active access immediately.
- [ ] Purge schedule and legally required retention exceptions are documented.
- [ ] Billing/audit records retained after account deletion are minimized or pseudonymized.
- [ ] Data-export artifacts expire and are deleted.
- [ ] A deletion test proves no active profile, report, session, or share remains accessible.

## 12. Authentication and session gate — Gate 1

### 12.1 Provider compatibility

- [ ] Authentication provider/runtime compatibility spike passes on Vinext and the target Cloudflare runtime.
- [ ] Google OAuth works in staging.
- [ ] Email magic-link flow works in staging.
- [ ] Redirect URIs are exact and environment-specific.
- [ ] OAuth state and nonce validation are enabled.
- [ ] Email ownership is verified before account use.
- [ ] Account linking requires verified identity or authenticated confirmation.
- [ ] Duplicate-account behavior is documented and tested.

### 12.2 Session security

- [ ] Sessions are validated on the server.
- [ ] Session cookies are `Secure` in production.
- [ ] Session cookies are `HttpOnly`.
- [ ] `SameSite` policy is documented and tested.
- [ ] Session identifiers/tokens are stored only as hashes where persisted.
- [ ] Sessions rotate after sign-in and privilege changes.
- [ ] Logout revokes the active session.
- [ ] Security changes can revoke all sessions.
- [ ] Expired and revoked sessions are rejected.
- [ ] Session-management UI lists devices without exposing raw tokens.
- [ ] Sensitive actions require recent authentication.
- [ ] Admin and professional privileged access has an MFA policy.

### 12.3 Browser request protection

- [ ] Cookie-authenticated state changes have CSRF protection.
- [ ] Login and magic-link requests are rate-limited.
- [ ] Magic links expire and cannot be replayed.
- [ ] Redirect targets are allowlisted.
- [ ] Authentication errors do not reveal whether arbitrary emails exist.
- [ ] Login logs exclude tokens and magic-link URLs.

## 13. API security and validation gate

- [ ] New production CRUD routes use runtime schemas.
- [ ] Maximum string lengths are explicit.
- [ ] Request-body byte limits are explicit.
- [ ] Latitude and longitude bounds are validated.
- [ ] Time-confidence and uncertainty combinations are validated.
- [ ] Stable error codes are defined.
- [ ] Correlation/request IDs are returned and logged.
- [ ] Raw database and provider errors are not returned to clients.
- [ ] Sensitive responses use `no-store`.
- [ ] Security headers are centrally defined.
- [ ] Cross-origin policy is intentional and tested.
- [ ] State-changing routes reject unsupported methods and content types.
- [ ] Profile, report, subscription, and workspace endpoints are protected against IDOR.
- [ ] Anonymous chart calculation remains non-persistent unless explicitly opted in.
- [ ] Expensive endpoints have endpoint-specific rate and usage limits.

## 14. Place-provider gate

`GET /api/places` currently depends on OpenStreetMap Nominatim and a coordinate-to-timezone lookup.

- [ ] Provider use and identification requirements are reviewed.
- [ ] User-Agent identifies the application appropriately.
- [ ] Rate limiting prevents abusive automated search.
- [ ] Public cache behavior is retained only for non-personal place search results.
- [ ] Provider response fields are runtime-validated.
- [ ] Invalid or non-finite coordinates are rejected before timezone lookup.
- [ ] Provider failure preserves verified manual-entry fallback.
- [ ] Monitoring distinguishes provider failure from application failure.
- [ ] A future provider change updates the place-provider receipt field.

## 15. Calculation and receipt regression gate

- [ ] Exact-time calculations pass.
- [ ] Approximate-time stability checks pass for every supported uncertainty window.
- [ ] Unknown-time charts do not invent a default time.
- [ ] Unknown-time outputs suppress Ascendant, houses, and exact Dasha timing.
- [ ] Historical timezone standard and DST cases pass.
- [ ] Quarter-hour timezone cases pass.
- [ ] Ambiguous and nonexistent local-time cases pass.
- [ ] Pinned full-chart regression fixtures pass.
- [ ] Pinned NASA/JPL comparison fixtures pass the documented threshold.
- [ ] Public copy retains the internal-validation limitation.
- [ ] Receipt schema and chart-ID behavior remain versioned.
- [ ] Calculation changes include migration/compatibility notes for stored receipts.

## 16. Family Vault and account-data gate — Gate 1

- [ ] Authenticated profile-list API exists.
- [ ] Authenticated create/read/update/delete APIs exist.
- [ ] Every profile query includes owner account scope.
- [ ] Another person’s profile requires recorded consent confirmation.
- [ ] Exact, approximate, and unknown times persist without conversion to invented values.
- [ ] Unknown time stores no fabricated birth time.
- [ ] Approximate time preserves supported uncertainty.
- [ ] Profile UI displays calculation and privacy consequences.
- [ ] Account data export excludes secrets and internal security fields.
- [ ] Account deletion uses reauthentication and time-bounded confirmation.
- [ ] Deletion completion is audited without storing birth data in audit metadata.
- [ ] Cross-account authorization tests fail closed.
- [ ] User-facing privacy notice identifies storage purpose and deletion process.

## 17. Premium report protection gate — Gate 2

The required processing order is:

```text
Authenticate session
→ verify account
→ verify chart ownership
→ verify active entitlement or report grant
→ apply rate and usage limits
→ create idempotent report request
→ recalculate chart
→ rebuild approved interpretation
→ generate report
→ store privately when report library is active
→ return authorized short-lived download
→ record usage and audit metadata
```

- [ ] Public unentitled report generation is disabled or explicitly retained only for a controlled non-commercial environment.
- [ ] Account/session check occurs before calculation and PDF generation.
- [ ] Chart ownership check occurs before generation.
- [ ] Entitlement check occurs before generation.
- [ ] One-time grant and subscription allowance are distinguished.
- [ ] Duplicate requests are idempotent.
- [ ] PDF generation is rate-limited.
- [ ] Filename remains sanitized.
- [ ] Response uses `nosniff` and private/no-store caching.
- [ ] Stored report access is account-scoped.
- [ ] Signed download expires quickly.
- [ ] Report deletion and account deletion remove access.
- [ ] Report content is excluded from logs and audit metadata.
- [ ] Unknown-time limitations remain visible in the report.

## 18. Billing and payment gate — Gate 2

### 18.1 Provider configuration

- [ ] Razorpay sandbox account and credentials are configured in staging.
- [ ] Production credentials are not enabled before sandbox approval.
- [ ] Server owns the plan/product mapping.
- [ ] Client cannot submit arbitrary entitlement identifiers.
- [ ] Amount and currency are verified server-side.
- [ ] INR plan configuration is reviewed.
- [ ] Production product/plan IDs are recorded in restricted configuration.

### 18.2 Checkout confirmation

- [ ] Server creates the order or subscription.
- [ ] Pending purchase/subscription is recorded before checkout.
- [ ] Returned checkout identifiers are validated.
- [ ] Checkout signature verification is cryptographic and provider-specific.
- [ ] UI distinguishes pending, confirmed, failed, and canceled states.
- [ ] Entitlement is not granted solely from browser success callbacks.

### 18.3 Webhook processing

- [ ] Raw request body is preserved for signature verification.
- [ ] Signature is compared using a safe comparison method.
- [ ] Invalid signatures are rejected without processing.
- [ ] Provider event ID is deduplicated.
- [ ] Duplicate delivery is safe.
- [ ] Event processing is idempotent.
- [ ] Event-to-account resolution is validated.
- [ ] Subscription-state mapping is provider-neutral.
- [ ] Out-of-order events are handled.
- [ ] Processing failures create alerts and can be replayed safely.
- [ ] Webhook payloads are not logged in full.

### 18.4 Customer billing operations

- [ ] Billing status is visible to the authenticated customer.
- [ ] Cancellation flow is implemented and confirmed.
- [ ] Access-through-period behavior is documented.
- [ ] Failed-payment and grace-period behavior is documented.
- [ ] Refund process is documented and tested.
- [ ] Duplicate-charge support process exists.
- [ ] Invoice/tax/GST handling receives accounting and legal review.
- [ ] Sandbox end-to-end test proves checkout, webhook, entitlement, report access, cancellation, and failed payment.

## 19. Professional workspace gate — Gate 3

- [ ] Professional onboarding exists.
- [ ] Professional verification policy exists.
- [ ] Paying does not automatically create a “verified astrologer” label.
- [ ] Workspace membership APIs are authenticated.
- [ ] Roles are enforced through workspace membership.
- [ ] Viewer cannot modify records.
- [ ] Astrologer can access only assigned cases where required.
- [ ] Cross-workspace access is rejected.
- [ ] Client consent is required before chart disclosure.
- [ ] Consent purpose, duration, AI use, report use, and revocation are visible.
- [ ] Revoked consent blocks future access immediately.
- [ ] Professional notes are never included in public AI or customer output without explicit design and permission.
- [ ] Appointment state transitions are enforced.
- [ ] Report delivery verifies matching case/chart receipt.
- [ ] Audit history excludes note and birth-data content.
- [ ] Cross-workspace penetration tests pass.
- [ ] Professional terms and privacy review are approved.

## 20. Generative AI gate — Gate 4

The current deterministic evidence router remains the active Ask My Chart implementation until this gate passes.

- [ ] AI feature has a separate feature flag defaulting to off.
- [ ] Model/provider contract is approved.
- [ ] Chart facts are obtained only through controlled tools.
- [ ] Browser-supplied chart placements are not trusted.
- [ ] Structured output schema is enforced.
- [ ] UI commands are allowlisted.
- [ ] Evidence and limitations are mandatory.
- [ ] Unsupported prediction requests are refused.
- [ ] Medical, legal, financial, mental-health, death, fertility, criminality, curse, and gambling conclusions are refused.
- [ ] Prompt-injection tests pass.
- [ ] Cross-profile and cross-workspace leakage tests pass.
- [ ] Conversation storage and deletion policy is visible.
- [ ] Model prompts, secrets, and hidden internal reasoning are not exposed in export.
- [ ] RAG sources are public-domain, licensed, or owned.
- [ ] Source metadata records licence and review status.
- [ ] Token, cost, and rate limits are enforced.
- [ ] Evaluation set covers unknown-time and unstable evidence.
- [ ] Hallucinated placement rate is measured.
- [ ] Deterministic fallback remains available.
- [ ] Public copy changes only after production activation evidence exists.

## 21. Privacy and responsible-use gate

- [ ] Privacy notice identifies data collected and purpose.
- [ ] Third-party family-profile handling is explained.
- [ ] Consent and withdrawal flows are implemented.
- [ ] Retention periods exist for profiles, chats, reports, exports, billing records, and audit events.
- [ ] Data-export process is documented.
- [ ] Account-deletion process is documented.
- [ ] Vendor inventory exists.
- [ ] Data shared with identity, email, payment, monitoring, and AI providers is minimized.
- [ ] Breach/incident notification responsibilities are documented.
- [ ] Grievance/support contact is published.
- [ ] Terms and privacy versions accepted by users are recorded.
- [ ] Responsible-use disclaimer is visible before high-stakes interpretation use.
- [ ] Product does not guarantee events or outcomes.
- [ ] Product does not provide medical, legal, financial, or mental-health advice.
- [ ] Legal review covers applicable Indian privacy, consumer, payment, tax, and professional-use obligations.

## 22. Accessibility and UI gate

- [ ] Keyboard navigation works across all launch-critical flows.
- [ ] Focus is visible.
- [ ] Forms have programmatic labels.
- [ ] Validation errors are summarized and associated with fields.
- [ ] Contrast meets the adopted accessibility standard.
- [ ] Reduced-motion preference is respected.
- [ ] Charts have structured text/table alternatives.
- [ ] Retrograde, confidence, and uncertainty are not represented by color alone.
- [ ] Mobile touch targets are usable.
- [ ] Modals trap and restore focus correctly.
- [ ] Skip links exist.
- [ ] PDF text is selectable where designed.
- [ ] Download filenames are descriptive and sanitized.
- [ ] Auth, payment, consent, export, and deletion flows receive accessibility review.

## 23. Observability and alerting gate

### 23.1 Required signals

- [ ] Release SHA and environment are attached to events.
- [ ] Request IDs connect API errors to logs.
- [ ] Calculation success and failure rates are tracked.
- [ ] Calculation latency is tracked.
- [ ] Timezone-resolution failures are tracked.
- [ ] Place-provider failures are tracked.
- [ ] Authentication failures and abuse limits are tracked.
- [ ] D1 errors and migration failures are tracked.
- [ ] PDF generation duration and failures are tracked.
- [ ] Webhook verification and processing failures are tracked.
- [ ] Entitlement denials are tracked without exposing private data.
- [ ] Cross-account/workspace authorization denials are tracked.
- [ ] Queue/workflow retries and terminal failures are tracked.
- [ ] Account deletion completion is tracked.

### 23.2 Logging restrictions

- [ ] Raw birth date, time, location, coordinates, profile name, and relationship are excluded from normal logs.
- [ ] Session tokens and magic links are excluded.
- [ ] Payment secrets and signatures are excluded.
- [ ] Full webhook payloads are excluded unless an approved encrypted incident store exists.
- [ ] AI prompts and professional notes are excluded from ordinary logs.
- [ ] Report content and signed URLs are excluded.
- [ ] Audit metadata uses identifiers and action types, not sensitive content.
- [ ] Log retention is defined.
- [ ] Production log access is restricted and reviewed.

### 23.3 Alerts

- [ ] Alert recipients are named.
- [ ] High error-rate alert exists.
- [ ] Authentication anomaly alert exists.
- [ ] Payment/webhook failure alert exists before Gate 2.
- [ ] Database migration failure alert exists.
- [ ] Report workflow failure alert exists before stored reports.
- [ ] Authorization leakage indicator has immediate escalation.
- [ ] Alert runbooks identify first response and rollback authority.

## 24. Security verification gate

Use the adopted OWASP ASVS-based security plan for applicable controls.

- [ ] Threat model is updated for the release.
- [ ] Authentication tests pass.
- [ ] Session fixation and revocation tests pass.
- [ ] CSRF tests pass.
- [ ] IDOR/cross-account tests pass.
- [ ] Cross-workspace and role tests pass.
- [ ] Stored and reflected XSS tests pass.
- [ ] Request-size and rate-limit tests pass.
- [ ] Webhook forgery and replay tests pass before Gate 2.
- [ ] PDF input/content tests pass.
- [ ] Secret scan passes.
- [ ] Dependency scan is reviewed.
- [ ] Security headers are verified in staging.
- [ ] Manual test confirms no sensitive data appears in logs.
- [ ] High-severity findings are fixed before launch.
- [ ] Any accepted finding has named owner, expiry, mitigation, and approver.

## 25. Staging acceptance gate

Staging must be production-like but use non-production data and credentials.

- [ ] Staging release uses the intended production candidate SHA.
- [ ] Staging bindings are verified before deployment.
- [ ] Staging migrations complete.
- [ ] Staging OAuth redirects and callbacks work.
- [ ] Staging email links work.
- [ ] Staging payment sandbox flow works before Gate 2.
- [ ] Staging report storage/download works before Gate 2.
- [ ] Staging professional consent/case flow works before Gate 3.
- [ ] Staging monitoring receives test events.
- [ ] Staging alerts are tested.
- [ ] No production credential appears in staging configuration.
- [ ] No production data is copied into staging.
- [ ] Accessibility smoke review completes.
- [ ] Security smoke review completes.
- [ ] Product owner signs off on user-facing claims and limitations.

## 26. Required smoke tests

### 26.1 Public calculation surface

- [ ] Landing page loads without client/server error.
- [ ] `GET /api/certification` returns `200` and the current internal-validation profile.
- [ ] `GET /api/places?q=Ahmedabad` returns bounded place results or the documented fallback error.
- [ ] Exact-time calculation returns a timed chart and `calculation-receipt-v3`.
- [ ] Approximate-time calculation returns stability data.
- [ ] Unknown-time calculation returns a date range and suppressed factors.
- [ ] Calculation response uses `Cache-Control: no-store`.
- [ ] Browser-supplied placements cannot replace server calculation.

### 26.2 Deterministic Ask My Chart

- [ ] `GET /api/ask-my-chart` reports deterministic router and no generative model.
- [ ] Supported chart question returns evidence and limitations.
- [ ] Unknown-time question does not invent Ascendant/house evidence.
- [ ] Prediction request is refused.
- [ ] High-stakes request is refused.
- [ ] Guardrail override request is refused.

### 26.3 Premium report

Before Gate 2, one of the following must be true:

- [ ] production premium generation is disabled; or
- [ ] production route is explicitly limited to an approved controlled prototype and not marketed as paid/protected.

After Gate 2:

- [ ] unauthenticated request is rejected;
- [ ] wrong-account chart is rejected;
- [ ] unentitled request is rejected before generation;
- [ ] entitled request generates the expected receipt-linked PDF;
- [ ] duplicate request is safe;
- [ ] authorized download expires;
- [ ] unauthorized download is rejected.

### 26.4 Gate 1 account flow

- [ ] Sign up/sign in works.
- [ ] Session survives expected navigation.
- [ ] Logout revokes access.
- [ ] Create profile works.
- [ ] Read/update/delete only works for owner.
- [ ] Consent requirement works for another person.
- [ ] Export works and strips secrets.
- [ ] Deletion confirmation expires as designed.
- [ ] Deleted account loses active access.

### 26.5 Gate 2 payment flow

- [ ] Sandbox checkout starts from server-created product mapping.
- [ ] Invalid checkout signature is rejected.
- [ ] Valid webhook grants the expected entitlement.
- [ ] Duplicate webhook does not duplicate entitlement.
- [ ] Failed payment changes status safely.
- [ ] Cancellation behavior matches customer copy.
- [ ] Refund handling removes or preserves access according to policy.

### 26.6 Gate 3 professional flow

- [ ] Workspace owner can invite permitted member.
- [ ] Viewer cannot modify case.
- [ ] Astrologer cannot access unassigned case where assignment restriction applies.
- [ ] Other workspace cannot access case.
- [ ] Chart cannot be disclosed without active client consent.
- [ ] Revocation blocks access.
- [ ] Appointment state rules hold.
- [ ] Wrong-chart report delivery is rejected.

## 27. Production deployment procedure

### 27.1 Before deployment

- [ ] Release owner opens a release record.
- [ ] Final commit SHA is identified.
- [ ] Required CI checks pass on that SHA.
- [ ] Staging runs the same candidate.
- [ ] Staging acceptance is signed.
- [ ] Database migration set is reviewed.
- [ ] Backup/recovery point is confirmed.
- [ ] Feature-flag plan is reviewed.
- [ ] Rollback owner is available.
- [ ] Monitoring dashboards and alerts are open.
- [ ] Support contact is informed.
- [ ] No unrelated change is included.

### 27.2 Deployment order

```text
Confirm release SHA
→ confirm environment and bindings
→ create/verify database recovery point
→ apply backward-compatible migrations
→ deploy application
→ run public smoke tests
→ run authenticated smoke tests
→ run billing/professional smoke tests when applicable
→ verify logs and alerts
→ enable feature flags gradually
→ record decision and evidence
```

### 27.3 After deployment

- [ ] Application release SHA matches approved SHA.
- [ ] Public routes pass.
- [ ] Authentication passes before Gate 1 activation.
- [ ] Database reads/writes pass before profile activation.
- [ ] Payment verification passes before paid activation.
- [ ] Entitlement protection passes before premium generation activation.
- [ ] Professional authorization passes before workspace activation.
- [ ] Error and latency signals remain within approved thresholds.
- [ ] No sensitive payload appears in logs.
- [ ] Release record is completed.
- [ ] Customer-facing status or release note is updated where appropriate.

## 28. Rollback and emergency controls

### 28.1 Rollback triggers

Rollback, disable, or isolate the affected feature when any of the following occurs:

- cross-account or cross-workspace data exposure;
- authentication bypass;
- incorrect entitlement grant;
- webhook forgery acceptance;
- destructive migration error;
- repeated failed report generation causing resource exhaustion;
- sensitive data appearing in logs;
- severe calculation regression;
- unknown-time suppression failure;
- payment amount/currency mismatch;
- generative AI exposing private data or inventing chart facts.

### 28.2 Required emergency controls

- [ ] Previous application release can be redeployed.
- [ ] Account creation can be disabled.
- [ ] Saved-profile writes can be disabled.
- [ ] Premium report generation can be disabled.
- [ ] Payment checkout can be disabled without deleting subscription records.
- [ ] Webhook processing can be paused or quarantined.
- [ ] Professional workspace access can be disabled.
- [ ] Generative AI feature flag defaults to off.
- [ ] Compromised sessions can be revoked.
- [ ] Compromised secrets can be rotated.
- [ ] Incident owner can preserve evidence without copying sensitive payloads broadly.

### 28.3 Database rollback policy

- [ ] Every migration identifies application versions that can run against the new schema.
- [ ] Destructive migrations use staged expand/migrate/contract planning.
- [ ] Application rollback does not assume database rollback is safe.
- [ ] Forward-fix and restore options are documented.
- [ ] Restore approval and validation steps are defined.

## 29. Incident-response checklist

- [ ] Identify incident commander.
- [ ] Record start time and affected environment.
- [ ] Preserve relevant request IDs, release SHA, and provider event IDs.
- [ ] Do not paste sensitive payloads into broad chat channels.
- [ ] Disable or isolate affected feature.
- [ ] Revoke sessions or secrets where required.
- [ ] Determine whether account/workspace boundaries were crossed.
- [ ] Determine whether payment or professional data was affected.
- [ ] Determine whether notification obligations require legal/privacy review.
- [ ] Restore service or roll back.
- [ ] Validate data integrity.
- [ ] Communicate accurate, non-speculative status.
- [ ] Complete root-cause analysis.
- [ ] Add regression test and remediation ticket.

## 30. Launch gates

## Gate 0 — Engineering and documentation foundation

Required before production-sensitive implementation is trusted:

- [ ] README reflects current product truth.
- [ ] Architecture document is current.
- [ ] API/database inventory is current.
- [ ] Claim-integrity policy and test are active.
- [ ] This production checklist is current.
- [ ] GitHub Actions required checks exist.
- [ ] Branch protection exists.
- [ ] Staging environment exists.
- [ ] Monitoring foundation exists.

**Current decision:** Documentation items are being completed in P9-A. CI, branch protection, staging, and monitoring remain P9-B.

## Gate 1 — Controlled account beta

All Gate 0 items plus:

- [ ] Authentication and secure sessions.
- [ ] CSRF and login abuse controls.
- [ ] D1 staging and production bindings.
- [ ] Typed-schema/migration parity.
- [ ] Profile CRUD APIs and UI.
- [ ] Consent handling.
- [ ] Data export.
- [ ] Account deletion.
- [ ] Cross-account authorization tests.
- [ ] Backup/restore drill.
- [ ] Privacy notice and responsible-use acceptance.

**Gate 1 decision:** `BLOCKED` until evidence is complete.

## Gate 2 — Paid customer launch

All Gate 1 items plus:

- [ ] Razorpay production configuration.
- [ ] Server-side checkout verification.
- [ ] Raw-body webhook signature verification.
- [ ] Provider-event idempotency.
- [ ] Subscription and entitlement persistence.
- [ ] Protected premium-report processing order.
- [ ] Private report storage and authorized download, if report library is active.
- [ ] Billing/cancellation UI.
- [ ] Refund, invoice, tax, and support process.
- [ ] Full sandbox end-to-end evidence.
- [ ] Payment and report alerts.

**Gate 2 decision:** `BLOCKED` until evidence is complete.

## Gate 3 — Professional beta

All Gate 2 items applicable to professional plans plus:

- [ ] Professional onboarding and verification.
- [ ] Workspace authorization middleware.
- [ ] Client-consent UI.
- [ ] Case, notes, appointment, and report-delivery UI/API.
- [ ] Professional terms.
- [ ] Audit-retention design.
- [ ] Cross-workspace security suite.
- [ ] Professional-data backup and deletion behavior.

**Gate 3 decision:** `BLOCKED` until evidence is complete.

## Gate 4 — Controlled generative AI

All relevant earlier gates plus:

- [ ] Tool-based evidence orchestration.
- [ ] Structured output validation.
- [ ] Safety guardrails.
- [ ] Model usage and cost limits.
- [ ] Prompt-injection and leakage tests.
- [ ] Licensed/approved RAG sources.
- [ ] Evaluation dataset and quality thresholds.
- [ ] Conversation privacy, export, and deletion behavior.
- [ ] Monitoring and human escalation process.
- [ ] Public copy updated only after activation.

**Gate 4 decision:** `BLOCKED` until evidence is complete.

## 31. Final go/no-go review

A production launch requires explicit approval rather than implied approval from merged code.

| Review area | Approver | Decision | Date | Evidence |
| --- | --- | --- | --- | --- |
| Product scope and claims |  |  |  |  |
| Engineering and CI |  |  |  |  |
| Database and recovery |  |  |  |  |
| Authentication and authorization |  |  |  |  |
| Security and abuse prevention |  |  |  |  |
| Privacy and legal readiness |  |  |  |  |
| Accessibility |  |  |  |  |
| Payments, when applicable |  |  |  |  |
| Professional workflow, when applicable |  |  |  |  |
| AI safety, when applicable |  |  |  |  |
| Operations and incident response |  |  |  |  |

### Final decision

```text
Release:
Gate:
Decision: GO / NO-GO
Approved commit SHA:
Approved environment:
Approved feature flags:
Known limitations:
Rollback owner:
Approvers:
Decision timestamp:
```

A `GO` decision is invalid when any required item is incomplete, lacks evidence, or is contradicted by current runtime behavior.

## 32. Document maintenance

Update this checklist whenever any of the following changes:

- deployment platform or runtime;
- environment structure;
- identity provider;
- session model;
- D1 or R2 bindings;
- schema or migration process;
- payment provider;
- report storage or download model;
- professional authorization model;
- AI provider or orchestration framework;
- logging, monitoring, backup, or incident process;
- privacy, legal, accessibility, or responsible-use requirements;
- launch-gate ownership.

The checklist must remain aligned with:

- `README.md`;
- `docs/ARCHITECTURE.md`;
- `docs/API_DATABASE_INVENTORY.md`;
- `docs/CLAIM_INTEGRITY.md`;
- current route handlers;
- current migrations and typed schema;
- current deployment bindings; and
- current Jira release scope.
