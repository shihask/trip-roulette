# Trip Roulette Kerala — Build Brief for Claude Code

Paste this into Claude Code (or save it as `CLAUDE.md` / `docs/BUILD_BRIEF.md` in the repo) and start with:

> Read `docs/BUILD_BRIEF.md` and the screens in `docs/design/`. Build the app in the order in §10. Ask me before changing the stack or data model.

---

## 1. What we are building

A mobile-first web app (installable PWA) that helps people in Kerala pick a trip. The user enters a starting point, a date, a duration, a per-person budget, the travellers and a mood. The app shortlists **exactly three** eligible destinations, then a **server-decided** roulette picks one. The user sees the destination's details, an itemised cost estimate and an itinerary, and can save or share the trip.

Core principles (do not break these):
- Costs, distances and travel times are always labelled **estimates**.
- Every destination shows **last-verified** dates and links to its sources.
- **The server picks the roulette winner.** The browser only animates to the result.
- Accessible (WCAG 2.2 AA), keyboard-usable, and respects reduced motion.
- Calm and trustworthy: no fake ratings, no "best" claims, no busy gamification.

## 2. Stack (confirmed, v1.2)

Full detail in `docs/3. ARCHITECTURE.md`. In short:

- **Next.js (App Router) + React 19 + TypeScript** on **Vercel** (functions region `bom1`). Next.js renders pages and metadata only; it holds **no business rules**.
- **Supabase** (Mumbai, `ap-south-1`):
  - **Auth:** Anonymous Auth for guests (`signInAnonymously()` with CAPTCHA, on first wizard submit); email sign-in for admins. Sessions via `@supabase/ssr` cookies.
  - **Postgres with RLS** on every table. Clients read through `supabase-js` under RLS; trip tables have **no client write policies**.
  - **Edge Functions** for all business logic: `create-trip`, `spin`, `generate-itinerary`, `create-share-link`, `revoke-share-link`, `get-shared-trip`, `track-event`, plus scheduled `refresh-routes` and `daily-maintenance`.
  - **SQL migrations** (Supabase CLI) for schema, policies, SQL functions and triggers.
  - **Storage** for images.
- **No Prisma.**
- **Tailwind CSS**, with the tokens in §4 mapped into the theme
- **Zod** schemas in `supabase/functions/_shared/`, imported by the functions and (for form validation) by the app
- **TanStack Query** where client-side caching helps
- **Playwright** end-to-end, **Vitest** + Testing Library unit tests, **pgTAP** RLS policy tests, Deno tests for functions
- PWA: web manifest + service worker (saved trips readable offline)
- The service-role key lives only in Edge Function secrets, never in Vercel or the browser

## 3. Routes

| Route | Screen | Reference file |
|---|---|---|
| `/` | Homepage | `design/1-Homepage.html` |
| `/plan` | Preference wizard (5 steps) | `design/2-Wizard-Mood.html` (step 4 shown) |
| `/trip/:tripId` | Three recommendations (or fewer-than-three state) | `design/3-Recommendations.html`, `design/7-Edge-States.html` |
| `/trip/:tripId/roulette` | Roulette | `design/4-Roulette.html` |
| `/trip/:tripId/destination` | Chosen destination with trip costs and itinerary | `design/5-Destination.html` |
| `/destinations/:slug` | Public destination page (no trip context: no fuel share, no itinerary) | `design/5-Destination.html` (subset) |
| `/shared/:token` | Shared trip view | `design/6-Shared.html` |
| `/explore` | Curated discovery | (reuse homepage card grid) |
| `/saved` | Saved trips (local list) | not designed yet |
| `/how-it-works`, `/about`, `/contact`, `/privacy`, `/terms` | Content pages | not designed yet |
| `/admin` | Protected admin | not designed yet; see §8 |

