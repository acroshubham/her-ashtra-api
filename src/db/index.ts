import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as authSchema from "../schema/auth.schema.js";
import * as sosSchema from "../schema/sos.schema.js";
// Each feature imports its own schema file here — one shared pool, one Neon
// project. See drizzle.config.ts for why.
const schema = { ...authSchema, ...sosSchema };

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set — see .env.example");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
