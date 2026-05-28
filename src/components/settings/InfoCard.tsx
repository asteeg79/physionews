/**
 * Schmale Info-Card mit Icon, Inhalt und farblicher Variante.
 * Wird in PushSettings und InstallStatus genutzt.
 */
export interface InfoCardProps {
  icon: React.ReactNode;
  variant: 'muted' | 'success' | 'destructive';
  children: React.ReactNode;
}

export function InfoCard({ icon, variant, children }: InfoCardProps) {
  const styles: Record<InfoCardProps['variant'], string> = {
    muted: 'bg-card border-border',
    success: 'bg-brand/5 border-brand/30',
    destructive: 'bg-destructive/5 border-destructive/30 text-destructive',
  };
  return (
    <div className={`p-3 ${styles[variant]} border rounded-xl flex items-start gap-2 text-sm`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>{children}</div>
    </div>
  );
}
