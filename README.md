# BA Too Minus Online

A faithful web recreation of the Texas Instruments **BA II Plus** financial calculator (standard model). It has the real key layout, LCD indicators, and worksheet keystroke behavior, plus a smart feature panel (TVM, cash flows, statistics, bond and the other worksheets) bound to the calculator's own registers, and an optional AI step-by-step explainer.

## The page

Everything lives on one page (`/`): the calculator on the left (it stays in view on wide screens), and beside it, or below it on a phone:

- **Feature block.** One card that shows the feature you are using. It follows the keys: a TVM key (N, I/Y, PV, PMT, FV, or 2ND xP/Y, P/Y, AMORT, BGN, CLR TVM) opens **TVM**; CF, NPV or IRR opens **Cash flow**; 2ND DATA or STAT opens **Statistics**; 2ND BOND opens **Bond**; 2ND DEPR, DATE, Δ%, ICONV, PROFIT or BRKEVN opens **More** (the generic worksheet view, which keeps showing that worksheet after 2ND QUIT). Other keys leave it as it is. The selector in its header switches by hand without pressing a key.
  - **TVM**: edit N, I/Y, PV, PMT, FV, P/Y, C/Y and END/BGN directly (they are the calculator's registers: RCL shows them), press **CPT** beside a register to compute it on the calculator, load an example, and see the cash-flow timeline, the amortization schedule (with CSV export) and the formulas with your numbers.
  - **Cash flow**: edit CFo, up to 24 groups (amount and frequency; add, move, remove) and I; **Compute NPV** / **Compute IRR** press NPV ↓ CPT / IRR CPT on the calculator. Also the guidebook example, a chart with the cumulative discounted cash flow, and the formulas.
- **Memory** and **Format settings**, always on screen.
- **Keystroke tape**: every key, with 2ND functions by their gold names; values typed into a block show as notes, e.g. `PV = -100 (panel)`.

The header has two switches beside the theme toggle: **Key tips** (hover or long-press a key to see what it does) and **Calculator only** (hide everything but the calculator). Both are remembered in the browser. The old `/#/tools/tvm` and `/#/tools/cash-flow` links open the calculator with that block.

> Not affiliated with or endorsed by Texas Instruments. "BA II PLUS" is a trademark of Texas Instruments.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server (http://localhost:5173) |
| `npm test` | Run the engine unit tests (Vitest) |
| `npm run typecheck` | Run the TypeScript strict check |
| `npm run e2e` | Run the Playwright end-to-end tests (desktop + mobile) |
| `npm run build` | Build for production into `dist/` |

## Architecture

- **`src/engine/`** is a pure, framework-free state machine: `press(state, key) → state`. It has no React or DOM imports.
  - `keys.ts` defines the key grid and the 2ND functions.
  - `state.ts` holds the complete JSON-serializable state and factory defaults.
  - `press.ts` routes each key: power → error → 2ND → global → mode → entry → arithmetic.
  - `lcd.ts` derives the LCD (label, value, annunciators) from state.
  - `worksheets/` holds one module per worksheet, built on the contract in `types.ts`. `runner.ts` does the shared navigation, enter, compute and set logic.
  - `finance/` holds pure math (TVM, cash flow, amortization, bond, depreciation, stats, day count). The emulator and the feature blocks share it.
  - `script.ts` runs keystroke scripts, e.g. `runScript("2ND FV 10 N 5 I/Y 100 +|- PV CPT FV")`.
- **`src/ui/`, `src/pages/`** hold the React UI: the device skin (`ui/device`), the side column (`ui/panels`) and the page (`pages/Emulator.tsx`).
  - `ui/panels/featureContext.ts` is the pure rule for which feature block a key opens.
  - `ui/panels/edits.ts` holds the pure block edits (TVM registers, cash flows) with the device's rules; `ui/panels/keysTo.ts` builds the key sequences the block buttons press (first back to standard mode: CE|C, 2ND, 2ND QUIT…).
  - `ui/tools/` holds the TVM and cash-flow models, charts, amortization table and formulas used by the blocks.
- **`api/explain.ts`** is a serverless function that asks Claude for a step-by-step explanation of the last computation. It needs `ANTHROPIC_API_KEY` on the server.

## AI explainer (feature flag)

Every calculation runs in the browser. The only feature that calls a server is the "Explain this result" button, which asks Claude to walk through the last result.

It is **off by default**: nothing of the explainer is shown, and the site works as a plain static build. With the flag on, an "Explain this calculation" card appears below the feature block. To turn it on:

1. Set `VITE_AI_EXPLAINER=on` and `ANTHROPIC_API_KEY=…` in `.env` (see `.env.example`).
2. Run `npm run dev`, or for production, build with the flag and deploy `api/explain.ts` as a serverless function.
- **`docs/SPEC.md`** is the behavior spec (formulas, keys, worksheets, defaults, errors), sourced from the TI guidebook. **It is the source of truth.**

## Testing approach

Engine tests are keystroke scripts with golden values taken from the TI guidebook's worked examples:

```ts
expect(lcd("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV")).toBe("FV= 162.89 *");
```
