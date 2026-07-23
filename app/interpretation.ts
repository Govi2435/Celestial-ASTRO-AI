import { formatDate, formatDegrees, type PlanetPosition } from "./astro.ts";
import type {
  BirthTimeConfidence,
  CalculationResult,
  TimedCalculationResult,
} from "./calculation.ts";

export type InterpretationConfidence = "supported" | "limited";
export type InterpretationEvidenceKind = "calculated" | "derived" | "limitation";

export type InterpretationEvidence = {
  id: string;
  kind: InterpretationEvidenceKind;
  label: string;
  value: string;
  sourcePath: string;
};

export type InterpretationInsight = {
  id: string;
  category: string;
  title: string;
  statement: string;
  confidence: InterpretationConfidence;
  ruleId: (typeof INTERPRETATION_PROFILE)["approvedRuleIds"][number];
  evidence: InterpretationEvidence[];
  limitation: string;
};

export type InterpretationReport = {
  schema: typeof INTERPRETATION_PROFILE.schema;
  profileId: typeof INTERPRETATION_PROFILE.id;
  chartId: string;
  generatedBy: "deterministic-rule-engine";
  status: "available" | "limited";
  birthTimeConfidence: BirthTimeConfidence;
  disclosure: string;
  insights: InterpretationInsight[];
  suppressed: string[];
};

export const INTERPRETATION_PROFILE = {
  id: "celestial-interpretation-p4-v1",
  schema: "interpretation-evidence-v1",
  status: "Active",
  tradition: "Jyotish",
  knowledgeProfile: "celestial-approved-jyotish-vocabulary-v1",
  approvedRuleIds: [
    "p4.ascendant.sign.v1",
    "p4.moon.sign-nakshatra.v1",
    "p4.mercury.sign-house.v1",
    "p4.mars.sign-house.v1",
    "p4.dasha.current-lord.v1",
  ] as const,
  guardrails: [
    "Every interpretation must cite one or more visible chart factors.",
    "Calculated facts, derived rules, and traditional interpretations remain visibly separated.",
    "Unknown birth time suppresses Ascendant, house, and exact Dasha interpretations.",
    "Approximate birth time marks affected interpretations as limited.",
    "No guaranteed events, fear-based language, or medical, legal, or financial certainty.",
    "Open-ended AI answers remain disabled until they can be constrained to this evidence contract.",
  ],
} as const;

const SIGN_THEMES: Record<string, string> = {
  Aries: "initiative, directness, and momentum",
  Taurus: "stability, continuity, and tangible priorities",
  Gemini: "curiosity, exchange, and adaptability",
  Cancer: "protection, belonging, and emotional continuity",
  Leo: "visibility, creative expression, and personal authorship",
  Virgo: "discernment, refinement, and practical service",
  Libra: "balance, relationship awareness, and considered choice",
  Scorpio: "depth, privacy, and sustained transformation",
  Sagittarius: "meaning, exploration, and a wider frame",
  Capricorn: "structure, responsibility, and long-range effort",
  Aquarius: "systems, independence, and collective perspective",
  Pisces: "sensitivity, imagination, and porous boundaries",
};

const DASHA_THEMES: Record<string, string> = {
  Ketu: "release, simplification, and inward reassessment",
  Venus: "relationships, values, creativity, and material preferences",
  Sun: "identity, visibility, responsibility, and purpose",
  Moon: "emotional life, care, belonging, and changing needs",
  Mars: "initiative, effort, competition, and boundaries",
  Rahu: "amplification, unfamiliar territory, and strong appetite",
  Jupiter: "learning, counsel, meaning, and expansion",
  Saturn: "structure, patience, duty, and durable results",
  Mercury: "learning, communication, trade, and analysis",
};

const DISCLOSURE =
  "These are traditional Jyotish interpretations produced by a deterministic rule engine. They are not scientific, predictive, or professional advice.";

function planet(chart: TimedCalculationResult["chart"], name: string) {
  const match = chart.planets.find((candidate) => candidate.name === name);
  if (!match) throw new Error(`Interpretation evidence is missing calculated ${name} data.`);
  return match;
}

