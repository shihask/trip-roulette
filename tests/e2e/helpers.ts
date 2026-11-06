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

/**
 * Body field Supabase Auth expects when CAPTCHA is on: a fresh Turnstile token, obtained by
 * rendering a widget on one of the site's own pages (Turnstile only works on its allowed hostnames).
 * Empty object when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set (CAPTCHA off).
 */
export async function captchaFields(page: Page): Promise<Record<string, unknown>> {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!sitekey) return {};
  await page.goto("/offline");
  const token = await page.evaluate(
    (key) =>
      new Promise<string>((resolve, reject) => {
        const w = window as unknown as { turnstile?: { render(el: HTMLElement, o: object): string } };
        const render = () => {
          const el = document.createElement("div");
          document.body.appendChild(el);
          w.turnstile!.render(el, { sitekey: key, callback: resolve, "error-callback": () => reject(new Error("Turnstile error")) });
        };
        if (w.turnstile) return render();
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.onload = render;
        s.onerror = () => reject(new Error("Turnstile script failed"));
        document.head.appendChild(s);
      }),
    sitekey,
  );
  return { gotrue_meta_security: { captcha_token: token } };
}

/**
 * Turnstile refuses headless browsers (error 600010), so tests that sign in run in a visible
 * Chrome window when the site key is set. Use with `test.use(captchaBrowser)`.
 */
export const captchaBrowser = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  ? { headless: false, launchOptions: { args: ["--disable-blink-features=AutomationControlled"] } }
  : {};
