export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="none" stroke="#1D6A4C" strokeWidth="2.5" />
      <path
        d="M14 2v12l10.4 6"
        fill="none"
        stroke="#B9461B"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandName() {
  return (
    <span className="font-display text-[19px] font-bold tracking-[-0.01em] text-ink">
      Trip Roulette <span className="text-green">Kerala</span>
    </span>
  );
}
