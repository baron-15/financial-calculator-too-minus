import { describe, expect, it } from "vitest";
import { createShiftTracker, isTypingTarget, keyFromKeyboard, ownsEnterKey } from "../../src/ui/device/keyboardMap";

const k = (key: string, mode: "calc" | "ws" | "resetConfirm" = "calc", mods: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}) =>
  keyFromKeyboard({ key, ...mods }, mode);

describe("keyFromKeyboard (SPEC §10)", () => {
  it("maps digits and the decimal point", () => {
    for (const d of "0123456789") expect(k(d)).toBe(d);
    expect(k(".")).toBe("DOT");
  });

  it("maps operators and parentheses", () => {
    expect(k("+")).toBe("ADD");
    expect(k("-")).toBe("SUBTRACT");
    expect(k("*")).toBe("MULTIPLY");
    expect(k("/")).toBe("DIVIDE");
    expect(k("^")).toBe("POWER");
    expect(k("(")).toBe("LPAREN");
    expect(k(")")).toBe("RPAREN");
    expect(k("%")).toBe("PERCENT");
    expect(k("=")).toBe("EQUALS");
  });

  it("maps editing and navigation keys", () => {
    expect(k("Backspace")).toBe("BACKSPACE");
    expect(k("Escape")).toBe("CE_C");
    expect(k("ArrowUp")).toBe("UP");
    expect(k("ArrowDown")).toBe("DOWN");
  });

  it("Enter is = in standard mode and ENTER inside a worksheet or the RST ? prompt", () => {
    expect(k("Enter", "calc")).toBe("EQUALS");
    expect(k("Enter", "ws")).toBe("ENTER");
    expect(k("Enter", "resetConfirm")).toBe("ENTER");
  });

  it("ignores browser shortcuts and unmapped keys", () => {
    expect(k("r", "calc", { metaKey: true })).toBeNull();
    expect(k("c", "calc", { ctrlKey: true })).toBeNull();
    expect(k("5", "calc", { altKey: true })).toBeNull();
    expect(k("a")).toBeNull();
    expect(k("Tab")).toBeNull();
    expect(k("Shift")).toBeNull();
    expect(k("ArrowLeft")).toBeNull();
  });
});

describe("createShiftTracker", () => {
  it("fires on a lone Shift tap", () => {
    const t = createShiftTracker();
    t.down("Shift");
    expect(t.up("Shift")).toBe(true);
  });

  it("does not fire when Shift was used to type a character", () => {
    const t = createShiftTracker();
    t.down("Shift");
    t.down("*");
    expect(t.up("*")).toBe(false);
    expect(t.up("Shift")).toBe(false);
  });

  it("ignores auto-repeat, other keys' keyup, and resets on blur", () => {
    const t = createShiftTracker();
    t.down("Shift");
    t.down("Shift", true);
    expect(t.up("a")).toBe(false);
    expect(t.up("Shift")).toBe(true);
    expect(t.up("Shift")).toBe(false);
    t.down("Shift");
    t.reset();
    expect(t.up("Shift")).toBe(false);
  });
});

describe("focus helpers", () => {
  const el = (tagName: string, attrs: Record<string, string> = {}, isContentEditable = false) => ({
    tagName,
    isContentEditable,
    getAttribute: (n: string) => attrs[n] ?? null,
  });

  it("treats form fields as typing targets", () => {
    expect(isTypingTarget(el("input"))).toBe(true);
    expect(isTypingTarget(el("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(el("select"))).toBe(true);
    expect(isTypingTarget(el("div", {}, true))).toBe(true);
    expect(isTypingTarget(el("div", { role: "textbox" }))).toBe(true);
    expect(isTypingTarget(el("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("lets other controls keep Enter, but not calculator keys", () => {
    expect(ownsEnterKey(el("BUTTON"))).toBe(true);
    expect(ownsEnterKey(el("A"))).toBe(true);
    expect(ownsEnterKey(el("button", { role: "tab" }))).toBe(true);
    expect(ownsEnterKey(el("BUTTON", { "data-calc-key": "5" }))).toBe(false);
    expect(ownsEnterKey(el("BODY"))).toBe(false);
    expect(ownsEnterKey(null)).toBe(false);
  });
});
