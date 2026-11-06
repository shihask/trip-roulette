/** Formatting shared by the functions (server-written text such as warnings and reasons). */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Paise → "₹1,850" (Indian digit grouping, no decimals). */
export function formatInr(minor: number): string {
  const rupees = Math.round(minor / 100);
  const s = String(Math.abs(rupees));
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rupees < 0 ? "-" : ""}₹${rest ? `${rest},${last3}` : last3}`;
}

/** "2026-10-28" or a timestamp → "28 Oct 2026" (calendar date in Asia/Kolkata). */
export function formatDate(value: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
