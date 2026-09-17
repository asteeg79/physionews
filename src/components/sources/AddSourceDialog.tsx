'use client';

/**
 * AddSourceDialog — Modal-Dialog zum Hinzufügen einer neuen Quelle.
 *
 * Eingabe:
 *  - URL (Pflicht; muss valid sein)
 *  - Name (optional; bei leer wird Feed-Title oder hostname benutzt)
 *  - Kategorie (Default: fachlich)
 *
 * Auto-Detect: ruft POST /api/sources mit autoDetect:true auf. Der Server
 * versucht zuerst RSS-Erkennung (eigener Feed oder &lt;link rel="alternate"&gt;),
 * sonst Fallback auf den Generic-HTML-Adapter.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, X, Loader2 } from 'lucide-react';
import { CATEGORY_LABELS } from '@/lib/categories';
import type { ClientSource } from './types';
import type { VisibleCategory } from '@/lib/categories';

export interface AddSourceDialogProps {
  onClose: () => void;
  onAdded: (created: ClientSource) => void;
}

export function AddSourceDialog({ onClose, onAdded }: Readonly<AddSourceDialogProps>) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<VisibleCategory>('fachlich');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!url.trim()) {
      toast.error('URL fehlt');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || undefined,
          category,
          autoDetect: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.detail ?? body.error ?? 'Hinzufügen fehlgeschlagen');
        return;
      }
      const detectedAs = (body as { detectedAs?: string }).detectedAs;
      toast.success(
        detectedAs === 'rss' ? 'RSS-Feed erkannt und hinzugefügt' : 'Als HTML-Quelle hinzugefügt'
      );
      onAdded(body as ClientSource);
    } catch (err) {
      toast.error('Hinzufügen fehlgeschlagen');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quelle hinzufügen"
    >
      <div className="bg-background border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Quelle hinzufügen</h2>
          <button type="button" onClick={onClose} aria-label="Schließen">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          PhysioNews versucht, einen RSS-Feed unter der URL zu finden. Wenn keiner gefunden wird,
          wird die Seite als HTML-Quelle aufgenommen.
        </p>

        <Field label="URL">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/news"
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm"
            autoFocus
          />
        </Field>

        <Field label="Name (optional)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wird aus dem Feed-Titel ermittelt"
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm"
          />
        </Field>

        <Field label="Kategorie">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as VisibleCategory)}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-brand text-white rounded-xl font-medium disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Hinzufügen
          </button>
          <button type="button" onClick={onClose} className="px-4 text-sm text-muted-foreground">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium block">{label}</label>
      {children}
    </div>
  );
}
