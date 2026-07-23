# P0 Trust Contract

Status: **Proposed v0.1 — owner approval required**  
Product: **Celestial ASTRO AI**  
Effective date: **Not effective until approved**

## 1. Purpose

This contract defines what Celestial ASTRO AI may calculate, interpret,
generate, and claim. Product, engineering, design, content, AI, marketing, and
commercial decisions must comply with it.

When a future feature conflicts with this contract, the feature must change or
the contract must be deliberately reviewed and versioned. The product must
never silently weaken these rules.

## 2. Brand promise

> Celestial ASTRO AI produces reproducible chart calculations, transparent
> astrological interpretations, and explainable AI responses derived from the
> customer's actual chart—not random content.

Customer-facing short form:

> Your chart. Calculated, explained, understood.

## 3. What the product may promise

Celestial ASTRO AI may promise:

1. The same input and calculation profile produce the same chart output.
2. No chart value or interpretation is filled with random data.
3. The calculation method and relevant settings are visible.
4. Calculated facts and interpretations are clearly separated.
5. AI explanations cite the chart factors used.
6. Uncertain or missing input creates visible limitations.
7. Errors are shown as errors and never converted into plausible-looking
   results.
8. The customer can inspect a Calculation Receipt for every generated chart.

## 4. What the product must not promise

Celestial ASTRO AI must not claim:

- 100% accurate predictions
- scientifically proven astrological interpretations
- guaranteed marriage, career, wealth, pregnancy, illness, death, or legal
  outcomes
- that an AI response is a diagnosis or professional medical, legal, financial,
  or psychological advice
- that a negative event will occur unless a remedy is purchased
- that compatibility can be reduced to an unexplained percentage
- that uncertain birth data produced a precise time-dependent result

Marketing must not use words such as “guaranteed,” “certain,” “destined,” or
“will happen” for interpretive outcomes.

## 5. Required evidence classes

Every meaningful result must belong to one of these classes:

| Class | Meaning | Required behavior |
| --- | --- | --- |
| Calculated | Deterministic output from the recorded birth data and calculation profile | Show method and Calculation Receipt fields |
| Traditional interpretation | A documented astrological rule or interpretive tradition | Show the rule or chart factors used |
| AI explanation | AI-organized language grounded in calculated data and approved interpretation rules | Cite supporting chart factors and identify AI involvement |
| Limited | Precision is reduced by missing, uncertain, conflicting, or unsupported input | State exactly what is limited and suppress unsupported claims |
| Expert reviewed | A named human practitioner reviewed the result | Keep the original calculation record and identify the reviewer and review time |

An AI explanation cannot be relabelled as a calculation. Human review cannot
change planetary positions without creating a corrected chart version.

## 6. Birth-data confidence

The product must record the confidence of the supplied birth data:

- **Exact:** customer states the time is taken from an official or reliable
  record.
- **Approximate:** customer supplies a time but identifies uncertainty.
- **Unknown:** no usable birth time is supplied.

### Exact time

All supported time-dependent features may be calculated, subject to normal
validation and the selected profile.

### Approximate time

The product must:

- store the customer's uncertainty range when known
- show which Ascendant, house, Nakshatra, Dasha, or other outputs may change
- avoid presenting an unstable result as exact
- provide a comparison or confidence range when the engine supports it

### Unknown time

The product must not silently substitute noon, sunrise, or another invented
time as an exact birth time.

Unknown-time mode must:

- suppress the Ascendant, house cusps, house placements, divisional charts, and
  house-dependent yogas
- suppress exact Dasha start or end dates when the Moon's possible movement
  changes the balance
- show a day-wide range for time-sensitive values
- show a placement as stable only when it remains stable throughout the local
  civil day
- label Panchang factors that can change during the day
- allow date-only outputs such as numerology when their own inputs are valid

## 7. Calculation integrity

Every chart must be:

- deterministic
- versioned
- reproducible
- traceable to normalized UTC
- linked to coordinates and an IANA timezone
- linked to a calculation profile
- linked to a calculation engine and data version

The normal customer flow must not ask the customer to calculate a UTC offset.
The product must derive the historical UTC offset and daylight-saving behavior
from the place, local date, local time, and IANA timezone database.

The IANA Time Zone Database is updated when civil-time rules change. The
application must record the timezone database version used for a chart.

Official reference:
[IANA Time Zone Database](https://www.iana.org/time-zones)

## 8. Interpretation integrity

Interpretations must:

- be based on stored calculated factors
- identify the relevant tradition or ruleset
- use possibility-oriented language
- distinguish natal tendencies from current transits or Dashas
- disclose conflicting indicators instead of selecting only dramatic ones
- avoid moral judgments about signs, planets, houses, or people
- allow the customer to open “Why am I seeing this?” evidence

Interpretations must not be generated when their required factors are missing
or unstable.

## 9. AI boundaries

AI may:

- explain calculated chart factors in clearer language
- summarize approved rule-based interpretations
- compare supporting and conflicting chart indicators
- answer questions using the customer's chart and approved knowledge sources
- state uncertainty and request missing information

AI must not:

- invent planets, houses, aspects, Dashas, transits, scores, sources, or user
  history
- answer from a generic horoscope when a personalized chart is unavailable
- hide that it generated or reorganized an explanation
- override calculation-engine output
- make prohibited certainty, fear, health, legal, or financial claims
- recommend costly remedies as necessary to prevent harm

If the grounding data are insufficient, the correct response is a limitation,
not a plausible guess.

## 10. Compatibility

Compatibility results must:

- use named traditional factors or documented comparison rules
- show separate dimensions such as emotional patterns, communication,
  long-term expectations, and likely friction
- expose the evidence for each dimension
- show missing-data limitations for either person

The product must not show an unexplained universal compatibility percentage.

## 11. Privacy baseline

Until durable account and deletion systems are implemented:

- private mode must remain available
- birth data must not be presented as public by default
- saving must require clear customer intent
- logs must not contain unnecessary full birth profiles
- deletion must remove saved profiles and derived reports within the documented
  retention policy
- analytics must not receive full birth time and location unless strictly
  necessary and disclosed

## 12. Commercial boundaries

Payment may unlock depth, convenience, history, reports, professional review,
or recurring updates.

Payment must never:

- unlock a more frightening interpretation
- create artificial urgency around a predicted event
- imply that a paid remedy guarantees safety or success
- hide calculation methods available to free users
- convert an uncertain result into false precision

## 13. Change control

This contract uses semantic versions:

- patch: wording clarification without changing behavior
- minor: new rule that does not weaken existing protections
- major: changed product promise, evidence model, or safety boundary

Every major change requires explicit owner approval and a dated decision record.
