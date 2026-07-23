import { calculateChart, type BirthInput, type ChartResult, formatDegrees } from "./astro.ts";
import { CERTIFICATION_PROFILE } from "./certification-profile.ts";
import {
  AYANAMSA_PROFILE,
  CALCULATION_PROFILE_ID,
  DATE_RANGE_PROFILE_ID,
  ENGINE_PROFILE,
  HOUSE_PROFILE,
  NODE_PROFILE,
  engineFingerprint,
} from "./engine-profile.ts";
import { localPartsAtInstant, resolveLocalDay, resolveLocalTime } from "./timezone.ts";

export type BirthTimeConfidence = "exact" | "approximate" | "unknown";

export type CalculationRequest = {
  name: string;
  location: string;
  date: string;
  time: string;
  timeConfidence: BirthTimeConfidence;
  uncertaintyMinutes: number;
  timezoneId: string;
  latitude: number;
  longitude: number;
  placeProvider: string;
};

export type CalculationReceipt = {
  schema: "calculation-receipt-v3";
  chartId: string;
  inputFingerprint: string;
  calculatedAt: string;
  birthTimeConfidence: BirthTimeConfidence;
  localInput: string;
  normalizedUtc: string;
  coordinates: string;
  timezoneId: string;
  timezoneOffset: string;
  timezoneAbbreviation: string;
  timezoneDataVersion: string;
  placeProvider: string;
  profileId: typeof CALCULATION_PROFILE_ID | typeof DATE_RANGE_PROFILE_ID;
  zodiac: "Sidereal";
  ayanamsa: typeof AYANAMSA_PROFILE.name;
  ayanamsaProfileId: typeof AYANAMSA_PROFILE.id;
  houseSystem: "Whole sign" | "Suppressed";
  houseProfileId: typeof HOUSE_PROFILE.id | "suppressed";
  nodeMethod: typeof NODE_PROFILE.name;
  nodeProfileId: typeof NODE_PROFILE.id;
  engineName: typeof ENGINE_PROFILE.name;
  engineVersion: typeof ENGINE_PROFILE.version;
  engineStatus: "Active";
  kernel: `${typeof ENGINE_PROFILE.kernelName} ${typeof ENGINE_PROFILE.kernelVersion}`;
  kernelLicense: typeof ENGINE_PROFILE.kernelLicense;
  validationProfile: typeof ENGINE_PROFILE.validationProfile;
  validationSummary: typeof ENGINE_PROFILE.validationSummary;
  certificationId: typeof CERTIFICATION_PROFILE.certificateId;
  certificationProfile: typeof CERTIFICATION_PROFILE.id;
  certificationStatus: typeof CERTIFICATION_PROFILE.status;
  certificationSummary: typeof CERTIFICATION_PROFILE.summary;
};

export type StabilityCheck = {
  uncertaintyMinutes: number;
  ascendantStable: boolean;
  moonSignStable: boolean;
  nakshatraStable: boolean;
  houseChanges: string[];
};

export type TimedCalculationResult = {
  kind: "timed";
  chart: ChartResult;
  stability: StabilityCheck | null;
  receipt: CalculationReceipt;
};

export type UnknownPlanetRange = {
  name: string;
  glyph: string;
  start: string;
  end: string;
  possibleSigns: string[];
  stableSign: boolean;
};

export type UnknownCalculationResult = {
  kind: "unknown";
  input: CalculationRequest;
  utcRange: { start: string; end: string };
  planets: UnknownPlanetRange[];
  possibleNakshatras: string[];
  possibleTithis: string[];
  possibleYogas: string[];
  numerology: ChartResult["numerology"];
  suppressed: string[];
  receipt: CalculationReceipt;
};

export type CalculationResult = TimedCalculationResult | UnknownCalculationResult;