**About the reference files:** they are mockups at a 390 px phone width, written in a design-tool format (`<x-dc>`, `{{holes}}`, `<sc-for>`, `<sc-if>`, and a `DCLogic` class). Use them for **layout, copy, spacing, colours and states**. Rebuild them as real React components; do not copy that runtime. All prices, fee totals and "last verified" dates in them are **sample data**, and the striped boxes stand in for licensed photos.

## 4. Design tokens

```ts
// colours
ground:       '#F6F5F1'  // page background
surface:      '#FFFFFF'  // cards
surfaceMuted: '#EFEEE8'  // chips, "Estimated" label
ink:          '#18211D'  // body text
muted:        '#55605A'  // secondary text (passes AA on ground and surface)
line:         '#E1DFD7'  // borders
lineStrong:   '#C9C7BE'  // outline-button borders
green:        '#1D6A4C'  // primary actions, links
greenInk:     '#145239'  // text on greenTint
greenTint:    '#E4EFE8'  // selected states, verified label
warm:         '#B9461B'  // the Spin action only
warmInk:      '#8F3412'
warmTint:     '#FBE9DF'
warnBg:       '#FFF4D6'  warnBorder: '#E8C46A'  warnText: '#5A3E00'  warnIcon: '#8A6100'
errorBg:      '#FCE8E5'  errorBorder: '#E6A49B'  errorText: '#7A1D13'  errorInline: '#A3261B'
footer:       '#18211D'  // dark footer and CTA band

// type (Google Fonts)
display: 'Bricolage Grotesque' 500/700  // headings
body:    'Instrument Sans' 400/500/600
H1 30–40px/1.05, tracking -0.02em · H2 22–26px · body 15–17px · labels 12–14px (never smaller than 12px)

// shape and spacing
radius: chip 999px · label 6px · input/button 12–14px · card 16–18px · hero image 20px
page gutter 16px · section gap 28–48px · touch targets ≥ 44px (primary buttons 52–56px tall)
focus ring: 3px solid green, 2px offset
```

Wheel segment colours: `#1D6A4C`, `#3F6E74`, `#5E6B2E`, all with white labels.

## 5. Components to build

`AppHeader`, `AppFooter`, `PrimaryButton` (variants: primary green, spin warm, outline), `LocationAutocomplete`, `DateSelector`, `BudgetSelector` (preset chips plus a custom amount, labelled "per person"), `TravellerCounter`, `InterestSelector` (toggle cards with `aria-pressed`), `WizardProgress` (5-segment bar, `role="progressbar"`), `DestinationCard`, `RecommendationSummary` (preference chips plus "Adjust preferences"), `CostBreakdown` (a semantic `<table>`), `DataFreshnessLabel` (verified = green check; review due = amber warning), `AccessWarning`, `RouletteWheel`, `ItineraryTimeline`, `MapLink` (opens an external maps app), `SaveTripButton`, `ShareTripButton`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `OfflineBanner`.

## 6. Screen behaviour

**Homepage.** Hero headline "Don't know where to go? Let Kerala surprise you." Primary CTA "Start Your Trip" (must be visible on first load on a phone), secondary "Explore Destinations". Then curated cards, a three-step "How it works", the trust section ("Estimates you can check") and the footer. No auto-playing video, and no form in the hero.

**Wizard (`/plan`).** Five steps:
1. Starting point: searchable; geolocation only after the user taps it; fall back to manual search if permission is denied.
2. Date (specific or flexible) and duration (a few hours, one day, two days, 3–5 days).
3. Budget per person in INR, travellers, and group type (solo, friends, couple, family).
4. Mood: multi-select, at least one required.
5. Optional: transport (bike, car, public transport), whether to stay overnight, and accessibility needs.

Keep state when the user goes back (in the URL or session storage). Validate inline and show errors in text, not colour alone. Move focus to the step's H1 when the step changes. Show a review summary before submitting. Never change the user's inputs silently.

