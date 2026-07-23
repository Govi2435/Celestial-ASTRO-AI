# ADR-0007: Approved Career and Relationship Rule Packs

- Status: Accepted
- Date: 2026-07-23
- Phase: P4 — Explainable AI and Chart Evidence

## Context

The first P4 interpretation profile deliberately supported only five core
rules. That was enough to prove the evidence contract, but too narrow for
useful career and relationship questions. Expanding coverage must not introduce
generic text, hidden scoring, guaranteed outcomes, or untested modern
assumptions.

## Decision

The P4 v2 profile contains 15 approved deterministic rules:

- five core rules;
- six career rules; and
- four relationship rules.

The career pack uses the calculated whole-sign 10th house, its traditional
Jyotish sign lord, the lord's calculated sign and house, and the calculated
positions of the Sun, Saturn, Jupiter, Mercury, and Mars.

The relationship pack uses the calculated whole-sign 7th house, its traditional
Jyotish sign lord, the lord's calculated sign and house, Venus, and the Moon.
It interprets themes inside one natal chart only.

Traditional sign lordship is explicit and versioned: Mars rules Aries and
Scorpio; Venus rules Taurus and Libra; Mercury rules Gemini and Virgo; the Moon
rules Cancer; the Sun rules Leo; Jupiter rules Sagittarius and Pisces; and
Saturn rules Capricorn and Aquarius. Outer planets are not used as sign lords
in these packs.

Every rule returns:

- its pack and rule ID;
- the calculated or derived factors used;
- source paths;
- confidence based on birth-time stability; and
- a limitation statement.

`Ask My Chart` may compose career and one-chart relationship answers from these
rules. Compatibility matching, percentages, marriage outcomes, profession
selection, employment promises, salary claims, and guaranteed events remain
outside scope.

## Consequences

- Career and relationship questions are more useful without becoming
  predictive.
- Unknown birth time suppresses both packs because their house evidence is not
  available.
- Approximate birth time marks affected houses and lord placements as limited.
- The interpretation screen can filter core, career, and relationship rules.
- Future compatibility work requires a separate two-chart input and
  certification contract.

## Verification

Automated tests certify all 15 rule IDs, rule-pack counts, whole-sign 7th and
10th house derivation, traditional sign-lord mapping, evidence completeness
across every P2 reference chart, approximate-time limitations, grounded
relationship answers, and continued compatibility refusal.
