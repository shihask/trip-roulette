import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** axe with WCAG 2.0/2.1/2.2 A and AA rules. Fails with a readable list of violations. */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const violations = results.violations.map(
    (v) => `${v.id} [${v.impact}] ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`,
  );
  expect(violations, `accessibility violations on ${label}`).toEqual([]);
}

/** No horizontal scrolling at the current width. */
export async function expectNoHorizontalScroll(page: Page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fits, "page scrolls horizontally").toBe(true);
}

/** Next keeps recently visited pages mounted but hidden; only look at the visible one. */
export const visibleH1 = (page: Page) => page.locator("h1:visible").first();

export const supabase = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
};
