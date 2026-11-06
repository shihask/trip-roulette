"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  addDays,
  createTripRequestSchema,
  DURATION_CODES,
  MAX_DAYS_AHEAD,
  todayInKolkata,
  toFieldErrors,
  TRANSPORT_MODES,
  TRAVEL_GROUPS,
  TRAVELLERS_MAX,
  TRAVELLERS_MIN,
} from "@shared/trip-request";
import { buttonVariants } from "@/components/button-link";
import { formatDate, formatInr } from "@/lib/format";
import { createTrip, type CreateTripResult } from "@/lib/trips";
import { useTurnstile } from "@/lib/turnstile";
import {
  CheckCircle,
  ChevronLeft,
  ChoiceCard,
  defaultMoodIcon,
  FieldError,
  Legend,
  moodIcons,
  StepHeading,
} from "./fields";
import { LocationAutocomplete } from "./location-autocomplete";
import { useCatalogue, type Catalogue, type Mood } from "./use-catalogue";
import { track } from "@/lib/analytics";
import {
  AVAILABLE_TRANSPORT,
  BUDGET_PRESETS,
  durationLabels,
  fieldStep,
  groupLabels,
  initialValues,
  isOvernight,
  loadState,
  parseBudgetMinor,
  REVIEW_STEP,
  saveState,
  STEP_COUNT,
  toRequest,
  transportLabels,
  validateStep,
  type FieldErrors,
  type Step,
  type WizardState,
  type WizardValues,
} from "./wizard-state";

const STEP_NAMES = ["Starting point", "Date and duration", "Budget and travellers", "Mood", "Preferences"] as const;

type Suggestion = { field: string; label: string };
type SubmitState = { kind: "idle" } | { kind: "submitting" } | { kind: "failed"; result: Exclude<CreateTripResult, { ok: true }> };

const noopSubscribe = () => () => {};

/** The wizard reads sessionStorage, so it renders on the client only; the server sends a skeleton. */
export function TripWizard() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return isClient ? <Wizard /> : <WizardSkeleton />;
}

