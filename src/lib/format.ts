const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const istParts = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Kolkata",
});

/**
 * "2026-10-28" or a timestamp → "28 Oct 2026", as a calendar date in Asia/Kolkata.
 * Month names are fixed (ICU versions differ, e.g. "Sep" vs "Sept").
 */
export function formatDate(isoDate: string): string {
  const [y, m, d] = /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? isoDate.split("-")
    : istParts.format(new Date(isoDate)).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Paise → "₹1,850". */
export function formatInr(minor: number): string {
  return inrFormatter.format(minor / 100);
}

/** 240 → "4 h", 150 → "2 h 30 min", 45 → "45 min". Rounded to 5 minutes (it's an estimate). */
export function formatDuration(minutes: number): string {
  const m = Math.max(5, Math.round(minutes / 5) * 5);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

type MoneyLike = { amountMinor: number | null; minMinor: number | null; maxMinor: number | null };

/** A single estimate → "₹1,850"; a range → "₹1,200–₹1,850". */
export function formatMoney(m: MoneyLike): string {
  if (m.amountMinor !== null) return formatInr(m.amountMinor);
  if (m.minMinor !== null && m.maxMinor !== null) return `${formatInr(m.minMinor)}–${formatInr(m.maxMinor)}`;
  return "Cost info missing";
}

/** "2026-11-14" → "Sat 14 Nov". */
export function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  return `${day} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "07:05:00" or "07:05" → "7:05 AM" (local time, Asia/Kolkata). */
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** [10, 11, 12, 1, 2] → "October to February"; non-contiguous lists are listed. */
export function formatMonths(months: number[]): string {
  if (months.length === 0) return "";
  if (months.length === 12) return "All year";
  const set = new Set(months);
  // Find a start month whose previous month isn't in the set, then walk forward.
  const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1));
  if (start !== undefined) {
    let len = 1;
    let m = start;
    while (set.has(m === 12 ? 1 : m + 1) && len < 12) {
      m = m === 12 ? 1 : m + 1;
      len++;
    }
    if (len === set.size) return len === 1 ? MONTH_NAMES[start - 1] : `${MONTH_NAMES[start - 1]} to ${MONTH_NAMES[m - 1]}`;
  }
  return [...set].sort((a, b) => a - b).map((x) => MONTH_NAMES[x - 1]).join(", ");
}
