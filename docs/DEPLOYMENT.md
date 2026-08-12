# Deployment Guide

## Option A — Docker Compose (fastest way to see the whole thing running)

```bash
cd ai-bi-dashboard
cp backend/.env.example .env    # fill in ANTHROPIC_API_KEY if you have one
docker compose up --build
```
- Backend: http://localhost:4000
- Frontend: http://localhost:8080

Seed data is created automatically the first time the backend container starts
(SQLite file in a named Docker volume, so it persists across restarts). To
reseed from scratch: `docker compose down -v && docker compose up --build`.

## Option B — Split cloud deployment (what you'd actually run in production)

**Backend + Postgres:**
1. Push this repo to GitHub.
2. Create a new Web Service on Render (or Railway/Fly.io), pointing at `backend/`.
3. Add a managed Postgres instance (Render Postgres, Supabase, or RDS) and set `DATABASE_URL`.
4. Swap `backend/src/db/index.ts` for a `pg`-based adapter (see comment at top of that file) and run `docs/DATABASE_SCHEMA.md` against the new database.
5. Set environment variables from `.env.example`: `ANTHROPIC_API_KEY`, `INGEST_API_KEY`, `ALERT_WEBHOOK_URL`.
6. Deploy. Note the public URL — you'll need it for both the frontend and n8n.

**Frontend:**
1. Create a new project on Vercel/Netlify pointing at `frontend/`.
2. Set build command `npm run build`, output directory `dist`.
3. Set an environment variable `VITE_API_BASE_URL` to the backend's public URL, and update `frontend/src/api/client.ts`'s `BASE` constant to read from `import.meta.env.VITE_API_BASE_URL` instead of the relative `/api` (the relative path only works when both are served from the same origin, as in the Docker Compose setup).
4. Deploy.

**n8n:**
1. Use n8n Cloud, or self-host via their official Docker image.
2. Import `automation/n8n-workflows/daily-ingestion-and-analysis.json`.
3. Set `BI_API_BASE_URL`, `BI_INGEST_API_KEY`, `SLACK_ALERT_CHANNEL_ID` in n8n's environment/credentials.
4. Connect a Google Sheets credential with read access to the portfolio companies' metrics sheets.
5. Activate the workflow.

## Security checklist before going live
- [ ] `ANTHROPIC_API_KEY` only set on the backend, never in frontend env vars or n8n workflow JSON
- [ ] `INGEST_API_KEY` rotated from the example value, shared only with n8n's environment
- [ ] CORS on the backend (`app.use(cors())` in `server.ts`) restricted to the deployed frontend's origin
- [ ] Postgres connection uses SSL (`?sslmode=require`) in production
- [ ] Rate limiting added in front of `/api/insights/generate` if exposed beyond internal use (Claude API calls cost money per request)
