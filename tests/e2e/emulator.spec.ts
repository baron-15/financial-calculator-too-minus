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

test("the tape shows 2ND functions by their gold names", async ({ page }) => {
  await press(page, "Second function", "FV, future value", "1", "0", "N, number of periods");
  const tape = page.getByTestId("tape");
  await expect(tape).toContainText("CLR TVM");
  await expect(tape).not.toContainText("2ND");
  await expect(tape.locator(".tape-token.is-second")).toHaveText("CLR TVM");
});

test("hovering a key explains it and its 2ND function", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover tips are for pointer devices; touch uses long-press");
  const tip = page.getByTestId("key-tip");
  const tipsSwitch = page.locator("header").getByRole("switch", { name: "Key tips" });
  // Off by default: hovering shows nothing.
  await expect(tipsSwitch).toHaveAttribute("aria-checked", "false");
  await key(page, "PV, present value").hover();
  await page.waitForTimeout(700);
  await expect(tip).toBeHidden();
  // Turn the switch on (in the page header): the tip opens after the short hover delay.
  await page.mouse.move(0, 0);
  await tipsSwitch.click();
  await expect(tipsSwitch).toHaveAttribute("aria-checked", "true");
  await key(page, "PV, present value").hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Present value");
  await expect(tip).toContainText("AMORT");
  // Remembered in this browser.
  await page.reload();
  await expect(page.getByRole("switch", { name: "Key tips" })).toHaveAttribute("aria-checked", "true");
});

test("opening a worksheet shows and highlights its block", async ({ page }) => {
  await press(page, "Cash flow worksheet");
  await expect(lcd(page)).toHaveText(/^CFo= /);
  await expect(page.getByTestId("panel-cf")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("feature-tab-cf")).toHaveAttribute("aria-selected", "true");
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

test("no horizontal overflow at 360px, with every feature block and in Calculator only", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.reload();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  // Keys stay at least 44px tall at this width.
  const box = await key(page, "5").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  for (const feature of ["tvm", "cf", "stats", "bond", "worksheet"]) {
    await page.getByTestId(`feature-tab-${feature}`).click();
    await expect(page.getByTestId("feature-block")).toHaveAttribute("data-feature", feature);
    expect(await overflow(), feature).toBeLessThanOrEqual(0);
  }
  // A full cash-flow table and the amortization schedule still fit.
  await page.getByTestId("feature-tab-cf").click();
  await page.getByTestId("cf-example").click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByTestId("feature-tab-tvm").click();
  await page.getByTestId("tvm-example").selectOption("mortgage");
  await page.getByTestId("tvm-tab-amort").click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("switch", { name: "Calculator only" }).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("on a phone the whole calculator is on screen when the page opens", async ({ page }) => {
  // A Pixel 7 and an iPhone 14 with their browser bars showing, and a small Android phone.
  for (const [width, height] of [[412, 747], [390, 664], [360, 640]] as const) {
    await page.setViewportSize({ width, height });
    await page.reload();
    const box = (await page.getByTestId("device").boundingBox())!;
    expect(box.y + box.height, `${width}×${height}`).toBeLessThanOrEqual(height);
  }
  // On a very short screen it stops shrinking at 240 px wide (the page scrolls), and every key stays a
  // 24 px target at least (WCAG 2.5.8).
  await page.setViewportSize({ width: 375, height: 553 });
  await page.reload();
  expect((await page.getByTestId("device").boundingBox())!.width).toBeCloseTo(240, 0);
  for (const button of await page.getByRole("group", { name: "Keypad" }).getByRole("button").all()) {
    const box = (await button.boundingBox())!;
    expect(Math.min(box.width, box.height), (await button.getAttribute("aria-label")) ?? "").toBeGreaterThanOrEqual(24);
  }
});
