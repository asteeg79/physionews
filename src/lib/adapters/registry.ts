import type { SourceAdapter } from './types';
import { RssAdapter } from './rss';
import { YouTubeAdapter } from './youtube';
import { GenericHtmlAdapter } from './html/generic';

import { IfkAdapter } from './html/ifk';
import { BmgAdapter } from './html/bmg';
import { RkiAdapter } from './html/rki';
import { CochraneAdapter } from './html/cochrane';
import { PhysioDeutschlandAdapter } from './html/physio-deutschland';
import { VdbNrwAdapter } from './html/vdb-nrw';
import { DgspAdapter } from './html/dgsp';
import { RaAltAdapter } from './html/ra-alt';
import { VptAdapter, VptNrwAdapter } from './html/vpt';
import { GbaAdapter } from './html/gba';
import { AwmfAdapter } from './html/awmf';
import { DvmtAdapter } from './html/dvmt';

const adapters: SourceAdapter[] = [
  new RssAdapter(),
  new YouTubeAdapter(),

  // Spezifische HTML-Adapter
  new IfkAdapter(),
  new BmgAdapter(),
  new RkiAdapter(),
  new CochraneAdapter(),
  new PhysioDeutschlandAdapter(),
  new VdbNrwAdapter(),
  new DgspAdapter(),
  new RaAltAdapter(),
  new VptAdapter(),
  new VptNrwAdapter(),
  new GbaAdapter(),
  new AwmfAdapter(),
  new DvmtAdapter(),

  // Generic-Fallback für Quellen, die noch keinen spezifischen Adapter haben
  new GenericHtmlAdapter('html:thiemeJournal'),
  new GenericHtmlAdapter('html:thiemeNewsletter'),
  new GenericHtmlAdapter('html:physiotherapeutenDe'),
  new GenericHtmlAdapter('html:physioDe'),
];

const registry = new Map<string, SourceAdapter>(
  adapters.map((a) => [a.typeIdentifier, a])
);

export function getAdapter(typeIdentifier: string): SourceAdapter {
  const adapter = registry.get(typeIdentifier);
  if (!adapter) {
    throw new Error(`Kein Adapter für Typ "${typeIdentifier}" registriert.`);
  }
  return adapter;
}

export function listAdapters(): string[] {
  return [...registry.keys()];
}
