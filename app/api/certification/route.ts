import { CERTIFICATION_PROFILE } from "../../certification-profile.ts";
import {
  AYANAMSA_PROFILE,
  ENGINE_PROFILE,
  HOUSE_PROFILE,
  NODE_PROFILE,
} from "../../engine-profile.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      certificate: CERTIFICATION_PROFILE,
      engine: ENGINE_PROFILE,
      methods: {
        ayanamsa: AYANAMSA_PROFILE,
        houses: HOUSE_PROFILE,
        nodes: NODE_PROFILE,
      },
      evidence: {
        external: "NASA/JPL Horizons DE441 apparent geocentric longitude fixtures",
        regression: "Pinned full-chart outputs for the exact named calculation profile",
        timezone: "Pinned IANA timezone data with standard, DST, quarter-hour, ambiguous, and nonexistent-time cases",
      },
      limitations: [
        "This is an internal reproducibility certificate, not third-party accreditation.",
        "It does not validate astrological interpretations or guarantee future events.",
        "NASA/JPL comparisons cover the pinned planetary positions only.",
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "X-Celestial-Certificate": CERTIFICATION_PROFILE.certificateId,
      },
    },
  );
}
