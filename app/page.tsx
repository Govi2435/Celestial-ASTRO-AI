"use client";

import { FormEvent, useState } from "react";
import {
  ChartResult,
  formatDate,
  formatDegrees,
  SIGNS,
  SIGN_GLYPHS,
} from "./astro";
import type {
  BirthTimeConfidence,
  CalculationResult,
  CalculationReceipt,
  CalculationRequest,
  UnknownCalculationResult,
} from "./calculation";

type ChartMode = "North Indian" | "South Indian" | "Zodiac Wheel";

const MODES: ChartMode[] = ["North Indian", "South Indian", "Zodiac Wheel"];
const HOUSE_POINTS = [
  [210, 92],
  [305, 72],
  [348, 142],
  [328, 210],
  [348, 278],
  [305, 348],
  [210, 328],
  [115, 348],
  [72, 278],
  [92, 210],
  [72, 142],
  [115, 72],
];
const SOUTH_SIGN_CELLS = [1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4, 0];
const PLANET_TONES: Record<string, string> = {
  Sun: "gold",
  Moon: "silver",
  Mars: "coral",
  Mercury: "green",
  Jupiter: "violet",
  Venus: "rose",
  Saturn: "blue",
  Rahu: "cyan",
  Ketu: "cyan",
};

type PlaceResult = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  timezoneId: string;
  type: string;
  provider: string;
};

type LocationState = {
  displayName: string;
  latitude: string;
  longitude: string;
  timezoneId: string;
  provider: string;
};

function Sparkle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2c.7 5.9 4.1 9.3 10 10-5.9.7-9.3 4.1-10 10-.7-5.9-4.1-9.3-10-10 5.9-.7 9.3-4.1 10-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MoonLogo() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 44 44">
        <defs>
          <linearGradient id="moonGlow" x1="0" x2="1">
            <stop stopColor="#F5C542" />
            <stop offset="1" stopColor="#FFE993" />
          </linearGradient>
        </defs>
        <path
          d="M29.8 32.4A15 15 0 0 1 13.2 9.1 15.5 15.5 0 1 0 34.9 28a15.2 15.2 0 0 1-5.1 4.4Z"
          fill="url(#moonGlow)"
        />
        <circle cx="31.5" cy="10.5" r="1.8" fill="#8B5CF6" />
        <path
          d="M34 15.5c.25 2 1.4 3.15 3.4 3.4-2 .25-3.15 1.4-3.4 3.4-.25-2-1.4-3.15-3.4-3.4 2-.25 3.15-1.4 3.4-3.4Z"
          fill="#06B6D4"
        />
      </svg>
    </span>
  );
}

function NorthChart({ result }: { result: ChartResult }) {
  const byHouse = Array.from({ length: 12 }, (_, index) => {
    const labels = result.planets
      .filter((planet) => planet.house === index + 1)
      .map((planet) => `${planet.short}${Math.floor(planet.degreeInSign)}°${planet.retrograde ? "℞" : ""}`);
    if (index === 0) labels.unshift(`Asc ${Math.floor(result.ascendantDegree)}°`);
    return labels;
  });

  return (
    <div className="north-chart" aria-label="Calculated North Indian whole-sign chart">
      <svg viewBox="0 0 420 420" role="img">
        <defs>
          <linearGradient id="chartSheen" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="rgba(139,92,246,.16)" />
            <stop offset="1" stopColor="rgba(6,182,212,.03)" />
          </linearGradient>
        </defs>
        <rect
          x="31"
          y="31"
          width="358"
          height="358"
          rx="8"
          fill="url(#chartSheen)"
          stroke="rgba(245,197,66,.72)"
          strokeWidth="1.3"
        />
        <path
          d="M31 31 389 389M389 31 31 389M210 31 389 210 210 389 31 210Z"
          fill="none"
          stroke="rgba(245,197,66,.42)"
        />
        <path
          d="M31 31 210 210 389 31M389 389 210 210 31 389"
          fill="none"
          stroke="rgba(139,92,246,.25)"
        />
        {HOUSE_POINTS.map(([x, y], index) => (
          <g key={index}>
            <text x={x} y={y - 9} textAnchor="middle" className="house-number">
              H{index + 1} • {SIGN_GLYPHS[(result.ascendantSignIndex + index) % 12]}
            </text>
            <text x={x} y={y + 6} textAnchor="middle" className="planet-labels">
              {byHouse[index].slice(0, 3).join(" ")}
            </text>
            {byHouse[index].length > 3 && (
              <text x={x} y={y + 17} textAnchor="middle" className="planet-labels secondary">
                {byHouse[index].slice(3).join(" ")}
              </text>
            )}
          </g>
        ))}
        <circle cx="210" cy="210" r="43" fill="#11152a" stroke="rgba(245,197,66,.35)" />
        <text x="210" y="204" textAnchor="middle" fill="#F5C542" fontFamily="serif" fontSize="20">
          D1
        </text>
        <text x="210" y="224" textAnchor="middle" fill="#7F89A5" fontSize="8" letterSpacing="1.6">
          WHOLE SIGN
        </text>
      </svg>
    </div>
  );
}

