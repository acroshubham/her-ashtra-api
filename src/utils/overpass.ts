// Nearby places via the OpenStreetMap Overpass API (https://overpass-api.de).
// Free, no API key, no billing — consistent with the key-free Leaflet map used
// on the public tracking page. Like email.ts, this never throws to the caller:
// a lookup failure returns [] and logs, so the Safe Haven feature degrades
// gracefully instead of 500ing.

// Public Overpass mirrors, tried in order until one responds. The main
// overpass-api.de instance is the most widely reachable, so it's tried first;
// the others are fallbacks (some networks can't reach them). Override or prepend
// your own with the OVERPASS_URL env var.
const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
].filter((u): u is string => Boolean(u));

const REQUEST_TIMEOUT_MS = 12000; // fail fast so a healthy mirror is reached quickly
const MAX_PASSES = 2; // retry the mirror list once — 504s are usually transient

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Friendly categories the rest of the feature reasons about. The safety scorer
// and the app UI both key off these, not raw OSM tags.
export type PlaceCategory =
  | "police"
  | "hospital"
  | "fire_station"
  | "petrol_pump"
  | "metro"
  | "hotel"
  | "mall"
  | "pharmacy"
  | "government";

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  openingHours: string | null; // raw OSM `opening_hours` tag, if present
}

type OverpassTags = Record<string, string | undefined>;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
}

// Overpass QL: union of the amenity/type set within `radius` of the point.
// `nwr` matches node+way+relation in one statement (fewer clauses → lighter
// query → faster, fewer 504s). `[out:json]` returns JSON; `out center` gives
// ways/relations a single representative point.
function buildQuery(lat: number, lng: number, radius: number): string {
  const around = `(around:${radius},${lat},${lng})`;
  const clauses = [
    `nwr["amenity"="police"]${around};`,
    `nwr["amenity"="hospital"]${around};`,
    `nwr["amenity"="fire_station"]${around};`,
    `nwr["amenity"="fuel"]${around};`,
    `nwr["amenity"="pharmacy"]${around};`,
    `nwr["amenity"="townhall"]${around};`,
    `nwr["office"="government"]${around};`,
    `nwr["railway"="station"]${around};`,
    `nwr["station"="subway"]${around};`,
    `nwr["tourism"="hotel"]${around};`,
    `nwr["shop"="mall"]${around};`,
  ];
  // Low server-side [timeout] + capped output keeps the query cheap enough to
  // return before the public gateway's ~10s limit fires a 504.
  return `[out:json][timeout:10];(${clauses.join("")});out center 40;`;
}

// Map raw OSM tags → our category enum. Order matters: the most specific /
// safest classification wins. Returns null for anything we don't surface.
function categorize(tags: OverpassTags): PlaceCategory | null {
  const amenity = tags.amenity;
  if (amenity === "police") return "police";
  if (amenity === "hospital") return "hospital";
  if (amenity === "fire_station") return "fire_station";
  if (amenity === "fuel") return "petrol_pump";
  if (amenity === "pharmacy") return "pharmacy";
  if (amenity === "townhall" || tags.office === "government") return "government";
  if (tags.railway === "station" || tags.station === "subway") return "metro";
  if (tags.tourism === "hotel") return "hotel";
  if (tags.shop === "mall") return "mall";
  return null;
}

const CATEGORY_FALLBACK_NAME: Record<PlaceCategory, string> = {
  police: "Police station",
  hospital: "Hospital",
  fire_station: "Fire station",
  petrol_pump: "Petrol pump",
  metro: "Metro / railway station",
  hotel: "Hotel",
  mall: "Shopping mall",
  pharmacy: "Pharmacy",
  government: "Government building",
};

function normalize(el: OverpassElement): Place | null {
  const tags = el.tags ?? {};
  const category = categorize(tags);
  if (!category) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  return {
    id: `${el.type}/${el.id}`,
    name: tags.name?.trim() || CATEGORY_FALLBACK_NAME[category],
    category,
    lat,
    lng,
    openingHours: tags.opening_hours?.trim() || null,
  };
}

/**
 * Fetch nearby safe-haven candidates around a coordinate. Never throws — on any
 * network/parse failure it logs and returns an empty array so the caller can
 * respond gracefully.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radiusMeters = 1500,
): Promise<Place[]> {
  const body = `data=${encodeURIComponent(buildQuery(lat, lng, radiusMeters))}`;

  // Try each mirror in turn (429/504/timeout falls through to the next), and
  // retry the whole list once — public Overpass 504s are usually transient.
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Some mirrors reject requests without these (406 Not Acceptable).
            Accept: "application/json",
            "User-Agent": "HerAshtra-SafeHaven/1.0 (women's safety app)",
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!res.ok) {
          console.warn(`[overpass] ${endpoint} → ${res.status} ${res.statusText}, trying next mirror`);
          continue;
        }

        const json = (await res.json()) as { elements?: OverpassElement[] };
        const elements = json.elements ?? [];

        // Deduplicate by id (a place can match more than one clause).
        const byId = new Map<string, Place>();
        for (const el of elements) {
          const place = normalize(el);
          if (place && !byId.has(place.id)) byId.set(place.id, place);
        }
        return [...byId.values()];
      } catch (err) {
        console.warn(`[overpass] ${endpoint} error: ${(err as Error).message}, trying next mirror`);
      }
    }
    if (pass < MAX_PASSES) await sleep(1500); // brief backoff before the retry pass
  }

  console.error("[overpass] all mirrors failed — returning no places");
  return [];
}
