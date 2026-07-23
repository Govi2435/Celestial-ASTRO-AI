import { calculateCelestial, type CalculationRequest } from "../../calculation.ts";
import { buildInterpretationReport } from "../../interpretation.ts";
import { buildPremiumReport, PREMIUM_REPORT_PROFILE } from "../../premium-report.ts";

export const dynamic = "force-dynamic";

function reportFilename(name: string) {
  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${safeName || "private-chart"}-celestial-report.pdf`;
}

export async function GET() {
  return Response.json({
    ...PREMIUM_REPORT_PROFILE,
    calculationPolicy: "The report endpoint recalculates from submitted birth details before rendering.",
    interpretationPolicy: "Only approved P4 evidence-linked rules are included.",
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { calculation?: CalculationRequest };
    if (!payload.calculation) throw new Error("Calculation details are required.");

    const result = await calculateCelestial(payload.calculation);
    const interpretation = buildInterpretationReport(result);
    const pdfBytes = await buildPremiumReport(result, interpretation);
    const name = result.kind === "timed" ? result.chart.input.name : result.input.name;

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportFilename(name)}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "X-Celestial-Report": PREMIUM_REPORT_PROFILE.id,
        "X-Celestial-Receipt": result.receipt.chartId,
      },
    });
  } catch (caught) {
    return Response.json(
      { error: caught instanceof Error ? caught.message : "The premium report could not be generated." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}

