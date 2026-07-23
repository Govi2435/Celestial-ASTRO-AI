from pathlib import Path


def replace_required(path: str, old: str, new: str, minimum: int = 1):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"Expected at least {minimum} occurrence(s) in {path}: {old!r}; found {count}")
    file.write_text(text.replace(old, new))
    print(f"{path}: replaced {count} occurrence(s) of {old!r}")


replace_required(
    "app/layout.tsx",
    "with verified birth data, visible calculation receipts, and traditional interpretations linked to exact chart evidence.",
    "with submitted birth details, visible calculation receipts, and traditional interpretations linked to calculated chart evidence.",
)

page = "app/page.tsx"
for old, new in [
    ("AI STATUS", "RESPONSE MODE"),
    ("Grounded answers active", "Deterministic router • no generative model"),
    ('href="/api/interpretation-profile"', 'href="/api/ask-my-chart"'),
    ("Your chart, designed as a private observatory folio.", "Your chart, designed as a direct-download observatory folio."),
    ("The server recalculates your birth details, rebuilds the approved evidence, and creates a receipt-linked PDF. Browser", "The server recalculates submitted birth details, rebuilds approved evidence, and returns a receipt-linked PDF directly. The current"),
    ("placements are never trusted and the generated file is not stored.", "P5 route does not store the file and is not yet protected by account, ownership, or subscription checks."),
    ("Midnight observatory edition", "Direct download • access protection pending"),
    ("Server calculation • no saved birth data", "Server calculation • current routes do not persist birth data"),
    ("P2 certificate passed • 15 evidence-linked rules active", "Internal P2 checks passed • 15 deterministic rules active"),
    ("verified birth data", "submitted birth details"),
    ("Birth data stays unsaved", "Current routes do not persist birth data"),
    ("CELESTIAL OBSERVATORY / LIVE", "CELESTIAL OBSERVATORY / CURRENT BUILD"),
    ("<i /> Operational", "<i /> Runtime active"),
    ("The pinned NASA/JPL DE441 reference set passed.", "The pinned NASA/JPL Horizons fixtures passed the documented threshold; this is not NASA certification or a universal accuracy claim."),
    ("recalculates the same verified chart", "recalculates the chart from the same submitted birth inputs"),
    ("verified inputs", "submitted inputs"),
    ("P2 certification passed", "P2 internal validation checks passed"),
    ("REFERENCE CHART CERTIFICATION", "INTERNAL REFERENCE VALIDATION"),
    ("Reproducible across real-world time conditions.", "Pinned fixtures reproduced across selected time conditions."),
    ("View machine-readable certificate ↗", "View machine-readable validation record ↗"),
    ("NASA/JPL comparisons", "pinned NASA/JPL checks"),
    ("Apparent geocentric planetary longitudes with a one-arcminute acceptance threshold.", "Pinned apparent geocentric longitude fixtures checked against a one-arcminute threshold; not NASA certification."),
    ("P2 reference-chart regression certificate on every release", "P2 pinned reference regression record for the current build"),
    ("Private, server-recalculated premium PDF with chart evidence and receipt", "Direct-download, server-recalculated premium PDF; account protection pending"),
    ("Free MIT accuracy route • P2 certified • P4 evidence contract • P5 premium report", "MIT calculation route • internal P2 validation • P4 evidence contract • P5 direct-download report"),
    ("P2\n             certificate used", "internal P2\n             validation record used"),
    ("Verified birth details", "Submitted birth details"),
    ("Verified manual location", "Manual location entry"),
    ("Verified manual entry", "Manual user entry"),
    ("P2 certificate", "P2 internal validation"),
    ("Certified coverage", "Validated coverage"),
]:
    replace_required(page, old, new)

report = "app/premium-report.ts"
for old, new in [
    ('return safeText(name) || "Private chart";', 'return safeText(name) || "Unnamed chart";'),
    ('addPage(context, "Premium Natal Report", "P5 verified report")', 'addPage(context, "Premium Natal Report", "P5 receipt-linked report")'),
    ('"A verified date-range profile"', '"A date-range profile with unknown-time suppression"'),
    ("receipt-verified", "receipt-linked"),
    ('["P2 certificate",', '["P2 internal validation",'),
    ('["Certified coverage",', '["Validated coverage",'),
    ("reference-certificate coverage", "internal reference-validation coverage"),
    ("This certificate covers calculation reproducibility. It does not scientifically validate astrology.", "This internal validation record covers calculation reproducibility only; it is not external accreditation or scientific validation of astrology."),
    ('"Versioned calculation receipt and P2 certificate",', '"Versioned calculation receipt and internal P2 validation record",'),
    ('privacy: "Generated on demand and not stored",', 'privacy: "Generated on demand, returned directly, and not stored by the current route; account, ownership, and entitlement protection are not active in P5",'),
]:
    replace_required(report, old, new)