**Recommendations.** Show exactly three cards. Each card has: image, name, district, type, approximate road distance, travel-time estimate, estimated cost per person, a "Why it matches" sentence, a freshness label, and a warning where relevant. **No match scores.** The bottom bar holds "Spin to choose" and "Equal chance for all three".
If fewer than three destinations are eligible, show the constraint-conflict state (see the edge-states file): explain which constraint is limiting the results and offer one-tap ways to loosen it. Each option sends the user back to the wizard with that change suggested, never applied automatically.

**Roulette.** Follow this sequence:
1. The user taps Spin. The button is disabled and reads "Asking the server…".
2. Invoke the `spin` Edge Function with `{ tripId }` and an `Idempotency-Key` header (a UUID generated once per spin attempt and kept in sessionStorage).
3. The function picks uniformly with Web Crypto (rejection sampling), stores the result (one per trip, enforced by a unique constraint; clients cannot write this table), generates the default itinerary, and returns `{ resultId, publicCode, recommendationId, destinationSlug, index }` (see `docs/4. DATABASE_API_SPEC.md` §8.5).
4. The wheel animates to that segment (about 3.4 s ease-out, 5 full turns). With reduced motion, it jumps there with no animation.
5. An `aria-live="polite"` region announces "The wheel chose Munnar."
6. The CTA becomes "See Munnar details", with the line "Result saved · ID TR-xxxx" under it.

A reload after a result shows the stored result (read `roulette_results` for the trip directly under RLS); it must not spin again. On a timeout, show "Checking your spin…", read the stored result, and if there is none, retry with the **same** key. Only a real failure shows the error state, which says no spin was used.

**Destination detail.** Content in this order:
1. Hero image and title (with "The wheel chose" when the user arrived from a spin)
2. District, category and overview
3. Key facts: approximate road distance, travel-time estimate, suggested duration
4. Itemised cost estimate with a total and a "Not included" line
5. Attractions
6. Itinerary timeline
7. Route link
8. Access, permit, seasonal and safety information
9. Sources, each with a last-verified date
10. A bottom bar with Save and Share trip, which must not cover content (add bottom padding)

**Shared trip.** Starts with a "Shared trip plan, not a booking" notice, then the destination, the preference chips, the estimate and the itinerary, and ends with a "Start your own trip" CTA. Show no account or private information. Expired or revoked links get their own friendly state.

## 7. API and data model (starting point)

**The source of truth is `docs/4. DATABASE_API_SPEC.md` (tables, RLS policies, function contracts, error codes) and `docs/3. ARCHITECTURE.md` §5–8 (engine, roulette, costs, itinerary).** Write the SQL migrations from that spec; don't simplify it. Summary:

| Need | How |
|---|---|
| Search starting towns | Direct read of `locations` under RLS |
| Create trip + 3 recommendations | Edge Function `create-trip` → 201 with exactly 3, or 422 `INSUFFICIENT_DESTINATIONS` |
| Show recommendations / spin result / itinerary | Direct reads of the user's own trip tables under RLS (never recomputed) |
| Spin | Edge Function `spin` (header `Idempotency-Key`) |
| Regenerate itinerary | Edge Function `generate-itinerary` (optional departure time only) |
| Share | Edge Functions `create-share-link`, `revoke-share-link`, `get-shared-trip` (frozen snapshot, always expires, 410 when expired/revoked) |
| Public destination pages | Next.js server components reading published rows with the anon key (ISR) |
| Analytics | Edge Function `track-event` (allow-listed events) |
| Admin edits | Direct writes under editor/admin RLS policies + audit triggers; publish via RPC `publish_destination` |

