import type {
  InterpretationInsight,
  InterpretationReport,
} from "./interpretation.ts";

export type AskMyChartStatus = "answered" | "limited" | "not-supported" | "refused";
export type AskMyChartIntent =
  | "overview"
  | "identity"
  | "emotions"
  | "communication"
  | "drive"
  | "current-cycle"
  | "career-decisions"
  | "relationship"
  | "compatibility"
  | "prediction"
  | "high-stakes"
  | "override-attempt"
  | "unknown";

export type AskMyChartAnswer = {
  schema: typeof ASK_MY_CHART_PROFILE.schema;
  profileId: typeof ASK_MY_CHART_PROFILE.id;
  answerId: string;
  chartId: string;
  question: string;
  intent: AskMyChartIntent;
  status: AskMyChartStatus;
  title: string;
  answer: string;
  disclosure: string;
  generatedBy: "deterministic-evidence-router";
  evidence: InterpretationInsight[];
  grounding: {
    ruleIds: string[];
    sourcePaths: string[];
    evidenceCount: number;
  };
  limitations: string[];
  suggestedQuestions: string[];
};

export const ASK_MY_CHART_PROFILE = {
  id: "celestial-ask-my-chart-p4-v2",
  schema: "ask-my-chart-answer-v1",
  status: "Active",
  responseEngine: "deterministic-evidence-router",
  generativeModel: "none",
  supportedIntents: [
    "overview",
    "identity",
    "emotions",
    "communication",
    "drive",
    "current-cycle",
    "career-decisions",
    "relationship",
  ],
  guardrails: [
    "Answers can use only insights that passed the P4 interpretation evidence contract.",
    "Every supported answer exposes its rule IDs, source paths, and linked calculation receipt.",
    "Unknown or unstable birth-time factors remain limited or suppressed.",
    "Relationship answers use only the approved natal relationship pack.",
    "Compatibility matching, percentages, and relationship outcomes are not approximated.",
    "Prediction requests and medical, legal, financial, or mental-health conclusions are refused.",
    "Instruction override attempts cannot disable the evidence contract.",
    "No question, birth data, or answer is stored by this feature.",
  ],
} as const;

const SUGGESTED_QUESTIONS = [
  "Give me an evidence-based chart overview.",
  "How does this chart describe communication?",
  "What themes shape career decisions?",
  "What relationship themes are supported?",
  "What does the current cycle emphasize?",
];

const HIGH_STAKES_PATTERN =
  /\b(medical|medicine|diagnos(?:e|is)|disease|pregnan(?:t|cy)|mental health|suicid(?:e|al)|legal|lawsuit|court|crime|financial advice|investment|stock|crypto|loan|debt|salary guarantee|tax)\b/i;
const PREDICTION_PATTERN =
  /\b(will i|when will|predict|prediction|guarantee|guaranteed|certain future|exact future|destin(?:y|ed)|surely happen|winning number)\b/i;
const OVERRIDE_PATTERN =
  /\b(ignore|bypass|override|disable|forget)\b.{0,45}\b(evidence|guardrail|rule|instruction|limitation|system|receipt)\b/i;

function normalizedQuestion(question: string) {
  return question.trim().replace(/\s+/g, " ").slice(0, 400);
}

function selectInsights(report: InterpretationReport, ids: string[]) {
  const wanted = new Set(ids);
  return report.insights.filter((insight) => wanted.has(insight.id));
}

function groundingFor(insights: InterpretationInsight[]) {
  const ruleIds = [...new Set(insights.map((insight) => insight.ruleId))];
  const sourcePaths = [
    ...new Set(insights.flatMap((insight) => insight.evidence.map((item) => item.sourcePath))),
  ];
  return {
    ruleIds,
    sourcePaths,
    evidenceCount: insights.reduce((total, insight) => total + insight.evidence.length, 0),
  };
}

