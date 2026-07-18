# Her-Ashtra-API

Auth backend for the Her Ashtra hackathon project — Express + Drizzle ORM + Neon Postgres. Register, login, and `me`, with role-based (user/admin) access control. `src/index.ts` mounts one router: `/api/auth/*`.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` + `JWT_SECRET` (ask a teammate who's already set up Auth for the shared Neon connection string):
   ```bash
   cp .env.example .env
   ```
3. Apply migrations to your Neon database:
   ```bash
   npm run db:migrate
   ```
4. Start the dev server:
   ```bash
   npm run dev     # tsx watch, listens on $PORT (default 4000)
   ```
5. Open `http://localhost:4000` — the landing page links to `/api-docs` for the full Swagger reference.

## Database

**One shared Neon Postgres project** for the whole backend — not one per feature or per teammate. New features add a schema file under `src/schema/`; `drizzle.config.ts` globs all of them into one migration set against the same database. No new Neon project needed.

## Commands

```bash
npm run dev          # local dev server (tsx watch)
npm run check        # typecheck
npm run db:generate   # generate a migration from schema changes
npm run db:migrate    # apply migrations to DATABASE_URL
npm run build         # production build (esbuild -> dist/)
npm start             # run the production build
```
