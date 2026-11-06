import { formatDate } from "@/lib/format";

export type FreshnessStatus = "verified" | "review_due" | "unavailable";

/** Verified = green check; review due = amber warning; unavailable = neutral (BUILD_BRIEF §5). */
export function DataFreshnessLabel({
  status,
  lastVerifiedAt,
  prefix = "Last verified",
}: {
  status: FreshnessStatus;
  lastVerifiedAt?: string | null;
  prefix?: string;
}) {
  if (status === "verified" && lastVerifiedAt) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        <CheckIcon />
        {prefix} {formatDate(lastVerifiedAt)}
      </p>
    );
  }

  if (status === "review_due") {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-warn-label">
        <WarnIcon />
        Access check due
        {lastVerifiedAt ? ` — last verified ${formatDate(lastVerifiedAt)}` : ""}
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-[13px] text-muted">
      Access information unavailable. Check the official source before travelling.
    </p>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="flex-none">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="#1D6A4C" strokeWidth="1.5" />
      <path
        d="M4.6 7.1l1.6 1.6 3.2-3.3"
        fill="none"
        stroke="#1D6A4C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WarnIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="flex-none">
      <path d="M7 1.5l6 10.5H1z" fill="none" stroke="#8A6100" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 5.5v3M7 10.2v.1" stroke="#8A6100" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
