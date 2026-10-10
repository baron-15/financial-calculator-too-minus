import { expect, test, type Page } from "@playwright/test";

/** A calculator key by its accessible name (KeySpec.aria). */
const key = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
/** The LCD as one line of text (lcdText), from the visually hidden live region. */
const lcd = (page: Page) => page.getByTestId("lcd-text");

async function press(page: Page, ...names: string[]) {
  for (const name of names) await key(page, name).click();
}

test.beforeEach(async ({ page }) => {
  // Each test gets a fresh browser context, so localStorage starts empty.
  await page.goto("/");
  await expect(lcd(page)).toHaveText("0.00");
});

test("clicking 2 + 3 = shows 5.00", async ({ page }) => {
  await press(page, "2", "Add", "3", "Equals");
  await expect(lcd(page)).toHaveText("5.00");
  await expect(page.getByTestId("lcd-value")).toHaveAttribute("data-value", "5.00");
});

test("typing on the physical keyboard works", async ({ page }) => {
  await page.keyboard.type("12*3");
  await page.keyboard.press("Enter");
  await expect(lcd(page)).toHaveText("36.00");

  await page.keyboard.press("Escape");
  await expect(lcd(page)).toHaveText("0.00");

  await page.keyboard.type("123");
  await page.keyboard.press("Backspace");
  await expect(lcd(page)).toHaveText("12");

  await page.keyboard.press("Escape");
  await page.keyboard.type("7-2=");
  await expect(lcd(page)).toHaveText("5.00");
});

test("Enter still works after clicking a key with the mouse", async ({ page }) => {
  // The clicked key keeps focus; Enter must mean "=", not "press 3 again".
  await press(page, "2", "Add", "3");
  await page.keyboard.press("Enter");
  await expect(lcd(page)).toHaveText("5.00");
});

test("2ND toggles its annunciator (on screen and with a lone Shift tap)", async ({ page }) => {
  const ann = page.getByTestId("ann-second");
  await expect(ann).toHaveAttribute("data-on", "false");
  await press(page, "Second function");
  await expect(ann).toHaveAttribute("data-on", "true");
  await expect(key(page, "Second function")).toHaveAttribute("aria-pressed", "true");
  await press(page, "Second function");
  await expect(ann).toHaveAttribute("data-on", "false");

  await page.keyboard.press("Shift");
  await expect(ann).toHaveAttribute("data-on", "true");
  await page.keyboard.press("Shift");
  await expect(ann).toHaveAttribute("data-on", "false");

  // Shift used to type "*" is not a 2ND tap.
  await page.keyboard.type("4*");
  await expect(ann).toHaveAttribute("data-on", "false");
});

test("state persists across a reload (continuous memory)", async ({ page }) => {
  await press(page, "4", "2", "Store", "1");
  await page.waitForTimeout(400); // past the save debounce
  await page.reload();
  await expect(lcd(page)).toHaveText("42.00"); // the display value is restored too
  await press(page, "Clear entry / clear", "Clear entry / clear");
  await expect(lcd(page)).toHaveText("0.00");
  await press(page, "Recall", "1");
  await expect(lcd(page)).toHaveText("42.00");
});

test("state is saved on pagehide even before the debounce fires", async ({ page }) => {
  await press(page, "7", "Store", "2");
  await page.reload();
  await press(page, "Clear entry / clear", "Recall", "2");
  await expect(lcd(page)).toHaveText("7.00");
});

test("the tape shows 2ND functions by their gold names", async ({ page, isMobile }) => {
  if (isMobile) await page.getByRole("tab", { name: "Tape" }).click();
  await press(page, "Second function", "FV, future value", "1", "0", "N, number of periods");
  const tape = page.getByTestId("tape");
  await expect(tape).toContainText("CLR TVM");
  await expect(tape).not.toContainText("2ND");
  await expect(tape.locator(".tape-token.is-second")).toHaveText("CLR TVM");
});

test("hovering a key explains it and its 2ND function", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover tips are for pointer devices; touch uses long-press");
  await key(page, "PV, present value").hover();
  const tip = page.getByTestId("key-tip");
  // Not aggressive: a brief hover (passing over the keypad) does not open it.
  await page.waitForTimeout(700);
  await expect(tip).toBeHidden();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Present value");
  await expect(tip).toContainText("AMORT");
});

test("opening a worksheet highlights its panel", async ({ page, isMobile }) => {
  await press(page, "Cash flow worksheet");
  await expect(lcd(page)).toHaveText(/^CFo= /);
  await expect(page.getByTestId("panel-cf")).toHaveAttribute("data-active", "true");
  if (isMobile) await expect(page.getByRole("tab", { name: /Cash flow/ })).toHaveAttribute("aria-selected", "true");
  await press(page, "Second function", "Compute");
  await expect(page.getByTestId("panel-cf")).toHaveAttribute("data-active", "false");
});

test("theme toggle switches data-theme and is remembered", async ({ page }) => {
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  const toggle = page.getByRole("button", { name: /Switch to (dark|light) theme/ });
  await toggle.click();
  const after = await html.getAttribute("data-theme");
  expect(after).not.toBe(before);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", after!);
});

test("no horizontal overflow at 360px, on every panel tab", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.reload();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  // Keys stay at least 44px tall at this width.
  const box = await key(page, "5").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  const tabs = page.getByRole("tab");
  const n = await tabs.count();
  expect(n).toBeGreaterThan(5);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    expect(await overflow()).toBeLessThanOrEqual(0);
  }
});
