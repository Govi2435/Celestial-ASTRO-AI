# ADR-0021: Normalize rendered HTML before visible-text smoke assertions

## Status

Accepted.

## Context

The ASTRO-126 session console heading contains semantic inline markup: `Your signed-in <em>sessions.</em>`. A staging smoke assertion matched the raw HTML against a plain-text phrase, which produced a false failure even though the rendered heading was correct.

## Decision

Staging smoke checks that verify user-visible copy must remove script/style blocks, strip HTML tags, normalize whitespace, and then compare the resulting visible text. CSS and JavaScript asset availability remain separate mandatory checks.

## Consequences

- Semantic markup can change without causing false smoke failures.
- Missing or incorrect visible copy still fails deployment.
- Missing CSS or JavaScript still fails deployment through explicit asset checks.
- No application runtime, authentication, session, D1, or secret behavior changes.
