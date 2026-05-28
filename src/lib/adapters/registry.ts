import type { SourceAdapter } from './types';
import { RssAdapter } from './rss';
import { YouTubeAdapter } from './youtube';
import { IfkAdapter } from './html/ifk';
import { GenericHtmlAdapter } from './html/generic';

const adapters: SourceAdapter[] = [
  new RssAdapter(),
  new YouTubeAdapter(),
  new IfkAdapter(),

  // Stub-Adapter — werden in Phase 3 durch spezifische Implementierungen ersetzt
  new GenericHtmlAdapter('html:vpt-nrw'),
  new GenericHtmlAdapter('html:vpt'),
  new GenericHtmlAdapter('html:physioDeutschland'),
  new GenericHtmlAdapter('html:vdbNrw'),
  new GenericHtmlAdapter('html:raAlt'),
  new GenericHtmlAdapter('html:gba'),
  new GenericHtmlAdapter('html:physioDe'),
  new GenericHtmlAdapter('html:thiemeJournal'),
  new GenericHtmlAdapter('html:thiemeNewsletter'),
  new GenericHtmlAdapter('html:physiotherapeutenDe'),
  new GenericHtmlAdapter('html:cochrane'),
  new GenericHtmlAdapter('html:awmf'),
  new GenericHtmlAdapter('html:rki'),
  new GenericHtmlAdapter('html:bmg'),
  new GenericHtmlAdapter('html:dgsp'),
  new GenericHtmlAdapter('html:dvmt'),
];

const registry = new Map<string, SourceAdapter>(
  adapters.map((a) => [a.typeIdentifier, a])
);

export function getAdapter(typeIdentifier: string): SourceAdapter {
  // Unterstützt sowohl 'rss' als auch 'html:ifk' etc.
  const adapter = registry.get(typeIdentifier);
  if (!adapter) {
    throw new Error(`Kein Adapter für Typ "${typeIdentifier}" registriert.`);
  }
  return adapter;
}

export function listAdapters(): string[] {
  return [...registry.keys()];
}
