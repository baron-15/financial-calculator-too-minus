/** The "Key tips" switch shown in the Explain card: turns the key tip pop-ups on or off. */
export function KeyTipsSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      data-testid="key-tips-switch"
      className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--page-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      Key tips
      <span
        aria-hidden="true"
        className={`relative inline-block h-4 w-7 rounded-full transition-colors ${on ? "bg-[var(--accent)]" : "bg-[color-mix(in_srgb,var(--page-fg)_25%,transparent)]"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-[left] ${on ? "left-3.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
