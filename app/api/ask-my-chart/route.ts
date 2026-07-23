import {
  answerChartQuestion,
  ASK_MY_CHART_PROFILE,
} from "../../ask-my-chart.ts";
import {
  calculateCelestial,
  type CalculationRequest,
} from "../../calculation.ts";
import { buildInterpretationReport } from "../../interpretation.ts";

export const dynamic = "force-dynamic";

type AskMyChartRequest = {
  question?: unknown;
  calculation?: CalculationRequest;
};

export async function GET() {
  return Response.json(ASK_MY_CHART_PROFILE, {
    headers: {
      "Cache-Control": "no-store",
      "X-Celestial-Ask-Profile": ASK_MY_CHART_PROFILE.id,
    },
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AskMyChartRequest;
    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    if (!question) throw new Error("Enter a chart question.");
    if (question.length > 400) throw new Error("Keep the chart question under 400 characters.");
    if (!payload.calculation) throw new Error("Calculate a chart before asking a question.");

    // Recalculate from verified birth inputs rather than trusting client-supplied
    // placements or interpretations.
    const result = await calculateCelestial(payload.calculation);
    const report = buildInterpretationReport(result);
    const answer = answerChartQuestion(report, question);

    return Response.json(answer, {
      headers: {
        "Cache-Control": "no-store",
        "X-Celestial-Ask-Profile": ASK_MY_CHART_PROFILE.id,
        "X-Celestial-Chart": answer.chartId,
      },
    });
  } catch (caught) {
    return Response.json(
      { error: caught instanceof Error ? caught.message : "The chart question could not be answered." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}

