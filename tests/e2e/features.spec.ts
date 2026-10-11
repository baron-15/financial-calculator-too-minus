/**
 * The calculator page's feature block (the former TVM and Cash Flow tools, now read-only views of the
 * calculator's registers: values are keyed in on the calculator), the header switches and the old tool URLs. The explainer API is always mocked; its specs run on the VITE_AI_EXPLAINER=on server
 * (tests/e2e/ai.ts).
 */
import { expect, test, type Page } from "@playwright/test";
import { AI_BASE_URL, AI_SKIP_REASON } from "./ai";
import { freshEmulator, key, lcd, run } from "./calc";

const block = (page: Page) => page.getByTestId("feature-block");
const expectFeature = (page: Page, feature: string) => expect(block(page)).toHaveAttribute("data-feature", feature);
const tab = (page: Page, feature: string) => page.getByTestId(`feature-tab-${feature}`);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/explain", (route) => route.fulfill({ status: 599, body: "explainer is mocked in tests" }));
  await freshEmulator(page);
});

test.describe("smart switching", () => {
  test("starts with a placeholder, then follows the keys", async ({ page }) => {
    await expectFeature(page, "none");
    await expect(page.getByTestId("feature-placeholder")).toContainText("Press a TVM key, CF, NPV, IRR, 2ND DATA, 2ND BOND");
    await run(page, "5 PV");
    await expectFeature(page, "tvm");
    await expect(page.getByTestId("panel-tvm")).toHaveAttribute("data-active", "true");
    await run(page, "2ND DATA");
    await expectFeature(page, "stats");
    await run(page, "CF");
    await expectFeature(page, "cf");
    await run(page, "2ND BOND");
    await expectFeature(page, "bond");
    await run(page, "2ND DEPR");
    await expectFeature(page, "worksheet");
    await expect(block(page).getByRole("heading", { level: 2 })).toHaveText("Depreciation");
  });

  test("digits, arithmetic, memory, MEM and FORMAT do not switch the block", async ({ page }) => {
    await run(page, "CF");
    await expectFeature(page, "cf");
    await run(page, "2ND QUIT 7 + 2 = STO 4 RCL 4");
    await expectFeature(page, "cf");
    await run(page, "2ND MEM");
    await expectFeature(page, "cf");
    await expect(page.getByTestId("panel-memory")).toHaveAttribute("data-active", "true");
    await run(page, "2ND FORMAT");
    await expectFeature(page, "cf");
    await expect(page.getByTestId("panel-settings")).toHaveAttribute("data-active", "true");
  });

  test("the physical keyboard switches it too (Shift tap = 2ND)", async ({ page }) => {
    await page.keyboard.press("Shift");
    await page.keyboard.type("7");
    await expectFeature(page, "stats");
    await page.keyboard.type("9");
    await expectFeature(page, "stats"); // a digit inside DATA does not switch
  });

  test("the block persists across a reload", async ({ page }) => {
    await run(page, "2ND BOND 2ND QUIT");
    await page.reload();
    await expectFeature(page, "bond");
  });

  test("the generic block keeps the worksheet's values after QUIT", async ({ page }) => {
    await run(page, "2ND Δ% 100 ENTER ↓ 125 ENTER 2ND QUIT");
    await expectFeature(page, "worksheet");
    await expect(page.getByTestId("panel-worksheet")).toHaveAttribute("data-active", "false");
    await expect(page.getByTestId("panel-worksheet")).toContainText("125.00");
  });
});

