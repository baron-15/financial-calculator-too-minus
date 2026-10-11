/**
 * Accessibility checks in a real browser: key names and descriptions, the LCD's live announcement,
 * visible focus, keyboard-only use of the keypad, labelled tool-page fields, and WCAG AA text contrast.
 */
import { expect, test, type Page } from "@playwright/test";
import { ALL_KEYS } from "../../src/engine";

const key = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

interface ContrastFailure {
  text: string;
  ratio: number;
  need: number;
  fg: string;
  bg: string;
}

/**
 * WCAG 2.x contrast of every visible text node against its effective background. Backgrounds are
 * composited up the ancestor chain (alpha colors, opacity); for gradients the worst stop is used.
 * Skips the LCD glass (aria-hidden segment art with deliberate ghost segments) and disabled controls,
 * which WCAG exempts.
 */
async function contrastFailures(page: Page): Promise<ContrastFailure[]> {
  return page.evaluate(() => {
    type RGBA = [number, number, number, number];
    const probe = document.createElement("canvas").getContext("2d")!;
    const parse = (c: string): RGBA | null => {
      if (!c || c === "transparent") return [0, 0, 0, 0];
      probe.fillStyle = "#000";
      probe.fillStyle = c;
      const v = probe.fillStyle;
      if (v.startsWith("#")) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
      const m = /rgba?\(([^)]+)\)/.exec(v);
      if (!m) return null;
      const p = m[1]!.split(",").map((x) => parseFloat(x));
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
    };
    // Resolve any CSS color (oklab, color-mix, …) to rgba through the canvas.
    const resolve = (c: string): RGBA | null => {
      const direct = parse(c);
      if (direct) return direct;
      const el = document.createElement("div");
      el.style.color = c;
      document.body.appendChild(el);
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = getComputedStyle(el).color;
      probe.fillRect(0, 0, 1, 1);
      el.remove();
      const d = probe.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const over = (top: RGBA, under: RGBA): RGBA => {
      const a = top[3] + under[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const ch = (i: number) => (top[i]! * top[3] + under[i]! * under[3] * (1 - top[3])) / a;
      return [ch(0), ch(1), ch(2), a];
    };
    const lum = (c: RGBA) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    /** Candidate backgrounds behind `el` (several when a gradient is involved). */
    const backgrounds = (el: Element): RGBA[] => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) chain.push(e);
      let layers: RGBA[] = [[255, 255, 255, 1]];
      for (const e of chain.reverse()) {
        const cs = getComputedStyle(e);
        const color = resolve(cs.backgroundColor) ?? [0, 0, 0, 0];
        layers = layers.map((l) => over(color, l));
        // Gradient layers paint bottom (last listed) to top; each stop is a candidate background.
        const gradients = [...cs.backgroundImage.matchAll(/(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/g)].map((m) => m[0]);
        for (const g of gradients.reverse()) {
          const stops = [...g.matchAll(/(rgba?\([^)]+\)|#[0-9a-f]{3,8}|oklab\([^)]+\)|oklch\([^)]+\))/gi)].map((m) => resolve(m[1]!)).filter((s): s is RGBA => !!s);
          if (stops.length) layers = layers.flatMap((l) => stops.map((s) => over(s, l)));
        }
      }
      return layers;
    };
    const failures: { text: string; ratio: number; need: number; fg: string; bg: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent?.trim()) continue;
      seen.add(el);
      // Key legends reproduce the hardware's printed colors on purpose (white "2ND" on tan, white digits on
      // warm grey are low contrast on the real BA II Plus). They are aria-hidden: every key has an
      // accessible name and its 2ND function as a description (see the keypad semantics tests).
      if (el.closest(".ba-lcd, .ba-key-legend, .sr-only, [hidden], :disabled, [aria-disabled='true'], .katex-mathml")) continue;
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || cs.visibility === "hidden" || cs.display === "none") continue;
      let opacity = 1;
      for (let e: Element | null = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
      if (opacity === 0) continue;
      const fg0 = resolve(cs.color)!;
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      for (const bg of backgrounds(el)) {
        const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], bg);
        const r = ratio(fg, bg);
        if (r < need - 0.01) {
          failures.push({ text: n.textContent.trim().slice(0, 40), ratio: Math.round(r * 100) / 100, need, fg: fg.map(Math.round).join(","), bg: bg.map(Math.round).join(",") });
          break;
        }
      }
    }
    return failures;
  });
}

