# Calculation Receipt Specification

Status: **Proposed v0.1 — owner approval required**  
Receipt schema: `calculation-receipt-v1`

## 1. Purpose

The Calculation Receipt allows a customer, tester, or practitioner to reproduce
and audit a chart. It is evidence of how the calculation was produced; it is
not proof that an astrological interpretation is scientifically valid.

Every completed chart must have one immutable receipt. A corrected input or
changed profile creates a new chart and receipt.

## 2. Customer-visible receipt

### Birth input

- supplied birth date
- supplied local birth time, including seconds when provided
- birth-time confidence: exact, approximate, or unknown
- uncertainty range when provided
- selected birthplace label

### Normalized place and time

- latitude and longitude
- IANA timezone identifier
- historical UTC offset
- daylight-saving status when applicable
- normalized UTC date and time
- timezone database version

### Calculation method

- calculation profile name and ID
- zodiac: sidereal or tropical
- ayanamsa name, engine identifier, and calculated value
- house system and identifier
- lunar-node method
- position frame
- included planet set
- Dasha system and year-length convention

### Engine

- calculation-engine name
- library version
- ephemeris data/model
- calculation flags
- application calculation-service version
- fallback status

### Provenance

- chart ID
- receipt schema version
- calculation timestamp in UTC
- deterministic input hash
- superseded chart ID when this is a correction

## 3. Internal audit fields

The internal record should additionally retain:

- raw geocoding provider result identifier
- customer-selected place candidate
- timezone resolution method
- unrounded longitudes and house values
- exact engine return codes and warnings
- calculation duration
- rule-engine version
- interpretation version
- AI policy and prompt-template version when AI is used

Sensitive inputs must not be placed in ordinary application logs.

## 4. Display rules

- Display rounded values for readability while retaining unrounded audit data.
- Never show greater precision than the engine and input confidence support.
- Clearly identify a fallback engine or approximation.
- Put warnings before derived interpretations.
- Allow the customer to copy or download the receipt.
- Keep the receipt available with a purchased report.

## 5. Unknown-time receipt

For unknown time, the receipt must show:

- `birth_time_confidence: unknown`
- start and end of the evaluated local civil day
- corresponding UTC range
- stable placements
- changing placement ranges
- suppressed result types
- no invented exact UTC instant

## 6. Deterministic input hash

The hash should be generated from a canonical, versioned representation of:

- normalized birth input
- resolved location and timezone
- calculation profile
- calculation-engine version
- ephemeris version
- application calculation-service version

The public receipt may expose a shortened fingerprint. The complete internal
hash should be retained for auditing.

## 7. Failure behavior

No successful receipt may be produced when:

- UTC conversion is unresolved
- local time is invalid or DST ambiguity is unresolved
- the calculation engine returns an unhandled error
- required profile settings are missing
- the requested date is outside the supported ephemeris range

The customer must receive a clear error instead of a partial result disguised
as complete.