test.describe("manual selector", () => {
  test("switches without pressing a key, and highlights the feature in use", async ({ page }) => {
    await run(page, "CF");
    await tab(page, "stats").click();
    await expectFeature(page, "stats");
    await expect(tab(page, "stats")).toHaveAttribute("aria-selected", "true");
    await expect(lcd(page)).toHaveText("CFo= 0.00");
    await expect(page.getByTestId("tape").locator(".tape-token")).toHaveCount(1); // just CF
    // The calculator is still in CF: its tab carries the "in use" dot.
    await expect(tab(page, "cf")).toHaveAccessibleName("Cash flow (in use)");
    // The next trigger key takes over again.
    await run(page, "NPV");
    await expectFeature(page, "cf");
  });

  test("works from the keyboard (arrows, Home, End)", async ({ page }) => {
    await tab(page, "tvm").focus();
    await page.keyboard.press("ArrowRight");
    await expectFeature(page, "cf");
    await expect(tab(page, "cf")).toBeFocused();
    await page.keyboard.press("End");
    await expectFeature(page, "worksheet");
    await page.keyboard.press("Home");
    await expectFeature(page, "tvm");
    await expect(lcd(page)).toHaveText("0.00"); // no key pressed
  });

  test("More lists the worksheets with their keys and shows the one picked", async ({ page }) => {
    await tab(page, "worksheet").click();
    const picker = page.getByTestId("worksheet-picker");
    await expect(picker).toContainText("DEPR2ND 4");
    await expect(picker).toContainText("BRKEVN2ND 6");
    await picker.getByText("ICONV").click();
    await expect(block(page).getByRole("heading", { level: 2 })).toHaveText("Interest Conversion");
    await expect(page.getByTestId("panel-worksheet")).toContainText("Press 2ND 2 to open it on the calculator.");
  });
});

