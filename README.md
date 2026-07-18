# Her-Ashtra-API

Auth backend for the Her Ashtra hackathon project. Register, login, and `me` — that's the whole surface. `src/index.ts` mounts one router: `/api/auth/*`.

## Database

**One shared Neon Postgres project** for the whole backend — not one per feature or per teammate. That was considered and rejected: on Neon's free tier, splitting DBs across teammates turns "independent ownership" into N single points of failure, each one only fixable by contacting whichever teammate owns that project (hit a free-tier limit, went offline, forgot to renew — now the whole feature is blocked on a person, not a technical problem). One shared instance means one connection string, one place to look when something breaks, and Neon's free tier (0.5GB storage, 100 CU-hrs/month) has plenty of headroom for a hackathon's data volume.

New features add a schema file under `src/schema/` — `drizzle.config.ts` globs all of them into one migration set against the one database. No new Neon project needed.

Safe Trip, Guardian Network, and AI Safety are not part of this repo yet — separate work for whichever teammate picks up each feature, added as new tables in this same database per `BACKEND_IMPLEMENTATION_PLAN.md` (in the `her-ashtra-app` frontend repo).

## Local dev

```
cp .env.example .env   # fill in JWT_SECRET + DATABASE_URL
npm install
npm run db:migrate     # applies migrations/*.sql to your Neon DB
npm run dev             # tsx watch, listens on $PORT (default 4000)
```

## Deployment

See `NEON_KOYEB_DEPLOYMENT.md` in the frontend repo (`her-ashtra-app`) for the full Neon-project → migration → Koyeb → app-integration walkthrough.
