# Loop (web / PWA)

Same app as `loop.jsx`, now a website you open on phone or laptop. Sign in once and your data
syncs across devices and is backed up in the cloud. Works offline and syncs when back online.

**Stack:** React + Vite (PWA) · Supabase (login + database) · Vercel (hosting + `/api/ai` proxy for the Coach / meal AI)

## One-time setup (~20 min, all free tiers)

### 1. Supabase (accounts + synced data)
1. Create a project at https://supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Project Settings → API → copy the **Project URL** and **anon public key**.
4. Authentication → URL Configuration → set **Site URL** to your Vercel URL (after step 3 below).
   (Optional for quick testing: Authentication → Providers → Email → turn off "Confirm email".)

### 2. Run locally
```bash
cp .env.example .env     # fill in the two VITE_ values
npm install
npm run dev              # http://localhost:5173
```
With no `.env`, the app runs local-only (no login, no sync) — handy for trying it.
AI features need the `/api/ai` function, so test them with `npx vercel dev` or once deployed.

### 3. Deploy on Vercel
1. Push this folder to a GitHub repo and import it at https://vercel.com (framework: Vite).
2. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (from console.anthropic.com).
3. Deploy. Open the URL on your phone → Share → **Add to Home Screen** (iPhone) /
   **Install app** (Android). It then behaves like a native app.

## How sync works
- Every save writes to the device first (instant, offline-safe), then is queued and upserted to the
  `kv` table (one row per user + key). Row-level security means only you can read/write your rows.
- On sign-in, tab focus, reconnect, and live (Supabase Realtime), the app pulls changes; newest
  `updated_at` wins per key. Edits on another device refresh the view automatically.
- Backup = the Supabase database (enable daily backups on a paid plan, or export the `kv` table).

## Notes
- The Anthropic key lives only on the server; `/api/ai` requires a valid signed-in session.
- Photos are downscaled to ≤1280px JPEG before saving. They sync inside the `kv` rows; if you plan
  many photos, move them to Supabase Storage later.
- Update the Privacy/Terms placeholders in-app before sharing publicly.
