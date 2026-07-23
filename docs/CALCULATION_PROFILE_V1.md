# Calculation Profile V1

Status: **Approved v1.0**  
Profile ID: `vedic-lahiri-ws-mean-node-v1`

## 1. Purpose

The initial product must support one well-tested calculation profile before
adding many combinations. This limits ambiguity and makes reference testing
practical.

The first proposed profile is a Vedic sidereal profile with Lahiri ayanamsa,
whole-sign houses, and mean lunar nodes.

## 2. Proposed defaults

| Setting | V1 choice | Notes |
| --- | --- | --- |
| Primary tradition | Vedic astrology | Customer-facing default |
| Zodiac | Sidereal | Tropical mode is postponed until V1 validation is complete |
| Ayanamsa | Lahiri / Chitrapaksha | Exact engine identifier and value must be recorded |
| House system | Whole sign | Ascendant degree remains calculated; each sign forms one house |
| Lunar nodes | Mean Rahu and Ketu | True nodes are postponed as an advanced profile option |
| Position frame | Geocentric | Topocentric options are outside V1 |
| Planet set | Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn | Uranus, Neptune, and Pluto may be displayed separately as modern additions |
| Nodes | Rahu and Ketu | Ketu is exactly opposite the selected Rahu method |
| Dasha system | Vimshottari | Exact year-length convention must be approved and versioned |
| Nakshatra model | 27 equal sidereal divisions | Pada derived from four equal quarters |
| Input time | Local civil time plus IANA timezone | UTC is derived, not manually entered in the normal flow |

## 3. Professional engine requirement

The project selected the **Swiss Ephemeris Professional Licence** route.

P1 may perform implementation and non-public validation. A public service using
Swiss Ephemeris must not be activated until the Professional Licence is
obtained, its deployment scope is confirmed, and required notices are recorded.

Astrodienst states that the licensing choice must be made before software
containing Swiss Ephemeris is distributed or a public service using it is
activated.

Official reference:
[Astrodienst Swiss Ephemeris licensing](https://www.astro.com/swisseph/swephinfo_e.htm)

The backend must pin and record:

- Swiss Ephemeris library version
- ephemeris data/model selected by the library
- sidereal mode identifier
- calculation flags
- house-system identifier
- node identifier

The UI must never display “Swiss Ephemeris” when a fallback engine or
approximation produced the chart.

## 4. Time and location normalization

Required input:

- birth date
- local birth time, unless unknown-time mode is selected
- selected birthplace result

Resolved values:

- canonical place label
- latitude and longitude
- IANA timezone identifier
- historical UTC offset
- daylight-saving status when applicable
- normalized UTC instant
- timezone database version

The customer may correct the detected place or timezone before confirmation.
The original and corrected values must not be confused.

## 5. Input validation

The engine must reject:

- invalid calendar dates
- nonexistent local civil times during a forward DST transition
- ambiguous local times without explicit offset resolution during a backward
  DST transition
- coordinates outside valid ranges
- unsupported ephemeris dates
- missing birthplace when an IANA timezone cannot be resolved

Errors must be explicit. The engine must not silently shift an invalid local
time.

## 6. Unknown-time calculation profile

Unknown-time mode is a separate profile:

Profile ID: `vedic-lahiri-date-range-v1`

It must evaluate the full local civil day and return:

- stable values that do not change across the day
- possible value ranges for changing planets or Panchang factors
- suppressed values for Ascendant, houses, divisional charts, and exact
  time-dependent periods
- a visible `Limited` evidence state

An internal midpoint may be used for performance or comparison only if it is
never exposed as an exact birth time or exact customer result.

## 7. Postponed profile options

These are not part of the first validated profile:

- tropical zodiac
- true lunar nodes
- Raman, KP, or other ayanamsas
- Placidus, equal, or other house systems
- topocentric planetary positions
- divisional charts
- additional Dasha systems
- rectification

They may be introduced as separately versioned profiles after V1 reference
tests pass.

## 8. Approved Dasha convention with validation gate

V1 approves `365.2425` days per year as the deterministic civil-date conversion
convention for Vimshottari Dasha calculations.

P2 must validate this convention against the selected traditional reference and
golden chart fixtures. If validation requires a different convention, the
calculation profile must receive a new version; existing receipts must remain
reproducible under this V1 profile.