test.describe("TVM block", () => {
  test.beforeEach(async ({ page }) => {
    await tab(page, "tvm").click();
  });

  test("is read-only: no text fields, only the example list, the chart checkbox and buttons", async ({ page }) => {
    const panel = page.getByTestId("panel-tvm");
    await expect(panel.locator('input:not([type="checkbox"]), textarea, [contenteditable="true"], [role="textbox"]')).toHaveCount(0);
    await expect(panel.locator("select")).toHaveCount(1);
    await expect(panel.locator('input[type="checkbox"]')).toHaveCount(1);
    await expect(panel.getByRole("radio")).toHaveCount(0);
    await expect(page.getByTestId("tvm-summary")).toHaveText("Nothing in the TVM registers yet: key in values, e.g. 360 N, or load an example.");
    await expect(panel).toContainText("Values come from the calculator: key them in, or load an example.");
  });

  test("keying 360 N on the calculator updates the block's N and its summary at once", async ({ page }) => {
    await run(page, "360 N");
    await expect(page.getByTestId("tvm-n")).toHaveText("360.00");
    await expect(page.getByTestId("tvm-summary")).toHaveText(
      "The calculator holds 360 periods at 0% a year with 1 payment and 1 compounding period a year; PV, PMT and FV are still 0.00.",
    );
    // The register on the LCD is highlighted, and the next one takes over.
    await expect(page.getByTestId("tvm-n").locator("xpath=ancestor::div[contains(@class,'block-row')]")).toHaveAttribute("data-current", "true");
    await run(page, "120000 PV");
    await expect(page.getByTestId("tvm-pv")).toHaveText("120,000.00");
    await expect(page.getByTestId("tvm-summary")).toContainText("The calculator holds a 360-period loan: 120,000.00 received today (PV)");
    await expect(page.getByTestId("tvm-pv").locator("xpath=ancestor::div[contains(@class,'block-row')]")).toHaveAttribute("data-current", "true");
  });

  test("P/Y, C/Y and END / BGN show the calculator's settings", async ({ page }) => {
    await run(page, "2ND P/Y 12 ENTER");
    await expect(page.getByTestId("tvm-py")).toHaveText("12.00");
    await expect(page.getByTestId("tvm-cy")).toHaveText("12.00"); // entering P/Y also sets C/Y
    await run(page, "2ND QUIT 2ND BGN 2ND SET");
    await expect(page.getByTestId("tvm-timing")).toHaveText("BGN");
    await expect(page.getByTestId("ann-bgn")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("panel-tvm").locator('.panel-row[data-current="true"]')).toContainText("Timing");
  });

  test("CPT presses the real keys: the LCD shows the result and the tape records it", async ({ page }) => {
    await run(page, "10 N 5 I/Y 100 +|- PV");
    await run(page, "2ND MEM 2ND"); // leave the calculator in a worksheet with 2ND pending (MEM keeps the block)
    await page.getByRole("button", { name: "Press CPT, FV on the calculator" }).click();
    await expect(lcd(page)).toHaveText("FV= 162.89 *");
    await expect(page.getByTestId("tvm-fv")).toHaveText("162.89");
    await expect(page.getByTestId("tvm-computed-fv")).toBeVisible();
    await expect(page.getByTestId("tvm-summary")).toContainText("162.89 received at the end (FV)");
    await expectFeature(page, "tvm");
    // Clean-up first (cancel 2ND, 2ND QUIT), then CPT FV, exactly as keyed on the device.
    await expect(page.getByTestId("tape").locator(".tape-line").last()).toHaveText(/^CPT\s*FV$/);
    await expect(page.getByTestId("tape")).toContainText("QUIT");
    await expect(page.getByTestId("tape")).not.toContainText("(panel)");
  });

  test("a CPT error shows on the LCD and as a message in the block", async ({ page }) => {
    await run(page, "10 N 100 PV 100 FV");
    await page.getByTestId("tvm-cpt-iy").click();
    await expect(lcd(page)).toHaveText("Error 5");
    await expect(page.getByTestId("tvm-error")).toContainText("Error 5");
    await run(page, "CE|C");
    await expect(page.getByTestId("tvm-error")).toHaveCount(0);
    // A later error from the keypad is not the block's: the LCD shows it, the block stays quiet.
    await page.getByTestId("tvm-cpt-fv").click(); // I/Y = 0: FV = −(PV + PMT·N) = −100
    await expect(lcd(page)).toHaveText("FV= -100.00 *");
    await expect(page.getByTestId("tvm-error")).toHaveCount(0);
    await run(page, "1 ÷ 0 =");
    await expect(lcd(page)).toHaveText("Error 1");
    await expect(page.getByTestId("tvm-error")).toHaveCount(0);
  });

  test("guidebook FV example gives 162.89 on the LCD; Clear TVM clears the registers", async ({ page }) => {
    await page.getByTestId("tvm-example").selectOption("fv");
    await expect(lcd(page)).toHaveText("FV= 162.89 *");
    await expect(page.getByTestId("tvm-fv")).toHaveText("162.89");
    await expect(page.getByTestId("timeline-chart")).toBeVisible();
    // Loading an example is one "(panel)" line on the tape; the CPT that follows is the real key.
    await expect(page.getByTestId("tape").locator(".tape-line").filter({ hasText: "(panel)" })).toHaveCount(1);
    await expect(page.getByTestId("tape")).toContainText("Guidebook example (panel)");
    await page.getByRole("button", { name: "Clear TVM: press 2ND CLR TVM on the calculator" }).click();
    await expect(lcd(page)).toHaveText("0.00");
    await expect(page.getByTestId("tvm-n")).toHaveText("0.00");
    await expect(page.getByTestId("tvm-fv")).toHaveText("0.00");
    await expect(page.getByTestId("tvm-summary")).toContainText("Nothing in the TVM registers yet");
  });

  test("mortgage: PMT −729.13, the summary, a 360-row schedule, CSV export, formulas", async ({ page }) => {
    await page.getByTestId("tvm-example").selectOption("mortgage");
    await expect(lcd(page)).toHaveText("PMT= -729.13 *");
    await expect(page.getByTestId("tvm-pmt")).toHaveText("-729.13");
    await expect(page.getByTestId("tvm-summary")).toHaveText(
      "The calculator holds a 360-period loan: 120,000.00 received today (PV), 729.13 paid at the end of each period (PMT, END), " +
        "0.00 left at the end (FV), at 6.125% a year with 12 payments and 12 compounding periods a year.",
    );
    await page.getByTestId("tvm-tab-amort").click();
    await expect(page.getByTestId("amort-table").locator("tbody tr")).toHaveCount(360);
    const download = page.waitForEvent("download");
    await page.getByTestId("amort-csv").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("amortization-schedule.csv");
    const text = await (await file.createReadStream()).toArray();
    expect(Buffer.concat(text).toString("utf8")).toMatch(/^Period,Beginning balance,Payment,Principal,Interest,Ending balance\r\n1,120000\.00,-729\.13,/);
    await page.getByTestId("tvm-tab-formulas").click();
    await expect(page.getByTestId("tvm-formulas")).toContainText("Solving for PMT");
    await expect(page.getByTestId("tvm-formulas").locator(".katex").first()).toBeVisible();
  });

  test("the timeline and the schedule follow the keys live and say where they come from", async ({ page }) => {
    await page.getByTestId("tvm-example").selectOption("mortgage");
    const chart = page.getByTestId("timeline-chart");
    await expect(chart).toContainText("Drawn from the calculator's current TVM registers.");
    await expect(chart.getByRole("img")).toHaveAccessibleName("Bar chart of inflows and outflows over 360 periods");
    await run(page, "120 N");
    await expect(chart.getByRole("img")).toHaveAccessibleName("Bar chart of inflows and outflows over 120 periods");
    await page.getByTestId("tvm-tab-amort").click();
    await expect(page.getByTestId("panel-tvm")).toContainText("Schedule from the calculator's current registers");
    await expect(page.getByTestId("amort-table").locator("tbody tr")).toHaveCount(120);
  });

  test("the AMORT worksheet values show with the schedule", async ({ page }) => {
    await page.getByTestId("tvm-example").selectOption("mortgage");
    await run(page, "2ND AMORT 1 ENTER ↓ 9 ENTER ↓");
    await expect(lcd(page)).toHaveText("BAL= 118,928.63 *");
    await page.getByTestId("tvm-tab-amort").click();
    await expect(page.getByTestId("panel-tvm")).toContainText("118,928.63");
  });
});

