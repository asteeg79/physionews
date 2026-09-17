/**
 * Shared types for the SourcesManager and its sub-components.
 * Client-side representation (Date-Spalten als ISO-String serialisiert).
 */

import type { NewsCategory } from '@/data/types';

export interface ClientSource {
  id: string;
  name: string;
  url: string;
  adapterType: string;
  category: NewsCategory;
  iconName: string | null;
  isEnabled: boolean;
  notificationsEnabled: boolean;
  lastFetchAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
}