function response(
  report: InterpretationReport,
  question: string,
  intent: AskMyChartIntent,
  status: AskMyChartStatus,
  title: string,
  answer: string,
  evidence: InterpretationInsight[] = [],
  limitations: string[] = [],
): AskMyChartAnswer {
  const grounding = groundingFor(evidence);
  return {
    schema: ASK_MY_CHART_PROFILE.schema,
    profileId: ASK_MY_CHART_PROFILE.id,
    answerId: `${report.chartId}:${intent}:${grounding.ruleIds.join("+") || status}`,
    chartId: report.chartId,
    question,
    intent,
    status,
    title,
    answer,
    disclosure:
      "This answer is a traditional Jyotish interpretation assembled from the visible chart evidence below. It is not scientific, predictive, or professional advice.",
    generatedBy: "deterministic-evidence-router",
    evidence,
    grounding,
    limitations,
    suggestedQuestions: SUGGESTED_QUESTIONS,
  };
}

function groundedResponse(
  report: InterpretationReport,
  question: string,
  intent: AskMyChartIntent,
  title: string,
  insightIds: string[],
  introduction: string,
  closing: string,
) {
  const evidence = selectInsights(report, insightIds);
  if (evidence.length === 0) {
    return response(
      report,
      question,
      intent,
      "limited",
      "Birth-time evidence is unavailable",
      "I cannot answer this from the current chart because the approved factors depend on a known birth time. No Ascendant, house, or exact Dasha factor has been invented.",
      [],
      [
        "Add a recorded or approximate birth time to enable time-dependent interpretation.",
        "Approximate time will still show confidence warnings for unstable factors.",
      ],
    );
  }

  const limitedInsights = evidence.filter((insight) => insight.confidence === "limited");
  const status: AskMyChartStatus = limitedInsights.length > 0 ? "limited" : "answered";
  const statements = evidence.map((insight) => insight.statement).join(" ");
  const limitations = [
    ...new Set([
      ...evidence.map((insight) => insight.limitation),
      closing,
    ]),
  ];
  return response(
    report,
    question,
    intent,
    status,
    title,
    `${introduction} ${statements} ${closing}`,
    evidence,
    limitations,
  );
}

function detectIntent(question: string): AskMyChartIntent {
  if (OVERRIDE_PATTERN.test(question)) return "override-attempt";
  if (HIGH_STAKES_PATTERN.test(question)) return "high-stakes";
  if (PREDICTION_PATTERN.test(question)) return "prediction";
  if (/\b(compatib\w*|match score|matching score|percentage|guna|ashtakoota|dashakoota)\b/i.test(question)) {
    return "compatibility";
  }
  if (/\b(career|work|job|profession|decision)\b/i.test(question)) return "career-decisions";
  if (/\b(relationships?|marriage|partner|love life|spouse|relating)\b/i.test(question)) return "relationship";
  if (/\b(current|cycle|dasha|period|phase)\b/i.test(question)) return "current-cycle";
  if (/\b(communicat|speaking|learning|thinking|mercury)\b/i.test(question)) return "communication";
  if (/\b(emotion|feeling|mood|inner|moon|need)\b/i.test(question)) return "emotions";
  if (/\b(drive|effort|assert|boundary|anger|mars|motivat)\b/i.test(question)) return "drive";
  if (/\b(identity|personality|approach|ascendant|rising|who am i|nature)\b/i.test(question)) return "identity";
  if (/\b(overview|summary|chart|understand|tell me about)\b/i.test(question)) return "overview";
  return "unknown";
}

