'use client';

/**
 * GeminiUsagePanel — zeigt den heutigen KI-Verbrauch in den Settings.
 *
 * Pollt /api/gemini-usage und zeigt:
 *  - genutzte / verbleibende Tokens (Progress-Bar)
 *  - genutzte / verbleibende Requests
 *  - Status: grün (alles ok), gelb (über 80 %), rot (Limit erreicht)
 */

import { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FieldGroup } from './settings/FieldGroup';

interface QuotaStatus {
  date: string;
  tokensUsed: number;
  requestsMade: number;
  tokensRemaining: number;
  requestsRemaining: number;
  canUseAi: boolean;
}

const POLL_MS = 30_000;

export function GeminiUsagePanel() {
  const [status, setStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/gemini-usage');
        if (res.ok) setStatus(await res.json());
      } catch {
        // Stille — bei Fehler einfach kein Update
      } finally {
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <FieldGroup
      icon={<Sparkles className="w-4 h-4 text-brand" />}
      title="KI-Verbrauch heute"
      description="Gemini Flash Lite wertet Grauzonen-Items aus. Bei Erreichen der Schwelle fällt das System automatisch auf reine Schlagwort-Bewertung zurück."
    >
      {loading || !status ? (
        <div className="p-4 bg-card border border-border rounded-xl text-xs text-muted-foreground">
          Lade…
        </div>
      ) : (
        <UsageDisplay status={status} />
      )}
    </FieldGroup>
  );
}

function UsageDisplay({ status }: { status: QuotaStatus }) {
  const tokensTotal = status.tokensUsed + status.tokensRemaining;
  const requestsTotal = status.requestsMade + status.requestsRemaining;
  const tokensPct = tokensTotal > 0 ? (status.tokensUsed / tokensTotal) * 100 : 0;
  const requestsPct = requestsTotal > 0 ? (status.requestsMade / requestsTotal) * 100 : 0;
  const overallPct = Math.max(tokensPct, requestsPct);

  // Status-Ampel
  let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-brand" />;
  let statusText: string;
  let statusColor: string;
  if (!status.canUseAi) {
    statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    statusText = 'Limit erreicht — Fallback aktiv';
    statusColor = 'text-destructive';
  } else if (overallPct >= 80) {
    statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    statusText = 'Knapp am Limit';
    statusColor = 'text-amber-500';
  } else {
    statusText = 'OK';
    statusColor = 'text-brand';
  }

  return (
    <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
      <div className="flex items-center gap-1.5 text-xs">
        {statusIcon}
        <span className={`font-medium ${statusColor}`}>{statusText}</span>
        <span className="ml-auto text-muted-foreground">Stichtag {status.date} UTC</span>
      </div>

      <UsageBar
        label="Tokens"
        used={status.tokensUsed}
        total={tokensTotal}
        format={(n) => n.toLocaleString('de-DE')}
      />
      <UsageBar
        label="Anfragen"
        used={status.requestsMade}
        total={requestsTotal}
        format={(n) => n.toLocaleString('de-DE')}
      />
    </div>
  );
}

function UsageBar({
  label,
  used,
  total,
  format,
}: {
  label: string;
  used: number;
  total: number;
  format: (n: number) => string;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const barColor = pct >= 80 ? 'bg-destructive' : pct >= 50 ? 'bg-amber-500' : 'bg-brand';

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {format(used)} <span className="text-muted-foreground">/ {format(total)}</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}
