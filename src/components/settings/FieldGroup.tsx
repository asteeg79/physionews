/**
 * Optisches Gruppieren-Wrapper für einzelne Setting-Sektionen.
 * Wiederverwendet von SettingsForm und Helfer-Komponenten.
 */
export interface FieldGroupProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FieldGroup({ icon, title, description, children }: FieldGroupProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="pt-1">{children}</div>
    </div>
  );
}
