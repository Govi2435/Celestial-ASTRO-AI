# Celestial Calculation Engine 1.0.0

## Active route

Celestial ASTRO AI uses Astronomy Engine 2.1.19 as its astronomical kernel.
The package is pinned exactly and is distributed under the MIT licence.

The product-facing engine name is **Celestial Calculation Engine 1.0.0**.
Receipts expose both that product profile and the underlying kernel. The
application does not contain or claim to use Swiss Ephemeris.

## Planetary reference set

The repository pins 20 apparent geocentric ecliptic-longitude values obtained
from the NASA/JPL Horizons API:

- Source ephemeris: DE441
- Center: Earth geocenter (`500@399`)
- Quantity: 31, observer ecliptic longitude and latitude
- Frame: observer-centered IAU76/80 ecliptic-of-date
- Corrections: light-time, gravitational deflection, and stellar aberration
- Atmosphere: airless
- Epochs: `2000-01-01T12:00:00Z` and `2024-04-08T18:00:00Z`
- Bodies: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
- Captured: 2026-07-23

Across this fixed set, the maximum observed longitude delta is
`0.189561 arcminute` and the mean delta is `0.053413 arcminute`. The automated
acceptance threshold is 1 arcminute.

These numbers describe only the pinned reference set. They are not a universal
precision guarantee and do not validate astrological interpretations.

NASA/JPL documentation:
https://ssd-api.jpl.nasa.gov/doc/horizons.html

## Sidereal profile

The current sidereal profile is
`mean-lahiri-j2000-linear-v1`. It uses:

```text
ayanamsa = 23.85675 degrees
         + years_from_J2000 * 50.290966 arcseconds/year
```

This is an explicit, deterministic mean Lahiri/Chitrapaksha model. It must not
be represented as Swiss Ephemeris Lahiri output. Alternate ayanamsas require
separate profile IDs and fixtures.

## Houses and nodes

- Houses: whole-sign houses from the calculated Ascendant
- Nodes: mean lunar node; Ketu is exactly 180 degrees opposite Rahu
- Unknown birth time: Ascendant, houses, exact Dasha dates, and house-dependent
  rules are suppressed

The JPL fixture set validates planetary longitudes only. It does not validate
the ayanamsa, Ascendant, houses, lunar nodes, Dashas, or Jyotish rules.
