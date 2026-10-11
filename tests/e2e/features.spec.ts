/**
 * The calculator page's feature block (the former TVM and Cash Flow tools), the header switches and the
 * old tool URLs. The explainer API is always mocked; its specs run on the VITE_AI_EXPLAINER=on server
 * (tests/e2e/ai.ts).
 */
import { expect, test, type Page } from "@playwright/test";
import { AI_BASE_URL, AI_SKIP_REASON } from "./ai";
import { freshEmulator, key, lcd, run } from "./calc";

const block = (page: Page) => page.getByTestId("feature-block");
const expectFeature = (page: Page, feature: string) => expect(block(page)).toHaveAttribute("data-feature", feature);
const tab = (page: Page, feature: string) => page.getByTestId(`feature-tab-${feature}`);

/** Type a value into a block field and commit it with Enter. */
async function enter(page: Page, testId: string, value: string): Promise<void> {
  const field = page.getByTestId(testId);
  await field.fill(value);
  await field.press("Enter");
}

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

  test("an edited register is the calculator's own: RCL shows it, and the tape notes it", async ({ page }) => {
    await enter(page, "tvm-pv", "-5,000");
    await run(page, "RCL PV");
    await expect(lcd(page)).toHaveText("PV= -5,000.00");
    await expect(page.getByTestId("tape")).toContainText("PV = -5,000 (panel)");
    await enter(page, "tvm-n", "1e3");
    await run(page, "RCL N");
    await expect(lcd(page)).toHaveText("N= 1,000.00");
  });

  test("editing the register on the LCD updates the LCD", async ({ page }) => {
    await run(page, "100 PV");
    await expect(lcd(page)).toHaveText("PV= 100.00 ◄");
    await enter(page, "tvm-pv", "250");
    await expect(lcd(page)).toHaveText("PV= 250.00 ◄");
    await expect(page.getByTestId("tvm-pv")).toHaveClass(/is-current/);
  });

  test("junk and P/Y = 0 are rejected inline; the register keeps its value", async ({ page }) => {
    await enter(page, "tvm-pv", "abc");
    await expect(block(page).getByRole("alert")).toContainText("is not a number");
    await page.getByTestId("tvm-pv").blur();
    await expect(page.getByTestId("tvm-pv")).toHaveValue("0.00");
    await enter(page, "tvm-py", "0");
    await expect(block(page).getByText("P/Y must be greater than 0 (Error 4 on the calculator).")).toBeVisible();
    await run(page, "2ND P/Y");
    await expect(lcd(page)).toHaveText("P/Y= 1.00");
  });

  test("P/Y sets C/Y, as the P/Y worksheet does", async ({ page }) => {
    await enter(page, "tvm-py", "12");
    await expect(page.getByTestId("tvm-cy")).toHaveValue("12.00");
    await run(page, "2ND P/Y ↓");
    await expect(lcd(page)).toHaveText("C/Y= 12.00");
  });

  test("CPT presses the real keys: the LCD shows the result and the tape records it", async ({ page }) => {
    await enter(page, "tvm-n", "10");
    await enter(page, "tvm-iy", "5");
    await enter(page, "tvm-pv", "-100");
    await run(page, "2ND MEM 2ND"); // leave the calculator in a worksheet with 2ND pending (MEM keeps the block)
    await page.getByTestId("tvm-cpt-fv").click();
    await expect(lcd(page)).toHaveText("FV= 162.89 *");
    await expect(page.getByTestId("tvm-fv")).toHaveValue("162.89");
    await expect(page.getByTestId("tvm-computed-fv")).toBeVisible();
    await expectFeature(page, "tvm");
    // Clean-up first (cancel 2ND, 2ND QUIT), then CPT FV, exactly as keyed on the device.
    await expect(page.getByTestId("tape").locator(".tape-line").last()).toHaveText(/^CPT\s*FV$/);
    await expect(page.getByTestId("tape")).toContainText("QUIT");
  });

  test("a CPT error shows on the LCD and as a message in the block", async ({ page }) => {
    await enter(page, "tvm-n", "10");
    await enter(page, "tvm-pv", "100");
    await enter(page, "tvm-fv", "100");
    await page.getByTestId("tvm-cpt-iy").click();
    await expect(lcd(page)).toHaveText("Error 5");
    await expect(page.getByTestId("tvm-error")).toContainText("Error 5");
    await run(page, "CE|C");
    await expect(page.getByTestId("tvm-error")).toHaveCount(0);
  });

  test("END / BGN sets the timing and the BGN annunciator", async ({ page }) => {
    await page.getByTestId("tvm-timing").getByText("BGN").click();
    await expect(page.getByTestId("ann-bgn")).toHaveAttribute("data-on", "true");
    await run(page, "2ND BGN");
    await expect(lcd(page)).toHaveText("BGN");
  });

  test("guidebook FV example gives 162.89 on the LCD; Clear TVM clears the registers", async ({ page }) => {
    await page.getByTestId("tvm-example").selectOption("fv");
    await expect(lcd(page)).toHaveText("FV= 162.89 *");
    await expect(page.getByTestId("timeline-chart")).toBeVisible();
    await page.getByTestId("tvm-clear").click();
    await expect(lcd(page)).toHaveText("0.00");
    await expect(page.getByTestId("tvm-n")).toHaveValue("0.00");
    await expect(page.getByTestId("tvm-fv")).toHaveValue("0.00");
  });

  test("mortgage: PMT −729.13, 360-row schedule, CSV export, formulas", async ({ page }) => {
    await page.getByTestId("tvm-example").selectOption("mortgage");
    await expect(lcd(page)).toHaveText("PMT= -729.13 *");
    await expect(page.getByTestId("tvm-pmt")).toHaveValue("-729.13");
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

  test("enter the guidebook flows in the table, then Compute NPV and IRR on the calculator", async ({ page }) => {
    await enter(page, "cf-cf0", "-7000");
    for (const [i, amount, freq] of [[1, "3000", "1"], [2, "4000", "1"], [3, "5000", "4"]] as const) {
      await page.getByTestId("cf-add").click();
      await enter(page, `cf-amount-${i}`, amount);
      await enter(page, `cf-freq-${i}`, freq);
    }
    await enter(page, "cf-rate", "20");
    await expect(page.getByTestId("cf-row")).toHaveCount(3);
    await page.getByTestId("cf-compute-npv").click();
    await expect(lcd(page)).toHaveText("NPV= 7,266.44 *");
    await expect(page.getByTestId("cf-npv-value")).toHaveText("7,266.44");
    await page.getByTestId("cf-compute-irr").click();
    await expect(lcd(page)).toHaveText("IRR= 52.71 *");
    await expect(page.getByTestId("cf-irr-value")).toHaveText("52.71");
    // The calculator's CF worksheet holds the same flows.
    await run(page, "CF ↓ ↓ ↓ ↓ ↓");
    await expect(lcd(page)).toHaveText("C03= 5,000.00 ◄");
    await run(page, "↓");
    await expect(lcd(page)).toHaveText("F03= 4.00 ◄");
  });

  test("changing a flow invalidates NPV and IRR; changing I invalidates NPV only", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    await expect(lcd(page)).toHaveText("IRR= 52.71 *");
    await expect(page.getByTestId("cf-npv-value")).toHaveText("7,266.44");
    await enter(page, "cf-rate", "10");
    await expect(page.getByTestId("cf-npv-value")).toHaveCount(0);
    await expect(page.getByTestId("cf-irr-value")).toHaveText("52.71");
    await enter(page, "cf-amount-1", "2500");
    await expect(page.getByTestId("cf-irr-value")).toHaveCount(0);
    await expect(lcd(page)).toHaveText("IRR= 52.71"); // the LCD loses its "*" too
  });

  test("rows can be added (up to 24), moved and removed; the LCD follows its group", async ({ page }) => {
    await page.getByTestId("cf-add").click();
    await enter(page, "cf-amount-1", "100");
    await page.getByTestId("cf-add").click();
    await enter(page, "cf-amount-2", "200");
    await run(page, "CF ↓ ↓ ↓");
    await expect(lcd(page)).toHaveText("C02= 200.00 ◄");
    await page.getByRole("button", { name: "Move C02 up" }).click();
    await expect(page.getByTestId("cf-amount-1")).toHaveValue("200.00");
    await expect(page.getByTestId("cf-amount-2")).toHaveValue("100.00");
    await expect(lcd(page)).toHaveText("C01= 200.00 ◄");
    await page.getByRole("button", { name: "Remove C01" }).click();
    await expect(page.getByTestId("cf-row")).toHaveCount(1);
    await expect(page.getByTestId("cf-amount-1")).toHaveValue("100.00");
    for (let k = 1; k < 24; k++) await page.getByTestId("cf-add").click();
    await expect(page.getByTestId("cf-row")).toHaveCount(24);
    await expect(page.getByTestId("cf-add")).toBeDisabled();
    await expect(page.getByText("at most 24 cash-flow groups")).toBeVisible();
  });

  test("frequency must be 0.5 to 9,999; a blank amount is 0", async ({ page }) => {
    await page.getByTestId("cf-add").click();
    await enter(page, "cf-freq-1", "0.1");
    await expect(block(page).getByText("Frequency must be 0.5 to 9,999 (Error 4 on the calculator).")).toBeVisible();
    await enter(page, "cf-amount-1", "50");
    await enter(page, "cf-amount-1", "");
    await expect(page.getByTestId("cf-amount-1")).toHaveValue("0"); // still editing: full precision
    await page.getByTestId("cf-amount-1").blur();
    await expect(page.getByTestId("cf-amount-1")).toHaveValue("0.00"); // as the LCD shows it
  });

  test("no sign change: Compute IRR shows Error 5 on the LCD and a friendly message", async ({ page }) => {
    await enter(page, "cf-cf0", "100");
    await page.getByTestId("cf-add").click();
    await enter(page, "cf-amount-1", "50");
    await page.getByTestId("cf-compute-irr").click();
    await expect(lcd(page)).toHaveText("Error 5");
    await expect(page.getByTestId("cf-irr-error")).toContainText("Error 5");
  });

  test("the chart follows the flows live; Clear presses CF, 2ND CLR WORK", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    await expect(page.getByTestId("cf-chart")).toBeVisible();
    await expect(page.getByTestId("cf-chart").getByText(/Cumulative discounted cash flow/)).toBeVisible();
    await page.getByTestId("cf-clear").click();
    await expect(lcd(page)).toHaveText("CFo= 0.00");
    await expect(page.getByTestId("cf-row")).toHaveCount(0);
    await expect(page.getByTestId("cf-rate")).toHaveValue("20.00"); // CLR WORK in CF keeps I
  });

  test("highlights the row the LCD is on", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    await run(page, "CF ↓ ↓ ↓");
    await expect(page.getByTestId("cf-amount-2")).toHaveClass(/is-current/);
    await expect(page.getByTestId("cf-row").nth(1)).toHaveAttribute("data-current", "true");
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
  await tab(page, "cf").click();
  await page.getByTestId("cf-add").click();
  for (const name of ["Compute", "Down", "Up", "Clear entry / clear", "Net present value", "Internal rate of return"]) {
    await expect(key(page, name)).toHaveCount(1);
  }
});
