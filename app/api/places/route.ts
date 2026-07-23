import timezoneLookup from "@photostructure/tz-lookup";

export const dynamic = "force-dynamic";

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length < 3 || query.length > 120) {
    return Response.json({ error: "Enter at least three characters for the birthplace." }, { status: 400 });
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("limit", "5");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Accept-Language": request.headers.get("accept-language") ?? "en",
        "User-Agent": "Celestial-ASTRO-AI/0.2",
      },
    });
    if (!response.ok) throw new Error(`Place provider returned ${response.status}.`);
    const places = (await response.json()) as NominatimPlace[];
    const results = places.map((place) => {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      return {
        id: String(place.place_id),
        displayName: place.display_name,
        latitude,
        longitude,
        timezoneId: timezoneLookup(latitude, longitude),
        type: place.type ?? "place",
        provider: "OpenStreetMap Nominatim",
      };
    });
    return Response.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "X-Place-Provider": "OpenStreetMap Nominatim",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Place search is temporarily unavailable. Use the verified manual location fields." },
      { status: 502 },
    );
  }
}