Key rules from the spec:
- One trip = three recommendations = at most one spin. Changing preferences creates a new trip.
- Every function error uses the `{ "error": { code, message, fieldErrors, details, requestId } }` envelope.
- Route distances and times are precomputed in `location_destination_routes`; no routing calls on user requests.
- Eligibility: published; route exists and one-way time is within `duration_rules`; duration in `suitable_durations`; mood overlap; **cost per person ≤ budget (upper bound of a range)**; transport mode not excluded.
- **Essential access information must be present, current and not closed, or the destination is excluded.** Missing route or essential cost ⇒ excluded. Only non-essential access info that is stale or missing produces a warning.
- Ranking weights and travel-time limits come from `algorithm_configs` and `duration_rules` (configurable assumptions), not constants in code.
- Generate the "Why it matches" sentence from the rules that passed. Never return a match score.
- Ownership is enforced by RLS on `auth.uid()`; trip tables have no client write policies.

**Note on the mockups:** `3-Recommendations.html` shows Athirappilly as a match with "Access last verified 2 Sep 2026" (past review). Under the v1.2 rule that destination would be excluded. Keep the amber warning style for non-essential warnings and for browse pages, but don't treat that card as a valid recommendation example.

## 8. Admin (not designed; keep it simple and functional)

The admin area is protected by auth. It includes:
- A dashboard listing draft, published and review-needed destinations, with search and filters
- A destination editor with Zod validation, and management of attractions, costs, images, access info and sources (source URL, type, verified date, review-due date)
- A preview before publishing
- An audit log of important edits

Destinations whose access information is past its review-due date show the amber "Access check due" label on browse pages. If that information is essential, the destination is not recommended until an editor re-verifies it.

## 9. States every screen needs

Loading (skeletons), success, empty, validation error, network error, external service unavailable, stale data, permission denied (geolocation), offline (a banner; saved trips still work, spinning needs a connection), narrow phone width, and keyboard-only use.

Special cases: fewer than three matches, no route estimate ("Route estimate unavailable"), missing cost ("Cost info missing"), access not recently verified, spin timeout after the server may have finished, expired share link, and a reload after a spin result.

Approved wording: "Estimated cost", "Approximate road distance", "Travel time estimate", "Last verified", "Access information unavailable", "Check the official source before travelling".
Never use: "Guaranteed open", "Exact cost", "Definitely safe", "Best destination".

## 10. Build order and acceptance

1. Scaffold, tokens, fonts, layout shell, header and footer → Homepage matches `1-Homepage.html` at 390 px and scales up (tablet: 2 columns; desktop: 3 recommendation cards in a row, sticky summary on the detail page, readable line lengths).
2. SQL migrations (schema, RLS policies, helper functions, audit triggers) from `docs/4. DATABASE_API_SPEC.md`, pgTAP policy tests, and `seed.sql`: 10–15 Kerala destinations across several moods and districts, routes from 3–4 starting towns, essential access records, cost assumptions and the `1.0.0` algorithm config, all clearly marked as sample data. Set up Anonymous Auth with CAPTCHA.
3. Wizard with validation, state kept when going back, focus management, and a review step.
4. Recommendation engine and screen, including the fewer-than-three state.
5. Spin API (idempotent, cryptographic RNG) and the wheel (reduced motion, live announcement, reload-safe).
6. Destination detail.
7. Save (local) and share (token, expiry, revoke) and the shared view.
8. Edge, error and offline states, plus the PWA manifest and service worker.
9. Admin.
10. Tests:
    - Playwright: the usability tasks from the spec — find a one-day trip under budget, understand each recommendation, spin and identify the result, find the total cost and what it includes, check access verification, share the trip.
    - An axe accessibility check on every route.
    - Spin tests: index mapping checked with an injected RNG; one statistical uniformity check with a loose threshold; a repeated idempotency key and concurrent requests both return the single stored result.
    - pgTAP tests: anon, another user and the owner see the right rows; no client can insert into `trips`, `trip_recommendations` or `roulette_results`.
    - Engine tests: stale, missing or closed essential access excludes a destination; stale non-essential access only warns.

Done means: no browser-side winner selection, no unlabelled numbers, AA contrast, every control reachable by keyboard, and no horizontal scroll at 360 px.
