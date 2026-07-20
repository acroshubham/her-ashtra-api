import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../schema/auth.schema.js";
import { locationUpdates, sosEvents } from "../schema/sos.schema.js";
import { trackPageHtml } from "../trackPage.js";

// PUBLIC, unauthenticated, token-scoped. The 256-bit trackToken is the only
// credential. When an event is not active we withhold live coordinates so the
// link effectively dies once the user is safe.

// Mounted at /api/track — JSON consumed by the tracking page's poller.
export const trackApiRouter = Router();

trackApiRouter.get("/:token", async (req, res) => {
  const [event] = await db
    .select()
    .from(sosEvents)
    .where(eq(sosEvents.trackToken, req.params.token))
    .limit(1);

  if (!event) return res.status(404).json({ success: false, error: "Unknown tracking link" });

  const [user] = await db
    .select({ fullName: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.id, event.userId))
    .limit(1);

  const userName =
    user?.fullName?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "Someone";

  const initialLocation =
    event.initialLat != null && event.initialLng != null
      ? { lat: event.initialLat, lng: event.initialLng }
      : null;

  // Only expose live coordinates while the event is active.
  let latest: { lat: number; lng: number; accuracy: number | null; at: Date } | null = null;
  if (event.status === "active") {
    const [point] = await db
      .select()
      .from(locationUpdates)
      .where(eq(locationUpdates.sosEventId, event.id))
      .orderBy(desc(locationUpdates.createdAt))
      .limit(1);
    if (point) {
      latest = { lat: point.lat, lng: point.lng, accuracy: point.accuracy, at: point.createdAt };
    }
  }

  res.json({
    success: true,
    data: {
      status: event.status,
      userName,
      initialLocation: event.status === "active" ? initialLocation : null,
      latest,
      createdAt: event.createdAt,
      resolvedAt: event.resolvedAt,
    },
  });
});

// Mounted at /track — the human-facing HTML page contacts open from the SMS.
export const trackPageRouter = Router();

trackPageRouter.get("/:token", (req, res) => {
  res.type("html").send(trackPageHtml(req.params.token));
});
