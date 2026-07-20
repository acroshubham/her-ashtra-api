import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts } from "../schema/sos.schema.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const contactsRouter = Router();

// E.164: leading +, first digit 1-9, 7-14 more digits.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format, e.g. +919000000001");

const emailSchema = z.string().trim().email("A valid email address is required");

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  relation: z.string().trim().min(1).optional(),
  email: emailSchema, // notification channel — required
  phone: phoneSchema.optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  relation: z.string().trim().min(1).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

function toPublicContact(row: typeof contacts.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation,
    email: row.email,
    phone: row.phone,
  };
}

contactsRouter.get("/", requireAuth, async (req, res) => {
  const rows = await db.select().from(contacts).where(eq(contacts.userId, req.user!.id));
  res.json({ success: true, data: rows.map(toPublicContact) });
});

contactsRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  const [row] = await db
    .insert(contacts)
    .values({ ...parsed.data, userId: req.user!.id })
    .returning();

  res.status(201).json({ success: true, data: toPublicContact(row) });
});

contactsRouter.put("/:id", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ success: false, error: "No fields to update" });
  }

  const [row] = await db
    .update(contacts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(contacts.id, req.params.id), eq(contacts.userId, req.user!.id)))
    .returning();

  if (!row) return res.status(404).json({ success: false, error: "Contact not found" });
  res.json({ success: true, data: toPublicContact(row) });
});

contactsRouter.delete("/:id", requireAuth, async (req, res) => {
  const [row] = await db
    .delete(contacts)
    .where(and(eq(contacts.id, req.params.id), eq(contacts.userId, req.user!.id)))
    .returning({ id: contacts.id });

  if (!row) return res.status(404).json({ success: false, error: "Contact not found" });
  res.json({ success: true, data: { id: row.id } });
});