function validateRequest(input: CalculationRequest) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Enter a valid birth date.");
  if (!input.location.trim()) throw new Error("Select or enter a birthplace.");
  if (!input.timezoneId.trim()) throw new Error("A verified IANA timezone is required.");
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error("Latitude must be between −90 and 90.");
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("Longitude must be between −180 and 180.");
  }
  if (input.timeConfidence !== "unknown" && !input.time) throw new Error("Enter the recorded local birth time.");
  if (input.timeConfidence === "approximate" && ![5, 10, 15, 30, 60].includes(input.uncertaintyMinutes)) {
    throw new Error("Choose a supported birth-time uncertainty range.");
  }
}

function legacyInputAtInstant(input: CalculationRequest, instant: Date): BirthInput {
  const local = localPartsAtInstant(instant, input.timezoneId);
  return {
    name: input.name,
    location: input.location,
    date: local.date,
    time: local.time,
    utcOffset: local.offsetHours,
    latitude: input.latitude,
    longitude: input.longitude,
    system: "lahiri",
  };
}

function chartAtInstant(input: CalculationRequest, instant: Date) {
  return calculateChart(legacyInputAtInstant(input, instant));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatUtcOffset(offsetMinutes: number) {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function receipt(
  input: CalculationRequest,
  normalizedUtc: string,
  offset: string,
  abbreviation: string,
  timezoneDataVersion: string,
  profileId: CalculationReceipt["profileId"],
): Promise<CalculationReceipt> {
  const canonical = stableJson({
    input,
    normalizedUtc,
    profileId,
    engine: engineFingerprint(),
    timezoneDataVersion,
  });
  const fingerprint = await sha256(canonical);
  const calculatedAt = new Date().toISOString();
  return {
    schema: "calculation-receipt-v3",
    chartId: `chart_${fingerprint.slice(0, 16)}`,
    inputFingerprint: `sha256:${fingerprint}`,
    calculatedAt,
    birthTimeConfidence: input.timeConfidence,
    localInput: input.timeConfidence === "unknown" ? `${input.date} (time unknown)` : `${input.date} ${input.time}`,
    normalizedUtc,
    coordinates: `${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)}`,
    timezoneId: input.timezoneId,
    timezoneOffset: offset,
    timezoneAbbreviation: abbreviation,
    timezoneDataVersion,
    placeProvider: input.placeProvider,
    profileId,
    zodiac: "Sidereal",
    ayanamsa: AYANAMSA_PROFILE.name,
    ayanamsaProfileId: AYANAMSA_PROFILE.id,
    houseSystem: input.timeConfidence === "unknown" ? "Suppressed" : "Whole sign",
    houseProfileId: input.timeConfidence === "unknown" ? "suppressed" : HOUSE_PROFILE.id,
    nodeMethod: NODE_PROFILE.name,
    nodeProfileId: NODE_PROFILE.id,
    engineName: ENGINE_PROFILE.name,
    engineVersion: ENGINE_PROFILE.version,
    engineStatus: "Active",
    kernel: `${ENGINE_PROFILE.kernelName} ${ENGINE_PROFILE.kernelVersion}`,
    kernelLicense: ENGINE_PROFILE.kernelLicense,
    validationProfile: ENGINE_PROFILE.validationProfile,
    validationSummary: ENGINE_PROFILE.validationSummary,
    certificationId: CERTIFICATION_PROFILE.certificateId,
    certificationProfile: CERTIFICATION_PROFILE.id,
    certificationStatus: CERTIFICATION_PROFILE.status,
    certificationSummary: CERTIFICATION_PROFILE.summary,
  };
}

function stabilityCheck(input: CalculationRequest, center: Date, chart: ChartResult): StabilityCheck | null {
  if (input.timeConfidence !== "approximate") return null;
  const windowMs = input.uncertaintyMinutes * 60_000;
  const first = chartAtInstant(input, new Date(center.getTime() - windowMs));
  const last = chartAtInstant(input, new Date(center.getTime() + windowMs));
  const changed = chart.planets
    .filter((planet) => {
      const firstPlanet = first.planets.find((candidate) => candidate.name === planet.name);
      const lastPlanet = last.planets.find((candidate) => candidate.name === planet.name);
      return firstPlanet?.house !== lastPlanet?.house;
    })
    .map((planet) => planet.name);

  return {
    uncertaintyMinutes: input.uncertaintyMinutes,
    ascendantStable:
      first.ascendantSignIndex === chart.ascendantSignIndex && chart.ascendantSignIndex === last.ascendantSignIndex,
    moonSignStable:
      first.planets.find((planet) => planet.name === "Moon")?.signIndex ===
        chart.planets.find((planet) => planet.name === "Moon")?.signIndex &&
      chart.planets.find((planet) => planet.name === "Moon")?.signIndex ===
        last.planets.find((planet) => planet.name === "Moon")?.signIndex,
    nakshatraStable: first.moonNakshatra === chart.moonNakshatra && chart.moonNakshatra === last.moonNakshatra,
    houseChanges: changed,
  };
}

async function calculateTimed(input: CalculationRequest): Promise<TimedCalculationResult> {
  const resolved = resolveLocalTime(input.date, input.time, input.timezoneId);
  if (resolved.utcDate > new Date()) throw new Error("Birth time cannot be in the future.");
  const chart = chartAtInstant(input, resolved.utcDate);
  const offset = formatUtcOffset(resolved.offsetMinutes);
  return {
    kind: "timed",
    chart,
    stability: stabilityCheck(input, resolved.utcDate, chart),
    receipt: await receipt(
      input,
      resolved.utcDate.toISOString(),
      offset,
      resolved.abbreviation,
      resolved.timezoneDataVersion,
      CALCULATION_PROFILE_ID,
    ),
  };
}

async function calculateUnknown(input: CalculationRequest): Promise<UnknownCalculationResult> {
  const day = resolveLocalDay(input.date, input.timezoneId);
  if (day.startUtc > new Date()) throw new Error("Birth date cannot be in the future.");
  const samples: ChartResult[] = [];
  const sampleStep = 60 * 60 * 1000;
  for (let instant = day.startUtc.getTime(); instant <= day.endUtc.getTime(); instant += sampleStep) {
    samples.push(chartAtInstant(input, new Date(instant)));
  }
  samples.push(chartAtInstant(input, day.endUtc));

  const first = samples[0];
  const last = samples[samples.length - 1];
  const planets = first.planets.map((planet) => {
    const all = samples.map((sample) => sample.planets.find((candidate) => candidate.name === planet.name)!);
    const possibleSigns = Array.from(new Set(all.map((candidate) => candidate.sign)));
    const ending = last.planets.find((candidate) => candidate.name === planet.name)!;
    return {
      name: planet.name,
      glyph: planet.glyph,
      start: `${planet.sign} ${formatDegrees(planet.degreeInSign)}`,
      end: `${ending.sign} ${formatDegrees(ending.degreeInSign)}`,
      possibleSigns,
      stableSign: possibleSigns.length === 1,
    };
  });

  return {
    kind: "unknown",
    input,
    utcRange: { start: day.startUtc.toISOString(), end: day.endUtc.toISOString() },
    planets,
    possibleNakshatras: Array.from(new Set(samples.map((sample) => sample.moonNakshatra))),
    possibleTithis: Array.from(new Set(samples.map((sample) => sample.tithi))),
    possibleYogas: Array.from(new Set(samples.map((sample) => sample.yoga))),
    numerology: first.numerology,
    suppressed: [
      "Ascendant and Ascendant degree",
      "House cusps and planetary houses",
      "House-dependent yoga and dosha checks",
      "Exact Vimshottari Dasha dates",
      "Divisional charts",
    ],
    receipt: await receipt(
      input,
      `${day.startUtc.toISOString()} — ${day.endUtc.toISOString()}`,
      "Varies across local day",
      "Date-range mode",
      day.timezoneDataVersion,
      DATE_RANGE_PROFILE_ID,
    ),
  };
}

export async function calculateCelestial(input: CalculationRequest): Promise<CalculationResult> {
  validateRequest(input);
  return input.timeConfidence === "unknown" ? calculateUnknown(input) : calculateTimed(input);
}