export function answerChartQuestion(
  report: InterpretationReport,
  rawQuestion: string,
): AskMyChartAnswer {
  const question = normalizedQuestion(rawQuestion);
  if (!question) {
    return response(
      report,
      question,
      "unknown",
      "not-supported",
      "Ask a chart question",
      "Enter a question about the supported chart themes. I will answer only when approved evidence is available.",
    );
  }

  const intent = detectIntent(question);
  if (intent === "override-attempt") {
    return response(
      report,
      question,
      intent,
      "refused",
      "The evidence contract stays active",
      "I cannot ignore, bypass, or disable the chart-evidence rules. Rephrase the question as a supported reflection and I will show every factor used.",
      [],
      ["The P4 grounding contract cannot be changed by a question."],
    );
  }
  if (intent === "high-stakes") {
    return response(
      report,
      question,
      intent,
      "refused",
      "Professional guidance is required",
      "I cannot use astrology to make medical, legal, financial, or mental-health conclusions. Please use a qualified professional and reliable real-world information for this decision.",
      [],
      ["No chart factor is presented as evidence for a high-stakes conclusion."],
    );
  }
  if (intent === "prediction") {
    return response(
      report,
      question,
      intent,
      "refused",
      "Guaranteed prediction is outside scope",
      "I cannot predict a certain event, date, or outcome. I can describe approved traditional themes and their chart evidence without claiming what must happen.",
      [],
      ["Traditional timing context is not an event prediction."],
    );
  }
  if (intent === "compatibility") {
    return response(
      report,
      question,
      intent,
      "not-supported",
      "Compatibility requires a separate verified module",
      "The current relationship pack interprets one calculated natal chart only. It does not compare two people, calculate Ashtakoota or Dashakoota, or produce a compatibility percentage.",
      [],
      ["A future compatibility module must define two-chart inputs, calculation rules, weighting, limitations, and reference tests first."],
    );
  }
  if (intent === "relationship") {
    return groundedResponse(
      report,
      question,
      intent,
      "Relationship themes — one-chart evidence",
      ["relationship-field", "relationship-lord", "relationship-values", "relationship-needs"],
      "The approved relationship pack can reflect on partnership context, its traditional house lord, relational values, and emotional needs inside this natal chart.",
      "This is not a compatibility score, a judgment about a partner, or a prediction of marriage or relationship outcomes.",
    );
  }
  if (intent === "career-decisions") {
    return groundedResponse(
      report,
      question,
      intent,
      "Career decisions — evidence-limited reflection",
      ["career-public-field", "career-lord", "career-structure", "career-growth", "career-decision-factors", "current-cycle"],
      "The approved career pack can reflect on public-work context, its traditional house lord, structure, learning, decision factors, and current timing context; it cannot choose a career or promise an outcome.",
      "Use these themes as prompts for reflection, then base career decisions on skills, opportunities, constraints, and real-world advice.",
    );
  }
  if (intent === "current-cycle") {
    return groundedResponse(
      report,
      question,
      intent,
      "Current cycle",
      ["current-cycle"],
      "The current approved timing evidence says:",
      "This describes a broad traditional emphasis, not a guaranteed event or deadline.",
    );
  }
  if (intent === "communication") {
    return groundedResponse(
      report,
      question,
      intent,
      "Communication and learning",
      ["communication-style"],
      "The approved communication rule says:",
      "Treat this as a reflective theme rather than a fixed personality fact.",
    );
  }
  if (intent === "emotions") {
    return groundedResponse(
      report,
      question,
      intent,
      "Emotional pattern",
      ["emotional-rhythm"],
      "The approved Moon rule says:",
      "This is a traditional lens on emotional processing, not a mental-health assessment.",
    );
  }
  if (intent === "drive") {
    return groundedResponse(
      report,
      question,
      intent,
      "Drive and boundaries",
      ["drive-and-boundaries"],
      "The approved Mars rule says:",
      "This is a traditional reflection on effort and assertion, not a fixed behavioral diagnosis.",
    );
  }
  if (intent === "identity") {
    return groundedResponse(
      report,
      question,
      intent,
      "Identity and outward approach",
      ["outward-approach", "emotional-rhythm"],
      "The current evidence supports two different lenses: outward approach and emotional processing.",
      "These themes are interpretive prompts, not guaranteed or complete descriptions of a person.",
    );
  }
  if (intent === "overview") {
    return groundedResponse(
      report,
      question,
      intent,
      "Evidence-based chart overview",
      [
        "outward-approach",
        "emotional-rhythm",
        "communication-style",
        "career-public-field",
        "career-lord",
        "relationship-field",
        "relationship-values",
        "current-cycle",
      ],
      "Here is a concise cross-section of the approved core, career, relationship, and current-cycle evidence available for this chart.",
      "This overview intentionally excludes compatibility, health, wealth, and event claims that lack approved rules.",
    );
  }

  return response(
    report,
    question,
    intent,
    "not-supported",
    "This question is outside the approved profile",
    "I could not map this question to a tested P4 interpretation rule. Try one of the supported questions below; no generic answer has been generated.",
    [],
    ["Only approved overview, identity, emotional, communication, drive, current-cycle, career-reflection, and one-chart relationship intents are active."],
  );
}
