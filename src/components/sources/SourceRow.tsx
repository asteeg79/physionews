'use client';

/**
 * Einzelne Quellen-Zeile in der Liste:
 *  - Name + URL
 *  - Status-Icon (Erfolg/Fehler)
 *  - Letzter Erfolg / lastError
 *  - Toggles: aktiv, Push-pro-Quelle
 *  - Löschen-Button
 */

import { Trash2, AlertCircle, CheckCircle2, Bell, BellOff } from 'lucide-react';
import { Toggle } from '../settings/Toggle';
import type { ClientSource } from './types';

export interface SourceRowProps {
  source: ClientSource;
  onUpdate: (changes: Partial<ClientSource>) => void;
  onDelete: () => void;
}

export function SourceRow({ source, onUpdate, onDelete }: Readonly<SourceRowProps>) {
  const hasError = !!source.lastError;
  return (
    <div
      className={`p-3 bg-card border rounded-xl ${
        source.isEnabled ? 'border-border' : 'border-border opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{source.name}</p>
            <SourceStatusIcon hasError={hasError} lastSuccessAt={source.lastSuccessAt} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{source.url}</p>
          {source.lastError && (
            <p className="text-xs text-destructive mt-1 line-clamp-2">{source.lastError}</p>
          )}
          {source.lastSuccessAt && !hasError && (
            <p className="text-xs text-muted-foreground mt-1">
              Zuletzt: {new Date(source.lastSuccessAt).toLocaleString('de-DE')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Toggle
            enabled={source.isEnabled}
            onChange={(v) => onUpdate({ isEnabled: v })}
            ariaLabel="Quelle aktivieren/deaktivieren"
            size="sm"
          />
          <button
            type="button"
            onClick={() => onUpdate({ notificationsEnabled: !source.notificationsEnabled })}
            className="p-1 text-muted-foreground"
            aria-label={
              source.notificationsEnabled ? 'Push für Quelle aus' : 'Push für Quelle ein'
            }
            title={source.notificationsEnabled ? 'Push für Quelle aktiv' : 'Push für Quelle aus'}
          >
            {source.notificationsEnabled ? (
              <Bell className="w-3.5 h-3.5" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-destructive"
            aria-label="Quelle löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Statussymbol einer Quelle: Fehler, erfolgreicher Abruf, oder noch nie abgerufen. */
function SourceStatusIcon({
  hasError,
  lastSuccessAt,
}: Readonly<{ hasError: boolean; lastSuccessAt: string | null }>) {
  if (hasError) {
    return <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" aria-label="Fehler" />;
  }
  if (lastSuccessAt) {
    return (
      <CheckCircle2
        className="w-3.5 h-3.5 text-brand shrink-0"
        aria-label="Letzter Refresh erfolgreich"
      />
    );
  }
  return null;
}
