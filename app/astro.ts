import {
  Body,
  Ecliptic,
  EclipticGeoMoon,
  GeoVector,
  SiderealTime,
  SunPosition,
} from "astronomy-engine";

export type ZodiacSystem = "lahiri" | "tropical";

export type BirthInput = {
  name: string;
  location: string;
  date: string;
  time: string;
  utcOffset: number;
  latitude: number;
  longitude: number;
  system: ZodiacSystem;
};

export type PlanetPosition = {
  name: string;
  short: string;
  glyph: string;
  tropicalLongitude: number;
  longitude: number;
  signIndex: number;
  sign: string;
  degreeInSign: number;
  house: number;
  retrograde: boolean;
};

export type DashaSegment = {
  lord: string;
  start: Date;
  end: Date;
  current: boolean;
};

export type RuleCheck = {
  name: string;
  status: "present" | "clear" | "not-applicable";
  detail: string;
};

export type ChartResult = {
  input: BirthInput;
  utcDate: Date;
  ayanamsa: number;
  ascendantLongitude: number;
  ascendantTropical: number;
  ascendantSignIndex: number;
  ascendantSign: string;
  ascendantDegree: number;
  planets: PlanetPosition[];
  moonNakshatra: string;
  moonPada: number;
  tithi: string;
  paksha: string;
  yoga: string;
  dashas: DashaSegment[];
  rules: RuleCheck[];
  numerology: {
    lifePath: number;
    expression: number | null;
    soulUrge: number | null;
    personalYear: number;
  };
};

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

export const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

export const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];

const YOGAS = [
  "Vishkambha",
  "Priti",
  "Ayushman",
  "Saubhagya",
  "Shobhana",
  "Atiganda",
  "Sukarma",
  "Dhriti",
  "Shula",
  "Ganda",
  "Vriddhi",
  "Dhruva",
  "Vyaghata",
  "Harshana",
  "Vajra",
  "Siddhi",
  "Vyatipata",
  "Variyana",
  "Parigha",
  "Shiva",
  "Siddha",
  "Sadhya",
  "Shubha",
  "Shukla",
  "Brahma",
  "Indra",
  "Vaidhriti",
];

const TITHIS = [
  "Pratipada",
  "Dwitiya",
  "Tritiya",
  "Chaturthi",
  "Panchami",
  "Shashthi",
  "Saptami",
  "Ashtami",
  "Navami",
  "Dashami",
  "Ekadashi",
  "Dwadashi",
  "Trayodashi",
  "Chaturdashi",
  "Purnima",
];

const DASHA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];
const DAYS_PER_YEAR = 365.2425;

const PLANET_DEFINITIONS = [
  { name: "Sun", short: "Su", glyph: "☉", body: Body.Sun },
  { name: "Moon", short: "Mo", glyph: "☽", body: Body.Moon },
  { name: "Mercury", short: "Me", glyph: "☿", body: Body.Mercury },
  { name: "Venus", short: "Ve", glyph: "♀", body: Body.Venus },
  { name: "Mars", short: "Ma", glyph: "♂", body: Body.Mars },
  { name: "Jupiter", short: "Ju", glyph: "♃", body: Body.Jupiter },
  { name: "Saturn", short: "Sa", glyph: "♄", body: Body.Saturn },
  { name: "Uranus", short: "Ur", glyph: "♅", body: Body.Uranus },
  { name: "Neptune", short: "Ne", glyph: "♆", body: Body.Neptune },
  { name: "Pluto", short: "Pl", glyph: "♇", body: Body.Pluto },
] as const;

function normalize(value: number) {
  return ((value % 360) + 360) % 360;
}

