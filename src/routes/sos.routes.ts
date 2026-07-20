import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../schema/auth.schema.js";
import { contacts, locationUpdates, sosEvents } from "../schema/sos.schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { notifyContacts } from "../utils/email.js";

export const sosRouter = Router();

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;

const createSchema = z.object({
  initialLat: z.number().min(-90).max(90).optional(),
  initialLng: z.number().min(-180).max(180).optional(),
  mediaUrl: z.string().url().optional(),
});

const patchSchema = z.object({
  mediaUrl: z.string().url(),
});

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

function trackUrlFor(token: string) {
  return `${PUBLIC_BASE_URL}/track/${token}`;
}

function firstName(fullName: string | null, email: string) {
  if (fullName && fullName.trim()) return fullName.trim().split(/\s+/)[0];
  return email.split("@")[0];
}

// POST /api/sos — create the event, then fire SMS to contacts (best-effort,
// never blocks or fails the response). Returns immediately so the alert is fast.
sosRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }
  const { initialLat, initialLng, mediaUrl } = parsed.data;

  const trackToken = randomBytes(32).toString("hex");
  const [event] = await db
    .insert(sosEvents)
    .values({ userId: req.user!.id, trackToken, initialLat, initialLng, mediaUrl })
    .returning();

  // Respond first, notify after — the client shouldn't wait on the email send.
  res.status(201).json({
    success: true,
    data: {
      id: event.id,
      trackToken: event.trackToken,
      trackUrl: trackUrlFor(event.trackToken),
      status: event.status,
      createdAt: event.createdAt,
    },
  });

  // Fire-and-forget notification pipeline. Any failure is logged inside.
  void (async () => {
    try {
      const [user] = await db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);
      const allRows = await db.select().from(contacts).where(eq(contacts.userId, req.user!.id));
      const rows = allRows.filter((r): r is typeof r & { email: string } => Boolean(r.email));
      if (rows.length === 0) {
        console.warn(`[sos] event ${event.id} has no contacts with an email to notify`);
        return;
      }
      const name = firstName(user?.fullName ?? null, user?.email ?? "Someone");
      const trackUrl = trackUrlFor(trackToken);
      const mapUrl =
        initialLat != null && initialLng != null
          ? `https://maps.google.com/?q=${initialLat},${initialLng}`
          : null;
      const subject = `🚨 SOS: ${name} may need help`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#dc2626;margin-bottom:8px">Emergency SOS</h2>
          <p><strong>${name}</strong> triggered an SOS and may need help.</p>
          <p style="margin:20px 0">
            <a href="${trackUrl}" style="background:#e11d48;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">
              View live location
            </a>
          </p>
          ${mapUrl ? `<p><a href="${mapUrl}">Open last known location in Google Maps</a></p>` : ""}
          <p style="color:#6b7280;font-size:13px">
            Live location updates while their app is open. If you can't reach them, contact local emergency services.
          </p>
        </div>`;
      await notifyContacts(rows.map((r) => ({ name: r.name, email: r.email })), subject, html);
    } catch (err) {
      console.error(`[sos] notify pipeline failed for event ${event.id}:`, err);
    }
  })();
});

// PATCH /api/sos/:id — attach media URL once the video finishes uploading.
sosRouter.patch("/:id", requireAuth, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  const [event] = await db
    .update(sosEvents)
    .set({ mediaUrl: parsed.data.mediaUrl })
    .where(and(eq(sosEvents.id, req.params.id), eq(sosEvents.userId, req.user!.id)))
    .returning();

  if (!event) return res.status(404).json({ success: false, error: "SOS event not found" });
  res.json({ success: true, data: event });
});

// POST /api/sos/:id/locations — append a live location point (active events only).
sosRouter.post("/:id/locations", requireAuth, async (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  const [event] = await db
    .select({ id: sosEvents.id, status: sosEvents.status })
    .from(sosEvents)
    .where(and(eq(sosEvents.id, req.params.id), eq(sosEvents.userId, req.user!.id)))
    .limit(1);

  if (!event) return res.status(404).json({ success: false, error: "SOS event not found" });
  if (event.status !== "active") {
    return res.status(409).json({ success: false, error: "SOS event is not active" });
  }

  const [point] = await db
    .insert(locationUpdates)
    .values({ sosEventId: event.id, ...parsed.data })
    .returning();

  res.status(201).json({ success: true, data: point });
});

// POST /api/sos/:id/resolve — user marks themselves safe.
sosRouter.post("/:id/resolve", requireAuth, async (req, res) => {
  const [event] = await db
    .update(sosEvents)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(and(eq(sosEvents.id, req.params.id), eq(sosEvents.userId, req.user!.id)))
    .returning();

  if (!event) return res.status(404).json({ success: false, error: "SOS event not found" });
  res.json({ success: true, data: event });
});

// GET /api/sos — history for the current user, newest first.
sosRouter.get("/", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(sosEvents)
    .where(eq(sosEvents.userId, req.user!.id))
    .orderBy(desc(sosEvents.createdAt));
  res.json({ success: true, data: rows });
});

// GET /api/sos/:id — one event plus its location trail (owner only).
sosRouter.get("/:id", requireAuth, async (req, res) => {
  const [event] = await db
    .select()
    .from(sosEvents)
    .where(and(eq(sosEvents.id, req.params.id), eq(sosEvents.userId, req.user!.id)))
    .limit(1);

  if (!event) return res.status(404).json({ success: false, error: "SOS event not found" });

  const trail = await db
    .select()
    .from(locationUpdates)
    .where(eq(locationUpdates.sosEventId, event.id))
    .orderBy(locationUpdates.createdAt);

  res.json({ success: true, data: { ...event, locations: trail } });
});