function Wizard() {
  const router = useRouter();
  const { catalogue, retry } = useCatalogue();
  const [state, setState] = useState<WizardState>(() => loadState() ?? { step: 0, values: initialValues });
  const [tried, setTried] = useState<ReadonlySet<Step>>(new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [returnToReview, setReturnToReview] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const { containerRef: captchaRef, enabled: captchaEnabled, getToken: getCaptchaToken } = useTurnstile("create_trip", state.step === REVIEW_STEP);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepBodyRef = useRef<HTMLDivElement>(null);
  const lastStep = useRef(state.step);
  const pendingInvalidFocus = useRef<string | null>(null);

  const { step, values } = state;
  const moods = catalogue.status === "ready" ? catalogue.moods : [];
  const moodSlugs = moods.map((m) => m.slug);

  useEffect(() => saveState(state), [state]);

  // Move focus to the new step's heading (not on first load).
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);

  // After a failed "Continue", focus the first invalid field.
  useEffect(() => {
    const key = pendingInvalidFocus.current;
    if (!key) return;
    pendingInvalidFocus.current = null;
    const field = stepBodyRef.current?.querySelector(`[data-field="${key}"]`);
    const target = field?.matches("input, button")
      ? (field as HTMLElement)
      : field?.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled])");
    target?.focus();
  });

  const errors: FieldErrors = {
    ...(tried.has(step) ? validateStep(step, values, { moodSlugs }) : {}),
    ...Object.fromEntries(Object.entries(serverErrors).filter(([k]) => fieldStep[k] === step)),
  };

  function update(patch: Partial<WizardValues>) {
    setState((s) => ({ ...s, values: { ...s.values, ...patch } }));
    setServerErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        delete next[k];
        if (k === "startLocation") delete next.startLocationId;
        if (k === "budgetRupees") delete next.budgetPerPersonMinor;
        if (k === "dateMode") delete next.travelDate;
      }
      return next;
    });
    if (submit.kind === "failed") setSubmit({ kind: "idle" });
  }

  function goTo(next: Step) {
    setState((s) => ({ ...s, step: next }));
    setSuggestion((sg) => (sg && fieldStep[sg.field] === next ? sg : null));
  }

  function failStep(s: Step, errs: FieldErrors) {
    setTried((t) => new Set(t).add(s));
    const order = Object.keys(fieldStep).filter((k) => fieldStep[k] === s);
    pendingInvalidFocus.current = order.find((k) => errs[k]) ?? Object.keys(errs)[0] ?? null;
  }

  function onContinue() {
    if (step === REVIEW_STEP) return;
    const errs = { ...validateStep(step, values, { moodSlugs }), ...errors };
    if (Object.keys(errs).length > 0) {
      failStep(step, errs);
      return;
    }
    setSuggestion(null);
    if (returnToReview || step === STEP_COUNT - 1) {
      setReturnToReview(false);
      goTo(REVIEW_STEP);
    } else {
      goTo((step + 1) as Step);
    }
  }

  function onBack() {
    if (step === 0) return;
    setReturnToReview(false);
    goTo((step - 1) as Step);
  }

  function editFromReview(s: Step) {
    setReturnToReview(true);
    goTo(s);
  }

  async function onSubmit() {
    if (submit.kind === "submitting") return;
    for (let s = 0 as Step; s < STEP_COUNT; s = (s + 1) as Step) {
      const errs = validateStep(s, values, { moodSlugs });
      if (Object.keys(errs).length > 0) {
        setReturnToReview(true);
        goTo(s);
        failStep(s, errs);
        return;
      }
    }
    const request = { ...toRequest(values), moods: values.moods.filter((m) => moodSlugs.includes(m)) };
    const parsed = createTripRequestSchema().safeParse(request);
    if (!parsed.success) {
      applyServerFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setSubmit({ kind: "submitting" });
    track("preferences_completed", {
      duration: parsed.data.duration,
      transport: parsed.data.transportMode,
      travel_group: parsed.data.travelGroup,
      mood_count: parsed.data.moods.length,
      flexible_date: parsed.data.dateFlexible,
    });
    const result = await createTrip(parsed.data, captchaEnabled ? getCaptchaToken : undefined);
    if (result.ok) {
      router.push(`/trip/${result.tripId}`);
      return;
    }
    if (result.kind === "api" && result.error.fieldErrors && Object.keys(result.error.fieldErrors).length > 0) {
      setSubmit({ kind: "idle" });
      applyServerFieldErrors(result.error.fieldErrors);
      return;
    }
    if (result.kind === "api" && result.error.code === "LOCATION_NOT_SUPPORTED") {
      setSubmit({ kind: "idle" });
      applyServerFieldErrors({ startLocationId: "We can't plan trips from this town yet. Choose another starting town." });
      return;
    }
    setSubmit({ kind: "failed", result });
  }

  function applyServerFieldErrors(fieldErrors: Record<string, string>) {
    setServerErrors(fieldErrors);
    const first = (Object.keys(fieldErrors)
      .map((k) => fieldStep[k])
      .filter((s) => s !== undefined)
      .sort()[0] ?? 0) as Step;
    setReturnToReview(true);
    goTo(first);
    failStep(first, fieldErrors);
  }

  const isReview = step === REVIEW_STEP;
  const continueLabel = returnToReview || step === STEP_COUNT - 1 ? "Review" : "Continue";

  return (
    <div className="flex min-h-dvh flex-col">
      <WizardHeader step={step} onBack={onBack} />

      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-7">
        <div ref={stepBodyRef}>
          {suggestion && fieldStep[suggestion.field] === step ? (
            <div className="mb-5 rounded-control border border-warn-border bg-warn-bg p-3.5 text-[15px] text-warn-text">
              <p className="font-semibold">Suggestion: {suggestion.label}</p>
              <p>Nothing has been changed. Adjust the answer below if you&apos;d like to.</p>
            </div>
          ) : null}

          {step === 0 ? (
            <CatalogueGate catalogue={catalogue} retry={retry} headingRef={headingRef} title="Where are you starting from?">
              {(c) => (
                <>
                  <StepHeading headingRef={headingRef} title="Where are you starting from?" description="We'll estimate distances and travel times from this town." />
                  <LocationAutocomplete
                    towns={c.towns}
                    value={values.startLocation}
                    onChange={(loc) => update({ startLocation: loc })}
                    error={errors.startLocationId}
                    errorId="err-startLocationId"
                  />
                  <FieldError id="err-startLocationId" message={errors.startLocationId} />
                </>
              )}
            </CatalogueGate>
          ) : null}

          {step === 1 ? <DateStep values={values} errors={errors} update={update} headingRef={headingRef} /> : null}
          {step === 2 ? <BudgetStep values={values} errors={errors} update={update} headingRef={headingRef} /> : null}

          {step === 3 ? (
            <CatalogueGate catalogue={catalogue} retry={retry} headingRef={headingRef} title="What's the mood?">
              {(c) => <MoodStep moods={c.moods} values={values} errors={errors} update={update} headingRef={headingRef} />}
            </CatalogueGate>
          ) : null}

          {step === 4 ? <PreferencesStep values={values} errors={errors} update={update} headingRef={headingRef} /> : null}

          {isReview ? (
            <ReviewStep
              values={values}
              catalogue={catalogue}
              retry={retry}
              headingRef={headingRef}
              onEdit={editFromReview}
              submit={submit}
              onSuggestion={(sg) => {
                setSuggestion(sg);
                const s = fieldStep[sg.field];
                if (s !== undefined) editFromReview(s);
              }}
            />
          ) : null}
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-xl flex-col gap-2.5 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3.5">
          {step === 3 ? (
            <p className="text-sm text-muted" aria-live="polite">
              {countMoods(values, moodSlugs) === 0 ? "No moods selected" : `${countMoods(values, moodSlugs)} selected`}
            </p>
          ) : null}
          {isReview && captchaEnabled ? (
            // Security check (Cloudflare Turnstile): invisible unless Cloudflare asks for a tick.
            <div ref={captchaRef} className="flex justify-center [&:has(iframe[style*=visible])]:mb-3" />
          ) : null}
          <div className="flex gap-2.5">
            {step > 0 ? (
              <button type="button" onClick={onBack} className={`${buttonVariants.outline} flex-[0_0_104px] px-0`}>
                Back
              </button>
            ) : null}
            {isReview ? (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submit.kind === "submitting" || catalogue.status !== "ready"}
                aria-describedby="submit-note"
                className={`${buttonVariants.primary} h-[52px] flex-1 text-base disabled:cursor-wait disabled:opacity-80`}
              >
                {submit.kind === "submitting"
                  ? "Finding destinations…"
                  : catalogue.status === "loading"
                    ? "Loading…"
                    : "Find destinations"}
              </button>
            ) : (
              <button type="button" onClick={onContinue} className={`${buttonVariants.primary} h-[52px] flex-1 text-base`}>
                {continueLabel}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function countMoods(values: WizardValues, slugs: string[]) {
  return values.moods.filter((m) => slugs.includes(m)).length;
}

// ---------------------------------------------------------------------------
// Header and progress

function WizardHeader({ step, onBack }: { step: Step; onBack: () => void }) {
  const isReview = step === REVIEW_STEP;
  const now = isReview ? STEP_COUNT : step + 1;
  const label = isReview ? "Review your answers" : `Step ${step + 1} of ${STEP_COUNT}`;
  const iconButton = "flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink";

  return (
    <header className="border-b border-line bg-ground">
      <div className="mx-auto flex max-w-xl flex-col gap-3.5 px-4 pb-3.5 pt-3">
        <div className="flex h-11 items-center justify-between">
          {step === 0 ? (
            <Link href="/" aria-label="Back to home" className={iconButton}>
              <ChevronLeft />
            </Link>
          ) : (
            <button type="button" onClick={onBack} aria-label="Previous step" className={iconButton}>
              <ChevronLeft />
            </button>
          )}
          <p className="text-sm font-semibold text-muted">{label}</p>
          <Link href="/" className="flex min-h-11 items-center text-[15px] font-semibold">
            Exit
          </Link>
        </div>
        <div
          role="progressbar"
          aria-label="Wizard progress"
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={now}
          aria-valuetext={isReview ? "All 5 steps done, reviewing" : `Step ${now} of ${STEP_COUNT}: ${STEP_NAMES[step]}`}
          className="grid grid-cols-5 gap-1.5"
        >
          {STEP_NAMES.map((name, i) => (
            <span key={name} className={`h-1.5 rounded-full ${i < now ? "bg-green" : "bg-[#DAD8CF]"}`} />
          ))}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Steps

type StepProps = {
  values: WizardValues;
  errors: FieldErrors;
  update: (patch: Partial<WizardValues>) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
};

function CatalogueGate({
  catalogue,
  retry,
  headingRef,
  title,
  children,
}: {
  catalogue: Catalogue;
  retry: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
  title: string;
  children: (c: Extract<Catalogue, { status: "ready" }>) => ReactNode;
}) {
  if (catalogue.status === "ready") return <>{children(catalogue)}</>;
  if (catalogue.status === "loading") {
    return (
      <div aria-busy="true">
        <StepHeading headingRef={headingRef} title={title} />
        <p className="sr-only" role="status">Loading…</p>
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />
          <div className="h-14 animate-pulse rounded-control bg-surface-muted" />
          <div className="h-14 animate-pulse rounded-control bg-surface-muted" />
        </div>
      </div>
    );
  }
  return (
    <div>
      <StepHeading headingRef={headingRef} title={title} />
      <div role="alert" className="flex flex-col gap-3 rounded-card border border-error-border bg-error-bg p-4 text-error-text">
        <p className="font-semibold">We couldn&apos;t load this step.</p>
        <p className="text-[15px]">Check your connection and try again. Your answers so far are kept.</p>
        <button type="button" onClick={retry} className={`${buttonVariants.outline} h-12 self-start text-[15px]`}>
          Try again
        </button>
      </div>
    </div>
  );
}

function DateStep({ values, errors, update, headingRef }: StepProps) {
  const today = todayInKolkata();
  const latest = addDays(today, MAX_DAYS_AHEAD);
  const dateId = useId();

  return (
    <>
      <StepHeading headingRef={headingRef} title="When, and for how long?" />
      <div className="flex flex-col gap-7">
        <fieldset data-field="dateMode" aria-describedby={errors.dateMode ? "err-dateMode" : undefined}>
          <Legend>Travel date</Legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ChoiceCard name="dateMode" value="specific" label="A specific date" checked={values.dateMode === "specific"} onChange={() => update({ dateMode: "specific" })} />
            <ChoiceCard name="dateMode" value="flexible" label="I'm flexible" hint="Any day works" checked={values.dateMode === "flexible"} onChange={() => update({ dateMode: "flexible" })} />
          </div>
          <FieldError id="err-dateMode" message={errors.dateMode} />

          {values.dateMode === "specific" ? (
            <div className="mt-4 flex flex-col gap-2" data-field="travelDate">
              <label htmlFor={dateId} className="text-base font-semibold">
                Date
              </label>
              <input
                id={dateId}
                type="date"
                min={today}
                max={latest}
                value={values.travelDate}
                onChange={(e) => update({ travelDate: e.target.value })}
                aria-invalid={errors.travelDate ? true : undefined}
                aria-describedby={`${dateId}-hint${errors.travelDate ? " err-travelDate" : ""}`}
                className={`h-14 w-full rounded-control border-[1.5px] bg-surface px-4 text-[17px] sm:w-64 ${errors.travelDate ? "border-error-inline" : "border-line-input"}`}
              />
              <p id={`${dateId}-hint`} className="text-sm text-muted">
                With a date, we can check seasonal and access information where we have it.
              </p>
              <FieldError id="err-travelDate" message={errors.travelDate} />
            </div>
          ) : null}
        </fieldset>

        <fieldset data-field="duration" aria-describedby={errors.duration ? "err-duration" : undefined}>
          <Legend>How long do you have?</Legend>
          <div className="grid grid-cols-2 gap-2.5">
            {DURATION_CODES.map((d) => (
              <ChoiceCard key={d} name="duration" value={d} label={durationLabels[d]} checked={values.duration === d} onChange={() => update({ duration: d })} />
            ))}
          </div>
          <FieldError id="err-duration" message={errors.duration} />
        </fieldset>
      </div>
    </>
  );
}

function BudgetStep({ values, errors, update, headingRef }: StepProps) {
  const budgetId = useId();
  const minor = parseBudgetMinor(values.budgetRupees);
  const validBudget = Number.isFinite(minor) && minor > 0 && !errors.budgetPerPersonMinor;

  return (
    <>
      <StepHeading headingRef={headingRef} title="Budget and travellers" />
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5" data-field="budgetPerPersonMinor">
          <label htmlFor={budgetId} className="text-base font-semibold">
            Budget <span className="text-green-ink">per person</span>
          </label>
          <p id={`${budgetId}-hint`} className="-mt-1 text-sm text-muted">
            For the whole trip, per person: travel, entry fees and food. Costs are estimates.
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Budget presets, per person">
            {BUDGET_PRESETS.map((p) => {
              const on = minor === p * 100;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ budgetRupees: String(p) })}
                  className={`h-11 rounded-full border-[1.5px] px-4 text-[15px] font-semibold ${on ? "border-green bg-green-tint text-green-ink" : "border-line-input bg-surface"}`}
                >
                  {formatInr(p * 100)}
                </button>
              );
            })}
          </div>
          <div className="relative mt-1 sm:w-64">
            <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[17px] text-muted">
              ₹
            </span>
            <input
              id={budgetId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Or type an amount"
              value={values.budgetRupees}
              onChange={(e) => update({ budgetRupees: e.target.value })}
              aria-invalid={errors.budgetPerPersonMinor ? true : undefined}
              aria-describedby={`${budgetId}-hint${errors.budgetPerPersonMinor ? " err-budgetPerPersonMinor" : ""}`}
              className={`h-14 w-full rounded-control border-[1.5px] bg-surface pl-9 pr-4 text-[17px] ${errors.budgetPerPersonMinor ? "border-error-inline" : "border-line-input"}`}
            />
          </div>
          <FieldError id="err-budgetPerPersonMinor" message={errors.budgetPerPersonMinor} />
          {validBudget && values.travellerCount > 1 ? (
            <p className="text-sm text-muted">
              For {values.travellerCount} travellers, that&apos;s about {formatInr(minor * values.travellerCount)} in total.
            </p>
          ) : null}
        </div>

        <TravellerCounter values={values} errors={errors} update={update} />

        <fieldset data-field="travelGroup" aria-describedby={errors.travelGroup ? "err-travelGroup" : undefined}>
          <Legend>Who&apos;s travelling?</Legend>
          <div className="grid grid-cols-2 gap-2.5">
            {TRAVEL_GROUPS.map((g) => (
              <ChoiceCard key={g} name="travelGroup" value={g} label={groupLabels[g]} checked={values.travelGroup === g} onChange={() => update({ travelGroup: g })} />
            ))}
          </div>
          <FieldError id="err-travelGroup" message={errors.travelGroup} />
        </fieldset>
      </div>
    </>
  );
}

function TravellerCounter({ values, errors, update }: Omit<StepProps, "headingRef">) {
  const labelId = useId();
  const count = values.travellerCount;
  const stepper =
    "flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-line-strong bg-surface text-2xl font-semibold disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div data-field="travellerCount">
      <p id={labelId} className="mb-2.5 text-base font-semibold">
        Travellers
      </p>
      <div role="group" aria-labelledby={labelId} aria-describedby={errors.travellerCount ? "err-travellerCount" : undefined} className="flex items-center gap-4">
        <button type="button" aria-label="Fewer travellers" disabled={count <= TRAVELLERS_MIN} onClick={() => update({ travellerCount: count - 1 })} className={stepper}>
          <span aria-hidden="true">−</span>
        </button>
        <output aria-live="polite" className="min-w-16 text-center text-[17px] font-semibold">
          {count} {count === 1 ? "person" : "people"}
        </output>
        <button type="button" aria-label="More travellers" disabled={count >= TRAVELLERS_MAX} onClick={() => update({ travellerCount: count + 1 })} className={stepper}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        {TRAVELLERS_MIN} to {TRAVELLERS_MAX} people.
      </p>
      <FieldError id="err-travellerCount" message={errors.travellerCount} />
    </div>
  );
}

function MoodStep({ moods, values, errors, update, headingRef }: StepProps & { moods: Mood[] }) {
  function toggle(slug: string) {
    const on = values.moods.includes(slug);
    update({ moods: on ? values.moods.filter((m) => m !== slug) : [...values.moods, slug] });
  }
  return (
    <>
      <StepHeading headingRef={headingRef} title="What's the mood?" description="Pick at least one. Choose as many as you like." descriptionId="mood-help" />
      <fieldset data-field="moods" aria-describedby={`mood-help${errors.moods ? " err-moods" : ""}`}>
        <legend className="sr-only">Travel mood</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {moods.map((m) => {
            const on = values.moods.includes(m.slug);
            return (
              <button
                key={m.slug}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(m.slug)}
                className={`flex min-h-[92px] flex-col justify-between gap-2.5 rounded-2xl p-3.5 text-left ${on ? "border-2 border-green bg-green-tint" : "border-[1.5px] border-line-input bg-surface"}`}
              >
                <span className="flex items-center justify-between">
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={moodIcons[m.slug] ?? defaultMoodIcon} fill="none" stroke={on ? "#145239" : "#3E4742"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {on ? <CheckCircle /> : null}
                </span>
                <span className="text-base font-semibold">{m.name}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <FieldError id="err-moods" message={errors.moods} />
    </>
  );
}

function PreferencesStep({ values, errors, update, headingRef }: StepProps) {
  const overnight = isOvernight(values.duration);
  return (
    <>
      <StepHeading headingRef={headingRef} title="Any travel preferences?" description="Optional. We've filled in sensible defaults; change them if you like." />
      <div className="flex flex-col gap-7">
        <fieldset data-field="transportMode" aria-describedby={errors.transportMode ? "err-transportMode" : undefined}>
          <Legend>How will you travel?</Legend>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {TRANSPORT_MODES.map((t) => {
              const available = AVAILABLE_TRANSPORT.includes(t);
              return (
                <ChoiceCard
                  key={t}
                  name="transportMode"
                  value={t}
                  label={transportLabels[t]}
                  hint={available ? undefined : "Not available yet"}
                  disabled={!available}
                  checked={values.transportMode === t}
                  onChange={() => update({ transportMode: t })}
                />
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted">
            We don&apos;t have public transport estimates yet, so trips are planned by car or bike for now.
          </p>
          <FieldError id="err-transportMode" message={errors.transportMode} />
        </fieldset>

        {overnight ? (
          <fieldset data-field="overnightStay">
            <Legend>Staying overnight?</Legend>
            <div className="grid gap-2.5">
              <ChoiceCard name="overnightStay" value="yes" label="Yes, stay overnight" checked={values.overnightStay === true} onChange={() => update({ overnightStay: true })} />
              <ChoiceCard name="overnightStay" value="no" label="No, come back each day" checked={values.overnightStay === false} onChange={() => update({ overnightStay: false })} />
              <ChoiceCard name="overnightStay" value="none" label="No preference" checked={values.overnightStay === null} onChange={() => update({ overnightStay: null })} />
            </div>
          </fieldset>
        ) : null}

        <section aria-labelledby="access-h" className="rounded-card border border-line bg-surface p-4">
          <h2 id="access-h" className="mb-1.5 font-body text-base font-semibold">
            Accessibility needs
          </h2>
          <p className="text-[15px] leading-normal text-muted">
            We can&apos;t filter by accessibility yet because we don&apos;t have verified accessibility
            information for every destination. Each destination page shows the access details we do have.
            Check the official source before travelling.
          </p>
        </section>
      </div>
    </>
  );
}

function ReviewStep({
  values,
  catalogue,
  retry,
  headingRef,
  onEdit,
  submit,
  onSuggestion,
}: {
  values: WizardValues;
  catalogue: Catalogue;
  retry: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
  onEdit: (s: Step) => void;
  submit: SubmitState;
  onSuggestion: (s: Suggestion) => void;
}) {
  const minor = parseBudgetMinor(values.budgetRupees);
  const moods = catalogue.status === "ready" ? catalogue.moods : [];
  const moodNames = values.moods
    .map((slug) => moods.find((m) => m.slug === slug)?.name)
    .filter((n): n is string => Boolean(n));
  const overnightText =
    values.overnightStay === true ? "Staying overnight" : values.overnightStay === false ? "Coming back each day" : "No overnight preference";

  const rows: { step: Step; label: string; value: ReactNode }[] = [
    {
      step: 0,
      label: "Starting point",
      value: values.startLocation ? `${values.startLocation.name}, ${values.startLocation.district} district` : "Not chosen",
    },
    {
      step: 1,
      label: "When",
      value: (
        <>
          {values.dateMode === "flexible" ? "Flexible dates" : values.travelDate ? formatDate(values.travelDate) : "No date"}
          {" · "}
          {values.duration ? durationLabels[values.duration] : "No duration"}
        </>
      ),
    },
    {
      step: 2,
      label: "Budget and travellers",
      value: (
        <>
          {Number.isFinite(minor) ? `${formatInr(minor)} per person` : "No budget"}
          {" · "}
          {values.travellerCount} {values.travellerCount === 1 ? "traveller" : "travellers"}
          {values.travelGroup ? ` · ${groupLabels[values.travelGroup]}` : ""}
        </>
      ),
    },
    {
      step: 3,
      label: "Mood",
      value:
        catalogue.status === "loading" ? (
          <span className="text-muted">Loading moods…</span>
        ) : catalogue.status === "error" ? (
          <span className="text-muted">Couldn&apos;t load moods</span>
        ) : moodNames.length ? (
          moodNames.join(", ")
        ) : (
          "None chosen"
        ),
    },
    {
      step: 4,
      label: "Preferences",
      value: (
        <>
          {transportLabels[values.transportMode]}
          {isOvernight(values.duration) ? ` · ${overnightText}` : ""}
        </>
      ),
    },
  ];

  return (
    <>
      <StepHeading headingRef={headingRef} title="Check your answers" description="We'll shortlist three places that fit all of this." />
      <dl className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5 px-4 py-3.5">
            <dt className="text-sm font-semibold text-muted">{r.label}</dt>
            <dd className="flex items-start justify-between gap-4 text-base">
              <span className="min-w-0">{r.value}</span>
              <button
                type="button"
                onClick={() => onEdit(r.step)}
                aria-label={`Change ${r.label.toLowerCase()}`}
                className="-mt-6 flex min-h-11 flex-none items-center px-1 text-[15px] font-semibold text-green underline-offset-2 hover:underline"
              >
                Change
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p id="submit-note" className="mt-4 text-sm text-muted">
        Costs, distances and travel times are estimates. The first time you search, we start a private guest
        session in this browser so you can come back to your trip.
      </p>
      {catalogue.status === "error" ? (
        <div role="alert" className="mt-5 flex flex-col gap-3 rounded-card border border-error-border bg-error-bg p-4 text-[15px] text-error-text">
          <p>We couldn&apos;t load the mood list, so we can&apos;t search yet. Your answers are kept.</p>
          <button type="button" onClick={retry} className={`${buttonVariants.outline} h-12 self-start text-[15px]`}>
            Try again
          </button>
        </div>
      ) : null}
      <SubmitFeedback submit={submit} onSuggestion={onSuggestion} values={values} moodNames={moodNames} />
    </>
  );
}

/** Heading that takes focus and scrolls into view once, when it first appears. */
function FocusOnMountHeading({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  return (
    <h2 ref={ref} id={id} tabIndex={-1} className="text-[22px] font-bold outline-none">
      {children}
    </h2>
  );
}

function SubmitFeedback({
  submit,
  onSuggestion,
  values,
  moodNames,
}: {
  submit: SubmitState;
  onSuggestion: (s: Suggestion) => void;
  values: WizardValues;
  moodNames: string[];
}) {
  if (submit.kind !== "failed") return null;
  const r = submit.result;

  if (r.kind === "api" && r.error.code === "INSUFFICIENT_DESTINATIONS") {
    const adjustments = (r.error.details?.suggestedAdjustments ?? []) as (Suggestion & { additionalPlaces?: number })[];
    const minor = parseBudgetMinor(values.budgetRupees);
    const parts = [
      values.duration ? durationLabels[values.duration] : null,
      Number.isFinite(minor) ? `${formatInr(minor)} per person` : null,
      moodNames.length ? moodNames.join(" and ").toLowerCase() : null,
    ].filter((p): p is string => Boolean(p));
    const together = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    return (
      <section role="alert" aria-labelledby="insufficient-h" className="mt-5 flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
        <FocusOnMountHeading id="insufficient-h">
          {(r.error.message || "Fewer than three places fit all of that").replace(/\.$/, "")}
        </FocusOnMountHeading>
        <p className="text-[15px] leading-normal text-ink-soft">
          {together ? `${together.charAt(0).toUpperCase()}${together.slice(1)} don't overlap much` : "Your choices don't overlap much"}
          {values.startLocation ? ` near ${values.startLocation.name}` : ""}.{" "}
          {adjustments.length
            ? "Loosening one of these usually helps:"
            : "We tried changing one answer at a time and none of them added places. Try another starting town, or change more than one answer."}
        </p>
        {adjustments.length ? (
          <ul className="flex flex-col gap-2">
            {adjustments.map((a) => (
              <li key={`${a.field}-${a.label}`}>
                <button
                  type="button"
                  onClick={() => onSuggestion({ field: a.field, label: a.label })}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-[1.5px] border-line-input px-3.5 text-left font-medium"
                >
                  {a.label}
                  {a.additionalPlaces ? (
                    <span className="flex-none text-sm font-semibold text-green-ink">
                      +{a.additionalPlaces} {a.additionalPlaces === 1 ? "place" : "places"}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-muted">We won&apos;t change your choices without asking.</p>
      </section>
    );
  }

  const message =
    r.kind === "network"
      ? "You seem to be offline, or the connection dropped. Your answers are kept. Try again when you're connected."
      : r.kind === "captcha"
        ? "We couldn't confirm this browser with a quick security check. If a check box appeared above the button, tick it, then try again."
        : r.kind === "auth"
          ? "We couldn't start a guest session. Wait a moment and try again."
        : r.kind === "api" && r.error.code === "RATE_LIMITED"
          ? "Too many searches in a short time. Wait a minute and try again."
          : "We couldn't reach the trip planner just now. Your answers are kept. Try again in a moment.";

  return (
    <div role="alert" className="mt-5 rounded-card border border-error-border bg-error-bg p-4 text-[15px] text-error-text">
      <p className="font-semibold">Search didn&apos;t go through</p>
      <p>{message}</p>
      {r.kind === "api" && r.error.requestId ? <p className="mt-1 text-sm">Reference: {r.error.requestId}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function WizardSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true">
      <div className="border-b border-line bg-ground">
        <div className="mx-auto flex max-w-xl flex-col gap-3.5 px-4 pb-3.5 pt-3">
          <div className="h-11" />
          <div className="h-1.5 rounded-full bg-[#DAD8CF]" />
        </div>
      </div>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pt-7">
        <p className="sr-only" role="status">Loading the trip planner…</p>
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="h-9 w-3/4 animate-pulse rounded bg-surface-muted" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-surface-muted" />
          <div className="mt-4 h-14 animate-pulse rounded-control bg-surface-muted" />
        </div>
      </main>
    </div>
  );
}
