import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectAccessible, supabase, visibleH1 } from "./helpers";

/**
 * Admin, signed in (BUILD_BRIEF §10 step 9). Needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in
 * .env.local for an account with the `admin` role; skipped otherwise.
 * Creates one throwaway draft ("Zz E2E …"), never publishes it, and deletes it at the end.
 * The audit log keeps its entries, by design.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.use({ viewport: { width: 1280, height: 900 }, hasTouch: false });

async function deleteDestination(request: APIRequestContext, id: string) {
  const headers = { apikey: supabase.key, "Content-Type": "application/json" };
  const session = await (
    await request.post(`${supabase.url}/auth/v1/token?grant_type=password`, { headers, data: { email, password } })
  ).json();
  const res = await request.delete(`${supabase.url}/rest/v1/destinations?id=eq.${id}`, {
    headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: "return=representation" },
  });
  expect(res.status(), "test draft deleted").toBe(200);
  expect(await res.json()).toHaveLength(1);
}

test("admin: sign in, search, create, edit, preview, publish checks, archive, audit", async ({ page, request }) => {
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local");

  const stamp = Date.now().toString(36);
  const name = `Zz E2E ${stamp}`;
  const slug = `zz-e2e-${stamp}`;
  let createdId: string | null = null;

  try {
    // --- Sign in -----------------------------------------------------------------------------
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(visibleH1(page)).toHaveText("Destinations");
    await expect(page.getByText(`${email} · admin`)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, "/admin");

    // --- Search ------------------------------------------------------------------------------
    await page.getByLabel("Search").fill("munnar");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.waitForURL(/q=munnar/);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Munnar");

    const details = page.locator("form").filter({ has: page.getByRole("heading", { name: "Details", exact: true }) });

    // --- Create a draft ----------------------------------------------------------------------
    await page.getByRole("link", { name: "New destination" }).click();
    await expect(visibleH1(page)).toHaveText("New destination");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("Name is required.")).toBeVisible(); // validation shown in text
    await expect(details.getByLabel("Name", { exact: true })).toBeFocused();

    await details.getByLabel("Name", { exact: true }).fill(name);
    await details.getByLabel("Slug").fill(slug);
    await details.getByLabel("District").selectOption({ label: "Idukki" });
    await details.getByLabel("Type", { exact: true }).fill("Test place");
    await details.getByLabel("Short description").fill("Automated test draft. Safe to delete.");
    await details.getByLabel("Latitude").fill("10.0");
    await details.getByLabel("Longitude").fill("77.0");
    await details.getByRole("checkbox", { name: "One day" }).check();
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.waitForURL(/\/admin\/destinations\/[0-9a-f-]{36}$/);
    createdId = page.url().split("/").pop()!;
    await expect(visibleH1(page)).toHaveText(name);
    await expect(page.getByRole("heading", { name: "Status: draft" })).toBeVisible();

    // --- Edit --------------------------------------------------------------------------------
    await details.getByLabel("Type", { exact: true }).fill("Test viewpoint");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Details saved.")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, "/admin/destinations/[id]");

    // --- Preview -----------------------------------------------------------------------------
    await page.getByRole("link", { name: "Preview", exact: true }).click();
    await page.waitForURL(/\/preview$/);
    await expect(visibleH1(page)).toHaveText(name);
    await expect(page.getByText("Test viewpoint").first()).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Status: draft" })).toBeVisible();

    // --- Publish is refused, with the missing requirements listed -----------------------------
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Not published yet. Fix the items below.")).toBeVisible();
    const failures = page.getByRole("alert").filter({ has: page.locator("li") });
    expect(await failures.locator("li").count()).toBeGreaterThan(1);
    await expect(page.getByRole("heading", { name: "Status: draft" })).toBeVisible();

    // --- Archive -----------------------------------------------------------------------------
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Status changed to archived.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status: archived" })).toBeVisible();

    // --- Audit log ---------------------------------------------------------------------------
    await page.getByRole("link", { name: "Audit log" }).click();
    await expect(visibleH1(page)).toHaveText("Audit log");
    await expect(page.getByText(`insert destinations: ${name}`)).toBeVisible();
    await expect(page.getByText(`update destinations: ${name}`).first()).toBeVisible();
    await expect(page.getByText(`archive destinations: ${name}`)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, "/admin/audit");

    // --- Sign out ----------------------------------------------------------------------------
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/admin\/login$/);
    await page.goto("/admin");
    await page.waitForURL(/\/admin\/login$/);
  } finally {
    if (createdId) await deleteDestination(request, createdId);
  }
});