test.describe("cash-flow block", () => {
  test.beforeEach(async ({ page }) => {
    await tab(page, "cf").click();
  });

  test("is read-only: no form fields at all; with no flows it shows how to key them in", async ({ page }) => {
    const panel = page.getByTestId("panel-cf");
    await expect(panel.locator("input, select, textarea, [contenteditable='true'], [role='textbox']")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /^(Add|Remove|Move)/ })).toHaveCount(0);
    await expect(page.getByTestId("cf-summary")).toHaveText("No cash flows in the calculator yet: press CF and key them in, or load the guidebook example.");
    await expect(page.getByTestId("cf-how-to")).toContainText("7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER");
    await expect(panel).toContainText("Values come from the calculator: key them in, or load an example.");
  });

  test("key the guidebook flows in on the calculator, then Compute NPV and IRR", async ({ page }) => {
    await run(page, "CF 2ND CLR_WORK 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER");
    await expect(page.getByTestId("cf-row")).toHaveCount(3);
    await expect(page.getByTestId("cf-cf0")).toHaveText("-7,000.00");
    await expect(page.getByTestId("cf-amount-3")).toHaveText("5,000.00");
    await expect(page.getByTestId("cf-freq-3")).toHaveText("4.00");
    await expect(page.getByTestId("cf-how-to")).toHaveCount(0);
    await run(page, "NPV 20 ENTER");
    await expect(page.getByTestId("cf-rate")).toHaveText("20.00");
    await expect(page.getByTestId("cf-summary")).toHaveText(
      "The calculator holds CFo -7,000.00 at time 0, then 3 groups (C01–C03) covering 6 periods; NPV at I = 20% and IRR are not computed for these flows yet.",
    );
    await page.getByRole("button", { name: "Compute NPV: press NPV, Down, CPT on the calculator" }).click();
    await expect(lcd(page)).toHaveText("NPV= 7,266.44 *");
    await expect(page.getByTestId("cf-npv-value")).toHaveText("7,266.44");
    await page.getByTestId("cf-compute-irr").click();
    await expect(lcd(page)).toHaveText("IRR= 52.71 *");
    await expect(page.getByTestId("cf-irr-value")).toHaveText("52.71");
    await expect(page.getByTestId("cf-summary")).toContainText("NPV at I = 20% is 7,266.44*, IRR 52.71%.");
    await expect(page.getByTestId("tape")).not.toContainText("(panel)");
  });

  test("the guidebook example loads into the calculator; keying a new I or flow invalidates NPV / IRR", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    await expect(lcd(page)).toHaveText("IRR= 52.71 *");
    await expect(page.getByTestId("cf-npv-value")).toHaveText("7,266.44");
    await expect(page.getByTestId("tape").locator(".tape-line").filter({ hasText: "(panel)" })).toHaveCount(1);
    await expect(page.getByTestId("tape")).toContainText("Cash flows = guidebook example (panel)");
    await run(page, "NPV 10 ENTER");
    await expect(page.getByTestId("cf-npv-value")).toHaveCount(0);
    await expect(page.getByTestId("cf-irr-value")).toHaveText("52.71");
    await expect(page.getByTestId("cf-summary")).toContainText("NPV at I = 10% is not computed for these flows yet; IRR is 52.71%.");
    await run(page, "CF ↓ 2500 ENTER");
    await expect(page.getByTestId("cf-amount-1")).toHaveText("2,500.00");
    await expect(page.getByTestId("cf-irr-value")).toHaveCount(0);
  });

  test("no sign change: Compute IRR shows Error 5 on the LCD and a friendly message", async ({ page }) => {
    await run(page, "CF 2ND CLR_WORK 100 ENTER ↓ 50 ENTER");
    await page.getByTestId("cf-compute-irr").click();
    await expect(lcd(page)).toHaveText("Error 5");
    await expect(page.getByTestId("cf-irr-error")).toContainText("Error 5");
  });

  test("the chart follows the flows live; Clear presses CF, 2ND CLR WORK", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    const chart = page.getByTestId("cf-chart");
    await expect(chart).toBeVisible();
    await expect(chart.getByText(/Cumulative discounted cash flow/)).toBeVisible();
    await expect(chart).toContainText("Drawn from the calculator's current cash flows and I.");
    await expect(chart.getByRole("img")).toHaveAccessibleName("Cash flows over 7 periods with cumulative discounted value");
    await run(page, "CF ↓ ↓ ↓ ↓ ↓ ↓ 6 ENTER"); // F03 = 6
    await expect(chart.getByRole("img")).toHaveAccessibleName("Cash flows over 9 periods with cumulative discounted value");
    await page.getByRole("button", { name: "Clear cash flows: press CF, 2ND CLR WORK on the calculator" }).click();
    await expect(lcd(page)).toHaveText("CFo= 0.00");
    await expect(page.getByTestId("cf-row")).toHaveCount(0);
    await expect(page.getByTestId("cf-rate")).toHaveText("20.00"); // CLR WORK in CF keeps I
    await expect(page.getByTestId("cf-how-to")).toBeVisible();
  });

  test("highlights the row and cell the LCD is on, and the empty slot after the last group", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    await run(page, "CF ↓ ↓ ↓");
    await expect(page.getByTestId("cf-amount-2")).toHaveClass(/is-cell-current/);
    await expect(page.getByTestId("cf-row").nth(1)).toHaveAttribute("data-current", "true");
    await run(page, "↓ ↓ ↓ ↓");
    await expect(lcd(page)).toHaveText("C04= 0.00");
    await expect(page.getByTestId("cf-slot")).toContainText("C04");
  });
});

