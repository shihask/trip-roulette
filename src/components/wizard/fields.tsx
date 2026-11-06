import type { ReactNode, Ref } from "react";

/** Inline error: icon plus text (never colour alone). */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-[15px] font-medium text-error-inline">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="mt-0.5 flex-none">
        <circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 5.2v4.4M9 12.4v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>
        <span className="sr-only">Error: </span>
        {message}
      </span>
    </p>
  );
}

export function StepHeading({
  headingRef,
  title,
  description,
  descriptionId,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  title: string;
  description?: ReactNode;
  descriptionId?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[30px] font-bold leading-[1.1] tracking-[-0.01em] outline-none focus-visible:outline-none sm:text-[34px]"
      >
        {title}
      </h1>
      {description ? (
        <p id={descriptionId} className="text-base leading-[1.45] text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Visible legend styled as a field label. */
export function Legend({ children }: { children: ReactNode }) {
  return <legend className="mb-2.5 text-base font-semibold">{children}</legend>;
}

const cardBase =
  "relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-line-input bg-surface px-4 py-3 text-base font-semibold " +
  "has-checked:border-2 has-checked:border-green has-checked:bg-green-tint has-checked:text-green-ink " +
  "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-green " +
  "has-disabled:cursor-not-allowed has-disabled:border-dashed has-disabled:bg-ground has-disabled:text-muted";

/** A native radio rendered as a card. Group it in a <fieldset>. */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
  disabled,
  describedBy,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <label className={cardBase}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-describedby={describedBy}
        className="sr-only"
      />
      <span aria-hidden="true" className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${checked ? "border-green" : "border-line-strong"}`}>
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-green" /> : null}
      </span>
      <span className="flex flex-col">
        <span>{label}</span>
        {hint ? <span className="text-sm font-normal text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function CheckCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#1D6A4C" />
      <path d="M6 10.2l2.6 2.6L14 7.4" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mood icons from the design handoff, keyed by category slug. */
export const moodIcons: Record<string, string> = {
  nature: "M12 3l7 11H5zM12 14v7M8 21h8",
  beach: "M3 18c2 0 2-1.5 4.5-1.5S9.5 18 12 18s2.5-1.5 4.5-1.5S19 18 21 18M7 13a5 5 0 0110 0M12 4v3",
  adventure: "M3 20l6-11 4 6 3-4 5 9z",
  culture: "M4 20h16M6 20v-8M10 20v-8M14 20v-8M18 20v-8M3 12h18L12 4z",
  relaxation: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  wildlife:
    "M5 9a2 2 0 104 0 2 2 0 00-4 0zM15 9a2 2 0 104 0 2 2 0 00-4 0zM8 4.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM13 4.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM12 13c-3 0-5 3-5 5.5 0 1.5 1.5 2 2.5 1.5S11 19 12 19s1.5.5 2.5 1 2.5 0 2.5-1.5C17 16 15 13 12 13z",
  food: "M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 21V3c-2 1-3.5 3-3.5 7h3.5",
};
/** Fallback for a category added later without an icon. */
export const defaultMoodIcon = "M12 4a8 8 0 100 16 8 8 0 000-16z";
