import "dotenv/config";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../schema/auth.schema.js";

const EMAIL = "sysadmin@her-ashtra.ai";
const PASSWORD = "herashtra.ai@2026";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const normalizedEmail = EMAIL.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    console.log(`Updated existing user ${normalizedEmail} -> role=admin, password reset.`);
  } else {
    await db.insert(users).values({
      email: normalizedEmail,
      passwordHash,
      fullName: "System Admin",
      role: "admin",
    });
    console.log(`Created admin user ${normalizedEmail}.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
