import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { SIGNS } from "./astro.ts";
import type { CalculationResult, CalculationReceipt } from "./calculation.ts";
import type {
  InterpretationInsight,
  InterpretationPack,
  InterpretationReport,
} from "./interpretation.ts";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  midnight: rgb(0.031, 0.043, 0.078),
  navy: rgb(0.055, 0.075, 0.13),
  panel: rgb(0.075, 0.095, 0.16),
  panelSoft: rgb(0.09, 0.11, 0.19),
  ivory: rgb(0.95, 0.94, 0.89),
  muted: rgb(0.57, 0.61, 0.69),
  faint: rgb(0.27, 0.31, 0.4),
  gold: rgb(0.96, 0.77, 0.26),
  goldSoft: rgb(0.72, 0.56, 0.19),
  indigo: rgb(0.42, 0.3, 0.69),
  cyan: rgb(0.1, 0.66, 0.76),
  green: rgb(0.29, 0.76, 0.51),
  coral: rgb(0.93, 0.44, 0.49),
};

type Fonts = {
  body: PDFFont;
  bodyBold: PDFFont;
  serif: PDFFont;
  serifBold: PDFFont;
  mono: PDFFont;
};

type ReportContext = {
  document: PDFDocument;
  fonts: Fonts;
  result: CalculationResult;
  interpretation: InterpretationReport;
  pageNumber: number;
};

