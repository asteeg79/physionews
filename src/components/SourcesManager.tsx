'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, AlertCircle, CheckCircle2, X, Loader2, Bell, BellOff } from 'lucide-react';

interface ClientSource {
  id: string;
  name: string;
  url: string;
  adapterType: string;
  category:
    | 'berufspolitik'
    | 'recht'
    | 'evidenz'
    | 'fortbildung'
    | 'leitlinien'
    | 'allgemein'
    | 'fachlich'
    | 'gesetz'
    | 'politik';
  iconName: string | null;
  isEnabled: boolean;
  notificationsEnabled: boolean;
  lastFetchAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
}

const CATEGORY_LABELS: Record<ClientSource['category'], string> = {
  fachlich: 'Fachlich',
  gesetz: 'Gesetz',
  politik: 'Politik',
  berufspolitik: 'Berufspolitik (alt)',
  recht: 'Recht (alt)',
  evidenz: 'Evidenz (alt)',
  fortbildung: 'Fortbildung (alt)',
  leitlinien: 'Leitlinien (alt)',
  allgemein: 'Allgemein (alt)',
};

export function SourcesManager({ initialSources }: { initialSources: ClientSource[] }) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const updateSource = async (id: string, changes: Partial<ClientSource>) => {
    const prev = sources;
    setSources((s) => s.map((src) => (src.id === id ? { ...src, ...changes } : src)));
    try {
      const res = await fetch(`/api/sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setSources(prev);
      toast.error('Änderung fehlgeschlagen');
      console.error(err);
    }
  };

  const deleteSource = async (id: string, name: string) => {
    if (!confirm(`„${name}" und alle zugehörigen Beiträge wirklich löschen?`)) return;
    const prev = sources;
    setSources((s) => s.filter((src) => src.id !== id));
    try {
      const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Quelle gelöscht');
      router.refresh();
    } catch (err) {
      setSources(prev);
      toast.error('Löschen fehlgeschlagen');
      console.error(err);
    }
  };

  const handleAdded = (created: ClientSource) => {
    setSources((s) => [...s, created]);
    setShowAddDialog(false);
    router.refresh();
  };

  // Nach Kategorie gruppieren
  const grouped = sources.reduce<Record<string, ClientSource[]>>((acc, src) => {
    (acc[src.category] = acc[src.category] || []).push(src);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowAddDialog(true)}
        className="flex items-center gap-2 w-full p-3 bg-brand text-white rounded-xl font-medium"
      >
        <Plus className="w-4 h-4" /> Quelle hinzufügen
      </button>

      {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
        const list = grouped[cat] ?? [];
        if (list.length === 0) return null;
        return (
          <section key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
              {label} ({list.length})
            </h3>
            {list.map((src) => (
              <SourceRow
                key={src.id}
                source={src}
                onUpdate={(changes) => updateSource(src.id, changes)}
                onDelete={() => deleteSource(src.id, src.name)}
              />
            ))}
          </section>
        );
      })}

      {showAddDialog && (
        <AddSourceDialog
          onClose={() => setShowAddDialog(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

function SourceRow({
  source,
  onUpdate,
  onDelete,
}: {
  source: ClientSource;
  onUpdate: (changes: Partial<ClientSource>) => void;
  onDelete: () => void;
}) {
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
            {hasError ? (
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            ) : source.lastSuccessAt ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
            ) : null}
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
        <div className="flex flex-col items-end gap-1.5">
          <SmallToggle
            enabled={source.isEnabled}
            onChange={(v) => onUpdate({ isEnabled: v })}
            aria="Quelle aktivieren/deaktivieren"
          />
          <button
            onClick={() => onUpdate({ notificationsEnabled: !source.notificationsEnabled })}
            className="p-1 text-muted-foreground"
            aria-label={source.notificationsEnabled ? 'Push für Quelle aus' : 'Push für Quelle ein'}
            title={source.notificationsEnabled ? 'Push für Quelle aktiv' : 'Push für Quelle aus'}
          >
            {source.notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
          <button
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

function SmallToggle({
  enabled,
  onChange,
  aria,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  aria: string;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      aria-label={aria}
      className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-brand' : 'bg-muted'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-4' : ''
        }`}
      />
    </button>
  );
}

function AddSourceDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (s: ClientSource) => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClientSource['category']>('fachlich');
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Quelle hinzufügen</h2>
          <button onClick={onClose} aria-label="Schließen">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          PhysioNews versucht, einen RSS-Feed unter der URL zu finden. Wenn keiner gefunden wird, wird die Seite als HTML-Quelle aufgenommen.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-medium">URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/news"
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wird aus dem Feed-Titel ermittelt"
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ClientSource['category'])}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-brand text-white rounded-xl font-medium disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Hinzufügen
          </button>
          <button onClick={onClose} className="px-4 text-sm text-muted-foreground">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
