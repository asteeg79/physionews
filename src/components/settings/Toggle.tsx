/**
 * Switch-Toggle in zwei Größen — wiederverwendbar zwischen
 * Settings und Quellen-Manager.
 */
export interface ToggleProps {
  enabled: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function Toggle({
  enabled,
  onChange,
  label,
  size = 'md',
  ariaLabel,
}: ToggleProps) {
  const dimensions = {
    sm: { wrap: 'w-9 h-5', knob: 'w-4 h-4 top-0.5 left-0.5', translate: 'translate-x-4' },
    md: { wrap: 'w-10 h-6', knob: 'w-5 h-5 top-0.5 left-0.5', translate: 'translate-x-4' },
  };
  const d = dimensions[size];

  // Reines Switch ohne Label
  if (!label) {
    return (
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-label={ariaLabel}
        aria-pressed={enabled}
        className={`relative inline-block ${d.wrap} rounded-full transition-colors ${
          enabled ? 'bg-brand' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute ${d.knob} bg-white rounded-full shadow transition-transform ${
            enabled ? d.translate : ''
          }`}
        />
      </button>
    );
  }

  // Mit Label: ganze Zeile klickbar
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className="flex items-center justify-between w-full p-3 bg-card border border-border rounded-xl"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative inline-block ${d.wrap} rounded-full transition-colors ${
          enabled ? 'bg-brand' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute ${d.knob} bg-white rounded-full shadow transition-transform ${
            enabled ? d.translate : ''
          }`}
        />
      </span>
    </button>
  );
}
