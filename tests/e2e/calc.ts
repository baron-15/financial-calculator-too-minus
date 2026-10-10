/** Helpers for driving the emulator through its on-screen keys. */
import { expect, type Page } from "@playwright/test";
import { KEY_BY_ID, parseScript } from "../../src/engine";

/** A calculator key by its accessible name (KeySpec.aria). */
export const key = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** Click the on-screen keys for a keystroke script, e.g. "2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV". */
export async function run(page: Page, script: string): Promise<void> {
  for (const id of parseScript(script)) await key(page, KEY_BY_ID[id].aria).click();
}

/** The LCD as one line (engine lcdText form, e.g. "FV= 162.89 *"). */
export const lcd = (page: Page) => page.getByTestId("lcd-text");

/** An annunciator by its test id suffix ("bgn", "second", "computed", "enter", …). */
export const ann = (page: Page, id: string) => page.getByTestId(`ann-${id}`);

export async function expectAnn(page: Page, id: string, on: boolean): Promise<void> {
  await expect(ann(page, id)).toHaveAttribute("data-on", on ? "true" : "false");
}

/** Open the emulator with empty storage and wait for the power-on display. */
export async function freshEmulator(page: Page): Promise<void> {
  await page.goto("/");
  await expect(lcd(page)).toHaveText("0.00");
}