function positionEvidence(body: PlanetPosition): InterpretationEvidence[] {
  return [
    {
      id: `${body.name.toLowerCase()}-sign`,
      kind: "calculated",
      label: `${body.name} sign`,
      value: `${body.sign} ${formatDegrees(body.degreeInSign)}`,
      sourcePath: `chart.planets.${body.name}.sign`,
    },
    {
      id: `${body.name.toLowerCase()}-house`,
      kind: "calculated",
      label: `${body.name} whole-sign house`,
      value: `House ${body.house}`,
      sourcePath: `chart.planets.${body.name}.house`,
    },
    {
      id: `${body.name.toLowerCase()}-motion`,
      kind: "calculated",
      label: `${body.name} apparent motion`,
      value: body.retrograde ? "Retrograde" : "Direct",
      sourcePath: `chart.planets.${body.name}.retrograde`,
    },
  ];
}

function confidenceFor(
  result: TimedCalculationResult,
  factors: { ascendant?: boolean; moon?: boolean; housePlanet?: string },
): InterpretationConfidence {
  if (result.receipt.birthTimeConfidence !== "approximate" || !result.stability) return "supported";
  if (factors.ascendant && !result.stability.ascendantStable) return "limited";
  if (factors.moon && (!result.stability.moonSignStable || !result.stability.nakshatraStable)) return "limited";
  if (factors.housePlanet && result.stability.houseChanges.includes(factors.housePlanet)) return "limited";
  return "supported";
}

function insightLimitation(confidence: InterpretationConfidence) {
  return confidence === "limited"
    ? "This interpretation depends on a factor that may change inside the declared birth-time uncertainty window."
    : "Traditional interpretive language describes themes, not guaranteed traits or future events.";
}

function createTimedInsights(result: TimedCalculationResult): InterpretationInsight[] {
  const { chart } = result;
  const moon = planet(chart, "Moon");
  const mercury = planet(chart, "Mercury");
  const mars = planet(chart, "Mars");
  const currentDasha = chart.dashas.find((dasha) => dasha.current);

  const ascendantConfidence = confidenceFor(result, { ascendant: true });
  const moonConfidence = confidenceFor(result, { moon: true });
  const mercuryConfidence = confidenceFor(result, { housePlanet: "Mercury" });
  const marsConfidence = confidenceFor(result, { housePlanet: "Mars" });

  const insights: InterpretationInsight[] = [
    {
      id: "outward-approach",
      category: "Outward approach",
      title: `${chart.ascendantSign} rising`,
      statement: `In this Jyotish profile, ${chart.ascendantSign} rising is traditionally read through themes of ${SIGN_THEMES[chart.ascendantSign]}.`,
      confidence: ascendantConfidence,
      ruleId: "p4.ascendant.sign.v1",
      evidence: [
        {
          id: "ascendant-sign",
          kind: "calculated",
          label: "Ascendant",
          value: `${chart.ascendantSign} ${formatDegrees(chart.ascendantDegree)}`,
          sourcePath: "chart.ascendantSign + chart.ascendantDegree",
        },
        {
          id: "house-profile",
          kind: "calculated",
          label: "House profile",
          value: result.receipt.houseSystem,
          sourcePath: "receipt.houseSystem",
        },
        {
          id: "time-confidence",
          kind: result.receipt.birthTimeConfidence === "exact" ? "calculated" : "limitation",
          label: "Birth-time confidence",
          value: result.receipt.birthTimeConfidence,
          sourcePath: "receipt.birthTimeConfidence",
        },
      ],
      limitation: insightLimitation(ascendantConfidence),
    },
    {
      id: "emotional-rhythm",
      category: "Emotional pattern",
      title: `Moon in ${moon.sign}`,
      statement: `The Moon in ${moon.sign}, within ${chart.moonNakshatra} Pada ${chart.moonPada}, is traditionally used to discuss emotional processing through ${SIGN_THEMES[moon.sign]}.`,
      confidence: moonConfidence,
      ruleId: "p4.moon.sign-nakshatra.v1",
      evidence: [
        positionEvidence(moon)[0],
        {
          id: "moon-nakshatra",
          kind: "calculated",
          label: "Moon Nakshatra",
          value: `${chart.moonNakshatra}, Pada ${chart.moonPada}`,
          sourcePath: "chart.moonNakshatra + chart.moonPada",
        },
      ],
      limitation: insightLimitation(moonConfidence),
    },
    {
      id: "communication-style",
      category: "Communication",
      title: `Mercury in ${mercury.sign}`,
      statement: `Mercury in ${mercury.sign} and whole-sign house ${mercury.house} is traditionally read as a communication and learning style shaped by ${SIGN_THEMES[mercury.sign]}.`,
      confidence: mercuryConfidence,
      ruleId: "p4.mercury.sign-house.v1",
      evidence: positionEvidence(mercury),
      limitation: insightLimitation(mercuryConfidence),
    },
    {
      id: "drive-and-boundaries",
      category: "Drive and boundaries",
      title: `Mars in ${mars.sign}`,
      statement: `Mars in ${mars.sign} and whole-sign house ${mars.house} is traditionally used to examine effort, assertion, and boundaries through ${SIGN_THEMES[mars.sign]}.`,
      confidence: marsConfidence,
      ruleId: "p4.mars.sign-house.v1",
      evidence: positionEvidence(mars),
      limitation: insightLimitation(marsConfidence),
    },
  ];

  if (currentDasha) {
    insights.push({
      id: "current-cycle",
      category: "Current cycle",
      title: `${currentDasha.lord} Mahadasha`,
      statement: `The calculated ${currentDasha.lord} Mahadasha is traditionally used as a broad timing context for ${DASHA_THEMES[currentDasha.lord]}.`,
      confidence: result.receipt.birthTimeConfidence === "approximate" ? "limited" : "supported",
      ruleId: "p4.dasha.current-lord.v1",
      evidence: [
        {
          id: "current-dasha-lord",
          kind: "derived",
          label: "Current Mahadasha",
          value: currentDasha.lord,
          sourcePath: "chart.dashas[current].lord",
        },
        {
          id: "current-dasha-range",
          kind: "calculated",
          label: "Calculated period",
          value: `${formatDate(currentDasha.start)} – ${formatDate(currentDasha.end)}`,
          sourcePath: "chart.dashas[current].start + chart.dashas[current].end",
        },
        {
          id: "dasha-seed",
          kind: "calculated",
          label: "Dasha seed",
          value: `${chart.moonNakshatra}, Pada ${chart.moonPada}`,
          sourcePath: "chart.moonNakshatra + chart.moonPada",
        },
      ],
      limitation:
        result.receipt.birthTimeConfidence === "approximate"
          ? "Exact Dasha boundaries can shift with the declared birth-time uncertainty. This is a traditional timing framework, not an event prediction."
          : "This is a traditional timing framework, not a guarantee that a specific event will occur.",
    });
  }

  return insights;
}

