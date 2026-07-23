# ADR-0003: Reference chart certification

Status: Accepted
Date: 2026-07-23

## Decision

Every calculation-engine release must pass a versioned internal reference-chart
certificate before deployment.

The certificate separates:

1. external astronomical comparison against NASA/JPL Horizons;
2. pinned full-chart regression fixtures for the named sidereal, house, node,
   Panchang, and time-handling profile; and
3. explicit limitations that prevent the certificate from being represented as
   third-party accreditation or prediction validation.

## Release rule

A change to engine mathematics, ayanamsa, nodes, houses, timezone behavior, or
certified fixture output requires:

- a new calculation or certification profile identifier;
- reviewed fixture changes;
- updated scope documentation; and
- a newly issued certificate.

## Consequences

- Silent calculation drift blocks deployment.
- Customers can see the certificate ID in every Calculation Receipt.
- The public certificate endpoint exposes the tested scope and limitations.
- The product must never market P2 as independent certification.
