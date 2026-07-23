# ADR-0006: Grounded Ask My Chart

- Status: Accepted
- Date: 2026-07-23
- Phase: P4 — Explainable AI and Chart Evidence

## Context

Celestial ASTRO AI needs a question-answer experience without weakening the
existing calculation receipt and interpretation evidence contracts. A generic
language model could produce fluent but unsupported astrology claims, and a
paid model dependency is not appropriate for the current free route.

## Decision

`Ask My Chart` uses a deterministic evidence router in this checkpoint.

For every question, the server:

1. recalculates the chart from the verified birth inputs;
2. rebuilds the approved P4 interpretation report;
3. routes the question to a supported intent;
4. composes an answer only from approved interpretation statements; and
5. returns the exact rule IDs, evidence values, source paths, limitations, and
   linked chart receipt.

The active intents are overview, identity, emotions, communication, drive,
current cycle, and an explicitly limited career-decision reflection.

Relationship or compatibility questions are marked unsupported until dedicated
Venus, seventh-house, and compatibility rules are defined and tested. Guaranteed
prediction and medical, legal, financial, or mental-health requests are
refused. Attempts to override the evidence contract are also refused.

No generative model is called in this version. Questions and answers are not
stored.

## Consequences

- Supported answers are reproducible for the same calculated chart and question
  intent.
- Every substantive sentence can be inspected through its source rules and
  chart factors.
- The experience is narrower than a generic chatbot, but it does not fabricate
  unsupported astrology content.
- A future language model may improve phrasing only after it can be constrained
  to the same answer schema and verified against the same grounding tests.

## Verification

Automated tests require supported answers to expose approved rule IDs and source
paths. Tests also verify unknown-time limitations, unsupported relationship
questions, prediction refusal, high-stakes refusal, and resistance to
instruction-override prompts.
