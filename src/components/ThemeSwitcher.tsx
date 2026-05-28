'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { applyTheme, readTheme, writeTheme, type ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeSwitcher() {
  // 'system' als sichere Default-Annahme für SSR — Mismatch wird beim Hydration korrigiert.
  const [pref, setPref] = useState<ThemePreference>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPref(readTheme());
    setMounted(true);
  }, []);

  const handleChange = (next: ThemePreference) => {
    setPref(next);
    writeTheme(next);
    applyTheme(next);
  };

  return (
    <div
      className="grid grid-cols-3 gap-1 p-1 bg-card border border-border rounded-xl"
      role="radiogroup"
      aria-label="Erscheinungsbild"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mounted && pref === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => handleChange(opt.value)}
            className={`flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors ${
              active
                ? 'bg-brand text-white font-medium'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
