/**
 * Guidebook flows driven through the on-screen keys (and the physical keyboard), asserting the LCD text
 * and annunciators the user sees. The explainer API is always mocked; the real one is never called.
 */
import { expect, test, type Page } from "@playwright/test";
import { ann, expectAnn, freshEmulator, key, lcd, run } from "./calc";
import { AI_BASE_URL, AI_SKIP_REASON, COMING_SOON } from "./ai";

test.beforeEach(async ({ page }) => {
  // Never reach the real explainer, even by accident.
  await page.route("**/api/explain", (route) => route.fulfill({ status: 599, body: "explainer is mocked in tests" }));
  await freshEmulator(page);
});

/** Step through a worksheet with ↓, checking each LCD line in turn. */
async function expectDown(page: Page, lines: (string | RegExp)[]) {
  for (const [i, line] of lines.entries()) {
    if (i > 0) await run(page, "↓");
    await expect(lcd(page)).toHaveText(line);
  }
}

test.describe("TVM", () => {
  test("guidebook FV: 10 N 5 I/Y 100 +|− PV CPT FV shows 162.89 *", async ({ page }) => {
    await run(page, "2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    await expect(lcd(page)).toHaveText("FV= 162.89 *");
    await expect(page.getByTestId("lcd-value")).toHaveAttribute("data-value", "162.89");
    await expectAnn(page, "computed", true);
    await expectAnn(page, "assigned", true);
  });

  test("mortgage: PMT −729.13, then AMORT P1 1 P2 9 gives BAL 118,928.63", async ({ page }) => {
    await run(page, "2ND P/Y 12 ENTER");
    await expect(lcd(page)).toHaveText("P/Y= 12.00 ◄");
    await run(page, "↓");
    await expect(lcd(page)).toHaveText("C/Y= 12.00"); // entering P/Y also sets C/Y
    await run(page, "2ND QUIT 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT");
    await expect(lcd(page)).toHaveText("PMT= -729.13 *");
    await run(page, "2ND AMORT 1 ENTER ↓ 9 ENTER ↓");
    await expect(lcd(page)).toHaveText("BAL= 118,928.63 *");
    await expectAnn(page, "up", true);
    await expectAnn(page, "down", true);
    await run(page, "↓");
    await expect(lcd(page)).toHaveText(/^PRN= -1,071\.37 \*$/);
    await run(page, "↓");
    await expect(lcd(page)).toHaveText(/^INT= -5,490\.80 \*$/);
  });

  test("BGN: 2ND BGN 2ND SET lights BGN, which stays on after QUIT and a reload", async ({ page }) => {
    await expectAnn(page, "bgn", false);
    await run(page, "2ND BGN");
    await expect(lcd(page)).toHaveText("END");
    await expectAnn(page, "set", true);
    await run(page, "2ND SET");
    await expect(lcd(page)).toHaveText("BGN");
    await expectAnn(page, "bgn", true);
    await run(page, "2ND QUIT");
    await expect(lcd(page)).toHaveText("0.00");
    await expectAnn(page, "bgn", true);
    await page.reload();
    await expectAnn(page, "bgn", true);
  });
});

test.describe("cash flows", () => {
  test("enter the guidebook flows, INS/DEL renumber, NPV 7,266.44 and IRR 52.71", async ({ page, isMobile }) => {
    await run(page, "CF 2ND CLR_WORK 7000 +|- ENTER");
    await expect(lcd(page)).toHaveText("CFo= -7,000.00 ◄");
    await expectAnn(page, "ins", true);
    await expectAnn(page, "del", true);
    await run(page, "↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER");
    await expect(lcd(page)).toHaveText("F03= 4.00 ◄");

    // INS on C02 inserts an empty group there; the old C02/C03 become C03/C04.
    // Every value of an existing group shows the ◄ entered mark (guidebook p. 42); the empty slot does not.
    await run(page, "↑ ↑ ↑");
    await expect(lcd(page)).toHaveText("C02= 4,000.00 ◄");
    await run(page, "2ND INS");
    await expectDown(page, ["C02= 0.00 ◄", "F02= 1.00 ◄", "C03= 4,000.00 ◄", "F03= 1.00 ◄", "C04= 5,000.00 ◄", "F04= 4.00 ◄"]);
    if (!isMobile) await expect(page.getByTestId("panel-cf").locator("tbody tr")).toHaveCount(5);

    // DEL on the inserted group closes the gap again.
    await run(page, "↑ ↑ ↑ ↑ ↑");
    await expect(lcd(page)).toHaveText("C02= 0.00 ◄");
    await run(page, "2ND DEL");
    await expectDown(page, ["C02= 4,000.00 ◄", "F02= 1.00 ◄", "C03= 5,000.00 ◄", "F03= 4.00 ◄", "C04= 0.00"]);
    if (!isMobile) await expect(page.getByTestId("panel-cf").locator("tbody tr")).toHaveCount(4);

    await run(page, "NPV 20 ENTER ↓ CPT");
    await expect(lcd(page)).toHaveText("NPV= 7,266.44 *");
    await run(page, "IRR CPT");
    await expect(lcd(page)).toHaveText("IRR= 52.71 *");
  });

  test("Load into calculator from /tools/cash-flow fills the CF and NPV worksheets", async ({ page }) => {
    await page.goto("/#/tools/cash-flow");
    await page.getByTestId("cf-example").click();
    await page.getByTestId("cf-load-calculator").click();
    await expect(page).toHaveURL(/\/$/);
    await run(page, "CF");
    await expectDown(page, ["CFo= -7,000.00", "C01= 3,000.00 ◄", "F01= 1.00 ◄", "C02= 4,000.00 ◄", "F02= 1.00 ◄", "C03= 5,000.00 ◄", "F03= 4.00 ◄", "C04= 0.00"]);
    await run(page, "NPV");
    await expect(lcd(page)).toHaveText("I= 20.00");
    await run(page, "↓");
    await expect(lcd(page)).toHaveText(/^NPV= /);
    await expectAnn(page, "computed", false); // loaded flows invalidate the old NPV
    await run(page, "CPT");
    await expect(lcd(page)).toHaveText("NPV= 7,266.44 *");
  });
});

test.describe("clearing, reset and errors", () => {
  test("CLR WORK clears only the open worksheet; CLR TVM clears only the TVM registers", async ({ page }) => {
    await run(page, "2ND P/Y 12 ENTER 2ND QUIT 2ND CLR_TVM 5 N 1000 PV");
    await run(page, "CF 250 ENTER ↓ 75 ENTER");
    await run(page, "2ND CLR_WORK");
    await expect(lcd(page)).toHaveText("CFo= 0.00");
    await run(page, "↓");
    await expect(lcd(page)).toHaveText("C01= 0.00"); // the groups are gone too
    // CLR TVM does nothing inside a worksheet (standard mode only).
    await run(page, "2ND CLR_TVM");
    await expect(lcd(page)).toHaveText("C01= 0.00");
    await run(page, "2ND QUIT RCL N");
    await expect(lcd(page)).toHaveText("N= 5.00"); // TVM untouched by CLR WORK in CF

    await run(page, "2ND CLR_TVM");
    await expect(lcd(page)).toHaveText("0.00");
    await run(page, "RCL N");
    await expect(lcd(page)).toHaveText("N= 0.00");
    await run(page, "RCL PV");
    await expect(lcd(page)).toHaveText("PV= 0.00");
    await run(page, "2ND P/Y");
    await expect(lcd(page)).toHaveText("P/Y= 12.00"); // CLR TVM leaves P/Y alone
  });

  test("RESET asks RST ? with ENTER lit; CE|C cancels, ENTER resets everything", async ({ page }) => {
    await run(page, "42 STO 3 2ND P/Y 4 ENTER 2ND QUIT");
    await run(page, "2ND RESET");
    await expect(lcd(page)).toHaveText("RST ?");
    await expectAnn(page, "enter", true);
    await expect(page.getByTestId("lcd-announce")).toContainText("Press ENTER to confirm");
    await run(page, "CE|C");
    await expectAnn(page, "enter", false);
    await run(page, "RCL 3");
    await expect(lcd(page)).toHaveText("42.00"); // cancelled: memory kept

    await run(page, "2ND RESET ENTER");
    await expect(lcd(page)).toHaveText(/^RST.* 0\.00$/);
    await run(page, "RCL 3");
    await expect(lcd(page)).toHaveText("0.00");
    await run(page, "2ND P/Y");
    await expect(lcd(page)).toHaveText("P/Y= 1.00");
  });

  test("1 ÷ 0 = shows Error 1; every key but CE|C is ignored until it is cleared", async ({ page }) => {
    await run(page, "1 ÷ 0 =");
    await expect(lcd(page)).toHaveText("Error 1");
    await run(page, "5 + 2ND CF ↓ RCL 1 =");
    await expect(lcd(page)).toHaveText("Error 1");
    await expectAnn(page, "second", false);
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await expect(lcd(page)).toHaveText("Error 1");
    await run(page, "CE|C");
    await expect(lcd(page)).toHaveText("0.00");
    await run(page, "2 + 3 =");
    await expect(lcd(page)).toHaveText("5.00");
  });

  test("a TVM with no solution shows Error 5 (and the LCD draws it)", async ({ page }) => {
    await run(page, "2ND CLR_TVM 10 N 100 PV 100 FV CPT I/Y");
    await expect(lcd(page)).toHaveText("Error 5");
    await expect(page.getByTestId("lcd-value").locator("svg.ba-seg")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(lcd(page)).toHaveText("0.00");
  });
});

test.describe("physical keyboard", () => {
  test("digits and operators type, Shift alone is 2ND, Enter is ENTER inside a worksheet", async ({ page }) => {
    await page.keyboard.type("12/4+1");
    await page.keyboard.press("Enter");
    await expect(lcd(page)).toHaveText("4.00");

    // Shift tap → 2ND, then the on-screen I/Y key opens P/Y; Enter stores, ↓ moves.
    await page.keyboard.press("Shift");
    await expectAnn(page, "second", true);
    await key(page, "I/Y, interest rate per year").click();
    await expect(lcd(page)).toHaveText(/^P\/Y= /);
    await page.keyboard.type("52");
    await page.keyboard.press("Enter");
    await expect(lcd(page)).toHaveText("P/Y= 52.00 ◄");
    await page.keyboard.press("ArrowDown");
    await expect(lcd(page)).toHaveText("C/Y= 52.00");
    await page.keyboard.press("ArrowUp");
    await expect(lcd(page)).toHaveText("P/Y= 52.00");

    // Arithmetic inside the worksheet, then Enter stores the result.
    await page.keyboard.type("6*2");
    await page.keyboard.press("Enter");
    await expect(lcd(page)).toHaveText("P/Y= 12.00 ◄");
    await page.keyboard.press("Escape");
    await expect(lcd(page)).toHaveText("P/Y= 12.00 ◄");
  });

  test("Shift+key combinations do not toggle 2ND; Backspace deletes a digit", async ({ page }) => {
    await page.keyboard.type("(2+3)*4");
    await page.keyboard.press("Enter");
    await expect(lcd(page)).toHaveText("20.00");
    await expectAnn(page, "second", false);
    await page.keyboard.type("987");
    await page.keyboard.press("Backspace");
    await expect(lcd(page)).toHaveText("98");
  });
});

test.describe("persistence", () => {
  test("worksheet data, settings and memory survive a reload", async ({ page }) => {
    await run(page, "CF 100 +|- ENTER ↓ 60 ENTER 2ND QUIT 2ND FORMAT 4 ENTER 2ND QUIT 7 STO 9");
    await expect(lcd(page)).toHaveText("7.0000");
    await page.waitForTimeout(400); // past the save debounce
    await page.reload();
    await expect(lcd(page)).toHaveText("7.0000");
    await run(page, "CF");
    await expectDown(page, ["CFo= -100.0000 ◄", "C01= 60.0000 ◄", "F01= 1.0000 ◄"]);
    await run(page, "2ND QUIT RCL 9");
    await expect(lcd(page)).toHaveText("7.0000");
  });
});

test.describe("explainer on the emulator page, flag off (default)", () => {
  test("shows the coming-soon note and never calls the API", async ({ page, isMobile }) => {
    let calls = 0;
    await page.unroute("**/api/explain");
    await page.route("**/api/explain", (route) => {
      calls++;
      return route.fulfill({ status: 599, body: "should not be called" });
    });
    if (isMobile) await page.getByRole("tab", { name: /Explain/ }).click();
    await run(page, "2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    await expect(page.getByTestId("panel-explain").getByTestId("explain-coming-soon")).toHaveText(COMING_SOON);
    await expect(page.getByRole("button", { name: "Explain this result" })).toHaveCount(0);
    expect(calls).toBe(0);
  });
});

test.describe("explainer on the emulator page (VITE_AI_EXPLAINER=on)", () => {
  test.skip(!AI_BASE_URL, AI_SKIP_REASON);
  test.use({ baseURL: AI_BASE_URL });

  test("enables on a computed value, streams Markdown and renders $$ math", async ({ page, isMobile }) => {
    let body: Record<string, unknown> | null = null;
    let calls = 0;
    await page.unroute("**/api/explain");
    await page.route("**/api/explain", async (route) => {
      calls++;
      body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "**Formula**\n\n$$FV = -PV\\,(1 + i)^{N}$$\n\nWith $i = 0.05$ and $N = 10$:\n\n$$FV = 100 \\times 1.05^{10} = 162.89$$\n\n**Result:** FV = 162.89",
      });
    });
    if (isMobile) await page.getByRole("tab", { name: /Explain/ }).click();
    const button = page.getByRole("button", { name: "Explain this result" });
    await expect(button).toBeDisabled();
    await run(page, "2 + 3 =");
    await expect(button).toBeDisabled(); // plain arithmetic has nothing computed to explain
    await run(page, "2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    await expect(button).toBeEnabled();
    await expect(page.getByTestId("panel-explain")).toContainText("FV = 162.89");

    await button.click();
    const out = page.getByTestId("explain-output");
    await expect(out).toContainText("Result: FV = 162.89");
    await expect(out.locator(".katex-display")).toHaveCount(2);
    await expect(out.locator(".katex-display").first()).toBeVisible();
    await expect(out.locator(".katex-error")).toHaveCount(0);
    expect(calls).toBe(1);
    expect(body).toMatchObject({ result: { label: "FV", value: "162.89" } });

    // One card, one heading: no nested explainer heading on this page.
    await expect(page.getByTestId("panel-explain").getByRole("heading")).toHaveCount(1);

    // A new computation marks the old explanation as stale.
    await run(page, "CPT PV");
    await expect(out).toContainText("Explanation for FV = 162.89");
  });
});

test.describe("page theme", () => {
  test("follows the OS live until a theme is picked, then sticks to the choice", async ({ page }) => {
    const html = page.locator("html");
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).not.toHaveAttribute("data-theme", /.*/);
    expect(await bg()).toBe("rgb(21, 23, 26)");
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
    await page.emulateMedia({ colorScheme: "light" });
    expect(await bg()).toBe("rgb(244, 241, 234)");
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    expect(await bg()).toBe("rgb(21, 23, 26)"); // the explicit choice wins over the OS
  });

  test("dark: utilities apply under OS dark mode with no theme chosen", async ({ page, isMobile }) => {
    test.skip(isMobile, "the nav link's dark:hover style needs a hover-capable pointer");
    await page.emulateMedia({ colorScheme: "dark" });
    const link = page.getByRole("link", { name: "TVM Tool" });
    await link.hover();
    // dark:hover:bg-white/10 (white at 10% alpha); light mode would use black/5.
    await expect(link).toHaveCSS("background-color", /^(rgba\(255, 255, 255, 0\.1\)|oklab\(0\.99\d* [\d.e-]+ [\d.e-]+ \/ 0\.1\))$/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(link).toHaveCSS("background-color", /^(rgba\(0, 0, 0, 0\.05\)|oklab\(0 0 0 \/ 0\.05\))$/);
  });
});

test.describe("STAT labels", () => {
  // The guidebook (p. 54, SPEC §8) prints the sums in uppercase: ΣX, ΣX², ΣY, ΣY², ΣXY.
  test("STAT sum labels match the guidebook", async ({ page }) => {
    await run(page, "2ND DATA 2ND CLR_WORK 1 ENTER ↓ 2 ENTER ↓ 3 ENTER ↓ 5 ENTER 2ND STAT ↑");
    await expect(lcd(page)).toHaveText(/^ΣXY= /);
    await run(page, "↑");
    await expect(lcd(page)).toHaveText(/^ΣY²= /);
    await run(page, "↑ ↑ ↑");
    await expect(lcd(page)).toHaveText(/^ΣX= /);
  });
});

test("2ND keeps its annunciator in sync with the key's pressed state", async ({ page }) => {
  await run(page, "2ND");
  await expect(key(page, "Second function")).toHaveAttribute("aria-pressed", "true");
  await expect(ann(page, "second")).toHaveAttribute("data-on", "true");
  await run(page, "2ND");
  await expect(key(page, "Second function")).toHaveAttribute("aria-pressed", "false");
});