test.describe("Calculator only", () => {
  test("hides every block, keeps the calculator and the keyboard, and persists across a reload", async ({ page }) => {
    const sw = page.getByRole("switch", { name: "Calculator only" });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await run(page, "5 PV");
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    for (const id of ["feature-block", "panel-memory", "panel-settings", "panel-tape", "side-panels"]) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByTestId("device")).toBeVisible();
    await page.keyboard.type("2+3=");
    await expect(lcd(page)).toHaveText("5.00");
    await page.reload();
    await expect(page.getByRole("switch", { name: "Calculator only" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("feature-block")).toHaveCount(0);
    await page.getByRole("switch", { name: "Calculator only" }).click();
    await expectFeature(page, "tvm");
  });

  test("centres the calculator", async ({ page, isMobile }) => {
    test.skip(isMobile, "the calculator fills the width on a phone anyway");
    await page.getByRole("switch", { name: "Calculator only" }).click();
    const box = (await page.getByTestId("device").boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(12);
  });
});

test.describe("header and explainer", () => {
  test("Key tips and Calculator only sit in the header beside the theme toggle", async ({ page }) => {
    const header = page.locator("header");
    await expect(header.getByRole("switch", { name: "Key tips" })).toBeVisible();
    await expect(header.getByRole("switch", { name: "Calculator only" })).toBeVisible();
    await expect(header.getByRole("button", { name: /Switch to (dark|light) theme/ })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("the explainer is absent with the flag off (the default), and never called", async ({ page }) => {
    let calls = 0;
    await page.unroute("**/api/explain");
    await page.route("**/api/explain", (route) => {
      calls++;
      return route.fulfill({ status: 599, body: "should not be called" });
    });
    await run(page, "2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    await expect(page.getByTestId("panel-explain")).toHaveCount(0);
    await expect(page.getByText(/Explain this|Coming soon/)).toHaveCount(0);
    expect(calls).toBe(0);
  });
});

test.describe("old tool URLs", () => {
  test("/#/tools/tvm lands on the calculator with the TVM block", async ({ page }) => {
    await page.goto("/#/tools/tvm");
    await expectFeature(page, "tvm");
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId("device")).toBeVisible();
  });

  test("/#/tools/cash-flow lands on the calculator with the Cash flow block, even in Calculator only", async ({ page }) => {
    await page.getByRole("switch", { name: "Calculator only" }).click();
    await page.goto("/#/tools/cash-flow");
    await expectFeature(page, "cf");
    await expect(page.getByRole("switch", { name: "Calculator only" })).toHaveAttribute("aria-checked", "false");
    await expect(page).toHaveURL(/#\/$/);
  });

  test("unknown routes go to the calculator", async ({ page }) => {
    await page.goto("/#/nowhere");
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId("device")).toBeVisible();
  });
});

test.describe("explainer with the feature blocks (VITE_AI_EXPLAINER=on)", () => {
  test.skip(!AI_BASE_URL, AI_SKIP_REASON);
  test.use({ baseURL: AI_BASE_URL });

  test("a TVM example computed by the block can be explained", async ({ page }) => {
    let body: Record<string, unknown> | null = null;
    await page.unroute("**/api/explain");
    await page.route("**/api/explain", async (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: "**Result**\n\n$$FV = 162.89$$" });
    });
    await page.goto("/");
    await tab(page, "tvm").click();
    const button = page.getByRole("button", { name: "Explain this result" });
    await expect(button).toBeDisabled();
    await page.getByTestId("tvm-example").selectOption("fv");
    await expect(lcd(page)).toHaveText("FV= 162.89 *");
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByTestId("explain-output").locator(".katex-display")).toBeVisible();
    expect(body).toMatchObject({ context: "TVM", result: { label: "FV", value: "162.89" } });
    // The Explain card sits below the feature block and has no Key tips switch.
    await expect(page.getByTestId("panel-explain").getByRole("switch")).toHaveCount(0);
  });

  test("shows the server's message when the explainer is not configured", async ({ page }) => {
    await page.unroute("**/api/explain");
    await page.route("**/api/explain", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "not_configured", message: "No API key on this server." } }) }),
    );
    await page.goto("/");
    await tab(page, "cf").click();
    await page.getByTestId("cf-example").click();
    await expect(lcd(page)).toHaveText("IRR= 52.71 *");
    await page.getByRole("button", { name: "Explain this result" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No API key on this server." })).toBeVisible();
  });
});

// Keys are pressed by their accessible names; make sure the block's buttons never shadow one.
test("block buttons do not share a name with a calculator key", async ({ page }) => {
  const names = ["Compute", "Down", "Up", "Clear entry / clear", "Net present value", "Internal rate of return", "Cash flow worksheet"];
  await tab(page, "cf").click();
  await page.getByTestId("cf-example").click();
  for (const name of names) await expect(key(page, name)).toHaveCount(1);
  await tab(page, "tvm").click();
  for (const name of [...names, "N, number of periods", "I/Y, interest rate per year", "PV, present value", "PMT, payment", "FV, future value"]) {
    await expect(key(page, name)).toHaveCount(1);
  }
});
