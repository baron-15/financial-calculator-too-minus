/**
 * TVM and Cash Flow tool pages. Assertions that need real finance numbers are skipped until the finance
 * engine is implemented (its stubs throw "not implemented"). The explainer API is always mocked here,
 * and the explainer specs run on the VITE_AI_EXPLAINER=on server (tests/e2e/ai.ts).
 */
import { expect, test, type Page } from "@playwright/test";
import { npv } from "../../src/engine/finance/cashflow";
import { solveTvm } from "../../src/engine/finance/tvm";
import { implemented } from "../helpers/ready";
import { AI_BASE_URL, AI_SKIP_REASON, COMING_SOON } from "./ai";

// E2E_FINANCE_READY=1 forces the finance-dependent tests on (e.g. against a deployed build); =0 forces them off.
const forced = process.env.E2E_FINANCE_READY;
const ready = (probe: () => unknown) => (forced === undefined ? implemented(probe) : forced === "1");
const TVM_READY = ready(() => solveTvm("fv", { n: 10, iy: 5, pv: -100, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false }));
const CF_READY = ready(() => npv({ cf0: -1, groups: [{ amount: 2, freq: 1 }] }, 10));
const STORAGE_KEY = "ba2plus:state:v1";

async function savedWs(page: Page): Promise<Record<string, Record<string, unknown>>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").ws ?? {}, STORAGE_KEY);
}

test.describe("TVM tool", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/tools/tvm");
  });

  test("renders the solver, chart, schedule and formula sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "TVM Solver" })).toBeVisible();
    for (const name of ["Inputs", "Result", "Cash-flow timeline", "Amortization schedule", "How it's calculated"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    // The AI explainer is off by default: a coming-soon note, no button.
    await expect(page.getByTestId("explain-coming-soon")).toHaveText(COMING_SOON);
    await expect(page.getByRole("button", { name: "Explain this result" })).toHaveCount(0);
    // KaTeX renders the governing equation.
    await expect(page.locator(".katex").first()).toBeVisible();
  });

  test("solve-for selection disables the target field; P/Y drives C/Y until C/Y is edited", async ({ page }) => {
    await page.getByRole("radio", { name: "PMT" }).check({ force: true });
    await expect(page.getByTestId("tvm-pmt")).toBeDisabled();
    await expect(page.getByTestId("tvm-fv")).toBeEnabled();
    await expect(page.getByTestId("tvm-calculate")).toHaveText("Calculate PMT");

    await page.getByTestId("tvm-py").fill("12");
    await expect(page.getByTestId("tvm-cy")).toHaveValue("12");
    await page.getByTestId("tvm-cy").fill("4");
    await page.getByTestId("tvm-py").fill("52");
    await expect(page.getByTestId("tvm-cy")).toHaveValue("4");
  });

  test("validates inputs with friendly messages", async ({ page }) => {
    await page.getByTestId("tvm-pv").fill("abc");
    await page.getByTestId("tvm-calculate").click();
    await expect(page.getByText("Enter N.")).toBeVisible();
    await expect(page.getByText("PV must be a number.")).toBeVisible();
    await expect(page.getByTestId("tvm-error")).toContainText("Fix the highlighted inputs");
  });

  test("calculating shows a result or a clear message", async ({ page }) => {
    await page.getByTestId("tvm-n").fill("10");
    await page.getByTestId("tvm-iy").fill("5");
    await page.getByTestId("tvm-pv").fill("-100");
    await page.getByTestId("tvm-calculate").click();
    await expect(page.getByTestId("tvm-result").or(page.getByTestId("tvm-error"))).toBeVisible();
  });

  test("Open in calculator saves the TVM registers and goes to the emulator", async ({ page }) => {
    await page.getByTestId("tvm-n").fill("360");
    await page.getByTestId("tvm-iy").fill("6.125");
    await page.getByTestId("tvm-pv").fill("120000");
    await page.getByTestId("tvm-py").fill("12");
    await page.getByRole("radio", { name: "BGN" }).check({ force: true });
    await page.getByTestId("tvm-open-calculator").click();
    await expect(page).toHaveURL(/\/$/);
    const ws = await savedWs(page);
    expect(ws.tvm).toMatchObject({ n: 360, iy: 6.125, pv: 120000, py: 12, cy: 12, bgn: true });
  });

  test.describe("with the finance engine", () => {
    test.skip(!TVM_READY, "finance engine (solveTvm / amortSchedule) not implemented yet");

    test("guidebook FV example gives 162.89", async ({ page }) => {
      await page.selectOption("#tvm-example", "fv");
      await expect(page.getByTestId("tvm-result-value")).toHaveText("162.89");
      await expect(page.getByTestId("timeline-chart")).toBeVisible();
    });

    test("mortgage: PMT −729.13, 360-row schedule, CSV export", async ({ page }) => {
      await page.selectOption("#tvm-example", "mortgage");
      await expect(page.getByTestId("tvm-result-value")).toHaveText("-729.13");
      await expect(page.getByTestId("amort-table").locator("tbody tr")).toHaveCount(360);
      const download = page.waitForEvent("download");
      await page.getByTestId("amort-csv").click();
      const file = await download;
      expect(file.suggestedFilename()).toBe("amortization-schedule.csv");
      const text = await (await file.createReadStream()).toArray();
      expect(Buffer.concat(text).toString("utf8")).toMatch(/^Period,Beginning balance,Payment,Principal,Interest,Ending balance\r\n1,120000\.00,-729\.13,/);
    });
  });
});

