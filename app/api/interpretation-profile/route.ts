import { INTERPRETATION_PROFILE } from "../../interpretation.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(INTERPRETATION_PROFILE, {
    headers: {
      "Cache-Control": "no-store",
      "X-Celestial-Interpretation-Profile": INTERPRETATION_PROFILE.id,
    },
  });
}
