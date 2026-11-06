import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, visibleH1 } from "./helpers";

/** Routes that need no trip or account. No data is created. */
const routes = [
  { path: "/", h1: /Let Kerala surprise you/ },
  { path: "/explore", h1: "Explore Kerala" },
  { path: "/plan", h1: "Where are you starting from?" },
  { path: "/saved", h1: "Saved trips" },
  { path: "/offline", h1: "You're offline" },
  { path: "/how-it-works", h1: "How it works" },
  { path: "/about", h1: "About Trip Roulette Kerala" },
  { path: "/contact", h1: "Contact" },
  { path: "/privacy", h1: "Privacy" },
  { path: "/terms", h1: "Terms of use" },
  { path: "/destinations/munnar", h1: "Munnar" },
  { path: "/destinations/athirappilly", h1: "Athirappilly" },
  { path: "/shared/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", h1: "This trip link has expired" },
  { path: "/admin/login", h1: "Sign in to admin" },
  { path: "/no-such-page", h1: "This page isn't here yet" },
];

for (const r of routes) {
  test(`accessible, no sideways scroll at 360px: ${r.path}`, async ({ page }) => {
    const cspViolations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text());
    });
    await page.goto(r.path);
    await expect(visibleH1(page)).toHaveText(r.h1);
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, r.path);
    await page.setViewportSize({ width: 360, height: 740 });
    await expectNoHorizontalScroll(page);
    expect(cspViolations, "nothing blocked by the Content Security Policy").toEqual([]);
  });
}

test("security headers are sent", async ({ request }) => {
  const h = (await request.get("/")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["content-security-policy"]).not.toContain("unsafe-eval");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
  // Shared links keep their stricter referrer rule.
  const shared = (await request.get("/shared/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).headers();
  expect(shared["referrer-policy"]).toBe("no-referrer");
  expect(shared["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("homepage: Start Your Trip is visible on first load on a phone", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Start Your Trip" }).first();
  await expect(cta).toBeInViewport();
});

test("never uses banned wording", async ({ page }) => {
  for (const path of ["/", "/explore", "/destinations/munnar"]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    for (const banned of ["Guaranteed open", "Exact cost", "Definitely safe", "Best destination"]) {
      expect(text, `${banned} on ${path}`).not.toContain(banned);
    }
  }
});

test("stale essential access: browsable with 'Access check due', and the label is on Explore", async ({ page }) => {
  await page.goto("/destinations/athirappilly");
  await expect(page.getByText(/Access check due/).first()).toBeVisible();
  await page.goto("/explore");
  await expect(page.getByText(/Access check due/).first()).toBeVisible();
});

test("admin pages send signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("revalidate endpoint refuses callers without the secret or an editor session", async ({ request }) => {
  const res = await request.post("/api/revalidate", { data: { slug: "munnar" } });
  expect(res.status()).toBe(403);
});

test("wizard: keyboard only, validation in text, focus moves to each step heading", async ({ page }) => {
  await page.goto("/plan");
  await page.getByRole("combobox").waitFor();
  await page.keyboard.press("Tab"); // first focusable after load
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Choose a starting town from the list.")).toBeVisible();
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.type("kochi");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "When, and for how long?" })).toBeFocused();
});