type TextStyle = {
  font?: PDFFont;
  size?: number;
  color?: ReturnType<typeof rgb>;
  lineHeight?: number;
};

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/[–—−]/g, "-")
    .replace(/±/g, "+/-")
    .replace(/•/g, "|")
    .replace(/→/g, "to")
    .replace(/↗/g, "")
    .replace(/℞/g, "Rx")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value: string, maxLength: number) {
  const clean = safeText(value);
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 3).trimEnd()}...`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safeText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }
    let fragment = "";
    for (const character of word) {
      const next = `${fragment}${character}`;
      if (font.widthOfTextAtSize(next, size) > maxWidth && fragment) {
        lines.push(fragment);
        fragment = character;
      } else {
        fragment = next;
      }
    }
    line = fragment;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  style: TextStyle,
  maxLines?: number,
) {
  const font = style.font!;
  const size = style.size ?? 10;
  const lineHeight = style.lineHeight ?? size * 1.45;
  const lines = wrapText(text, font, size, maxWidth);
  const visible = maxLines ? lines.slice(0, maxLines) : lines;
  if (maxLines && lines.length > maxLines) {
    visible[maxLines - 1] = shortText(visible[maxLines - 1], Math.max(8, visible[maxLines - 1].length - 3));
  }
  visible.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color: style.color ?? COLORS.ivory,
    });
  });
  return y - visible.length * lineHeight;
}

function formatAngle(value: number) {
  const degrees = Math.floor(value);
  const minutes = Math.floor((value - degrees) * 60);
  return `${degrees} deg ${String(minutes).padStart(2, "0")} min`;
}

function displayName(result: CalculationResult) {
  const name = result.kind === "timed" ? result.chart.input.name : result.input.name;
  return safeText(name) || "Private chart";
}

function drawOrbitDecoration(page: PDFPage, centerX: number, centerY: number, radius: number) {
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius,
    borderColor: COLORS.indigo,
    borderWidth: 0.8,
    opacity: 0.35,
  });
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius * 0.68,
    borderColor: COLORS.goldSoft,
    borderWidth: 0.65,
    opacity: 0.4,
  });
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius * 0.12,
    color: COLORS.gold,
    opacity: 0.9,
  });
  page.drawCircle({
    x: centerX + radius * 0.72,
    y: centerY + radius * 0.2,
    size: 3.2,
    color: COLORS.cyan,
  });
  page.drawCircle({
    x: centerX - radius * 0.53,
    y: centerY - radius * 0.58,
    size: 2.4,
    color: COLORS.gold,
  });
}

function addPage(context: ReportContext, section: string, label: string) {
  const page = context.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  context.pageNumber += 1;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.midnight });
  page.drawCircle({
    x: PAGE_WIDTH - 40,
    y: PAGE_HEIGHT - 45,
    size: 126,
    borderColor: COLORS.indigo,
    borderWidth: 0.5,
    opacity: 0.12,
  });
  page.drawCircle({
    x: -30,
    y: 170,
    size: 105,
    borderColor: COLORS.goldSoft,
    borderWidth: 0.5,
    opacity: 0.09,
  });
  page.drawText("CELESTIAL", {
    x: MARGIN,
    y: PAGE_HEIGHT - 38,
    size: 9,
    font: context.fonts.serifBold,
    color: COLORS.gold,
  });
  page.drawText("ASTRO AI", {
    x: MARGIN + 57,
    y: PAGE_HEIGHT - 38,
    size: 9,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  const pageLabel = safeText(label).toUpperCase();
  page.drawText(pageLabel, {
    x: PAGE_WIDTH - MARGIN - context.fonts.bodyBold.widthOfTextAtSize(pageLabel, 6.5),
    y: PAGE_HEIGHT - 37,
    size: 6.5,
    font: context.fonts.bodyBold,
    color: COLORS.muted,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 50 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 50 },
    thickness: 0.45,
    color: COLORS.faint,
  });
  page.drawText(safeText(section), {
    x: MARGIN,
    y: 23,
    size: 6.3,
    font: context.fonts.body,
    color: COLORS.muted,
  });
  const footer = `${context.result.receipt.chartId}  |  ${String(context.pageNumber).padStart(2, "0")}`;
  page.drawText(footer, {
    x: PAGE_WIDTH - MARGIN - context.fonts.mono.widthOfTextAtSize(footer, 6),
    y: 23,
    size: 6,
    font: context.fonts.mono,
    color: COLORS.muted,
  });
  return page;
}

function drawSectionHeading(
  context: ReportContext,
  page: PDFPage,
  eyebrow: string,
  title: string,
  description: string,
) {
  page.drawText(safeText(eyebrow).toUpperCase(), {
    x: MARGIN,
    y: 755,
    size: 7,
    font: context.fonts.bodyBold,
    color: COLORS.gold,
  });
  page.drawText(safeText(title), {
    x: MARGIN,
    y: 724,
    size: 23,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  return drawWrappedText(page, description, MARGIN, 700, CONTENT_WIDTH, {
    font: context.fonts.body,
    size: 8.2,
    lineHeight: 12.5,
    color: COLORS.muted,
  });
}

function drawMetricCard(
  context: ReportContext,
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  accent = COLORS.gold,
) {
  page.drawRectangle({
    x,
    y: y - 54,
    width,
    height: 54,
    color: COLORS.panel,
    borderColor: COLORS.faint,
    borderWidth: 0.5,
  });
  page.drawRectangle({ x, y: y - 54, width: 2.5, height: 54, color: accent });
  page.drawText(safeText(label).toUpperCase(), {
    x: x + 12,
    y: y - 17,
    size: 6.2,
    font: context.fonts.bodyBold,
    color: COLORS.muted,
  });
  drawWrappedText(page, value, x + 12, y - 36, width - 22, {
    font: context.fonts.serif,
    size: 11,
    lineHeight: 12,
    color: COLORS.ivory,
  }, 2);
}

function drawCover(context: ReportContext) {
  const page = addPage(context, "Premium Natal Report", "P5 verified report");
  drawOrbitDecoration(page, 455, 660, 94);
  page.drawText("PREMIUM NATAL REPORT", {
    x: MARGIN,
    y: 708,
    size: 7.4,
    font: context.fonts.bodyBold,
    color: COLORS.gold,
  });
  page.drawText(displayName(context.result), {
    x: MARGIN,
    y: 644,
    size: 31,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  page.drawText(context.result.kind === "timed" ? "A calculated celestial profile" : "A verified date-range profile", {
    x: MARGIN,
    y: 615,
    size: 13,
    font: context.fonts.serif,
    color: COLORS.muted,
  });
  drawWrappedText(
    page,
    context.result.kind === "timed"
      ? "Astronomical positions, traditional Jyotish interpretations, and every supporting chart factor - separated, linked, and receipt-verified."
      : "The birth time was not invented. This report preserves date-wide astronomical facts and clearly suppresses time-dependent claims.",
    MARGIN,
    577,
    340,
    { font: context.fonts.body, size: 9.4, lineHeight: 15, color: COLORS.muted },
  );

  const location =
    context.result.kind === "timed" ? context.result.chart.input.location : context.result.input.location;
  drawMetricCard(context, page, MARGIN, 482, 246, "Recorded local birth", context.result.receipt.localInput);
  drawMetricCard(context, page, MARGIN + 260, 482, 246, "Birthplace", location, COLORS.cyan);

  if (context.result.kind === "timed") {
    const moon = context.result.chart.planets.find((planet) => planet.name === "Moon");
    drawMetricCard(
      context,
      page,
      MARGIN,
      410,
      158,
      "Ascendant",
      `${context.result.chart.ascendantSign} ${formatAngle(context.result.chart.ascendantDegree)}`,
    );
    drawMetricCard(context, page, MARGIN + 174, 410, 158, "Moon", moon?.sign ?? "Unavailable", COLORS.indigo);
    drawMetricCard(
      context,
      page,
      MARGIN + 348,
      410,
      158,
      "Nakshatra",
      `${context.result.chart.moonNakshatra}, Pada ${context.result.chart.moonPada}`,
      COLORS.cyan,
    );
  } else {
    drawMetricCard(context, page, MARGIN, 410, 246, "Time confidence", "Unknown - houses suppressed", COLORS.coral);
    drawMetricCard(
      context,
      page,
      MARGIN + 260,
      410,
      246,
      "Stable signs",
      `${context.result.planets.filter((planet) => planet.stableSign).length} of ${context.result.planets.length}`,
      COLORS.green,
    );
  }

  page.drawRectangle({
    x: MARGIN,
    y: 136,
    width: CONTENT_WIDTH,
    height: 142,
    color: COLORS.panelSoft,
    borderColor: COLORS.goldSoft,
    borderWidth: 0.7,
  });
  page.drawText("THE TRUST CONTRACT", {
    x: MARGIN + 19,
    y: 250,
    size: 7,
    font: context.fonts.bodyBold,
    color: COLORS.gold,
  });
  const promises = [
    "Recalculated on the server from the submitted birth details",
    "No random placements, hidden scores, or guaranteed predictions",
    "Calculated facts remain separate from traditional interpretation",
    "Every interpretation includes its rule ID, evidence, and limitation",
  ];
  promises.forEach((promise, index) => {
    const y = 221 - index * 22;
    page.drawCircle({ x: MARGIN + 22, y: y + 2, size: 2.6, color: index === 3 ? COLORS.cyan : COLORS.green });
    page.drawText(safeText(promise), {
      x: MARGIN + 34,
      y,
      size: 8,
      font: context.fonts.body,
      color: COLORS.ivory,
    });
  });
  page.drawText("REPORT RECEIPT", {
    x: MARGIN,
    y: 103,
    size: 6.2,
    font: context.fonts.bodyBold,
    color: COLORS.muted,
  });
  page.drawText(context.result.receipt.chartId, {
    x: MARGIN,
    y: 87,
    size: 8.2,
    font: context.fonts.mono,
    color: COLORS.gold,
  });
  page.drawText("Generated privately. Birth data is not stored by this report endpoint.", {
    x: MARGIN,
    y: 69,
    size: 6.6,
    font: context.fonts.body,
    color: COLORS.muted,
  });
}

function drawZodiacWheel(context: ReportContext, page: PDFPage, centerX: number, centerY: number, radius: number) {
  if (context.result.kind !== "timed") return;
  const chart = context.result.chart;
  page.drawCircle({ x: centerX, y: centerY, size: radius, borderColor: COLORS.goldSoft, borderWidth: 0.8 });
  page.drawCircle({ x: centerX, y: centerY, size: radius * 0.72, borderColor: COLORS.faint, borderWidth: 0.6 });
  page.drawCircle({ x: centerX, y: centerY, size: radius * 0.25, color: COLORS.panelSoft });
  for (let index = 0; index < 12; index += 1) {
    const angle = (index * Math.PI) / 6;
    page.drawLine({
      start: {
        x: centerX + Math.sin(angle) * radius * 0.72,
        y: centerY + Math.cos(angle) * radius * 0.72,
      },
      end: {
        x: centerX + Math.sin(angle) * radius,
        y: centerY + Math.cos(angle) * radius,
      },
      thickness: 0.45,
      color: COLORS.faint,
    });
    const signAngle = angle + Math.PI / 12;
    const sign = SIGNS[index].slice(0, 3).toUpperCase();
    page.drawText(sign, {
      x: centerX + Math.sin(signAngle) * radius * 0.84 - context.fonts.bodyBold.widthOfTextAtSize(sign, 5.2) / 2,
      y: centerY + Math.cos(signAngle) * radius * 0.84 - 2,
      size: 5.2,
      font: context.fonts.bodyBold,
      color: COLORS.muted,
    });
  }
  chart.planets.forEach((planet, index) => {
    const angle = (planet.longitude * Math.PI) / 180;
    const orbit = radius * (0.61 - (index % 3) * 0.07);
    const x = centerX + Math.sin(angle) * orbit;
    const y = centerY + Math.cos(angle) * orbit;
    page.drawCircle({ x, y, size: 4.8, color: index < 2 ? COLORS.gold : COLORS.indigo, opacity: 0.95 });
    const label = planet.short.toUpperCase();
    page.drawText(label, {
      x: x - context.fonts.bodyBold.widthOfTextAtSize(label, 4.4) / 2,
      y: y - 1.5,
      size: 4.4,
      font: context.fonts.bodyBold,
      color: COLORS.midnight,
    });
  });
  page.drawText("D1", {
    x: centerX - context.fonts.serifBold.widthOfTextAtSize("D1", 14) / 2,
    y: centerY - 5,
    size: 14,
    font: context.fonts.serifBold,
    color: COLORS.gold,
  });
}

function drawTimedOverview(context: ReportContext) {
  if (context.result.kind !== "timed") return;
  const page = addPage(context, "Chart Overview", "Calculated facts");
  drawSectionHeading(
    context,
    page,
    "Chart at a glance",
    "Your celestial fingerprint",
    "This page contains calculated chart facts only. Interpretive meaning begins in the evidence sections that follow.",
  );
  drawZodiacWheel(context, page, 181, 500, 118);
  const chart = context.result.chart;
  const moon = chart.planets.find((planet) => planet.name === "Moon");
  const facts = [
    ["Ascendant", `${chart.ascendantSign} ${formatAngle(chart.ascendantDegree)}`],
    ["Moon sign", moon?.sign ?? "Unavailable"],
    ["Nakshatra", `${chart.moonNakshatra}, Pada ${chart.moonPada}`],
    ["Birth Tithi", `${chart.tithi} | ${chart.paksha}`],
    ["Yoga", chart.yoga],
    ["Ayanamsa", formatAngle(chart.ayanamsa)],
    ["House system", context.result.receipt.houseSystem],
    ["Node method", context.result.receipt.nodeMethod],
  ];
  let y = 604;
  facts.forEach(([label, value], index) => {
    const accent = index < 3 ? COLORS.gold : COLORS.indigo;
    drawMetricCard(context, page, 327, y, 224, label, value, accent);
    y -= 65;
  });
  page.drawRectangle({
    x: MARGIN,
    y: 89,
    width: 252,
    height: 196,
    color: COLORS.panel,
    borderColor: COLORS.faint,
    borderWidth: 0.5,
  });
  page.drawText("NUMEROLOGY FROM ENTERED DATA", {
    x: MARGIN + 16,
    y: 258,
    size: 6.5,
    font: context.fonts.bodyBold,
    color: COLORS.muted,
  });
  const numerology = [
    ["Life Path", String(chart.numerology.lifePath)],
    ["Expression", chart.numerology.expression === null ? "Name required" : String(chart.numerology.expression)],
    ["Soul Urge", chart.numerology.soulUrge === null ? "Name required" : String(chart.numerology.soulUrge)],
    ["Personal Year", String(chart.numerology.personalYear)],
  ];
  numerology.forEach(([label, value], index) => {
    const rowY = 223 - index * 32;
    page.drawText(label, { x: MARGIN + 16, y: rowY, size: 7.2, font: context.fonts.body, color: COLORS.muted });
    page.drawText(value, {
      x: MARGIN + 222 - context.fonts.serifBold.widthOfTextAtSize(value, 12),
      y: rowY - 2,
      size: 12,
      font: context.fonts.serifBold,
      color: COLORS.ivory,
    });
    if (index < numerology.length - 1) {
      page.drawLine({
        start: { x: MARGIN + 16, y: rowY - 12 },
        end: { x: MARGIN + 236, y: rowY - 12 },
        thickness: 0.35,
        color: COLORS.faint,
      });
    }
  });
  page.drawRectangle({
    x: 310,
    y: 89,
    width: 241,
    height: 196,
    color: COLORS.panelSoft,
    borderColor: COLORS.faint,
    borderWidth: 0.5,
  });
  page.drawText("BIRTH-TIME CONFIDENCE", {
    x: 326,
    y: 258,
    size: 6.5,
    font: context.fonts.bodyBold,
    color: COLORS.gold,
  });
  page.drawText(context.result.receipt.birthTimeConfidence.toUpperCase(), {
    x: 326,
    y: 222,
    size: 18,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  const stability = context.result.stability;
  const stabilityCopy = stability
    ? `The declared uncertainty is +/-${stability.uncertaintyMinutes} minutes. Ascendant ${
        stability.ascendantStable ? "remained stable" : "may change"
      }; Moon sign ${stability.moonSignStable ? "remained stable" : "may change"}; Nakshatra ${
        stability.nakshatraStable ? "remained stable" : "may change"
      }.`
    : "The report uses the recorded minute supplied by the customer. Exact-time status describes the input, not certainty about interpretation.";
  drawWrappedText(page, stabilityCopy, 326, 194, 205, {
    font: context.fonts.body,
    size: 7.5,
    lineHeight: 11.5,
    color: COLORS.muted,
  });
}

function drawPlanetTable(context: ReportContext) {
  if (context.result.kind !== "timed") return;
  const page = addPage(context, "Planetary Positions", "Calculated facts");
  drawSectionHeading(
    context,
    page,
    "Calculated longitudes",
    "Planetary positions",
    "Mean Lahiri sidereal longitudes with whole-sign houses. Retrograde status is calculated from the active astronomy kernel.",
  );
  const headers = [
    { label: "BODY", x: MARGIN + 12 },
    { label: "SIGN", x: MARGIN + 124 },
    { label: "DEGREE", x: MARGIN + 250 },
    { label: "HOUSE", x: MARGIN + 382 },
    { label: "MOTION", x: MARGIN + 438 },
  ];
  page.drawRectangle({ x: MARGIN, y: 650, width: CONTENT_WIDTH, height: 29, color: COLORS.panelSoft });
  headers.forEach((header) => {
    page.drawText(header.label, {
      x: header.x,
      y: 661,
      size: 6,
      font: context.fonts.bodyBold,
      color: COLORS.gold,
    });
  });
  context.result.chart.planets.forEach((planet, index) => {
    const rowY = 622 - index * 37;
    page.drawRectangle({
      x: MARGIN,
      y: rowY - 10,
      width: CONTENT_WIDTH,
      height: 34,
      color: index % 2 === 0 ? COLORS.panel : COLORS.navy,
      opacity: 0.9,
    });
    page.drawCircle({
      x: MARGIN + 16,
      y: rowY + 5,
      size: 4,
      color: index < 2 ? COLORS.gold : index < 7 ? COLORS.indigo : COLORS.cyan,
    });
    page.drawText(planet.name, {
      x: MARGIN + 29,
      y: rowY + 1,
      size: 8,
      font: context.fonts.bodyBold,
      color: COLORS.ivory,
    });
    page.drawText(planet.sign, {
      x: MARGIN + 124,
      y: rowY + 1,
      size: 8,
      font: context.fonts.body,
      color: COLORS.ivory,
    });
    page.drawText(formatAngle(planet.degreeInSign), {
      x: MARGIN + 250,
      y: rowY + 1,
      size: 7.2,
      font: context.fonts.mono,
      color: COLORS.muted,
    });
    page.drawText(`H${planet.house}`, {
      x: MARGIN + 390,
      y: rowY + 1,
      size: 8,
      font: context.fonts.bodyBold,
      color: COLORS.gold,
    });
    page.drawText(planet.retrograde ? "Retrograde" : "Direct", {
      x: MARGIN + 438,
      y: rowY + 1,
      size: 7,
      font: context.fonts.body,
      color: planet.retrograde ? COLORS.coral : COLORS.green,
    });
  });
  const currentDasha = context.result.chart.dashas.find((dasha) => dasha.current);
  page.drawRectangle({
    x: MARGIN,
    y: 87,
    width: CONTENT_WIDTH,
    height: 79,
    color: COLORS.panelSoft,
    borderColor: COLORS.indigo,
    borderWidth: 0.55,
  });
  page.drawText("CURRENT TRADITIONAL TIMING CONTEXT", {
    x: MARGIN + 16,
    y: 142,
    size: 6.3,
    font: context.fonts.bodyBold,
    color: COLORS.muted,
  });
  page.drawText(currentDasha ? `${currentDasha.lord} Mahadasha` : "No current segment in calculated sequence", {
    x: MARGIN + 16,
    y: 116,
    size: 15,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  if (currentDasha) {
    const range = `${currentDasha.start.toISOString().slice(0, 10)} to ${currentDasha.end.toISOString().slice(0, 10)}`;
    page.drawText(range, {
      x: PAGE_WIDTH - MARGIN - 16 - context.fonts.mono.widthOfTextAtSize(range, 7),
      y: 116,
      size: 7,
      font: context.fonts.mono,
      color: COLORS.gold,
    });
  }
  page.drawText("Traditional timing framework only - not a guaranteed event forecast.", {
    x: MARGIN + 16,
    y: 98,
    size: 6.6,
    font: context.fonts.body,
    color: COLORS.muted,
  });
}

function insightCardHeight(context: ReportContext, insight: InterpretationInsight) {
  const statementLines = wrapText(insight.statement, context.fonts.body, 7.4, CONTENT_WIDTH - 34).length;
  const evidenceLines = insight.evidence.reduce(
    (total, item) =>
      total + wrapText(`${item.label}: ${item.value}`, context.fonts.body, 6.6, CONTENT_WIDTH - 70).length,
    0,
  );
  const limitationLines = wrapText(insight.limitation, context.fonts.body, 6.4, CONTENT_WIDTH - 34).length;
  return Math.max(128, 88 + statementLines * 10.6 + evidenceLines * 11 + limitationLines * 10);
}

function drawInsightCard(
  context: ReportContext,
  page: PDFPage,
  insight: InterpretationInsight,
  y: number,
) {
  const height = insightCardHeight(context, insight);
  const accent = insight.pack === "career" ? COLORS.cyan : insight.pack === "relationship" ? COLORS.indigo : COLORS.gold;
  page.drawRectangle({
    x: MARGIN,
    y: y - height,
    width: CONTENT_WIDTH,
    height,
    color: COLORS.panel,
    borderColor: COLORS.faint,
    borderWidth: 0.5,
  });
  page.drawRectangle({ x: MARGIN, y: y - height, width: 3, height, color: accent });
  page.drawText(safeText(insight.category).toUpperCase(), {
    x: MARGIN + 17,
    y: y - 20,
    size: 6.1,
    font: context.fonts.bodyBold,
    color: accent,
  });
  const confidence = insight.confidence === "supported" ? "SUPPORTED" : "LIMITED";
  page.drawText(confidence, {
    x: PAGE_WIDTH - MARGIN - 17 - context.fonts.bodyBold.widthOfTextAtSize(confidence, 5.8),
    y: y - 20,
    size: 5.8,
    font: context.fonts.bodyBold,
    color: insight.confidence === "supported" ? COLORS.green : COLORS.coral,
  });
  page.drawText(safeText(insight.title), {
    x: MARGIN + 17,
    y: y - 43,
    size: 13,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  let cursor = drawWrappedText(page, insight.statement, MARGIN + 17, y - 62, CONTENT_WIDTH - 34, {
    font: context.fonts.body,
    size: 7.4,
    lineHeight: 10.6,
    color: COLORS.muted,
  });
  cursor -= 5;
  page.drawText("EVIDENCE USED", {
    x: MARGIN + 17,
    y: cursor,
    size: 5.6,
    font: context.fonts.bodyBold,
    color: COLORS.gold,
  });
  cursor -= 13;
  insight.evidence.forEach((evidence) => {
    page.drawCircle({
      x: MARGIN + 22,
      y: cursor + 2,
      size: 2,
      color: evidence.kind === "calculated" ? COLORS.green : COLORS.cyan,
    });
    cursor = drawWrappedText(
      page,
      `${evidence.label}: ${evidence.value}`,
      MARGIN + 31,
      cursor + 5,
      CONTENT_WIDTH - 70,
      { font: context.fonts.body, size: 6.7, lineHeight: 11, color: COLORS.ivory },
    );
  });
  cursor -= 2;
  drawWrappedText(page, `Limit: ${insight.limitation}`, MARGIN + 17, cursor, CONTENT_WIDTH - 34, {
    font: context.fonts.body,
    size: 6.4,
    lineHeight: 10,
    color: COLORS.muted,
  });
  page.drawText(insight.ruleId, {
    x: PAGE_WIDTH - MARGIN - 17 - context.fonts.mono.widthOfTextAtSize(insight.ruleId, 5.2),
    y: y - height + 10,
    size: 5.2,
    font: context.fonts.mono,
    color: COLORS.faint,
  });
  return y - height - 12;
}

const PACK_LABELS: Record<InterpretationPack, { eyebrow: string; title: string; description: string }> = {
  core: {
    eyebrow: "Core interpretation pack",
    title: "Identity and inner patterns",
    description: "Traditional Jyotish themes derived only from the calculated chart factors printed under each reading.",
  },
  career: {
    eyebrow: "Career interpretation pack",
    title: "Work and decision themes",
    description: "A reflective career lens - not a profession selector, employment promise, income forecast, or financial recommendation.",
  },
  relationship: {
    eyebrow: "Relationship interpretation pack",
    title: "Relating and partnership themes",
    description: "One-chart relational themes with no compatibility percentage, marriage outcome, or claim about another person.",
  },
};

function drawInterpretationPack(context: ReportContext, pack: InterpretationPack) {
  const insights = context.interpretation.insights.filter((insight) => insight.pack === pack);
  if (!insights.length) return;
  const label = PACK_LABELS[pack];
  const preferredCardsPerPage = pack === "relationship" ? 2 : 3;
  let page = addPage(context, `${label.title} | ${pack}`, "Traditional interpretation");
  let cursor = drawSectionHeading(context, page, label.eyebrow, label.title, label.description) - 20;
  let cardsOnPage = 0;
  for (const insight of insights) {
    const required = insightCardHeight(context, insight);
    if (cardsOnPage >= preferredCardsPerPage || cursor - required < 62) {
      page = addPage(context, `${label.title} | continued`, "Traditional interpretation");
      cursor =
        drawSectionHeading(
          context,
          page,
          `${label.eyebrow} - continued`,
          label.title,
          "Each statement remains linked to its visible chart evidence and approved rule identifier.",
        ) - 20;
      cardsOnPage = 0;
    }
    cursor = drawInsightCard(context, page, insight, cursor);
    cardsOnPage += 1;
  }
}

function drawUnknownOverview(context: ReportContext) {
  if (context.result.kind !== "unknown") return;
  const page = addPage(context, "Date-range Overview", "Calculated facts");
  drawSectionHeading(
    context,
    page,
    "Birth time unknown",
    "What stayed stable across the day",
    "The engine evaluated the complete local civil day. It reports ranges and stable sign placements without inventing an Ascendant or houses.",
  );
  page.drawRectangle({ x: MARGIN, y: 641, width: CONTENT_WIDTH, height: 29, color: COLORS.panelSoft });
  const headers = [
    ["BODY", MARGIN + 12],
    ["START OF DAY", MARGIN + 112],
    ["END OF DAY", MARGIN + 270],
    ["SIGN STATUS", MARGIN + 423],
  ] as const;
  headers.forEach(([label, x]) => {
    page.drawText(label, { x, y: 652, size: 6, font: context.fonts.bodyBold, color: COLORS.gold });
  });
  context.result.planets.forEach((planet, index) => {
    const y = 614 - index * 37;
    page.drawRectangle({
      x: MARGIN,
      y: y - 10,
      width: CONTENT_WIDTH,
      height: 34,
      color: index % 2 === 0 ? COLORS.panel : COLORS.navy,
    });
    page.drawText(planet.name, { x: MARGIN + 12, y: y + 1, size: 7.7, font: context.fonts.bodyBold, color: COLORS.ivory });
    page.drawText(shortText(planet.start, 25), { x: MARGIN + 112, y: y + 1, size: 6.5, font: context.fonts.body, color: COLORS.muted });
    page.drawText(shortText(planet.end, 25), { x: MARGIN + 270, y: y + 1, size: 6.5, font: context.fonts.body, color: COLORS.muted });
    const status = planet.stableSign ? `Stable: ${planet.possibleSigns[0]}` : shortText(planet.possibleSigns.join(" / "), 18);
    page.drawText(status, {
      x: MARGIN + 423,
      y: y + 1,
      size: 6.2,
      font: context.fonts.bodyBold,
      color: planet.stableSign ? COLORS.green : COLORS.coral,
    });
  });
  page.drawRectangle({
    x: MARGIN,
    y: 84,
    width: CONTENT_WIDTH,
    height: 88,
    color: COLORS.panelSoft,
    borderColor: COLORS.coral,
    borderWidth: 0.55,
  });
  page.drawText("SUPPRESSED FOR TRUST", {
    x: MARGIN + 16,
    y: 148,
    size: 6.3,
    font: context.fonts.bodyBold,
    color: COLORS.coral,
  });
  drawWrappedText(page, context.result.suppressed.join(" | "), MARGIN + 16, 126, CONTENT_WIDTH - 32, {
    font: context.fonts.body,
    size: 6.8,
    lineHeight: 10,
    color: COLORS.muted,
  });
}

function receiptRows(receipt: CalculationReceipt) {
  return [
    ["Chart ID", receipt.chartId],
    ["Local input", receipt.localInput],
    ["Normalized UTC", receipt.normalizedUtc],
    ["Coordinates", receipt.coordinates],
    ["IANA timezone", receipt.timezoneId],
    ["Historical offset", `${receipt.timezoneOffset} | ${receipt.timezoneAbbreviation}`],
    ["Timezone data", receipt.timezoneDataVersion],
    ["Calculation profile", receipt.profileId],
    ["Ayanamsa", `${receipt.ayanamsa} | ${receipt.ayanamsaProfileId}`],
    ["Houses", `${receipt.houseSystem} | ${receipt.houseProfileId}`],
    ["Nodes", `${receipt.nodeMethod} | ${receipt.nodeProfileId}`],
    ["Engine", `${receipt.engineName} ${receipt.engineVersion} | ${receipt.engineStatus}`],
    ["Astronomy kernel", `${receipt.kernel} | ${receipt.kernelLicense}`],
    ["Reference validation", receipt.validationSummary],
    ["Validation profile", receipt.validationProfile],
    ["P2 certificate", `${receipt.certificationId} | ${receipt.certificationStatus}`],
    ["Certified coverage", receipt.certificationSummary],
    ["Calculated at", receipt.calculatedAt],
    ["Input fingerprint", receipt.inputFingerprint],
  ];
}

function drawReceipt(context: ReportContext) {
  const page = addPage(context, "Calculation Receipt", "Reproducibility");
  drawSectionHeading(
    context,
    page,
    "Transparent calculation",
    "Your calculation receipt",
    "These versioned fields identify the input conversion, method profile, active astronomy engine, and reference-certificate coverage used for this report.",
  );
  const rows = receiptRows(context.result.receipt);
  let y = 656;
  rows.forEach(([label, value], index) => {
    const rowHeight = index === rows.length - 1 ? 44 : 29;
    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight + 7,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: index % 2 === 0 ? COLORS.panel : COLORS.navy,
    });
    page.drawText(safeText(label).toUpperCase(), {
      x: MARGIN + 12,
      y: y - 5,
      size: 5.8,
      font: context.fonts.bodyBold,
      color: COLORS.muted,
    });
    drawWrappedText(page, value, MARGIN + 158, y - 5, CONTENT_WIDTH - 173, {
      font: index === rows.length - 1 ? context.fonts.mono : context.fonts.body,
      size: index === rows.length - 1 ? 5.3 : 6.6,
      lineHeight: 8.2,
      color: index === 0 ? COLORS.gold : COLORS.ivory,
    }, index === rows.length - 1 ? 2 : 1);
    y -= rowHeight;
  });
  page.drawRectangle({
    x: MARGIN,
    y: 75,
    width: CONTENT_WIDTH,
    height: 46,
    color: COLORS.panelSoft,
    borderColor: COLORS.green,
    borderWidth: 0.5,
  });
  page.drawCircle({ x: MARGIN + 17, y: 98, size: 4, color: COLORS.green });
  page.drawText("REPRODUCIBLE CALCULATION PROFILE ACTIVE", {
    x: MARGIN + 31,
    y: 101,
    size: 6.5,
    font: context.fonts.bodyBold,
    color: COLORS.ivory,
  });
  page.drawText("This certificate covers calculation reproducibility. It does not scientifically validate astrology.", {
    x: MARGIN + 31,
    y: 86,
    size: 6.2,
    font: context.fonts.body,
    color: COLORS.muted,
  });
}

function drawClosingPage(context: ReportContext) {
  const page = addPage(context, "Use With Perspective", "Scope and limits");
  drawOrbitDecoration(page, 466, 680, 70);
  page.drawText("USE WITH PERSPECTIVE", {
    x: MARGIN,
    y: 710,
    size: 7,
    font: context.fonts.bodyBold,
    color: COLORS.gold,
  });
  page.drawText("Calculated. Explained.", {
    x: MARGIN,
    y: 654,
    size: 27,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  page.drawText("Never presented as certainty.", {
    x: MARGIN,
    y: 619,
    size: 22,
    font: context.fonts.serif,
    color: COLORS.muted,
  });
  drawWrappedText(
    page,
    "Astrology interpretations are traditional and are not scientifically proven predictions. Use this report for reflection, not as a substitute for professional medical, legal, financial, or mental-health advice.",
    MARGIN,
    572,
    360,
    { font: context.fonts.body, size: 9.2, lineHeight: 15, color: COLORS.muted },
  );

  const included = [
    "Server-recalculated astronomical positions",
    "Historical timezone and UTC normalization",
    "Birth-time confidence and suppression rules",
    "Approved evidence-linked Jyotish interpretation",
    "Versioned calculation receipt and P2 certificate",
  ];
  const excluded = [
    "Guaranteed events or perfect prediction claims",
    "Fear-based messages or expensive remedy pressure",
    "Medical, legal, financial, or mental-health certainty",
    "Hidden compatibility percentages",
    "Interpretations unsupported by the calculated chart",
  ];
  const columns = [
    { x: MARGIN, title: "WHAT THIS REPORT INCLUDES", items: included, color: COLORS.green },
    { x: 310, title: "WHAT THIS REPORT REFUSES", items: excluded, color: COLORS.coral },
  ];
  columns.forEach((column) => {
    page.drawRectangle({
      x: column.x,
      y: 229,
      width: 241,
      height: 248,
      color: COLORS.panel,
      borderColor: COLORS.faint,
      borderWidth: 0.5,
    });
    page.drawText(column.title, {
      x: column.x + 16,
      y: 449,
      size: 6.2,
      font: context.fonts.bodyBold,
      color: column.color,
    });
    column.items.forEach((item, index) => {
      const y = 413 - index * 39;
      page.drawCircle({ x: column.x + 19, y: y + 3, size: 2.4, color: column.color });
      drawWrappedText(page, item, column.x + 30, y + 6, 192, {
        font: context.fonts.body,
        size: 7.2,
        lineHeight: 10.2,
        color: COLORS.ivory,
      }, 2);
    });
  });
  page.drawText("YOUR CHART. CALCULATED, EXPLAINED, UNDERSTOOD.", {
    x: MARGIN,
    y: 174,
    size: 8,
    font: context.fonts.bodyBold,
    color: COLORS.gold,
  });
  page.drawText("Celestial ASTRO AI", {
    x: MARGIN,
    y: 128,
    size: 21,
    font: context.fonts.serif,
    color: COLORS.ivory,
  });
  page.drawText("Report profile celestial-premium-report-p5-v1", {
    x: MARGIN,
    y: 104,
    size: 6.5,
    font: context.fonts.mono,
    color: COLORS.muted,
  });
}

export const PREMIUM_REPORT_PROFILE = {
  id: "celestial-premium-report-p5-v1",
  schema: "premium-report-v1",
  status: "Active",
  format: "application/pdf",
  privacy: "Generated on demand and not stored",
  sections: [
    "Cover and trust contract",
    "Chart overview or unknown-time date range",
    "Planetary positions",
    "Core, career, and relationship evidence packs",
    "Calculation receipt",
    "Scope and limitations",
  ],
} as const;

export async function buildPremiumReport(
  result: CalculationResult,
  interpretation: InterpretationReport,
) {
  if (result.receipt.chartId !== interpretation.chartId) {
    throw new Error("Report evidence does not match the calculation receipt.");
  }
  const document = await PDFDocument.create();
  const fonts: Fonts = {
    body: await document.embedFont(StandardFonts.Helvetica),
    bodyBold: await document.embedFont(StandardFonts.HelveticaBold),
    serif: await document.embedFont(StandardFonts.TimesRoman),
    serifBold: await document.embedFont(StandardFonts.TimesRomanBold),
    mono: await document.embedFont(StandardFonts.Courier),
  };
  const context: ReportContext = {
    document,
    fonts,
    result,
    interpretation,
    pageNumber: 0,
  };

  document.setTitle(`${displayName(result)} | Celestial ASTRO AI Premium Report`);
  document.setAuthor("Celestial ASTRO AI");
  document.setSubject(`Receipt-linked premium astrology report ${result.receipt.chartId}`);
  document.setKeywords(["astrology", "calculation receipt", "evidence-linked", "Celestial ASTRO AI"]);
  document.setProducer(PREMIUM_REPORT_PROFILE.id);
  document.setCreator("Celestial ASTRO AI");
  document.setCreationDate(new Date());
  document.setModificationDate(new Date());

  drawCover(context);
  if (result.kind === "timed") {
    drawTimedOverview(context);
    drawPlanetTable(context);
    drawInterpretationPack(context, "core");
    drawInterpretationPack(context, "career");
    drawInterpretationPack(context, "relationship");
  } else {
    drawUnknownOverview(context);
  }
  drawReceipt(context);
  drawClosingPage(context);
  return document.save({ useObjectStreams: false });
}