replace_required(
    "app/engine-profile.ts",
    'validationSummary: "20 NASA/JPL Horizons DE441 positions; max observed delta 0.190′",',
    'validationSummary: "20 pinned NASA/JPL Horizons DE441 position fixtures; max observed delta 0.190′; internal comparison only, not NASA certification",',
)
replace_required(
    "app/certification-profile.ts",
    'name: "P2 Reference Chart Certification",',
    'name: "P2 Internal Reference Validation",',
)
replace_required(
    "app/certification-profile.ts",
    'summary: "5 full charts, 60 placements, 20 NASA/JPL positions, and 8 time-handling scenarios passed",',
    'summary: "5 pinned full charts, 60 placements, 20 NASA/JPL comparison fixtures, and 8 time-handling scenarios passed the internal regression suite",',
)
replace_required(
    "app/certification-profile.ts",
    '"Internal reproducibility certificate for the named calculation profile; not third-party accreditation or validation of astrological predictions.",',
    '"Internal reproducibility validation for the named calculation profile; not NASA certification, third-party accreditation, universal accuracy certification, or validation of astrological predictions.",',
)

for old, new in [
    ("evidence-linked traditional interpretations, private reports, and consent-aware product foundations.", "evidence-linked traditional interpretations, server-generated direct-download reports, and consent-aware product foundations."),
    ("Active — internal certificate passed", "Active — internal validation suite passed"),
    ("Private server-generated premium PDF report", "Server-generated direct-download premium PDF report"),
    ("## Calculation Receipt and P2 certification", "## Calculation Receipt and P2 internal validation"),
    ("P2 certification metadata", "P2 internal-validation metadata"),
    ("The P2 certificate is an **internal reproducibility certificate**, not third-party accreditation.", "The P2 validation record documents an **internal reproducibility suite**, not NASA certification or third-party accreditation."),
]:
    replace_required("README.md", old, new)

for old, new in [
    ("the engine and reference certificate are active", "the engine and internal reference-validation record are visible"),
    ("birth data is not saved", "current calculation routes do not persist birth data"),
    ("methodology and certification remain directly inspectable", "methodology and internal validation remain directly inspectable"),
]:
    replace_required("docs/DECISIONS/ADR-0004-PREMIUM-OBSERVATORY-UI.md", old, new)

