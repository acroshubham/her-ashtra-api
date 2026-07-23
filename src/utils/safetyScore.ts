// The ranking "brain" for Safe Haven. Deterministic weighted scoring — no ML,
// no external call. Every input (distance, place type, open/closed, time of day)
// is computable, so the safest destination is chosen transparently and for free.
//
// NOT modeled (unavailable from OpenStreetMap): live crime reports and real-time
// traffic. Those would need paid/region-specific data feeds and are left as
// future work rather than faked.

import type { Place, PlaceCategory } from "./overpass.js";

export interface ScoreContext {
  userLat: number;
  userLng: number;
  radiusMeters: number;
  now: Date;
}

export interface ScoredFactors {
  distance: number; // 0..1 (closer = higher)
  placeType: number; // 0..1 (inherent safety of the category)
  open: number; // 0..1 (likely open / staffed right now)
  lighting: number; // 0..1 (well-lit at this time of day)
  crowd: number; // 0..1 (likely people around at this time of day)
}

export interface ScoredPlace extends Place {
  distanceMeters: number;
  score: number; // 0..1 overall
  factors: ScoredFactors;
  reasons: string[]; // short human-readable factor highlights
}

// Weights sum to 1. Distance and place-type dominate; the time-of-day proxies
// (open/lighting/crowd) break ties and shift the ranking at night.
const WEIGHTS = {
  distance: 0.35,
  placeType: 0.3,
  open: 0.15,
  lighting: 0.1,
  crowd: 0.1,
} as const;

// Inherent safety of each category: 24/7 staffed emergency services rank
// highest; lit/staffed public places next; places that often close at night
// lowest.
const CATEGORY_WEIGHT: Record<PlaceCategory, number> = {
  police: 1.0,
  hospital: 1.0,
  fire_station: 0.9,
  petrol_pump: 0.8,
  metro: 0.75,
  hotel: 0.7,
  pharmacy: 0.6,
  mall: 0.55,
  government: 0.45,
};

// Categories that are realistically open/staffed around the clock.
const ALWAYS_OPEN: ReadonlySet<PlaceCategory> = new Set([
  "police",
  "hospital",
  "fire_station",
  "petrol_pump",
]);

// Categories that are typically well-lit and active late at night.
const WELL_LIT_AT_NIGHT: ReadonlySet<PlaceCategory> = new Set([
  "police",
  "hospital",
  "fire_station",
  "petrol_pump",
  "metro",
  "hotel",
]);

const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  police: "police station",
  hospital: "hospital",
  fire_station: "fire station",
  petrol_pump: "petrol pump",
  metro: "metro station",
  hotel: "hotel",
  mall: "shopping mall",
  pharmacy: "pharmacy",
  government: "government building",
};

export function categoryLabel(category: PlaceCategory): string {
  return CATEGORY_LABEL[category];
}

// Haversine distance in metres.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Rough "is it night" heuristic from local hour. We only have UTC on the server,
// so this is approximate; good enough to bias toward 24/7 lit places after dark.
function isNight(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 20 || hour < 6;
}

// Very light opening_hours read: only the unambiguous "24/7" case is trusted.
// Anything else falls back to the category assumption (parsing the full OSM
// opening_hours grammar is out of scope).
function isOpenNow(place: Place): boolean {
  if (place.openingHours && /24\s*\/\s*7/.test(place.openingHours)) return true;
  return ALWAYS_OPEN.has(place.category);
}

function scorePlace(place: Place, ctx: ScoreContext): ScoredPlace {
  const distanceMeters = haversineMeters(ctx.userLat, ctx.userLng, place.lat, place.lng);
  const night = isNight(ctx.now);
  const open = isOpenNow(place);

  const factors: ScoredFactors = {
    // Linear falloff over the search radius, clamped to [0,1].
    distance: Math.max(0, 1 - distanceMeters / ctx.radiusMeters),
    placeType: CATEGORY_WEIGHT[place.category],
    open: open ? 1 : night ? 0.2 : 0.6,
    lighting: WELL_LIT_AT_NIGHT.has(place.category) ? 1 : night ? 0.3 : 0.8,
    crowd: night
      ? WELL_LIT_AT_NIGHT.has(place.category)
        ? 0.7
        : 0.3
      : 0.8,
  };

  const score =
    factors.distance * WEIGHTS.distance +
    factors.placeType * WEIGHTS.placeType +
    factors.open * WEIGHTS.open +
    factors.lighting * WEIGHTS.lighting +
    factors.crowd * WEIGHTS.crowd;

  const reasons: string[] = [];
  reasons.push(`${Math.round(distanceMeters)} m away`);
  if (open) reasons.push("open now");
  if (ALWAYS_OPEN.has(place.category)) reasons.push("staffed 24/7");
  if (night && WELL_LIT_AT_NIGHT.has(place.category)) reasons.push("well-lit at night");

  return { ...place, distanceMeters, score, factors, reasons };
}

/**
 * Score and rank candidates, safest first. `[0]` is the recommended destination.
 */
export function rankPlaces(places: Place[], ctx: ScoreContext): ScoredPlace[] {
  return places.map((p) => scorePlace(p, ctx)).sort((a, b) => b.score - a.score);
}
