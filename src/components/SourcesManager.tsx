'use client';

/**
 * SourcesManager — Verwaltung aller News-Quellen.
 *
 * Verantwortlichkeiten:
 *  - Anzeige aller Quellen gruppiert nach Kategorie
 *  - Inline-Toggles (aktiv, Push) per PATCH /api/sources/[id]
 *  - Löschen per DELETE /api/sources/[id]
 *  - Neue Quelle hinzufügen via AddSourceDialog (POST /api/sources)
 *
 * Sub-Komponenten in src/components/sources/:
 *  - SourceRow: Darstellung einer einzelnen Zeile
 *  - AddSourceDialog: Modal zum Hinzufügen
 *  - types: ClientSource
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { SourceRow } from './sources/SourceRow';
import { AddSourceDialog } from './sources/AddSourceDialog';
import type { ClientSource } from './sources/types';
import { VISIBLE_CATEGORIES, CATEGORY_LABELS, isVisibleCategory } from '@/lib/categories';

export interface SourcesManagerProps {
  initialSources: ClientSource[];
}

export function SourcesManager({ initialSources }: SourcesManagerProps) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [showAddDialog, setShowAddDialog] = useState(false);

  /** Optimistic Update einer Quelle; bei Server-Fehler revert. */
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

  // Gruppiere Quellen nach sichtbarer Kategorie. Quellen mit Legacy-Kategorien
  // landen unter ihrer alten Kategorie (technisch erlaubt, im UI als „andere" zusammengefasst).
  const grouped = sources.reduce<Record<string, ClientSource[]>>((acc, src) => {
    const key = isVisibleCategory(src.category) ? src.category : 'sonstige';
    (acc[key] = acc[key] || []).push(src);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setShowAddDialog(true)}
        className="flex items-center gap-2 w-full p-3 bg-brand text-white rounded-xl font-medium"
      >
        <Plus className="w-4 h-4" /> Quelle hinzufügen
      </button>

      {VISIBLE_CATEGORIES.map((cat) => {
        const list = grouped[cat] ?? [];
        if (list.length === 0) return null;
        return (
          <section key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
              {CATEGORY_LABELS[cat]} ({list.length})
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

      {grouped.sonstige && grouped.sonstige.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
            Sonstige ({grouped.sonstige.length})
          </h3>
          {grouped.sonstige.map((src) => (
            <SourceRow
              key={src.id}
              source={src}
              onUpdate={(changes) => updateSource(src.id, changes)}
              onDelete={() => deleteSource(src.id, src.name)}
            />
          ))}
        </section>
      )}

      {showAddDialog && (
        <AddSourceDialog onClose={() => setShowAddDialog(false)} onAdded={handleAdded} />
      )}
    </div>
  );
}
