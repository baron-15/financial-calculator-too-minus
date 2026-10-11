# BA Too Minus Online

A faithful web recreation of the Texas Instruments **BA II Plus** financial calculator (standard model). It has the real key layout, LCD indicators, and worksheet keystroke behavior, plus live side panels, a TVM tool, a Cash Flow tool, and an AI step-by-step explainer.

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
  - `finance/` holds pure math (TVM, cash flow, amortization, bond, depreciation, stats, day count). The emulator and the tool pages share it.
  - `script.ts` runs keystroke scripts, e.g. `runScript("2ND FV 10 N 5 I/Y 100 +|- PV CPT FV")`.
- **`src/ui/`, `src/pages/`** hold the React UI: the device skin, side panels, and tool pages.
- **`api/explain.ts`** is a serverless function that asks Claude for a step-by-step explanation of the last computation. It needs `ANTHROPIC_API_KEY` on the server.

## AI explainer (feature flag)

Every calculation runs in the browser. The only feature that calls a server is the "Explain this result" button, which asks Claude to walk through the last result.

It is **off by default**: the button is replaced by "Coming soon, when I can afford the API call.", and the site works as a plain static build. To turn it on:

1. Set `VITE_AI_EXPLAINER=on` and `ANTHROPIC_API_KEY=…` in `.env` (see `.env.example`).
2. Run `npm run dev`, or for production, build with the flag and deploy `api/explain.ts` as a serverless function.
- **`docs/SPEC.md`** is the behavior spec (formulas, keys, worksheets, defaults, errors), sourced from the TI guidebook. **It is the source of truth.**

## Testing approach

Engine tests are keystroke scripts with golden values taken from the TI guidebook's worked examples:

```ts
expect(lcd("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV")).toBe("FV= 162.89 *");
```
