/**
 * True once a Phase 0 stub has been implemented (stubs throw CalcError "not implemented").
 * Golden-value tests that depend on src/engine/finance use:
 *   describe.runIf(implemented(() => npv({ cf0: -1, groups: [{ amount: 2, freq: 1 }] }, 10)))("…", …)
 */
export function implemented(probe: () => unknown): boolean {
  try {
    probe();
    return true;
  } catch (e) {
    return !(e instanceof Error && e.message.includes("not implemented"));
  }
}
