export const JPL_HORIZONS_FIXTURES = [
  {
    epoch: "2000-01-01T12:00:00Z",
    values: {
      Sun: 280.3689092,
      Moon: 223.323786,
      Mercury: 271.8892699,
      Venus: 241.5657794,
      Mars: 327.9632921,
      Jupiter: 25.2530685,
      Saturn: 40.3956366,
      Uranus: 314.809168,
      Neptune: 303.1930007,
      Pluto: 251.4547644,
    },
  },
  {
    epoch: "2024-04-08T18:00:00Z",
    values: {
      Sun: 19.3861885,
      Moon: 19.1832147,
      Mercury: 24.8070865,
      Venus: 4.427195,
      Mars: 343.0401557,
      Jupiter: 49.042528,
      Saturn: 344.4536677,
      Uranus: 51.1703807,
      Neptune: 358.1896143,
      Pluto: 301.9674783,
    },
  },
] as const;

export const JPL_HORIZONS_FIXTURE_METADATA = {
  source: "NASA/JPL Horizons",
  sourceEphemeris: "DE441",
  apiResponseSignatureVersion: "1.2",
  center: "500@399 (Earth geocenter)",
  quantity: "31 (observer ecliptic longitude and latitude)",
  frame: "observer-centered IAU76/80 ecliptic-of-date",
  corrections: "apparent; light-time, gravitational deflection, and stellar aberration",
  atmosphere: "airless",
  capturedAt: "2026-07-23",
  documentation: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
} as const;