test.describe("TVM tool explainer (VITE_AI_EXPLAINER=on)", () => {
  test.skip(!AI_BASE_URL, AI_SKIP_REASON);
  test.use({ baseURL: AI_BASE_URL });
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/tools/tvm");
  });

  test("the button is there but disabled until something is calculated", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Explain this result" })).toBeDisabled();
    await expect(page.getByTestId("explain-coming-soon")).toHaveCount(0);
  });

  test("explains a result with the (mocked) AI endpoint and renders math", async ({ page }) => {
    test.skip(!TVM_READY, "needs a computed result");
    let body: Record<string, unknown> | null = null;
    await page.route("**/api/explain", async (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "**Formula**\n\n$$FV = -PV(1+i)^N$$\n\n**Result**\n\nFV = 162.89",
      });
    });
    await page.selectOption("#tvm-example", "fv");
    await page.getByRole("button", { name: "Explain this result" }).click();
    const out = page.getByTestId("explain-output");
    await expect(out).toContainText("FV = 162.89");
    await expect(out.locator(".katex-display")).toBeVisible();
    expect(body).toMatchObject({ context: "TVM", result: { label: "FV", value: "162.89" } });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("shows the server's message when the explainer is not configured", async ({ page }) => {
    test.skip(!TVM_READY, "needs a computed result");
    await page.route("**/api/explain", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "not_configured", message: "No API key on this server." } }) }),
    );
    await page.selectOption("#tvm-example", "fv");
    await page.getByRole("button", { name: "Explain this result" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No API key on this server." })).toBeVisible();
  });
});

test.describe("Cash Flow tool", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/tools/cash-flow");
  });

  test("renders inputs, results and chart sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Cash Flow: NPV and IRR" })).toBeVisible();
    for (const name of ["Cash flows", "Results", "Cash flows over time", "How it's calculated"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("cf-row")).toHaveCount(1);
  });

  test("rows can be added (up to 24), moved and removed", async ({ page }) => {
    await page.getByTestId("cf-amount-1").fill("100");
    await page.getByTestId("cf-add").click();
    await page.getByTestId("cf-amount-2").fill("200");
    await page.getByRole("button", { name: "Move C02 up" }).click();
    await expect(page.getByTestId("cf-amount-1")).toHaveValue("200");
    await expect(page.getByTestId("cf-amount-2")).toHaveValue("100");
    await page.getByRole("button", { name: "Remove C01" }).click();
    await expect(page.getByTestId("cf-row")).toHaveCount(1);
    await expect(page.getByTestId("cf-amount-1")).toHaveValue("100");

    for (let k = 1; k < 24; k++) await page.getByTestId("cf-add").click();
    await expect(page.getByTestId("cf-row")).toHaveCount(24);
    await expect(page.getByTestId("cf-add")).toBeDisabled();
    await expect(page.getByText("at most 24 cash-flow groups")).toBeVisible();
  });

  test("validates frequencies (0.5 to 9,999)", async ({ page }) => {
    await page.getByTestId("cf-freq-1").fill("0.1");
    await page.getByTestId("cf-calculate").click();
    await expect(page.getByText("Use 0.5 to 9,999.")).toBeVisible();
  });

  test("the chart previews the cash flows live", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    await expect(page.getByTestId("cf-chart")).toBeVisible();
    await expect(page.getByTestId("cf-chart").getByText(/Cumulative discounted cash flow/)).toBeVisible();
  });

  test("Load into calculator saves ws.cf and goes to the emulator", async ({ page }) => {
    await page.getByTestId("cf-example").click();
    await page.getByTestId("cf-load-calculator").click();
    await expect(page).toHaveURL(/\/$/);
    const ws = await savedWs(page);
    expect(ws.cf).toMatchObject({
      cf0: -7000,
      groups: [
        { amount: 3000, freq: 1 },
        { amount: 4000, freq: 1 },
        { amount: 5000, freq: 4 },
      ],
      i: 20,
    });
  });

  test.describe("with the finance engine", () => {
    test.skip(!CF_READY, "finance engine (npv / irr) not implemented yet");

    test("guidebook example: NPV 7,266.44 and IRR 52.71", async ({ page }) => {
      await page.getByTestId("cf-example").click();
      await expect(page.getByTestId("cf-npv-value")).toHaveText("7,266.44");
      await expect(page.getByTestId("cf-irr-value")).toHaveText("52.71");
    });

    test("no sign change shows the Error 5 message", async ({ page }) => {
      await page.getByTestId("cf-cf0").fill("100");
      await page.getByTestId("cf-amount-1").fill("50");
      await page.getByTestId("cf-rate").fill("10");
      await page.getByTestId("cf-calculate").click();
      await expect(page.getByTestId("cf-irr-error")).toContainText("Error 5");
    });
  });
});