function signedAngle(value: number) {
  const angle = normalize(value);
  return angle > 180 ? angle - 360 : angle;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function julianDay(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/**
 * Mean Lahiri/Chitrapaksha ayanamsa anchored at J2000 and advanced using
 * the general precession rate. This is deliberately labelled "mean Lahiri"
 * in the interface and is not presented as Swiss Ephemeris output.
 */
export function lahiriMeanAyanamsa(date: Date) {
  const yearsFromJ2000 = (julianDay(date) - 2_451_545.0) / 365.2425;
  return 23.85675 + (yearsFromJ2000 * 50.290966) / 3600;
}

function tropicalLongitude(body: Body, date: Date) {
  if (body === Body.Sun) return normalize(SunPosition(date).elon);
  if (body === Body.Moon) return normalize(EclipticGeoMoon(date).lon);
  return normalize(Ecliptic(GeoVector(body, date, true)).elon);
}

function meanNodeLongitude(date: Date) {
  const t = (julianDay(date) - 2_451_545.0) / 36_525;
  return normalize(125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450_000);
}

function calculateAscendant(date: Date, latitude: number, longitude: number) {
  const t = (julianDay(date) - 2_451_545.0) / 36_525;
  const obliquity = 23.43929111 - 0.013004167 * t - 0.000000164 * t * t;
  const localSidereal = normalize(SiderealTime(date) * 15 + longitude);
  const theta = toRadians(localSidereal);
  const epsilon = toRadians(obliquity);
  const phi = toRadians(latitude);
  return normalize(
    toDegrees(
      Math.atan2(
        -Math.cos(theta),
        Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon),
      ),
    ),
  );
}

function createUtcDate(input: BirthInput) {
  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = input.time.split(":").map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - input.utcOffset * 3_600_000;
  return new Date(utcMillis);
}

function nakshatraAt(longitude: number) {
  const span = 360 / 27;
  const index = Math.floor(normalize(longitude) / span);
  const within = normalize(longitude) % span;
  return {
    index,
    name: NAKSHATRAS[index],
    pada: Math.floor(within / (span / 4)) + 1,
    fraction: within / span,
  };
}

function addYears(date: Date, years: number) {
  return new Date(date.getTime() + years * DAYS_PER_YEAR * 86_400_000);
}

function vimshottariTimeline(birthDate: Date, moonLongitude: number) {
  const nakshatra = nakshatraAt(moonLongitude);
  let lordIndex = nakshatra.index % 9;
  const elapsedYears = DASHA_YEARS[lordIndex] * nakshatra.fraction;
  let start = addYears(birthDate, -elapsedYears);
  const segments: DashaSegment[] = [];
  const now = new Date();

  for (let index = 0; index < 18; index += 1) {
    const end = addYears(start, DASHA_YEARS[lordIndex]);
    segments.push({
      lord: DASHA_LORDS[lordIndex],
      start,
      end,
      current: now >= start && now < end,
    });
    start = end;
    lordIndex = (lordIndex + 1) % 9;
  }

  const currentIndex = Math.max(0, segments.findIndex((segment) => segment.current));
  return segments.slice(Math.max(0, currentIndex - 2), currentIndex + 4);
}

function reduceNumber(value: number, preserveMasters = true): number {
  let number = Math.abs(Math.trunc(value));
  while (number > 9 && !(preserveMasters && [11, 22, 33].includes(number))) {
    number = String(number)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return number;
}

function nameNumber(name: string, vowelsOnly = false) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const filtered = vowelsOnly ? letters.split("").filter((letter) => "AEIOU".includes(letter)).join("") : letters;
  if (!filtered) return null;
  const total = filtered.split("").reduce((sum, letter) => sum + ((letter.charCodeAt(0) - 65) % 9) + 1, 0);
  return reduceNumber(total);
}

function numerology(input: BirthInput) {
  const dateDigits = input.date.replace(/\D/g, "");
  const lifePath = reduceNumber(dateDigits.split("").reduce((sum, digit) => sum + Number(digit), 0));
  const [, month, day] = input.date.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const personalYear = reduceNumber(
    reduceNumber(month, false) +
      reduceNumber(day, false) +
      reduceNumber(String(currentYear).split("").reduce((sum, digit) => sum + Number(digit), 0), false),
    false,
  );
  return {
    lifePath,
    expression: nameNumber(input.name),
    soulUrge: nameNumber(input.name, true),
    personalYear,
  };
}

function calculateRuleChecks(planets: PlanetPosition[], input: BirthInput): RuleCheck[] {
  if (input.system === "tropical") {
    return [
      {
        name: "Vedic rule checks",
        status: "not-applicable",
        detail: "Select mean Lahiri sidereal to evaluate these Jyotish rules.",
      },
    ];
  }

  const byName = Object.fromEntries(planets.map((planet) => [planet.name, planet]));
  const mars = byName.Mars;
  const moon = byName.Moon;
  const rahu = byName.Rahu;
  const mercury = byName.Mercury;
  const sun = byName.Sun;
  const jupiter = byName.Jupiter;
  const traditional = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map(
    (name) => byName[name].longitude,
  );

  const manglik = [1, 2, 4, 7, 8, 12].includes(mars.house);
  const arcA = traditional.every((longitude) => normalize(longitude - rahu.longitude) <= 180);
  const arcB = traditional.every((longitude) => normalize(rahu.longitude - longitude) <= 180);
  const kaalSarp = arcA || arcB;

  const currentDate = new Date();
  const currentAyanamsa = lahiriMeanAyanamsa(currentDate);
  const currentSaturn = normalize(tropicalLongitude(Body.Saturn, currentDate) - currentAyanamsa);
  const saturnSign = Math.floor(currentSaturn / 30);
  const relativeSaturn = (saturnSign - moon.signIndex + 12) % 12;
  const sadeSati = [11, 0, 1].includes(relativeSaturn);
  const sadePhase = relativeSaturn === 11 ? "rising" : relativeSaturn === 0 ? "peak" : "setting";

  const budhaditya = sun.signIndex === mercury.signIndex;
  const moonJupiterDistance = (jupiter.signIndex - moon.signIndex + 12) % 12;
  const gajakesari = [0, 3, 6, 9].includes(moonJupiterDistance);

  return [
    {
      name: "Manglik rule",
      status: manglik ? "present" : "clear",
      detail: manglik
        ? `Mars is in whole-sign house ${mars.house}; cancellation rules are not included.`
        : `Mars is in whole-sign house ${mars.house}, outside the six checked houses.`,
    },
    {
      name: "Sade Sati transit",
      status: sadeSati ? "present" : "clear",
      detail: sadeSati
        ? `Transit Saturn is in the ${sadePhase} phase relative to the natal Moon sign.`
        : "Transit Saturn is not in the sign before, of, or after the natal Moon.",
    },
    {
      name: "Kaal Sarp enclosure",
      status: kaalSarp ? "present" : "clear",
      detail: kaalSarp
        ? "All seven traditional planets fall within one mean-node semicircle."
        : "The seven traditional planets are not enclosed within one mean-node semicircle.",
    },
    {
      name: "Budhaditya rule",
      status: budhaditya ? "present" : "clear",
      detail: budhaditya ? "Sun and Mercury occupy the same sidereal sign." : "Sun and Mercury occupy different signs.",
    },
    {
      name: "Gajakesari rule",
      status: gajakesari ? "present" : "clear",
      detail: gajakesari
        ? "Jupiter is in a kendra sign from the Moon."
        : "Jupiter is not in a kendra sign from the Moon.",
    },
  ];
}

export function calculateChart(input: BirthInput): ChartResult {
  const utcDate = createUtcDate(input);
  if (Number.isNaN(utcDate.getTime())) throw new Error("The birth date or time is invalid.");
  if (input.latitude < -90 || input.latitude > 90) throw new Error("Latitude must be between −90 and 90.");
  if (input.longitude < -180 || input.longitude > 180) throw new Error("Longitude must be between −180 and 180.");
  if (input.utcOffset < -14 || input.utcOffset > 14) throw new Error("UTC offset must be between −14 and +14.");
  if (utcDate > new Date()) throw new Error("Birth time cannot be in the future.");

  const ayanamsa = input.system === "lahiri" ? lahiriMeanAyanamsa(utcDate) : 0;
  const ascendantTropical = calculateAscendant(utcDate, input.latitude, input.longitude);
  const ascendantLongitude = normalize(ascendantTropical - ayanamsa);
  const ascendantSignIndex = Math.floor(ascendantLongitude / 30);

  const planets: PlanetPosition[] = PLANET_DEFINITIONS.map((definition) => {
    const tropical = tropicalLongitude(definition.body, utcDate);
    const comparison = tropicalLongitude(definition.body, new Date(utcDate.getTime() + 6 * 3_600_000));
    const longitude = normalize(tropical - ayanamsa);
    const signIndex = Math.floor(longitude / 30);
    return {
      name: definition.name,
      short: definition.short,
      glyph: definition.glyph,
      tropicalLongitude: tropical,
      longitude,
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: longitude % 30,
      house: ((signIndex - ascendantSignIndex + 12) % 12) + 1,
      retrograde: ![Body.Sun, Body.Moon].includes(definition.body) && signedAngle(comparison - tropical) < 0,
    };
  });

  const rahuTropical = meanNodeLongitude(utcDate);
  const rahuLongitude = normalize(rahuTropical - ayanamsa);
  const rahuSign = Math.floor(rahuLongitude / 30);
  planets.push({
    name: "Rahu",
    short: "Ra",
    glyph: "☊",
    tropicalLongitude: rahuTropical,
    longitude: rahuLongitude,
    signIndex: rahuSign,
    sign: SIGNS[rahuSign],
    degreeInSign: rahuLongitude % 30,
    house: ((rahuSign - ascendantSignIndex + 12) % 12) + 1,
    retrograde: true,
  });

  const ketuTropical = normalize(rahuTropical + 180);
  const ketuLongitude = normalize(ketuTropical - ayanamsa);
  const ketuSign = Math.floor(ketuLongitude / 30);
  planets.push({
    name: "Ketu",
    short: "Ke",
    glyph: "☋",
    tropicalLongitude: ketuTropical,
    longitude: ketuLongitude,
    signIndex: ketuSign,
    sign: SIGNS[ketuSign],
    degreeInSign: ketuLongitude % 30,
    house: ((ketuSign - ascendantSignIndex + 12) % 12) + 1,
    retrograde: true,
  });

  const moon = planets.find((planet) => planet.name === "Moon")!;
  const sun = planets.find((planet) => planet.name === "Sun")!;
  const panchangAyanamsa = lahiriMeanAyanamsa(utcDate);
  const moonSidereal = normalize(moon.tropicalLongitude - panchangAyanamsa);
  const sunSidereal = normalize(sun.tropicalLongitude - panchangAyanamsa);
  const moonNakshatra = nakshatraAt(moonSidereal);
  const lunarAngle = normalize(moon.tropicalLongitude - sun.tropicalLongitude);
  const tithiIndex = Math.floor(lunarAngle / 12);
  const paksha = tithiIndex < 15 ? "Shukla Paksha" : "Krishna Paksha";
  const tithiBaseIndex = tithiIndex % 15;
  const tithi =
    tithiIndex === 29
      ? "Amavasya"
      : `${paksha === "Shukla Paksha" ? "Shukla" : "Krishna"} ${TITHIS[tithiBaseIndex]}`;
  const yogaIndex = Math.floor(normalize(sunSidereal + moonSidereal) / (360 / 27));

  return {
    input,
    utcDate,
    ayanamsa,
    ascendantLongitude,
    ascendantTropical,
    ascendantSignIndex,
    ascendantSign: SIGNS[ascendantSignIndex],
    ascendantDegree: ascendantLongitude % 30,
    planets,
    moonNakshatra: moonNakshatra.name,
    moonPada: moonNakshatra.pada,
    tithi,
    paksha,
    yoga: YOGAS[yogaIndex],
    dashas: input.system === "lahiri" ? vimshottariTimeline(utcDate, moon.longitude) : [],
    rules: calculateRuleChecks(planets, input),
    numerology: numerology(input),
  };
}

export function formatDegrees(value: number) {
  const normalized = normalize(value);
  const degrees = Math.floor(normalized);
  const minutesFloat = (normalized - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  return `${String(degrees).padStart(2, "0")}° ${String(minutes).padStart(2, "0")}′ ${String(seconds).padStart(2, "0")}″`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
