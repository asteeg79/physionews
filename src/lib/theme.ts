'use client';

/**
 * Theme-Management mit drei Modi:
 *  - 'light'  → erzwingt helles Design, ignoriert OS
 *  - 'dark'   → erzwingt dunkles Design, ignoriert OS
 *  - 'system' → folgt dem OS-Setting (Default)
 *
 * Persistenz in localStorage; das Inline-Script in layout.tsx liest
 * denselben Schlüssel beim ersten Paint, um FOUC zu vermeiden.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const STORAGE_KEY = 'physionews-theme';

export function readTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function writeTheme(value: ThemePreference): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, value);
}

export function applyTheme(value: ThemePreference): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (value === 'dark') {
    root.classList.add('dark');
  } else if (value === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const matches = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', matches);
  }
}
