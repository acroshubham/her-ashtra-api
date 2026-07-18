import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// One shared Neon project for the whole backend — not one per feature.
// Splitting DBs per feature/teammate on free-tier Neon turned "independent
// ownership" into "N single points of failure," each one only fixable by
// contacting whichever teammate owns that project. A single instance means
// one connection string, one place to look when something's wrong, and
// still plenty of headroom on Neon's free tier for a hackathon's data
// volume. New features add a schema file here (glob picks it up
// automatically) rather than a new project.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*.schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder/placeholder",
  },
});
