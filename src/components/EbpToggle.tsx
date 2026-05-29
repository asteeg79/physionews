'use client';

/**
 * EBP-Toggle — Filter „Nur Evidenz": zeigt nur Items, deren AI-Klassifizierung
 * mindestens ein Evidenz-Tag (Leitlinie, S3-Leitlinie, RCT, Meta-Analyse,
 * Systematic Review, Cochrane-Review, Studie) vergeben hat.
 *
 * State liegt im URL-Param `?ebp=true` (geteilt mit dem API-Filter).
 */

import { useTransition } from 'react';
import { FlaskConical } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function EbpToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const isActive = sp.get('ebp') === 'true';
  const [, startTransition] = useTransition();

  const toggle = () => {
    const params = new URLSearchParams(sp.toString());
    if (isActive) params.delete('ebp');
    else params.set('ebp', 'true');
    // Transition: Button bleibt sofort sichtbar im neuen State, ohne
    // dass das ganze Liste-Re-Render blockierend wird
    startTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
        isActive
          ? 'bg-brand text-white'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
      title="Nur Beiträge mit AI-vergebenen Evidenz-Tags (RCT, Leitlinie, Meta-Analyse, …)"
    >
      <FlaskConical className="w-4 h-4" aria-hidden="true" />
      KI Klassifiziert
    </button>
  );
}
