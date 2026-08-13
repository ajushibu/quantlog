# QuantLog — Phase 1 (backend + auth + schema)

Self-hosted CAT prep tracker. This phase gives you a deployed, secured
backend with a test console. Phase 2 ports the full v5 UI on top.

## Architecture
- Next.js (App Router) on Vercel — frontend + API routes in one deploy
- Supabase — Postgres (state + struggles) and private Storage bucket (photos)
- Auth — one shared access code; every API call checks the `x-access-code` header
- All secrets live server-side. The browser never sees the Supabase service
  key or the Anthropic key. RLS stays deny-all; only API routes touch the DB.

## Setup (about 20 minutes)

1. **Supabase**
   - New project → SQL Editor → paste and run `supabase/schema.sql`
   - Storage → New bucket → name `photos`, Public **OFF**
   - Settings → API: copy the Project URL and the `service_role` key

2. **Local**
   ```bash
   npm install
   cp .env.local.example .env.local   # fill in all four values
   npm run dev                        # open http://localhost:3000
   ```
   Enter your access code in the test console and run all five checks.

3. **Deploy**
   - Push the folder to a GitHub repo → import in Vercel
   - Add the same four env vars in Vercel → Project → Settings → Environment Variables
   - Deploy. Open the URL on both laptop and iPad, run the checks again.

## Notes
- Free tiers: Supabase (500MB DB, 1GB storage) and Vercel hobby cover this
  app comfortably. Only Anthropic API usage costs anything (cents/week).
- Supabase pauses free projects after ~7 days of zero traffic; opening the
  app wakes it. Daily use never triggers this.
- The access code is the entire lock. Pick something unguessable, share it
  only between the two of you, and change it in Vercel env vars if it leaks.
- Anthropic API calls in `src/app/api/ai/*` use model `claude-fable-5`.
- `app_state.data` mirrors the artifact's single-JSON state (last write
  wins). Struggles + photos are their own table/bucket so they scale.

## Phase 2 (next)
Port of the full v5 UI: sections with interleaved practice sets, Revision
tab with queue/keep/retire/export, dashboard, three themes (Ember, Forest
Ink, Midnight Plum), PWA manifest + install support.