function assertEvidenceContract(report: InterpretationReport) {
  const approvedRules = new Set<string>(INTERPRETATION_PROFILE.approvedRuleIds);
  const insightIds = new Set<string>();
  for (const insight of report.insights) {
    if (insightIds.has(insight.id)) throw new Error(`Duplicate interpretation insight ID: ${insight.id}`);
    insightIds.add(insight.id);
    if (!approvedRules.has(insight.ruleId)) throw new Error(`Unapproved interpretation rule: ${insight.ruleId}`);
    if (insight.evidence.length === 0) throw new Error(`Interpretation ${insight.id} has no chart evidence.`);
    if (insight.evidence.some((item) => !item.sourcePath || !item.value)) {
      throw new Error(`Interpretation ${insight.id} contains incomplete evidence.`);
    }
  }
}

export function buildInterpretationReport(result: CalculationResult): InterpretationReport {
  if (result.kind === "unknown") {
    const report: InterpretationReport = {
      schema: INTERPRETATION_PROFILE.schema,
      profileId: INTERPRETATION_PROFILE.id,
      chartId: result.receipt.chartId,
      generatedBy: "deterministic-rule-engine",
      status: "limited",
      birthTimeConfidence: "unknown",
      disclosure: DISCLOSURE,
      insights: [],
      suppressed: [
        "Ascendant and house-based interpretations",
        "Exact Dasha timing interpretation",
        "Open-ended Ask My Chart answers that require time-dependent factors",
      ],
    };
    assertEvidenceContract(report);
    return report;
  }

  const insights = createTimedInsights(result);
  const report: InterpretationReport = {
    schema: INTERPRETATION_PROFILE.schema,
    profileId: INTERPRETATION_PROFILE.id,
    chartId: result.receipt.chartId,
    generatedBy: "deterministic-rule-engine",
    status: insights.some((insight) => insight.confidence === "limited") ? "limited" : "available",
    birthTimeConfidence: result.receipt.birthTimeConfidence,
    disclosure: DISCLOSURE,
    insights,
    suppressed: [
      "Guaranteed event predictions",
      "Medical, legal, financial, or mental-health conclusions",
      "Interpretations without visible chart evidence",
    ],
  };
  assertEvidenceContract(report);
  return report;
}
