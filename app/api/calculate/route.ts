import { calculateProfessional, type CalculationRequest } from "../../professional";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CalculationRequest;
    const result = await calculateProfessional(input);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Celestial-Engine": "astronomy-engine-provisional",
      },
    });
  } catch (caught) {
    return Response.json(
      { error: caught instanceof Error ? caught.message : "The calculation could not be completed." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}
