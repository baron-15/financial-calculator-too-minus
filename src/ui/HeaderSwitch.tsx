/**
 * An on/off switch for the page header ("Key tips", "Calculator only"), styled like the theme toggle
 * beside it: the same box and height, with a label and a pill track.
 */
export interface HeaderSwitchProps {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  testId?: string;
  /** Tooltip explaining what the switch does. */
  title?: string;
}

export function HeaderSwitch({ label, on, onChange, testId, title }: HeaderSwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className="header-switch" onClick={() => onChange(!on)} data-testid={testId} title={title}>
      {label}
      <span className="header-switch-track" aria-hidden="true">
        <span className="header-switch-thumb" />
      </span>
    </button>
  );
}
