# Trip Roulette Kerala

Mobile-first PWA that shortlists three Kerala destinations for a budget, time and mood, then lets a server-decided wheel pick one.

- **Specs:** [`docs/`](docs/) — start with [`docs/BUILD_BRIEF.md`](docs/BUILD_BRIEF.md), then [`3. ARCHITECTURE.md`](docs/3.%20ARCHITECTURE.md) and [`4. DATABASE_API_SPEC.md`](docs/4.%20DATABASE_API_SPEC.md).
- **Design reference:** [`docs/design/`](docs/design/) (390 px mockups; layout, copy and tokens only).
- **Stack:** Next.js (App Router) on Vercel · Supabase (Anonymous Auth, Postgres + RLS, Edge Functions, Storage) · Tailwind CSS · Zod.

## Develop

```bash
cp .env.example .env.local   # fill in Supabase values when the project exists
npm install
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`.

## Database (Supabase)

- Project: `trip-roulette` (ref `wjkhwoxcdnxvfpssiqgg`, Mumbai). Migrations in [`supabase/migrations/`](supabase/migrations/), seed in [`supabase/seed.sql`](supabase/seed.sql) (**sample data, not verified**), pgTAP tests in [`supabase/tests/database/`](supabase/tests/database/).

```bash
npx supabase db push --remote              # apply new migrations
npm run test:db                            # run pgTAP tests on the linked project (rolled back; no Docker needed)
npx supabase gen types typescript --remote --schema public > src/lib/database.types.ts
npx supabase functions deploy create-trip --use-api   # deploy an Edge Function (no Docker needed; 9 functions in supabase/functions/)
npm test                                   # engine, spin and itinerary unit tests (Vitest)
npm run build && npm run test:e2e          # Playwright + axe against the production build (creates 2 test guests + 2 trips per run)
E2E_BASE_URL=https://trip-roulette-ten.vercel.app npx playwright test   # same tests against the live site
```

## Admin access

