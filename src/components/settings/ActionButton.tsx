/**
 * Vollbreiter Action-Button für die Settings-Aktionen-Sektion
 * (Refresh / Mark-Read / Cache-Clear).
 */
export interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  /** 'danger' = roter Akzent für destruktive Aktionen */
  variant?: 'default' | 'danger';
}

export function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  variant = 'default',
}: ActionButtonProps) {
  const cls =
    variant === 'danger'
      ? 'bg-destructive/10 border-destructive/30 text-destructive'
      : 'bg-card border-border';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 w-full p-3 border rounded-xl text-sm disabled:opacity-60 ${cls}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
