import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, visibleH1 } from "./helpers";

/**
 * The usability tasks (BUILD_BRIEF §10, TEST_PLAN §12), as one journey on a real trip:
 * 1. find a one-day trip under budget, 2. understand each recommendation, 3. spin and identify
 * the result, 4. find the total cost and what it includes, 5. check access verification,
 * 6. share the trip. Creates one guest and one trip; the share link is turned off at the end.
 */
const rupees = (s: string) => Number(s.replace(/[^\d]/g, ""));

test("usability tasks, end to end", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const cont = () => page.getByRole("button", { name: /^(Continue|Review)$/ }).click();

  // --- Task 1: a one-day trip under ₹2,000 per person -------------------------------------
  await page.goto("/plan");
  await page.getByRole("combobox").fill("kochi");
  await page.getByRole("option", { name: /Kochi/ }).click();
  await cont();
  await page.getByText("I'm flexible", { exact: true }).click();
  await page.getByText("One day", { exact: true }).click();
  await cont();
  await page.getByRole("button", { name: "₹2,000" }).click();
  await page.getByText("Friends", { exact: true }).click();
  await cont();
  await page.getByRole("button", { name: "Nature" }).click();
  await page.getByRole("button", { name: "Relaxation" }).click();
  await cont();
  await cont();
  await expect(visibleH1(page)).toHaveText("Check your answers");
  await expectAccessible(page, "/plan review");
  await page.getByRole("button", { name: "Find destinations" }).click();
  await page.waitForURL(/\/trip\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const tripUrl = page.url();

  await expect(visibleH1(page)).toHaveText("Your three matches");
  const cards = page.locator("article:visible");
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    const est = await card.locator("dt", { hasText: "Est. per person" }).locator("xpath=following-sibling::dd").innerText();
    const upper = rupees(est.split("–").pop()!);
    expect(upper, `estimate ${est} within budget`).toBeLessThanOrEqual(2000);
  }
  await page.waitForLoadState("networkidle");
  await expectAccessible(page, "/trip/[id]");
  await expectNoHorizontalScroll(page);

  // --- Task 2: understand each recommendation ----------------------------------------------
  for (const card of await cards.all()) {
    await expect(card.getByText("Why it matches")).toBeVisible();
    await expect(card.getByText("Road distance")).toBeVisible();
    await expect(card.getByText("Travel time")).toBeVisible();
    await expect(card.getByText(/Access last verified/)).toBeVisible();
  }
  expect(await page.locator("main:visible").innerText()).not.toMatch(/score|%\s*match/i);

  // --- Task 3: spin and identify the result -------------------------------------------------
  await page.getByRole("link", { name: "Spin to choose" }).click();
  await page.waitForURL(/\/roulette$/);
  await expect(page.getByRole("button", { name: "Spin", exact: true })).toBeVisible();
  await expectAccessible(page, "/trip/[id]/roulette");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  const announcement = page.locator("[aria-live=polite]:visible").filter({ hasText: /^The wheel chose .+\.$/ });
  await expect(announcement).toBeVisible({ timeout: 20_000 });
  const winner = (await announcement.innerText()).replace("The wheel chose ", "").replace(/\.$/, "");
  await expect(page.getByText(/Result saved to this trip · ID TR-[0-9A-Z]{6}/)).toBeVisible();
  await expectAccessible(page, "/trip/[id]/roulette (result)");
  await page.reload();
  await expect(page.getByText(/Result saved to this trip/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Spin", exact: true })).toHaveCount(0);

  // --- Task 4: the total cost and what it includes ----------------------------------------
  await page.getByRole("link", { name: `See ${winner} details` }).click();
  await page.waitForURL(/\/destination$/);
  await expect(visibleH1(page)).toHaveText(winner);
  await expect(page.getByRole("rowheader", { name: "Total estimate" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /Fuel \(shared\)/ })).toBeVisible();
  await expect(page.getByText(/^Not included:/)).toBeVisible();
  await expect(page.getByText("A suggestion, not a booking.").first()).toBeVisible();

  // --- Task 5: check access verification ---------------------------------------------------
  const access = page.locator("section[aria-labelledby=access-h]");
  await expect(access.getByText(/Last verified \d{1,2} \w{3} \d{4}/).first()).toBeVisible();
  await expect(page.getByText("Check the official source before travelling.").first()).toBeVisible();

  // --- Change the departure time (generate-itinerary) ---------------------------------------
  const plan = page.locator("section[aria-labelledby=plan-h]");
  const leaveAt = plan.getByLabel("Leave at");
  const next = (await leaveAt.inputValue()) === "08:00" ? "08:30" : "08:00";
  const label = next === "08:00" ? "8:00 AM" : "8:30 AM";
  await leaveAt.selectOption(next);
  await plan.getByRole("button", { name: "Update plan" }).click();
  await expect(plan.getByText(`Plan updated: leaving at ${label}.`)).toBeVisible({ timeout: 20_000 });
  await expect(plan.locator("ol > li").first()).toContainText(label);
  await expect(plan.getByRole("button", { name: "Update plan" })).toBeDisabled();

  await page.waitForLoadState("networkidle");
  await expectAccessible(page, "/trip/[id]/destination");
  await expectNoHorizontalScroll(page);

  // --- Task 6: share the trip ---------------------------------------------------------------
  await page.getByRole("button", { name: "Share trip" }).click();
  const dialog = page.getByRole("dialog", { name: "Share this trip" });
  const linkInput = dialog.getByLabel("Trip link");
  await expect(linkInput).toBeVisible({ timeout: 20_000 });
  const url = await linkInput.inputValue();
  expect(url).toMatch(/\/shared\/[A-Za-z0-9_-]{43}$/);
  await expectAccessible(page, "share dialog");

  const viewer = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await viewer.goto(url);
  await expect(viewer.locator("h1")).toHaveText(winner);
  await expect(viewer.getByText("Shared trip plan, not a booking.")).toBeVisible();
  expect(await viewer.content()).not.toContain(tripUrl.split("/").pop()!);
  await viewer.waitForLoadState("networkidle");
  await expectAccessible(viewer, "/shared/[token]");

  // Clean up: turn the link off, and confirm it now shows the expired state.
  await dialog.getByRole("button", { name: "Turn off this link" }).click();
  await expect(dialog.getByText("This link is off.")).toBeVisible({ timeout: 20_000 });
  await viewer.goto(url);
  await expect(viewer.getByRole("heading", { name: "This trip link has expired" })).toBeVisible();
});
