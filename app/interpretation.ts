import { formatDate, formatDegrees, type PlanetPosition } from "./astro.ts";
import type {
  BirthTimeConfidence,
  CalculationResult,
  TimedCalculationResult,
} from "./calculation.ts";
import {
  APPROVED_RULE_IDS,
  CAREER_RULE_IDS,
  CORE_RULE_IDS,
  houseTopic,
  RELATIONSHIP_RULE_IDS,
  RULE_PACKS,
  traditionalSignLord,
  wholeSignHouseSign,
} from "./interpretation-rule-packs.ts";

export type InterpretationConfidence = "supported" | "limited";
export type InterpretationEvidenceKind = "calculated" | "derived" | "limitation";
export type InterpretationPack = "core" | "career" | "relationship";

export type InterpretationEvidence = {
  id: string;
  kind: InterpretationEvidenceKind;
  label: string;
  value: string;
  sourcePath: string;
};

export type InterpretationInsight = {
  id: string;
  pack: InterpretationPack;
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
  id: "celestial-interpretation-p4-v2",
  schema: "interpretation-evidence-v1",
  status: "Active",
  tradition: "Jyotish",
  knowledgeProfile: "celestial-approved-jyotish-vocabulary-v2",
  approvedRuleIds: APPROVED_RULE_IDS,
  rulePacks: RULE_PACKS,
  ruleCount: APPROVED_RULE_IDS.length,
  packCounts: {
    core: CORE_RULE_IDS.length,
    career: CAREER_RULE_IDS.length,
    relationship: RELATIONSHIP_RULE_IDS.length,
  },
  guardrails: [
    "Every interpretation must cite one or more visible chart factors.",
    "Calculated facts, derived rules, and traditional interpretations remain visibly separated.",
    "Unknown birth time suppresses Ascendant, house, and exact Dasha interpretations.",
    "Approximate birth time marks affected interpretations as limited.",
    "No guaranteed events, fear-based language, or medical, legal, or financial certainty.",
    "Ask My Chart answers may use only approved insights that satisfy this evidence contract.",
    "Relationship themes describe one natal chart; they are not compatibility scores or marriage outcomes.",
    "Career themes do not select a profession, promise employment, or predict income.",
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
  factors: { ascendant?: boolean; moon?: boolean; housePlanet?: string; housePlanets?: string[] },
): InterpretationConfidence {
  if (result.receipt.birthTimeConfidence !== "approximate" || !result.stability) return "supported";
  if (factors.ascendant && !result.stability.ascendantStable) return "limited";
  if (factors.moon && (!result.stability.moonSignStable || !result.stability.nakshatraStable)) return "limited";
  const housePlanets = [
    ...(factors.housePlanet ? [factors.housePlanet] : []),
    ...(factors.housePlanets ?? []),
  ];
  if (housePlanets.some((name) => result.stability?.houseChanges.includes(name))) return "limited";
  return "supported";
}

function insightLimitation(confidence: InterpretationConfidence) {
  return confidence === "limited"
    ? "This interpretation depends on a factor that may change inside the declared birth-time uncertainty window."
    : "Traditional interpretive language describes themes, not guaranteed traits or future events.";
}

function createTimedInsights(result: TimedCalculationResult): InterpretationInsight[] {
  const { chart } = result;
  const sun = planet(chart, "Sun");
  const moon = planet(chart, "Moon");
  const mercury = planet(chart, "Mercury");
  const venus = planet(chart, "Venus");
  const mars = planet(chart, "Mars");
  const jupiter = planet(chart, "Jupiter");
  const saturn = planet(chart, "Saturn");
  const currentDasha = chart.dashas.find((dasha) => dasha.current);
  const seventhSign = wholeSignHouseSign(chart.ascendantSignIndex, 7);
  const seventhLordName = traditionalSignLord(seventhSign);
  const seventhLord = planet(chart, seventhLordName);
  const tenthSign = wholeSignHouseSign(chart.ascendantSignIndex, 10);
  const tenthLordName = traditionalSignLord(tenthSign);
  const tenthLord = planet(chart, tenthLordName);

  const ascendantConfidence = confidenceFor(result, { ascendant: true });
  const moonConfidence = confidenceFor(result, { moon: true });
  const mercuryConfidence = confidenceFor(result, { housePlanet: "Mercury" });
  const marsConfidence = confidenceFor(result, { housePlanet: "Mars" });
  const sunConfidence = confidenceFor(result, { housePlanet: "Sun" });
  const venusConfidence = confidenceFor(result, { housePlanet: "Venus" });
  const jupiterConfidence = confidenceFor(result, { housePlanet: "Jupiter" });
  const saturnConfidence = confidenceFor(result, { housePlanet: "Saturn" });
  const tenthHouseConfidence = confidenceFor(result, { ascendant: true });
  const tenthLordConfidence = confidenceFor(result, {
    ascendant: true,
    housePlanet: tenthLordName,
  });
  const seventhHouseConfidence = confidenceFor(result, { ascendant: true });
  const seventhLordConfidence = confidenceFor(result, {
    ascendant: true,
    housePlanet: seventhLordName,
  });
  const careerDecisionConfidence = confidenceFor(result, {
    housePlanets: ["Mercury", "Mars"],
  });
  const relationshipNeedsConfidence = confidenceFor(result, {
    moon: true,
    housePlanet: "Venus",
  });

  const houseSignEvidence = (
    house: 7 | 10,
    sign: string,
    lord: string,
  ): InterpretationEvidence[] => [
    {
      id: `house-${house}-sign`,
      kind: "derived",
      label: `House ${house} whole-sign sign`,
      value: sign,
      sourcePath: `chart.ascendantSignIndex -> wholeSignHouse(${house})`,
    },
    {
      id: `house-${house}-lord`,
      kind: "derived",
      label: `Traditional lord of ${sign}`,
      value: lord,
      sourcePath: `interpretation.rulePacks.traditionalSignLords.${sign}`,
    },
    {
      id: `house-${house}-profile`,
      kind: "calculated",
      label: "House profile",
      value: result.receipt.houseSystem,
      sourcePath: "receipt.houseSystem",
    },
  ];

  const insights: InterpretationInsight[] = [
    {
      id: "outward-approach",
      pack: "core",
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
      pack: "core",
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
      pack: "core",
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
      pack: "core",
      category: "Drive and boundaries",
      title: `Mars in ${mars.sign}`,
      statement: `Mars in ${mars.sign} and whole-sign house ${mars.house} is traditionally used to examine effort, assertion, and boundaries through ${SIGN_THEMES[mars.sign]}.`,
      confidence: marsConfidence,
      ruleId: "p4.mars.sign-house.v1",
      evidence: positionEvidence(mars),
      limitation: insightLimitation(marsConfidence),
    },
    {
      id: "career-public-field",
      pack: "career",
      category: "Career • public work",
      title: `${tenthSign} on the 10th house`,
      statement: `The 10th whole-sign house in ${tenthSign} is traditionally used to frame public work and responsibility through themes of ${SIGN_THEMES[tenthSign]}.`,
      confidence: tenthHouseConfidence,
      ruleId: "p4.career.tenth-house-sign.v1",
      evidence: houseSignEvidence(10, tenthSign, tenthLordName),
      limitation: insightLimitation(tenthHouseConfidence),
    },
    {
      id: "career-lord",
      pack: "career",
      category: "Career • house lord",
      title: `${tenthLordName} rules the 10th`,
      statement: `The traditional 10th-house lord ${tenthLordName}, calculated in ${tenthLord.sign} and whole-sign house ${tenthLord.house}, is traditionally used to connect public-work topics with ${houseTopic(tenthLord.house)}.`,
      confidence: tenthLordConfidence,
      ruleId: "p4.career.tenth-lord-position.v1",
      evidence: [
        ...houseSignEvidence(10, tenthSign, tenthLordName),
        ...positionEvidence(tenthLord),
      ],
      limitation: insightLimitation(tenthLordConfidence),
    },
    {
      id: "career-visibility",
      pack: "career",
      category: "Career • visibility",
      title: `Sun in ${sun.sign}`,
      statement: `The Sun in ${sun.sign} and whole-sign house ${sun.house} is traditionally used to reflect on visibility and responsibility through ${SIGN_THEMES[sun.sign]} within ${houseTopic(sun.house)}.`,
      confidence: sunConfidence,
      ruleId: "p4.career.sun-position.v1",
      evidence: positionEvidence(sun),
      limitation: insightLimitation(sunConfidence),
    },
    {
      id: "career-structure",
      pack: "career",
      category: "Career • structure",
      title: `Saturn in ${saturn.sign}`,
      statement: `Saturn in ${saturn.sign} and whole-sign house ${saturn.house} is traditionally used to examine patience, duty, and durable effort within ${houseTopic(saturn.house)}.`,
      confidence: saturnConfidence,
      ruleId: "p4.career.saturn-position.v1",
      evidence: positionEvidence(saturn),
      limitation: insightLimitation(saturnConfidence),
    },
    {
      id: "career-growth",
      pack: "career",
      category: "Career • growth",
      title: `Jupiter in ${jupiter.sign}`,
      statement: `Jupiter in ${jupiter.sign} and whole-sign house ${jupiter.house} is traditionally used to discuss learning, counsel, and growth through ${SIGN_THEMES[jupiter.sign]} within ${houseTopic(jupiter.house)}.`,
      confidence: jupiterConfidence,
      ruleId: "p4.career.jupiter-position.v1",
      evidence: positionEvidence(jupiter),
      limitation: insightLimitation(jupiterConfidence),
    },
    {
      id: "career-decision-factors",
      pack: "career",
      category: "Career • decisions",
      title: "Mercury and Mars decision factors",
      statement: `Mercury in ${mercury.sign} and Mars in ${mars.sign} are traditionally considered together here only to compare information processing with action and effort; they do not identify a correct profession or outcome.`,
      confidence: careerDecisionConfidence,
      ruleId: "p4.career.decision-factors.v1",
      evidence: [
        ...positionEvidence(mercury),
        ...positionEvidence(mars),
      ],
      limitation: insightLimitation(careerDecisionConfidence),
    },
    {
      id: "relationship-field",
      pack: "relationship",
      category: "Relationship • field",
      title: `${seventhSign} on the 7th house`,
      statement: `The 7th whole-sign house in ${seventhSign} is traditionally used to frame one-to-one partnership and negotiated responsibility through themes of ${SIGN_THEMES[seventhSign]}.`,
      confidence: seventhHouseConfidence,
      ruleId: "p4.relationship.seventh-house-sign.v1",
      evidence: houseSignEvidence(7, seventhSign, seventhLordName),
      limitation: insightLimitation(seventhHouseConfidence),
    },
    {
      id: "relationship-lord",
      pack: "relationship",
      category: "Relationship • house lord",
      title: `${seventhLordName} rules the 7th`,
      statement: `The traditional 7th-house lord ${seventhLordName}, calculated in ${seventhLord.sign} and whole-sign house ${seventhLord.house}, is traditionally used to connect partnership topics with ${houseTopic(seventhLord.house)}.`,
      confidence: seventhLordConfidence,
      ruleId: "p4.relationship.seventh-lord-position.v1",
      evidence: [
        ...houseSignEvidence(7, seventhSign, seventhLordName),
        ...positionEvidence(seventhLord),
      ],
      limitation: insightLimitation(seventhLordConfidence),
    },
    {
      id: "relationship-values",
      pack: "relationship",
      category: "Relationship • values",
      title: `Venus in ${venus.sign}`,
      statement: `Venus in ${venus.sign} and whole-sign house ${venus.house} is traditionally used to reflect on relational values, reciprocity, and preferences through ${SIGN_THEMES[venus.sign]} within ${houseTopic(venus.house)}.`,
      confidence: venusConfidence,
      ruleId: "p4.relationship.venus-position.v1",
      evidence: positionEvidence(venus),
      limitation: insightLimitation(venusConfidence),
    },
    {
      id: "relationship-needs",
      pack: "relationship",
      category: "Relationship • needs",
      title: "Moon and Venus needs",
      statement: `The Moon in ${moon.sign} and Venus in ${venus.sign} are traditionally compared here to reflect on emotional processing and relational preferences; this is not a compatibility score or marriage outcome.`,
      confidence: relationshipNeedsConfidence,
      ruleId: "p4.relationship.moon-venus-needs.v1",
      evidence: [
        positionEvidence(moon)[0],
        {
          id: "relationship-moon-nakshatra",
          kind: "calculated",
          label: "Moon Nakshatra",
          value: `${chart.moonNakshatra}, Pada ${chart.moonPada}`,
          sourcePath: "chart.moonNakshatra + chart.moonPada",
        },
        ...positionEvidence(venus),
      ],
      limitation:
        relationshipNeedsConfidence === "limited"
          ? insightLimitation(relationshipNeedsConfidence)
          : "This compares themes inside one natal chart. It does not evaluate another person or predict a relationship outcome.",
    },
  ];

  if (currentDasha) {
    insights.push({
      id: "current-cycle",
      pack: "core",
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
        "Career and relationship Ask My Chart answers that require time-dependent factors",
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
      "Compatibility percentages and guaranteed relationship outcomes",
      "Guaranteed profession, employment, salary, or career outcomes",
      "Interpretations without visible chart evidence",
    ],
  };
  assertEvidenceContract(report);
  return report;
}