function SouthChart({ result }: { result: ChartResult }) {
  const cells = Array.from({ length: 16 }, () => ({ sign: "", planets: "", ascendant: false }));
  SIGNS.forEach((sign, signIndex) => {
    const planetLabels = result.planets
      .filter((planet) => planet.signIndex === signIndex)
      .map((planet) => `${planet.short}${planet.retrograde ? "℞" : ""}`)
      .join(" ");
    cells[SOUTH_SIGN_CELLS[signIndex]] = {
      sign: `${SIGN_GLYPHS[signIndex]} ${sign.slice(0, 3)}`,
      planets: planetLabels,
      ascendant: result.ascendantSignIndex === signIndex,
    };
  });

  return (
    <div className="south-chart" aria-label="Calculated South Indian fixed-sign chart">
      {cells.map((cell, index) => {
        const center = [5, 6, 9, 10].includes(index);
        return (
          <div className={center ? "south-center" : cell.ascendant ? "asc-cell" : ""} key={index}>
            {center ? (
              index === 5 ? (
                <>
                  <small>CALCULATED</small>
                  <strong>D1</strong>
                </>
              ) : null
            ) : (
              <>
                <small>{cell.sign}</small>
                <strong>{cell.ascendant ? `Asc ${cell.planets}` : cell.planets}</strong>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ZodiacWheel({ result }: { result: ChartResult }) {
  return (
    <div className="wheel-wrap" aria-label="Calculated zodiac longitude wheel">
      <svg className="zodiac-wheel" viewBox="0 0 400 400" role="img">
        <defs>
          <radialGradient id="wheelCore">
            <stop stopColor="#231948" />
            <stop offset="1" stopColor="#0B0E17" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="181" fill="none" stroke="rgba(245,197,66,.42)" />
        <circle cx="200" cy="200" r="145" fill="url(#wheelCore)" stroke="rgba(255,255,255,.12)" />
        <circle cx="200" cy="200" r="88" fill="none" stroke="rgba(139,92,246,.38)" />
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = toRadians(index * 30);
          return (
            <line
              key={index}
              x1={200 + 88 * Math.sin(angle)}
              y1={200 - 88 * Math.cos(angle)}
              x2={200 + 181 * Math.sin(angle)}
              y2={200 - 181 * Math.cos(angle)}
              stroke="rgba(255,255,255,.12)"
            />
          );
        })}
        {SIGN_GLYPHS.map((glyph, index) => {
          const angle = toRadians(index * 30 + 15);
          return (
            <text
              key={glyph}
              x={200 + 161 * Math.sin(angle)}
              y={205 - 161 * Math.cos(angle)}
              textAnchor="middle"
              fill="#98A2BD"
              fontSize="17"
            >
              {glyph}
            </text>
          );
        })}
        {result.planets.map((planet, index) => {
          const angle = toRadians(planet.longitude);
          const radius = 118 - (index % 3) * 12;
          return (
            <g key={planet.name}>
              <line
                x1={200 + 89 * Math.sin(angle)}
                y1={200 - 89 * Math.cos(angle)}
                x2={200 + (radius - 7) * Math.sin(angle)}
                y2={200 - (radius - 7) * Math.cos(angle)}
                stroke="rgba(6,182,212,.23)"
              />
              <text
                x={200 + radius * Math.sin(angle)}
                y={205 - radius * Math.cos(angle)}
                textAnchor="middle"
                fill={planet.name === "Sun" ? "#F5C542" : "#C8B6E8"}
                fontSize="14"
              >
                {planet.glyph}
              </text>
            </g>
          );
        })}
        <text x="200" y="193" textAnchor="middle" fill="#F5C542" fontFamily="serif" fontSize="17">
          {result.input.system === "lahiri" ? "SIDEREAL" : "TROPICAL"}
        </text>
        <text x="200" y="215" textAnchor="middle" fill="#7F89A5" fontSize="8" letterSpacing="1.5">
          LONGITUDE MAP
        </text>
      </svg>
    </div>
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function ChartGraphic({ result, mode }: { result: ChartResult; mode: ChartMode }) {
  if (mode === "South Indian") return <SouthChart result={result} />;
  if (mode === "Zodiac Wheel") return <ZodiacWheel result={result} />;
  return <NorthChart result={result} />;
}

function EmptyChart() {
  return (
    <div className="empty-state">
      <div className="empty-orbit">
        <span>✦</span>
        <i />
        <i />
      </div>
      <span className="eyebrow">WAITING FOR BIRTH DETAILS</span>
      <h2>No chart has been calculated</h2>
      <p>
        Search for the birthplace and enter the recorded local date and time. Historical timezone and daylight-saving conversion are
        resolved automatically.
      </p>
      <div className="empty-points">
        <span>✓ No sample placements</span>
        <span>✓ No invented scores</span>
        <span>✓ Calculation receipt included</span>
      </div>
    </div>
  );
}

function ReceiptPanel({ receipt }: { receipt: CalculationReceipt }) {
  const rows = [
    ["Chart ID", receipt.chartId],
    ["Local input", receipt.localInput],
    ["Normalized UTC", receipt.normalizedUtc],
    ["Coordinates", receipt.coordinates],
    ["IANA timezone", receipt.timezoneId],
    ["Historical offset", `${receipt.timezoneOffset} • ${receipt.timezoneAbbreviation}`],
    ["Timezone data", receipt.timezoneDataVersion],
    ["Calculation profile", receipt.profileId],
    ["Ayanamsa", `${receipt.ayanamsa} • ${receipt.ayanamsaProfileId}`],
    [
      "Houses / nodes",
      `${receipt.houseSystem} (${receipt.houseProfileId}) • ${receipt.nodeMethod} (${receipt.nodeProfileId})`,
    ],
    ["Active engine", `${receipt.engineName} ${receipt.engineVersion} • ${receipt.engineStatus}`],
    ["Astronomy kernel", `${receipt.kernel} • ${receipt.kernelLicense}`],
    ["Reference validation", receipt.validationSummary],
    ["Validation profile", receipt.validationProfile],
    ["Input fingerprint", receipt.inputFingerprint],
    ["Calculated at", receipt.calculatedAt],
  ];

  return (
    <article className="receipt-card glass-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">CALCULATION RECEIPT</span>
          <h3>How this result was produced</h3>
        </div>
        <span className="evidence-badge calculated">Calculated</span>
      </div>
      <dl className="receipt-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function UnknownTimePanel({ result }: { result: UnknownCalculationResult }) {
  return (
    <>
      <article className="limited-card glass-panel">
        <span className="evidence-badge limited">Limited • birth time unknown</span>
        <h2>Date-range result</h2>
        <p>
          No exact time was invented. The engine evaluated the complete local civil day and shows only date-wide possibilities.
          Ascendant, houses, and exact Dasha dates are suppressed.
        </p>
        <div className="range-meta">
          <span>UTC range</span>
          <strong>
            {result.utcRange.start} — {result.utcRange.end}
          </strong>
        </div>
      </article>

      <article className="planet-card glass-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">DAY-WIDE CALCULATION</span>
            <h3>Possible planetary placements</h3>
          </div>
          <span>{result.planets.filter((planet) => planet.stableSign).length} stable signs</span>
        </div>
        <div className="range-table">
          {result.planets.map((planet) => (
            <div key={planet.name}>
              <span className="planet-glyph">{planet.glyph}</span>
              <strong>{planet.name}</strong>
              <span>{planet.start}</span>
              <span>{planet.end}</span>
              <b className={planet.stableSign ? "stable" : "changing"}>
                {planet.stableSign ? planet.possibleSigns[0] : planet.possibleSigns.join(" / ")}
              </b>
            </div>
          ))}
        </div>
      </article>

      <div className="fact-grid">
        <article className="fact-card glass-panel">
          <span className="eyebrow">POSSIBLE PANCHANG VALUES</span>
          <h3>{result.possibleNakshatras.join(" / ")}</h3>
          <dl>
            <div>
              <dt>Tithi</dt>
              <dd>{result.possibleTithis.join(" / ")}</dd>
            </div>
            <div>
              <dt>Yoga</dt>
              <dd>{result.possibleYogas.join(" / ")}</dd>
            </div>
          </dl>
        </article>
        <article className="fact-card glass-panel">
          <span className="eyebrow">SUPPRESSED FOR TRUST</span>
          <h3>Time-dependent results</h3>
          <ul className="suppressed-list">
            {result.suppressed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <ReceiptPanel receipt={result.receipt} />
    </>
  );
}

export default function Home() {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [mode, setMode] = useState<ChartMode>("North Indian");
  const [error, setError] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [timeConfidence, setTimeConfidence] = useState<BirthTimeConfidence>("exact");
  const [location, setLocation] = useState<LocationState>({
    displayName: "",
    latitude: "",
    longitude: "",
    timezoneId: "",
    provider: "Verified manual entry",
  });
  const chart = result?.kind === "timed" ? result.chart : null;

  async function searchPlaces() {
    if (placeQuery.trim().length < 3) {
      setError("Enter at least three characters for the birthplace.");
      return;
    }
    setSearching(true);
    setError("");
    setPlaces([]);
    try {
      const response = await fetch(`/api/places?q=${encodeURIComponent(placeQuery.trim())}`);
      const payload = (await response.json()) as { results?: PlaceResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Place search failed.");
      setPlaces(payload.results ?? []);
      if (!payload.results?.length) setError("No matching place was found. Try a more specific city and country.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Place search failed.");
    } finally {
      setSearching(false);
    }
  }

  function selectPlace(place: PlaceResult) {
    setLocation({
      displayName: place.displayName,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezoneId: place.timezoneId,
      provider: place.provider,
    });
    setPlaceQuery(place.displayName);
    setPlaces([]);
    setError("");
  }

  async function submitBirthDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalculating(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const input: CalculationRequest = {
      name: String(data.get("name") || "").trim(),
      location: location.displayName.trim(),
      date: String(data.get("date") || ""),
      time: timeConfidence === "unknown" ? "" : String(data.get("time") || ""),
      timeConfidence,
      uncertaintyMinutes: timeConfidence === "approximate" ? Number(data.get("uncertaintyMinutes")) : 0,
      timezoneId: location.timezoneId.trim(),
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      placeProvider: location.provider,
    };

    try {
      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as CalculationResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The calculation could not be completed.");
      if (payload.kind === "timed") {
        payload.chart.utcDate = new Date(payload.chart.utcDate);
        payload.chart.dashas = payload.chart.dashas.map((dasha) => ({
          ...dasha,
          start: new Date(String(dasha.start)),
          end: new Date(String(dasha.end)),
        }));
      }
      setResult(payload);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "The calculation could not be completed.");
    } finally {
      setCalculating(false);
    }
  }

  function downloadReport() {
    if (!result) return;
    if (result.kind === "unknown") {
      const report = [
        "CELESTIAL ASTRO AI — DATE-RANGE CALCULATION",
        `Birth date: ${result.input.date}`,
        `Birthplace: ${result.input.location}`,
        `Timezone: ${result.receipt.timezoneId}`,
        `UTC range: ${result.utcRange.start} — ${result.utcRange.end}`,
        "Birth time: Unknown — no exact time was invented",
        "",
        "POSSIBLE PLANETARY POSITIONS",
        ...result.planets.map(
          (planet) =>
            `${planet.name.padEnd(8)} ${planet.start} → ${planet.end} • ${
              planet.stableSign ? `stable ${planet.possibleSigns[0]}` : `may cross ${planet.possibleSigns.join(" / ")}`
            }`,
        ),
        "",
        "SUPPRESSED",
        ...result.suppressed.map((item) => `- ${item}`),
        "",
        `Receipt: ${result.receipt.chartId}`,
        `Fingerprint: ${result.receipt.inputFingerprint}`,
        `Engine: ${result.receipt.engineName} ${result.receipt.engineVersion} • ${result.receipt.engineStatus}`,
        `Kernel: ${result.receipt.kernel} • ${result.receipt.kernelLicense}`,
        `Validation: ${result.receipt.validationSummary}`,
      ].join("\n");
      const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "celestial-astro-ai-date-range.txt";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const rows = result.chart.planets.map(
      (planet) =>
        `${planet.name.padEnd(8)} ${planet.sign.padEnd(12)} ${formatDegrees(planet.degreeInSign)}  H${planet.house}${
          planet.retrograde ? "  Retrograde" : ""
        }`,
    );
    const report = [
      "CELESTIAL ASTRO AI — CALCULATED CHART DATA",
      `Name: ${result.chart.input.name || "Not provided"}`,
      `Location label: ${result.chart.input.location || "Not provided"}`,
      `Coordinates: ${result.receipt.coordinates}`,
      `Timezone: ${result.receipt.timezoneId} • ${result.receipt.timezoneOffset}`,
      `Calculated UTC: ${result.chart.utcDate.toISOString()}`,
      "Zodiac basis: Mean Lahiri sidereal",
      `Ayanamsa: ${formatDegrees(result.chart.ayanamsa)}`,
      `Ascendant: ${result.chart.ascendantSign} ${formatDegrees(result.chart.ascendantDegree)}`,
      `Moon Nakshatra (mean Lahiri): ${result.chart.moonNakshatra}, Pada ${result.chart.moonPada}`,
      "",
      "PLANETARY POSITIONS",
      ...rows,
      "",
      `Birth Tithi: ${result.chart.tithi}`,
      `Birth Yoga: ${result.chart.yoga}`,
      "",
      `Engine: ${result.receipt.engineName} ${result.receipt.engineVersion}`,
      `Kernel: ${result.receipt.kernel} • ${result.receipt.kernelLicense}`,
      `Validation: ${result.receipt.validationSummary}`,
      "Method: apparent geocentric ecliptic-of-date positions; whole-sign houses; mean Rahu/Ketu.",
      `Receipt: ${result.receipt.chartId}`,
      `Fingerprint: ${result.receipt.inputFingerprint}`,
      `Timezone data: ${result.receipt.timezoneDataVersion}`,
      "This report contains calculated data, not professional or predictive advice.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "celestial-astro-ai-calculated-chart.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Celestial ASTRO AI home">
          <MoonLogo />
          <span>
            <strong>Celestial</strong> ASTRO AI
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="active" href="#calculator">
            Calculator
          </a>
          <a href="#method">Method</a>
          <a href="#scope">Scope</a>
        </nav>
        <div className="local-badge">
          <span className="live-dot" />
          Server calculation • no saved birth data
        </div>
      </header>

      <section className="intro-band">
        <div>
          <span className="accuracy-pill">
            <Sparkle size={13} /> P1 trust-first calculation pipeline
          </span>
          <h1>
            Your chart, calculated and
            <em> fully traceable.</em>
          </h1>
        </div>
        <p>
          Search the birthplace, confirm the recorded time, and receive historical timezone conversion with an auditable Calculation
          Receipt. Unknown time stays unknown—never invented.
        </p>
      </section>

      <section className="calculator-shell" id="calculator">
        <aside className="input-panel glass-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REQUIRED INPUT</span>
              <h2>Verified birth details</h2>
            </div>
            <span className="step-badge">01</span>
          </div>
          <form onSubmit={submitBirthDetails}>
            <label>
              Name <small>optional; used for the report only</small>
              <span className="field-wrap">
                <span>♙</span>
                <input name="name" placeholder="Full name" autoComplete="name" />
              </span>
            </label>
            <label>
              Birthplace <small>search is submitted manually; no autocomplete tracking</small>
              <span className="place-search-row">
                <span className="field-wrap">
                  <span>⌖</span>
                  <input
                    value={placeQuery}
                    onChange={(event) => setPlaceQuery(event.target.value)}
                    placeholder="City, state, country"
                    aria-label="Birthplace search"
                  />
                </span>
                <button type="button" className="search-button" onClick={searchPlaces} disabled={searching}>
                  {searching ? "…" : "Find"}
                </button>
              </span>
            </label>
            {places.length > 0 && (
              <div className="place-results" role="list" aria-label="Birthplace results">
                {places.map((place) => (
                  <button type="button" key={place.id} onClick={() => selectPlace(place)}>
                    <strong>{place.displayName}</strong>
                    <small>
                      {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)} • {place.timezoneId}
                    </small>
                  </button>
                ))}
              </div>
            )}
            {location.timezoneId && (
              <div className="selected-place">
                <span>✓</span>
                <p>
                  <strong>{location.displayName}</strong>
                  <small>
                    {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)} • {location.timezoneId}
                  </small>
                </p>
              </div>
            )}
            <details className="manual-location">
              <summary>Verified manual location</summary>
              <label>
                Location label
                <span className="field-wrap">
                  <span>⌖</span>
                  <input
                    value={location.displayName}
                    onChange={(event) =>
                      setLocation((current) => ({ ...current, displayName: event.target.value, provider: "Verified manual entry" }))
                    }
                    placeholder="City, state, country"
                  />
                </span>
              </label>
              <div className="form-row">
                <label>
                  Latitude
                  <span className="field-wrap">
                    <span>φ</span>
                    <input
                      value={location.latitude}
                      onChange={(event) =>
                        setLocation((current) => ({ ...current, latitude: event.target.value, provider: "Verified manual entry" }))
                      }
                      type="number"
                      min="-90"
                      max="90"
                      step="0.000001"
                    />
                  </span>
                </label>
                <label>
                  Longitude
                  <span className="field-wrap">
                    <span>λ</span>
                    <input
                      value={location.longitude}
                      onChange={(event) =>
                        setLocation((current) => ({ ...current, longitude: event.target.value, provider: "Verified manual entry" }))
                      }
                      type="number"
                      min="-180"
                      max="180"
                      step="0.000001"
                    />
                  </span>
                </label>
              </div>
              <label>
                IANA timezone
                <span className="field-wrap">
                  <span>◷</span>
                  <input
                    value={location.timezoneId}
                    onChange={(event) =>
                      setLocation((current) => ({ ...current, timezoneId: event.target.value, provider: "Verified manual entry" }))
                    }
                    placeholder="Example: Asia/Kolkata"
                  />
                </span>
              </label>
            </details>
            <label>
              Birth-time confidence
              <span className="field-wrap">
                <span>◉</span>
                <select
                  value={timeConfidence}
                  onChange={(event) => setTimeConfidence(event.target.value as BirthTimeConfidence)}
                >
                  <option value="exact">Exact / recorded</option>
                  <option value="approximate">Approximate</option>
                  <option value="unknown">I do not know the time</option>
                </select>
              </span>
            </label>
            <div className="form-row">
              <label>
                Birth date
                <span className="field-wrap">
                  <span>◷</span>
                  <input name="date" type="date" required />
                </span>
              </label>
              <label>
                Local birth time
                <span className="field-wrap">
                  <span>⌾</span>
                  <input
                    name="time"
                    type="time"
                    step="1"
                    required={timeConfidence !== "unknown"}
                    disabled={timeConfidence === "unknown"}
                  />
                </span>
              </label>
            </div>
            {timeConfidence === "approximate" && (
              <label>
                Time uncertainty
                <span className="field-wrap">
                  <span>±</span>
                  <select name="uncertaintyMinutes" defaultValue="15">
                    <option value="5">± 5 minutes</option>
                    <option value="10">± 10 minutes</option>
                    <option value="15">± 15 minutes</option>
                    <option value="30">± 30 minutes</option>
                    <option value="60">± 60 minutes</option>
                  </select>
                </span>
              </label>
            )}
            <div className="profile-lock">
              <span>V1</span>
              <p>
                <strong>Vedic calculation profile</strong>
                <small>Lahiri sidereal • whole-sign houses • mean Rahu/Ketu</small>
              </p>
            </div>
            <div className="coordinate-note">
              <span>!</span>
              <p>
                The site derives historical UTC offset and DST from the confirmed IANA timezone. Search data © OpenStreetMap
                contributors.
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" type="submit" disabled={calculating}>
              <Sparkle size={16} /> {calculating ? "Calculating…" : "Calculate chart"} <span>→</span>
            </button>
          </form>
        </aside>

        <section className="result-panel">
          <div className="result-toolbar">
            <div>
              <span className="eyebrow">CALCULATION OUTPUT</span>
              <h2>
                {result
                  ? result.kind === "timed"
                    ? `${result.chart.input.name || "Birth"} chart`
                    : `${result.input.name || "Birth"} date range`
                  : "Ready when your inputs are"}
              </h2>
              <p>
                {result
                  ? result.kind === "timed"
                    ? `Vedic profile • ${result.chart.utcDate.toISOString()} • ${result.receipt.timezoneId}`
                    : `Time unknown • ${result.receipt.timezoneId} • exact houses suppressed`
                  : "Nothing below is populated with sample data."}
              </p>
            </div>
            <button className="outline-button" onClick={downloadReport} disabled={!result}>
              ⇩ &nbsp; Download data
            </button>
          </div>

          {!result ? (
            <EmptyChart />
          ) : result.kind === "unknown" ? (
            <UnknownTimePanel result={result} />
          ) : chart ? (
            <>
              {result.stability && (
                <article className="stability-card glass-panel">
                  <span className="evidence-badge limited">Approximate time • ±{result.stability.uncertaintyMinutes} min</span>
                  <p>
                    Ascendant sign {result.stability.ascendantStable ? "stays stable" : "may change"}; Moon sign{" "}
                    {result.stability.moonSignStable ? "stays stable" : "may change"}; Nakshatra{" "}
                    {result.stability.nakshatraStable ? "stays stable" : "may change"}.
                    {result.stability.houseChanges.length > 0
                      ? ` Possible house changes: ${result.stability.houseChanges.join(", ")}.`
                      : " No sampled planetary house changes were detected."}
                  </p>
                </article>
              )}
              <article className="engine-gate">
                <span className="evidence-badge calculated">Calculated</span>
                <p>
                  Active engine: Celestial Calculation Engine 1.0.0, powered by Astronomy Engine 2.1.19 under the MIT licence.
                  The pinned NASA/JPL DE441 reference set passed.
                </p>
              </article>
              <article className="chart-card glass-panel">
                <div className="chart-toolbar">
                  <div className="mode-switch" role="group" aria-label="Chart style">
                    {MODES.map((item) => (
                      <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="chart-meta">
                    <span className="live-dot" /> Receipt {result.receipt.chartId}
                  </div>
                </div>
                <div className="chart-stage">
                  <ChartGraphic result={chart} mode={mode} />
                  <div className="chart-summary">
                    <span className="eyebrow">ASCENDANT</span>
                    <div className="sign-badge">{SIGN_GLYPHS[chart.ascendantSignIndex]}</div>
                    <h3>{chart.ascendantSign}</h3>
                    <p>{formatDegrees(chart.ascendantDegree)}</p>
                    <div className="summary-rule" />
                    <div>
                      <span>Moon sign</span>
                      <strong>{chart.planets.find((planet) => planet.name === "Moon")?.sign}</strong>
                    </div>
                    <div>
                      <span>Nakshatra (Lahiri)</span>
                      <strong>{chart.moonNakshatra}</strong>
                    </div>
                    <div>
                      <span>Pada</span>
                      <strong>{chart.moonPada}</strong>
                    </div>
                    <div>
                      <span>Ayanamsa</span>
                      <strong>{formatDegrees(chart.ayanamsa)}</strong>
                    </div>
                  </div>
                </div>
              </article>

              <div className="fact-grid">
                <article className="fact-card glass-panel">
                  <span className="eyebrow">BIRTH PANCHANG • MEAN LAHIRI</span>
                  <h3>{chart.tithi}</h3>
                  <dl>
                    <div>
                      <dt>Paksha</dt>
                      <dd>{chart.paksha}</dd>
                    </div>
                    <div>
                      <dt>Nakshatra</dt>
                      <dd>
                        {chart.moonNakshatra}, Pada {chart.moonPada}
                      </dd>
                    </div>
                    <div>
                      <dt>Yoga</dt>
                      <dd>{chart.yoga}</dd>
                    </div>
                  </dl>
                </article>
                <article className="fact-card glass-panel">
                  <span className="eyebrow">NUMEROLOGY</span>
                  <h3>Life Path {chart.numerology.lifePath}</h3>
                  <dl>
                    <div>
                      <dt>Expression</dt>
                      <dd>{chart.numerology.expression ?? "Name required"}</dd>
                    </div>
                    <div>
                      <dt>Soul Urge</dt>
                      <dd>{chart.numerology.soulUrge ?? "Name required"}</dd>
                    </div>
                    <div>
                      <dt>Personal Year</dt>
                      <dd>{chart.numerology.personalYear}</dd>
                    </div>
                  </dl>
                </article>
              </div>

              <article className="planet-card glass-panel">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">CALCULATED LONGITUDES</span>
                    <h3>Planetary positions</h3>
                  </div>
                  <span>{chart.planets.length} bodies</span>
                </div>
                <div className="planet-header">
                  <span>Body</span>
                  <span>Sign</span>
                  <span>Degree in sign</span>
                  <span>House</span>
                  <span>Motion</span>
                </div>
                <div className="planet-table">
                  {chart.planets.map((planet) => (
                    <div key={planet.name}>
                      <span className={`planet-glyph ${PLANET_TONES[planet.name] || "neutral"}`}>{planet.glyph}</span>
                      <strong>{planet.name}</strong>
                      <span>
                        {SIGN_GLYPHS[planet.signIndex]} {planet.sign}
                      </span>
                      <span>{formatDegrees(planet.degreeInSign)}</span>
                      <span className="house-pill">H{planet.house}</span>
                      <span className={planet.retrograde ? "retrograde" : "direct"}>
                        {planet.retrograde ? "Retrograde" : "Direct"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              {chart.dashas.length > 0 && (
                <article className="dasha-card glass-panel">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">VIMSHOTTARI MAHADASHA</span>
                      <h3>Moon-Nakshatra timeline</h3>
                    </div>
                    <span>120-year sequence</span>
                  </div>
                  <div className="dasha-list">
                    {chart.dashas.map((dasha) => (
                      <div className={dasha.current ? "current" : ""} key={`${dasha.lord}-${dasha.start.toISOString()}`}>
                        <span>{dasha.lord}</span>
                        <strong>
                          {formatDate(dasha.start)} – {formatDate(dasha.end)}
                        </strong>
                        {dasha.current && <b>Current</b>}
                      </div>
                    ))}
                  </div>
                </article>
              )}

              <article className="checks-card glass-panel">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">TRANSPARENT RULE CHECKS</span>
                    <h3>What the code actually tested</h3>
                  </div>
                  <span>No generated interpretation</span>
                </div>
                <div className="checks-grid">
                  {chart.rules.map((rule) => (
                    <div key={rule.name}>
                      <span className={`check-dot ${rule.status}`} />
                      <p>
                        <strong>{rule.name}</strong>
                        <small>{rule.detail}</small>
                      </p>
                      <b>{rule.status === "present" ? "Matched" : rule.status === "clear" ? "Not matched" : "N/A"}</b>
                    </div>
                  ))}
                </div>
              </article>
              <ReceiptPanel receipt={result.receipt} />
            </>
          ) : null}
        </section>
      </section>

      <section className="method-section" id="method">
        <div className="method-heading">
          <span className="eyebrow">HOW THIS VERSION WORKS</span>
          <h2>Accuracy comes from showing the method.</h2>
          <p>The interface separates astronomical calculation, astrological rules, and interpretation instead of blending them.</p>
        </div>
        <div className="method-grid">
          <article>
            <span>01</span>
            <h3>Astronomical positions</h3>
            <p>
              Celestial Calculation Engine 1.0.0 uses the MIT-licensed Astronomy Engine kernel. The kernel states an approximately
              ±1 arcminute target; our pinned 20-position NASA/JPL DE441 reference set has a maximum observed delta of 0.190 arcminute.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Historical timezone</h3>
            <p>
              Place coordinates resolve to an IANA timezone. The server uses pinned timezone data to detect historical UTC offset,
              daylight-saving changes, nonexistent times, and duplicated clock times.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Birth-time confidence</h3>
            <p>
              Exact, approximate, and unknown times follow different paths. Approximate times receive stability checks. Unknown times
              produce date-wide ranges and suppress Ascendant, houses, and exact Dasha dates.
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>Versioned receipt</h3>
            <p>
              Every successful result includes its normalized UTC, coordinates, timezone data, profile, active engine, method,
              timestamp, and deterministic input fingerprint.
            </p>
          </article>
        </div>
      </section>

      <section className="scope-section" id="scope">
        <div>
          <span className="eyebrow">HONEST PRODUCT SCOPE</span>
          <h2>Calculated now</h2>
          <ul>
            <li>Geocentric Sun, Moon, and planetary longitudes</li>
            <li>Mean Rahu and Ketu</li>
            <li>Ascendant and whole-sign houses</li>
            <li>Nakshatra, Pada, birth Tithi, Paksha, and Yoga</li>
            <li>Vimshottari Mahadasha sequence</li>
            <li>Five explicitly defined Jyotish rule checks</li>
            <li>Pythagorean numerology from entered data</li>
            <li>Automatic place-to-IANA-timezone resolution</li>
            <li>Historical DST validation and Calculation Receipt</li>
            <li>Approximate-time stability and unknown-time ranges</li>
          </ul>
        </div>
        <div className="not-calculated">
          <span className="eyebrow">NOT CLAIMED YET</span>
          <h2>Outside this engine profile</h2>
          <ul>
            <li>Full dosha cancellation and exception rules</li>
            <li>KP cuspal sub-lords and all D1–D60 Vargas</li>
            <li>Location-aware Muhurta start and end times</li>
            <li>Ashtakoota or Dashakoota compatibility scores</li>
            <li>AI-generated personalized readings</li>
            <li>True-node and alternate ayanamsa profiles</li>
            <li>Accuracy claims beyond the documented kernel target and pinned reference set</li>
          </ul>
        </div>
      </section>

      <section className="trust-note">
        <Sparkle />
        <div>
          <strong>Free MIT accuracy route active</strong>
          <p>
            Every chart identifies the engine, kernel, licence, method IDs, timezone data, and NASA/JPL reference profile used.
            Reference results prove the tested fixtures only; they are not a claim of perfect prediction or universal precision.
          </p>
        </div>
      </section>

      <footer>
        <a className="brand" href="#">
          <MoonLogo />
          <span>
            <strong>Celestial</strong> ASTRO AI
          </span>
        </a>
        <p>Calculated data first. Interpretation only when its source is clear.</p>
        <small>Astrology is not a substitute for medical, legal, financial, or mental-health advice.</small>
      </footer>
    </main>
  );
}
