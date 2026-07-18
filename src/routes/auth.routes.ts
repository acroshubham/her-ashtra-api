import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../schema/auth.schema.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
});

function toPublicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
  };
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }
  const { email, password, fullName, phone } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    return res.status(409).json({ success: false, error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, fullName, phone })
    .returning();

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  res.status(201).json({ success: true, data: { token, user: toPublicUser(user) } });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, error: "Invalid email or password" });
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  res.json({ success: true, data: { token, user: toPublicUser(user) } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  res.json({ success: true, data: toPublicUser(user) });
});

authRouter.put("/me", requireAuth, async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ success: false, error: "No fields to update" });
  }

  const [user] = await db
    .update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, req.user!.id))
    .returning();

  res.json({ success: true, data: toPublicUser(user) });
});

authRouter.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  const allUsers = await db.select().from(users);
  res.json({ success: true, data: allUsers.map(toPublicUser) });
});
