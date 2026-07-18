import "dotenv/config";
// Must be imported before any router is defined — patches Express 4's
// router methods so a rejected async handler reaches the error middleware
// below instead of crashing the whole process (confirmed by testing: a
// failed DB query took the entire server down before this was added).
import "express-async-errors";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.routes.js";
import { openApiSpec } from "./openapi.js";
import { landingPageHtml } from "./landingPage.js";
// This is a team hackathon backend — only Auth is built here. Safe Trip,
// Guardian Network, and AI Safety each get their own router + schema + Neon
// project when a teammate picks up that feature (see
// BACKEND_IMPLEMENTATION_PLAN.md in the frontend repo for the intended
// per-feature-DB architecture) — nothing to enable here yet.

const app = express();

app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  // Requests from the API's own origin (e.g. Swagger UI's "Try it out" at
  // /api-docs) always carry an Origin header even though they're same-host —
  // trust those in addition to the configured frontend origins.
  const selfOrigin = `${req.protocol}://${req.get("host")}`;
  cors({
    origin(origin, callback) {
      // No Origin header = native app / curl / health checks — always allow.
      if (!origin || origin === selfOrigin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })(req, res, next);
});

// Registered before any DB-touching or auth-requiring route, so Koyeb's
// health check (and any uptime pinger) never 500s because a Neon project
// happens to be cold. See BACKEND_IMPLEMENTATION_PLAN.md section 6.
app.get("/health", (_req, res) => res.sendStatus(200));

app.get("/", (_req, res) => res.type("html").send(landingPageHtml));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: "Her Ashtra API Docs" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

app.use("/api/auth", authRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled]", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Her-Ashtra-API listening on port ${PORT}`);
});
