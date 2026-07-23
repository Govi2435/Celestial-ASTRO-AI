"use client";

import { FormEvent, useState } from "react";
import {
  BirthInput,
  ChartResult,
  formatDate,
  formatDegrees,
  calculateChart,
  SIGNS,
  SIGN_GLYPHS,
  ZodiacSystem,
} from "./astro";

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
      <p>Enter an exact local birth date, time, coordinates, and UTC offset. Results stay blank until the calculation succeeds.</p>
      <div className="empty-points">
        <span>✓ No sample placements</span>
        <span>✓ No invented scores</span>
        <span>✓ Input-driven output</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [result, setResult] = useState<ChartResult | null>(null);
  const [mode, setMode] = useState<ChartMode>("North Indian");
  const [error, setError] = useState("");
  const [calculating, setCalculating] = useState(false);

  function submitBirthDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalculating(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const input: BirthInput = {
      name: String(data.get("name") || "").trim(),
      location: String(data.get("location") || "").trim(),
      date: String(data.get("date") || ""),
      time: String(data.get("time") || ""),
      utcOffset: Number(data.get("utcOffset")),
      latitude: Number(data.get("latitude")),
      longitude: Number(data.get("longitude")),
      system: String(data.get("system")) as ZodiacSystem,
    };

    try {
      setResult(calculateChart(input));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "The calculation could not be completed.");
    } finally {
      setCalculating(false);
    }
  }

  function downloadReport() {
    if (!result) return;
    const rows = result.planets.map(
      (planet) =>
        `${planet.name.padEnd(8)} ${planet.sign.padEnd(12)} ${formatDegrees(planet.degreeInSign)}  H${planet.house}${
          planet.retrograde ? "  Retrograde" : ""
        }`,
    );
    const report = [
      "COSMICSPHERE — CALCULATED CHART DATA",
      `Name: ${result.input.name || "Not provided"}`,
      `Location label: ${result.input.location || "Not provided"}`,
      `Coordinates: ${result.input.latitude}, ${result.input.longitude}`,
      `Input UTC offset: ${result.input.utcOffset >= 0 ? "+" : ""}${result.input.utcOffset}`,
      `Calculated UTC: ${result.utcDate.toISOString()}`,
      `Zodiac basis: ${result.input.system === "lahiri" ? "Mean Lahiri sidereal" : "Tropical"}`,
      `Ayanamsa: ${formatDegrees(result.ayanamsa)}`,
      `Ascendant: ${result.ascendantSign} ${formatDegrees(result.ascendantDegree)}`,
      `Moon Nakshatra (mean Lahiri): ${result.moonNakshatra}, Pada ${result.moonPada}`,
      "",
      "PLANETARY POSITIONS",
      ...rows,
      "",
      `Birth Tithi: ${result.tithi}`,
      `Birth Yoga: ${result.yoga}`,
      "",
      "Method: Astronomy Engine geocentric positions; whole-sign houses; mean Rahu/Ketu.",
      "This report contains calculated data, not professional or predictive advice.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cosmicsphere-calculated-chart.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="CosmicSphere home">
          <MoonLogo />
          <span>
            <strong>Cosmic</strong>Sphere
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
          Local calculation • no saved birth data
        </div>
      </header>

      <section className="intro-band">
        <div>
          <span className="accuracy-pill">
            <Sparkle size={13} /> Input-driven calculator
          </span>
          <h1>
            Your sky, calculated from
            <em> your exact details.</em>
          </h1>
        </div>
        <p>
          This version does not preload a fictional person or a sample reading. It calculates astronomical positions only after you
          provide a complete birth time and location.
        </p>
      </section>

      <section className="calculator-shell" id="calculator">
        <aside className="input-panel glass-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REQUIRED INPUT</span>
              <h2>Exact birth details</h2>
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
              Location label <small>optional; calculations use coordinates</small>
              <span className="field-wrap">
                <span>⌖</span>
                <input name="location" placeholder="City, state, country" />
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
                  <input name="time" type="time" required />
                </span>
              </label>
            </div>
            <label>
              UTC offset at birth <small>include daylight-saving offset if it applied</small>
              <span className="field-wrap">
                <span>±</span>
                <input name="utcOffset" type="number" min="-14" max="14" step="0.25" placeholder="Example: 5.5" required />
              </span>
            </label>
            <div className="form-row">
              <label>
                Latitude
                <span className="field-wrap">
                  <span>φ</span>
                  <input name="latitude" type="number" min="-90" max="90" step="0.000001" placeholder="North is +" required />
                </span>
              </label>
              <label>
                Longitude
                <span className="field-wrap">
                  <span>λ</span>
                  <input
                    name="longitude"
                    type="number"
                    min="-180"
                    max="180"
                    step="0.000001"
                    placeholder="East is +"
                    required
                  />
                </span>
              </label>
            </div>
            <label>
              Zodiac basis
              <span className="field-wrap">
                <span>☼</span>
                <select name="system" defaultValue="lahiri">
                  <option value="lahiri">Mean Lahiri sidereal</option>
                  <option value="tropical">Tropical</option>
                </select>
              </span>
            </label>
            <div className="coordinate-note">
              <span>!</span>
              <p>
                Coordinates and historical UTC offset directly affect the Ascendant. Verify them before relying on the result.
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
              <h2>{result ? `${result.input.name || "Birth"} chart` : "Ready when your inputs are"}</h2>
              <p>
                {result
                  ? `${result.input.system === "lahiri" ? "Mean Lahiri sidereal" : "Tropical"} • ${result.utcDate.toISOString()}`
                  : "Nothing below is populated with sample data."}
              </p>
            </div>
            <button className="outline-button" onClick={downloadReport} disabled={!result}>
              ⇩ &nbsp; Download data
            </button>
          </div>

          {!result ? (
            <EmptyChart />
          ) : (
            <>
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
                    <span className="live-dot" /> Calculated
                  </div>
                </div>
                <div className="chart-stage">
                  <ChartGraphic result={result} mode={mode} />
                  <div className="chart-summary">
                    <span className="eyebrow">ASCENDANT</span>
                    <div className="sign-badge">{SIGN_GLYPHS[result.ascendantSignIndex]}</div>
                    <h3>{result.ascendantSign}</h3>
                    <p>{formatDegrees(result.ascendantDegree)}</p>
                    <div className="summary-rule" />
                    <div>
                      <span>Moon sign</span>
                      <strong>{result.planets.find((planet) => planet.name === "Moon")?.sign}</strong>
                    </div>
                    <div>
                      <span>Nakshatra (Lahiri)</span>
                      <strong>{result.moonNakshatra}</strong>
                    </div>
                    <div>
                      <span>Pada</span>
                      <strong>{result.moonPada}</strong>
                    </div>
                    <div>
                      <span>Ayanamsa</span>
                      <strong>{formatDegrees(result.ayanamsa)}</strong>
                    </div>
                  </div>
                </div>
              </article>

              <div className="fact-grid">
                <article className="fact-card glass-panel">
                  <span className="eyebrow">BIRTH PANCHANG • MEAN LAHIRI</span>
                  <h3>{result.tithi}</h3>
                  <dl>
                    <div>
                      <dt>Paksha</dt>
                      <dd>{result.paksha}</dd>
                    </div>
                    <div>
                      <dt>Nakshatra</dt>
                      <dd>
                        {result.moonNakshatra}, Pada {result.moonPada}
                      </dd>
                    </div>
                    <div>
                      <dt>Yoga</dt>
                      <dd>{result.yoga}</dd>
                    </div>
                  </dl>
                </article>
                <article className="fact-card glass-panel">
                  <span className="eyebrow">NUMEROLOGY</span>
                  <h3>Life Path {result.numerology.lifePath}</h3>
                  <dl>
                    <div>
                      <dt>Expression</dt>
                      <dd>{result.numerology.expression ?? "Name required"}</dd>
                    </div>
                    <div>
                      <dt>Soul Urge</dt>
                      <dd>{result.numerology.soulUrge ?? "Name required"}</dd>
                    </div>
                    <div>
                      <dt>Personal Year</dt>
                      <dd>{result.numerology.personalYear}</dd>
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
                  <span>{result.planets.length} bodies</span>
                </div>
                <div className="planet-header">
                  <span>Body</span>
                  <span>Sign</span>
                  <span>Degree in sign</span>
                  <span>House</span>
                  <span>Motion</span>
                </div>
                <div className="planet-table">
                  {result.planets.map((planet) => (
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

              {result.dashas.length > 0 && (
                <article className="dasha-card glass-panel">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">VIMSHOTTARI MAHADASHA</span>
                      <h3>Moon-Nakshatra timeline</h3>
                    </div>
                    <span>120-year sequence</span>
                  </div>
                  <div className="dasha-list">
                    {result.dashas.map((dasha) => (
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
                  {result.rules.map((rule) => (
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
            </>
          )}
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
              Sun, Moon, and planetary positions come from Astronomy Engine, based on VSOP87 and NOVAS-derived models and validated
              against JPL data. Its stated target is approximately ±1 arcminute.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Coordinate conversion</h3>
            <p>
              Local time is converted to UTC using the offset you supply. Greenwich sidereal time, latitude, and longitude determine
              the Ascendant. Houses are whole-sign houses.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Sidereal option</h3>
            <p>
              The Lahiri option uses an explicitly labelled mean Lahiri approximation. It is not silently presented as licensed Swiss
              Ephemeris output.
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>Rules, not predictions</h3>
            <p>
              Every displayed dosha or yoga check states the exact limited rule it evaluated. The site does not invent remedies,
              personality claims, timing predictions, or compatibility scores.
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
          </ul>
        </div>
        <div className="not-calculated">
          <span className="eyebrow">NOT CLAIMED YET</span>
          <h2>Requires a validated production engine</h2>
          <ul>
            <li>Full dosha cancellation and exception rules</li>
            <li>KP cuspal sub-lords and all D1–D60 Vargas</li>
            <li>Location-aware Muhurta start and end times</li>
            <li>Ashtakoota or Dashakoota compatibility scores</li>
            <li>AI-generated personalized readings</li>
            <li>Swiss Ephemeris branding or precision claims</li>
          </ul>
        </div>
      </section>

      <section className="license-note">
        <Sparkle />
        <div>
          <strong>Why this does not claim Swiss Ephemeris</strong>
          <p>
            Swiss Ephemeris uses AGPL or a commercial professional license. A commercial product should choose and comply with the
            correct license before integrating it.
          </p>
        </div>
      </section>

      <footer>
        <a className="brand" href="#">
          <MoonLogo />
          <span>
            <strong>Cosmic</strong>Sphere
          </span>
        </a>
        <p>Calculated data first. Interpretation only when its source is clear.</p>
        <small>Astrology is not a substitute for medical, legal, financial, or mental-health advice.</small>
      </footer>
    </main>
  );
}
