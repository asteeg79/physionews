'use client';

/**
 * SearchBar — Such-Eingabe im Header.
 *
 * Verhalten:
 *  - Klick auf Lupe-Icon klappt ein Input-Feld aus
 *  - Tippen (debounced 300ms) navigiert auf /?q=…
 *  - ESC oder X-Klick schließt das Feld
 *
 * Die Such-Logik selbst liegt im API-Endpoint /api/news?q=…
 * (Postgres tsvector mit deutschem Stemmer).
 */

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { withQuery } from '@/lib/query-string';

const DEBOUNCE_MS = 300;

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const initialQ = sp.get('q') ?? '';
  const [open, setOpen] = useState(initialQ.length > 0);
  const [value, setValue] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchron mit URL halten (falls anderer Klick die Query ändert)
  useEffect(() => {
    setValue(sp.get('q') ?? '');
  }, [sp]);

  // Auto-Focus beim Aufklappen
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced Navigation
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (value.trim()) params.set('q', value.trim());
      else params.delete('q');
      router.replace(withQuery(pathname, params));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open]);

  const handleClose = () => {
    setValue('');
    setOpen(false);
    const params = new URLSearchParams(sp.toString());
    params.delete('q');
    router.replace(withQuery(pathname, params));
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Suche öffnen"
        className="p-2 rounded-full hover:bg-muted transition-colors"
      >
        <Search className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="flex-1 mx-2 flex items-center gap-1 bg-muted rounded-full px-3 py-1.5">
      <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
        placeholder="Volltext-Suche…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        aria-label="Volltext-Suche"
      />
      <button
        type="button"
        onClick={handleClose}
        aria-label="Suche schließen"
        className="p-0.5 text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