test.describe("keypad semantics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("every key is a uniquely named button; gold functions are descriptions, not title tooltips", async ({ page }) => {
    const keys = page.locator("[data-calc-key]");
    await expect(keys).toHaveCount(ALL_KEYS.length);
    for (const spec of ALL_KEYS) {
      const k = key(page, spec.aria);
      await expect(k, spec.id).toHaveCount(1);
      await expect(k).toHaveAttribute("data-calc-key", spec.id);
      await expect(k).not.toHaveAttribute("title");
      if (spec.second) await expect(k).toHaveAccessibleDescription(new RegExp(`^2ND: ${spec.second.label.replace(/[|\\/]/g, "\\$&")}`));
    }
    await expect(key(page, "FV, future value")).toHaveAccessibleDescription("2ND: CLR TVM, Clear TVM");
  });

  test("the LCD is announced as a sentence through a polite live region", async ({ page }) => {
    const live = page.getByRole("status").filter({ has: page.getByTestId("lcd-announce") }).or(page.getByTestId("lcd-announce"));
    await expect(live).toHaveAttribute("aria-live", "polite");
    for (const name of ["Second function", "FV, future value", "1", "0", "N, number of periods", "5", "I/Y, interest rate per year", "1", "0", "0", "Change sign", "PV, present value", "Compute", "FV, future value"]) {
      await key(page, name).click();
    }
    await expect(page.getByTestId("lcd-announce")).toHaveText("FV equals 162.89, computed");
    await expect(page.getByTestId("lcd")).toHaveAttribute("aria-hidden", "true");
  });

  test("the keypad works with the keyboard alone (Tab, then Space or Enter)", async ({ page }) => {
    // Focus the first key, then walk the keypad with Tab.
    await page.getByRole("button", { name: /Switch to (dark|light) theme/ }).focus();
    await page.keyboard.press("Tab");
    await expect(key(page, "Compute")).toBeFocused();
    const order = await page.locator("[data-calc-key]").evaluateAll((els) => els.map((e) => e.getAttribute("data-calc-key")));
    const tabTo = async (id: string) => {
      const from = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.calcKey ?? "");
      let steps = order.indexOf(id) - order.indexOf(from);
      const k = steps >= 0 ? "Tab" : "Shift+Tab";
      for (steps = Math.abs(steps); steps > 0; steps--) await page.keyboard.press(k);
      await expect(page.locator(`[data-calc-key="${id}"]`)).toBeFocused();
    };
    await tabTo("2");
    await page.keyboard.press("Enter");
    await tabTo("ADD");
    await page.keyboard.press(" ");
    await tabTo("3");
    await page.keyboard.press("Enter");
    await tabTo("EQUALS");
    await page.keyboard.press(" ");
    await expect(page.getByTestId("lcd-text")).toHaveText("5.00");
    // Typing on the keyboard hands Enter back to "=" even while a key has focus.
    await page.keyboard.type("4*2");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("lcd-text")).toHaveText("8.00");
  });

  test("focus is visible on keys and page controls", async ({ page }) => {
    await page.getByRole("link", { name: "Calculator" }).focus();
    // Tab through the header controls into the first few keys.
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press("Tab");
      const indicator = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const target = el.querySelector(".ba-key-face") ?? el;
        const cs = getComputedStyle(target);
        return { who: el.dataset.calcKey ?? el.textContent?.trim() ?? el.tagName, outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== "none" };
      });
      expect(indicator.outline || indicator.shadow, `focus indicator on ${indicator.who}`).toBe(true);
    }
  });
});

test.describe("tool pages", () => {
  for (const path of ["/tools/tvm", "/tools/cash-flow"]) {
    test(`every form field on ${path} has a label`, async ({ page }) => {
      await page.goto(`/#${path}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      const unlabeled = await page.locator("input, select, textarea").evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLInputElement).type !== "hidden")
          .filter((e) => {
            const el = e as HTMLInputElement;
            const named = (el.labels?.length ?? 0) > 0 || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label");
            return !named;
          })
          .map((e) => e.outerHTML.slice(0, 120)),
      );
      expect(unlabeled).toEqual([]);
    });
  }
});

test.describe("text contrast (WCAG AA)", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const path of ["/", "/tools/tvm", "/tools/cash-flow"]) {
      test(`${path} in the ${theme} theme`, async ({ page, isMobile }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`/#${path}`);
        if (path === "/tools/tvm") await page.selectOption("#tvm-example", "mortgage");
        else if (path === "/tools/cash-flow") await page.getByTestId("cf-example").click();
        else if (!isMobile) {
          // Fill some panels so their rows and badges are on screen.
          for (const name of ["Cash flow worksheet", "Down", "5", "Enter"]) await key(page, name).click();
          // Key tips are off by default; turn them on so the tip bubble is included in the check.
          await page.getByRole("switch", { name: "Key tips" }).click();
          await key(page, "PV, present value").hover();
          await expect(page.getByTestId("key-tip")).toBeVisible();
        }
        await page.waitForTimeout(300);
        expect(await contrastFailures(page)).toEqual([]);
      });
    }
  }
});
