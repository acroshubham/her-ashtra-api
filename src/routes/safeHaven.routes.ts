import { Router } from "express";
import { z } from "zod";
import { fetchNearbyPlaces } from "../utils/overpass.js";
import { rankPlaces, categoryLabel, type ScoredPlace } from "../utils/safetyScore.js";
import { explainRecommendation } from "../utils/safeHavenReasoning.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const safeHavenRouter = Router();

// lat/lng bounds mirror sos.routes.ts locationSchema; radius/limit are clamped.
const findSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().int().min(500).max(10000).optional(),
  limit: z.number().int().min(1).max(30).optional(),
});

function toPublicPlace(p: ScoredPlace) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    categoryLabel: categoryLabel(p.category),
    lat: p.lat,
    lng: p.lng,
    distanceMeters: Math.round(p.distanceMeters),
    score: Number(p.score.toFixed(3)),
    reasons: p.reasons,
    openingHours: p.openingHours,
  };
}

// POST /api/safe-haven — find nearby safe destinations, ranked safest-first,
// with an AI/template explanation for the top pick. Stateless: no persistence.
safeHavenRouter.post("/", requireAuth, async (req, res) => {
  const parsed = findSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }
  const { lat, lng, radius = 1500, limit = 15 } = parsed.data;

  const places = await fetchNearbyPlaces(lat, lng, radius);
  if (places.length === 0) {
    return res.json({
      success: true,
      data: {
        recommendation: null,
        places: [],
        message: "No safe places found nearby. Try a wider search or move toward a main road.",
      },
    });
  }

  const ranked = rankPlaces(places, { userLat: lat, userLng: lng, radiusMeters: radius, now: new Date() });
  const top = ranked[0];
  const reason = await explainRecommendation(top, ranked);

  res.json({
    success: true,
    data: {
      recommendation: { ...toPublicPlace(top), reason },
      places: ranked.slice(0, limit).map(toPublicPlace),
    },
  });
});
