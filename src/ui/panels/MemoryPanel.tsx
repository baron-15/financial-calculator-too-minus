import type { CalcState } from "../../engine";
import { num } from "./fmt";
import { FlashValue, PanelCard } from "./PanelCard";

export function MemoryPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const pending = state.mods.pending;
  const meta = pending ? `${pending.kind}${pending.kind === "STO" && pending.op ? ` ${pending.op.toLowerCase()}` : ""} … pick 0–9` : undefined;
  return (
    <PanelCard id="memory" title="Memory" active={active} meta={meta}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => {
          const isCur = active && current === `m${i}`;
          return (
            <li key={i} className={`panel-row${isCur ? " is-current" : ""}`} data-testid={`mem-${i}`}>
              <span className="font-medium">M{i}</span>
              <FlashValue value={num(state, state.memory[i] ?? 0)} />
            </li>
          );
        })}
      </ul>
    </PanelCard>
  );
}