1. Supabase dashboard → **Authentication → Users → Add user**: your email and a strong password (tick *Auto confirm user*).
2. Supabase dashboard → **SQL editor** (use `'editor'` for people who prepare content but don't publish):

   ```sql
   insert into public.admin_users (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.com';
   ```

3. Sign in at `/admin/login`. Signing in replaces any guest session in that browser.
4. Optional: add `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` to `.env.local` to run the signed-in admin test ([`tests/e2e/admin.e2e.ts`](tests/e2e/admin.e2e.ts)). It creates a throwaway draft, checks edit, preview, refused publish, archive and the audit log, then deletes the draft.

## Build progress (BUILD_BRIEF §10)

- [x] 1. Scaffold, tokens, fonts, layout shell, header, footer, homepage
- [x] 2. SQL migrations, RLS policies, seed data, pgTAP tests (46 passing), anonymous sign-ins on — pending: CAPTCHA
- [x] 3. Wizard (`/plan`): five steps plus review, inline validation, state kept in sessionStorage, focus moves to each step's heading. Submitting calls `create-trip`, which arrives in step 4. Request schema shared with the functions: [`supabase/functions/_shared/trip-request.ts`](supabase/functions/_shared/trip-request.ts)
- [x] 4. Recommendation engine (`create-trip`, deployed) and results screen (`/trip/[tripId]`), including the fewer-than-three state. Engine in [`supabase/functions/_shared/engine.ts`](supabase/functions/_shared/engine.ts), unit tests in [`tests/unit/`](tests/unit/) (37 passing)
- [x] 5. Spin function (`spin`, deployed: Web Crypto rejection sampling, one result per trip, idempotent) and wheel (`/trip/[tripId]/roulette`: reduced motion, live announcement, reload-safe, "Checking your spin…" recovery). Default itinerary generated on spin ([`itinerary.ts`](supabase/functions/_shared/itinerary.ts))
- [x] 6. Destination detail: trip view `/trip/[tripId]/destination` (stored cost breakdown, itinerary timeline, route link) and public `/destinations/[slug]` (cached for hours, tagged `destinations` / `destination:<slug>` for revalidation; no fuel share or itinerary). Save/Share bar arrives with step 7
- [x] 7. Save (local, `/saved`, survives restarts) and share: `create-share-link` / `revoke-share-link` / `get-shared-trip` (deployed; 256-bit tokens stored as SHA-256, frozen snapshot without user ID, budget, moods or trip ID, 30-day expiry), `/shared/[token]` with `Referrer-Policy: no-referrer`. Optional function secret `SITE_URL` sets the link domain (defaults to the visitor's origin)
- [x] 8. Error boundary (`error.tsx`, `global-error.tsx`), offline banner and `/offline` fallback, PWA manifest + icons, service worker (`public/sw.js`: static assets, public destination pages, Saved trips and last 10 trip pages cached; never admin, API, shared links or Supabase). `/explore` and the homepage now read published destinations (cached hourly)
- [x] 9. Admin (`/admin`): email sign-in, dashboard with search and status / access-check-due filters, destination editor (Zod-validated details, moods, sources, attractions, costs, access records, images, routes), preview before publishing, publish via `publish_destination()` (admin) with failures listed, archive, audit log. All writes go through RLS and the audit triggers; `/api/revalidate` refreshes public pages after publish/archive
- [x] 10. Tests: Vitest unit tests (engine, costs, budget boundaries, access rules, spin RNG mapping and uniformity, itinerary, share tokens: 40), pgTAP RLS tests (46), Playwright end-to-end with axe WCAG 2.2 AA on every route, the six usability tasks, and spin idempotency/concurrency (18)

### After the 10 steps

- **`generate-itinerary`** (deployed): "Leave at" control on `/trip/[tripId]/destination` rebuilds the stored plan for a departure between 04:00 and 14:00 (UI offers 05:00–12:00); a saved copy updates itself.
- **`track-event`** (deployed): allow-listed browser events only (`homepage_view`, `start_trip_clicked`, `preferences_completed`, `roulette_spin_started`, `destination_viewed`, `trip_saved`; schema in [`_shared/analytics.ts`](supabase/functions/_shared/analytics.ts)). Server-side events stay with the functions that cause them. The browser's random ID is stored hashed; nothing is sent under Global Privacy Control / Do Not Track or from automated browsers (so test runs don't count).
- **Scheduled jobs** (`pg_cron`, migration `20261106100000_maintenance.sql`): `daily_maintenance()` at 03:00 IST deletes expired trips and share links, guests older than 90 days with no trips, rate-limit counters older than a day and events older than a year, and returns the review-due list; `refresh_route_estimates()` on Sundays fills missing car/bike routes as estimates and never overwrites editor- or provider-entered routes. On demand: the `daily-maintenance` (secret key) and `refresh-routes` (secret key or admin; `{"onlyMissing": true}`) functions. Job history: `select * from cron.job_run_details order by start_time desc;`
- **Content pages:** `/how-it-works`, `/about`, `/contact`, `/privacy`, `/terms`. Privacy and terms are **drafts** describing what the app does today; they need a legal review. Set `NEXT_PUBLIC_CONTACT_EMAIL` to publish a contact address.
- **Security headers** ([`next.config.ts`](next.config.ts)): Content Security Policy (scripts only from this site; the browser talks only to this site and Supabase; no framing, plugins or `<base>`), `nosniff`, `X-Frame-Options`, referrer and permissions policies, HSTS. No nonces, because those would turn off the cached public pages; add a host to the CSP before loading anything from another site (e.g. a CAPTCHA widget). The tests fail on any CSP violation.
- **CORS on the functions:** the `ALLOWED_ORIGINS` function secret (comma separated) limits which websites can call them from a browser. Unset = any origin. Currently `http://localhost:3000,http://localhost:3100`; add the live domain when deploying.
- Tests now: Vitest 46, pgTAP 70 (RLS 46 + maintenance 24), Playwright 25.

### Still open

- CAPTCHA on anonymous sign-in (Supabase → Authentication → Attack Protection, plus a Turnstile/hCaptcha widget at the wizard's submit).
- Admin account: see *Admin access* above.
- Routing provider (ARCHITECTURE §17): routes are straight-line estimates until one is chosen; plug it into `refresh-routes`.
- Legal review of privacy and terms; a contact address (`NEXT_PUBLIC_CONTACT_EMAIL`).
- Hosting: live at https://trip-roulette-ten.vercel.app (Vercel, deploys on push to `main`). Env vars there: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` and `REVALIDATE_SECRET` there, and the `SITE_URL` and `ALLOWED_ORIGINS` function secrets in Supabase (`npx supabase secrets set "ALLOWED_ORIGINS=https://<your-domain>,http://localhost:3000,http://localhost:3100"`; keep the localhost entries for development and tests).
- All destination data is **sample data**; replace it with verified records through the admin before launch.