Path("docs/CLAIM_INTEGRITY.md").write_text("""# Celestial ASTRO AI — Claim Integrity Policy

- Status: Source of truth
- Jira: `KAN-16 / ASTRO-104`
- Scope: README, product UI, metadata, reports, pitch material, API profiles, and release communication

This policy prevents roadmap ideas, internal tests, or code foundations from being marketed as active production capabilities.

## Current claim baseline

The current build may state that server-side calculations use Astronomy Engine `2.1.19`, the versioned mean Lahiri profile, whole-sign houses for timed charts, mean lunar nodes, historical timezone handling, honest birth-time uncertainty, calculation receipts, deterministic evidence-linked interpretation, and an on-demand direct-download PDF.

P6–P8 remain domain, migration, test, and ADR foundations. They are not live account, billing, or professional product surfaces.

## NASA/JPL reference language

Allowed:

> The internal regression suite compares 20 pinned apparent geocentric longitude fixtures with NASA/JPL Horizons DE441 data. The maximum observed delta in that pinned set is documented by the engine profile.

Required limitation:

> This is an internal fixture comparison. It is not NASA certification, third-party accreditation, proof of universal accuracy, or validation of astrology.

Never use `NASA-grade`, `NASA certified`, `NASA-powered astrology`, scientific proof of predictions, or accuracy claims broader than the documented kernel target and pinned fixture set.

## Swiss Ephemeris language

Swiss Ephemeris may be described only as a possible future calculation service subject to licensing, implementation, migration tests, and independent validation. Never state or imply that it powers the current public route.

## Artificial-intelligence language

Current truth:

```text
responseEngine: deterministic-evidence-router
generativeModel: none
```

Allowed terms include deterministic evidence router, approved rule engine, and evidence-linked chart questions. Never state or imply that the current feature uses an LLM, RAG, agent handoffs, multi-agent orchestration, model memory, or generative streaming.

## Privacy and production-security language

Current truth:

- calculation, question, and PDF routes do not persist application records;
- the PDF route returns a direct download and does not store the generated file;
- D1 and R2 bindings are not configured in the recorded hosting configuration;
- authentication, sessions, CSRF protection, tenant authorization, payment verification, and report-library access control are not active;
- P6–P8 are foundations rather than public account, billing, or professional surfaces.

Allowed terms include `current routes do not persist birth data`, `direct-download report`, `generated file is not stored by the current route`, and `account protection pending`.

Never claim end-to-end encryption, full production security, a live private vault, subscription-protected reports, enterprise readiness, legal compliance, zero-knowledge privacy, or tenant isolation before the implementation and tests exist.

The word `private` may describe the HTTP `Cache-Control: private` directive only when that protocol meaning is explicit. It must not imply authenticated ownership, encrypted storage, or tenant isolation.

## Internal-validation language

The P2 record is an internal reproducibility validation. Public copy should prefer `internal P2 validation`, `pinned reference regression suite`, `validation record`, or `internal checks passed`.

The stable schema and route may retain `certificate` identifiers for compatibility, but surrounding copy must state that the record is internal and not external accreditation.

## Feature activation rule

A model, migration, test, or ADR does not make a feature active. A customer-facing feature may be called active only when its route, identity boundary, authorization, persistence, UI, security tests, deployment binding, monitoring, and operating process are complete.

## Release checklist

1. Confirm engine and dependency versions.
2. Limit NASA/JPL wording to pinned internal comparisons.
3. Keep Swiss Ephemeris labelled future unless activated and validated.
4. Do not label deterministic routing as generative AI.
5. Do not market P6–P8 foundations as live surfaces.
6. Do not market the P5 download as account-secured or subscription-protected.
7. Require evidence for encryption, compliance, latency, security, and accuracy claims.
8. Label future capabilities as future, planned, gated, or experimental.
9. Keep the responsible-use disclaimer visible.
10. Run the claim-integrity regression test.

Update this policy whenever an engine, provider, identity system, storage binding, payment system, AI runtime, security control, validation process, or public surface becomes active.
""")

Path("tests/claim-integrity.test.mjs").write_text(r'''import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const layout = read("app/layout.tsx");
const report = read("app/premium-report.ts");
const readme = read("README.md");
const combined = [page, layout, report, readme].join("\n");

test("public copy does not claim unsupported active capabilities", () => {
  for (const banned of [
    /NASA-grade/i,
    /NASA certified/i,
    /powered by Swiss Ephemeris/i,
    /sub-arcsecond production accuracy/i,
    /end-to-end encrypted/i,
    /fully secure/i,
    /production-secure/i,
    /zero-latency AI/i,
    /multi-agent AI is active/i,
  ]) assert.doesNotMatch(combined, banned);
});

test("deterministic Ask My Chart is not labelled active generative AI", () => {
  assert.doesNotMatch(page, /AI STATUS/);
  assert.doesNotMatch(page, /Grounded answers active/);
  assert.match(page, /Deterministic router • no generative model/);
});

test("P5 report discloses the missing account-protection boundary", () => {
  assert.doesNotMatch(page, /private observatory folio/i);
  assert.doesNotMatch(page, /Private, server-recalculated premium PDF/i);
  assert.match(page, /not yet protected by account, ownership, or subscription checks/i);
  assert.match(report, /account, ownership, and entitlement protection are not active in P5/i);
});

test("NASA\/JPL language remains qualified as internal fixture validation", () => {
  assert.match(page, /not NASA certification/i);
  assert.match(readme, /not NASA certification or third-party accreditation/i);
});
''')

replace_required(
    "package.json",
    "tests/billing.test.ts tests/professional-dashboard.test.ts\"",
    "tests/billing.test.ts tests/professional-dashboard.test.ts tests/claim-integrity.test.mjs\"",
)
