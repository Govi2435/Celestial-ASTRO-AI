# P2 Reference Chart Certification

Certificate: `CAA-P2-RCC-20260723-01`
Profile: `reference-chart-cert-v1`
Status: Passed
Issued: 2026-07-23

## What this certificate means

P2 is an internal reproducibility certificate for the exact versioned
calculation profile shipped by Celestial ASTRO AI. Every release must reproduce
the pinned outputs or the automated test gate fails.

It is not third-party accreditation, scientific validation of astrology, or a
guarantee that interpretations or predictions are true.

## Reference-chart coverage

| Case | Timezone condition | Chart mode |
| --- | --- | --- |
| Anand, India | UTC+05:30, no DST | Exact time |
| New York, USA | Historical daylight time | Exact time |
| London, UK | Historical standard time | Exact time |
| Sydney, Australia | Southern-hemisphere daylight time | Exact time |
| Kathmandu, Nepal | UTC+05:45 quarter-hour offset | Approximate time |
| Anand, India | Complete local civil day | Unknown time |

The five timed charts pin:

- normalized UTC and historical offset;
- ayanamsa and Ascendant;
- all 60 Sun, Moon, planet, Rahu, and Ketu placements;
- signs, whole-sign houses, and retrograde flags;
- Nakshatra, Pada, Tithi, Paksha, and Yoga;
- approximate-time stability behavior.

## Edge conditions

The suite also rejects:

- a local clock time that never existed during a DST spring-forward; and
- a duplicated local clock time during a DST fall-back.

Unknown-time mode must suppress the Ascendant, houses, exact Dasha dates,
divisional charts, and house-dependent rules.

## Independent evidence versus regression evidence

The 20 NASA/JPL Horizons DE441 comparisons are external astronomical reference
evidence. The five full-chart fixtures are pinned regression evidence: they
prove that the named engine profile remains deterministic across releases, not
that an independent body endorses the astrological model.

## Acceptance criteria

- Every NASA/JPL longitude comparison: at most 1 arcminute delta.
- All 60 pinned chart placements: exact match at six decimal places.
- All normalized UTC values, offsets, signs, houses, Panchang values, and
  suppression rules: exact match.
- Mean Rahu and Ketu: exactly 180 degrees apart after six-decimal rounding.
- Any mismatch blocks the release checkpoint.

Machine-readable certificate endpoint: `/api/certification`
