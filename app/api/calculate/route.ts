import { calculateCelestial, type CalculationRequest } from "../../calculation.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CalculationRequest;
    const result = await calculateCelestial(input);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Celestial-Engine": "celestial-mit-v1",
      },
    });
  } catch (caught) {
    return Response.json(
      { error: caught instanceof Error ? caught.message : "The calculation could not be completed." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}
