# Evidence and Language Policy

Status: **Approved v1.0**  
Approved by: **Govinda Prajapati**  
Effective date: **2026-07-23**

## 1. Purpose

This policy defines the visible labels, evidence requirements, and allowed
language for calculated results, traditional interpretations, AI explanations,
and limited results.

## 2. Required visible labels

### Calculated

Meaning:

> Computed from the confirmed birth data using the calculation method shown in
> the Calculation Receipt.

Use for:

- normalized UTC
- planetary longitude
- sign placement
- Ascendant
- houses
- Nakshatra and Pada
- Panchang factors
- Dasha dates
- detected transits

Do not use for interpretation or advice.

### Traditional interpretation

Meaning:

> An astrological interpretation based on the chart factors and tradition
> shown below. It is not a scientifically proven prediction.

Required evidence:

- named chart factors
- named ruleset or tradition
- conflicting factors when relevant
- time-confidence limitation

### AI explanation

Meaning:

> AI organized this explanation from the calculated chart and approved
> interpretation rules. Review the supporting factors below.

Required evidence:

- calculated factor identifiers
- interpretation rule identifiers
- model and prompt-policy version in internal audit data
- visible “Why am I seeing this?” explanation

### Limited

Meaning:

> This result is incomplete or may change because required information is
> missing, uncertain, conflicting, or unsupported.

Required detail:

- missing or uncertain input
- affected outputs
- whether a range is available
- what the customer can provide to improve confidence

### Expert reviewed

Meaning:

> A human practitioner reviewed this interpretation. The underlying
> calculation remains unchanged unless a corrected chart version is shown.

Required detail:

- practitioner identity
- review date
- reviewed interpretation version
- corrected chart reference, if applicable

## 3. Language scale

| Strength | Allowed example | Use |
| --- | --- | --- |
| Calculated fact | “Mars is at 12°14′ Leo in this calculation profile.” | Deterministic chart output |
| Traditional association | “In this tradition, Mars in Leo is associated with direct self-expression.” | Rule-based interpretation |
| Balanced tendency | “This may emphasize confidence, while Saturn factors shown below may add caution.” | Multi-factor synthesis |
| Time-limited theme | “During this Dasha, these topics are traditionally emphasized.” | Period interpretation |
| Limitation | “Without a confirmed birth time, houses and the Ascendant cannot be calculated reliably.” | Missing or uncertain data |

## 4. Prohibited language

Do not generate:

- “This will definitely happen.”
- “Your marriage will fail.”
- “You will become rich in this year.”
- “You have a disease because of this planet.”
- “You must buy this remedy to avoid danger.”
- “Your compatibility is 92%” without a documented and visible scoring model.
- “The system knows your future.”
- “Swiss Ephemeris verified this interpretation.”

An ephemeris calculates astronomical positions. It does not validate an
astrological interpretation.

## 5. “Why am I seeing this?” structure

Every important interpretation should expose:

1. **Claim:** the concise interpretation shown to the customer.
2. **Calculated factors:** relevant planets, signs, houses, aspects, Dashas, or
   transits.
3. **Traditional rule:** the approved interpretation rule applied.
4. **Supporting factors:** factors that strengthen the interpretation.
5. **Conflicting factors:** factors that weaken or complicate it.
6. **Confidence:** input confidence and rule confidence.
7. **Source class:** calculated, traditional, AI explanation, limited, or
   expert reviewed.

## 6. AI refusal and limitation behavior

The AI must decline or reframe:

- medical diagnosis or treatment decisions
- legal conclusions
- investment or gambling instructions
- guaranteed pregnancy, death, accident, illness, marriage, divorce, or job
  dates
- requests to frighten another person using their chart
- claims unsupported by the available chart

The AI may offer reflective, non-deterministic questions and recommend an
appropriate qualified professional when the topic is high stakes.

## 7. Compatibility language

Compatibility should use named dimensions:

- emotional patterns
- communication
- expectations and values
- conflict style
- long-term routines
- traditional matching factors
- data confidence

Each dimension must show evidence and limitations. A combined score is allowed
only if its formula, weights, required inputs, and uncertainty are visible.
The V1 product should not use a combined percentage.

## 8. Marketing language

Preferred:

- “Transparent calculations”
- “Evidence behind every interpretation”
- “Derived from your confirmed chart”
- “Traditional interpretation, clearly labelled”
- “AI explanations grounded in your chart”

Avoid:

- “Perfectly predicts your future”
- “Scientifically proven astrology”
- “Guaranteed accuracy”
- “Secret truth nobody else will tell you”
- “Act now before something bad happens”
