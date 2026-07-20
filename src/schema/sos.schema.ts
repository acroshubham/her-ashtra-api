import { doublePrecision, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";

// lat/lng use doublePrecision (native JS number) rather than numeric (which the
// pg driver returns as a string) — GPS needs ~7 decimals, well within a float64.
export const sosStatusEnum = pgEnum("sos_status", ["active", "resolved", "cancelled"]);

// Trusted circle — the emergency contacts an SOS notifies. Mirrors the shape the
// app's stores/useContactStore.ts already uses ({ id, name, relation, phone }).
export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relation: text("relation"),
  email: text("email"), // notification channel (Resend) — required by the API on create
  phone: text("phone"), // optional; kept for display/calling
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sosEvents = pgTable("sos_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: sosStatusEnum("status").notNull().default("active"),
  // Unguessable public token used by the tracking link — see sos.routes.ts.
  trackToken: text("track_token").notNull().unique(),
  initialLat: doublePrecision("initial_lat"),
  initialLng: doublePrecision("initial_lng"),
  mediaUrl: text("media_url"), // Cloudinary secure_url, attached after the alert fires
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const locationUpdates = pgTable("location_updates", {
  id: uuid("id").defaultRandom().primaryKey(),
  sosEventId: uuid("sos_event_id")
    .notNull()
    .references(() => sosEvents.id, { onDelete: "cascade" }),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  accuracy: doublePrecision("accuracy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type SosEvent = typeof sosEvents.$inferSelect;
export type NewSosEvent = typeof sosEvents.$inferInsert;
export type LocationUpdate = typeof locationUpdates.$inferSelect;
export type NewLocationUpdate = typeof locationUpdates.$inferInsert;
