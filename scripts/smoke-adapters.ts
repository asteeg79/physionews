import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import type { Source } from '../src/db/schema';

import { IfkAdapter } from '../src/lib/adapters/html/ifk';
import { BmgAdapter } from '../src/lib/adapters/html/bmg';
import { RkiAdapter } from '../src/lib/adapters/html/rki';
import { CochraneAdapter } from '../src/lib/adapters/html/cochrane';
import { PhysioDeutschlandAdapter } from '../src/lib/adapters/html/physio-deutschland';
import { VdbNrwAdapter } from '../src/lib/adapters/html/vdb-nrw';
import { DgspAdapter } from '../src/lib/adapters/html/dgsp';
import { RaAltAdapter } from '../src/lib/adapters/html/ra-alt';
import { VptAdapter, VptNrwAdapter } from '../src/lib/adapters/html/vpt';
import { GbaAdapter } from '../src/lib/adapters/html/gba';
import { AwmfAdapter } from '../src/lib/adapters/html/awmf';
import { DvmtAdapter } from '../src/lib/adapters/html/dvmt';

const FIX = join(process.cwd(), 'tests/adapters/fixtures');

const tests: Array<[string, string, ConstructorParameters<typeof IfkAdapter> extends never[] ? () => InstanceType<typeof IfkAdapter> : never]> = [];

const probes = [
  { name: 'IFK', fixture: 'ifk.html', baseUrl: 'https://www.ifk.de/verband/aktuelles', adapter: new IfkAdapter() },
  { name: 'BMG', fixture: 'bmg.html', baseUrl: 'https://www.bundesgesundheitsministerium.de/presse/pressemitteilungen', adapter: new BmgAdapter() },
  { name: 'RKI', fixture: 'rki.html', baseUrl: 'https://www.rki.de/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/meldungen-pressemitteilungen-node.html', adapter: new RkiAdapter() },
  { name: 'Cochrane', fixture: 'cochrane.html', baseUrl: 'https://www.cochrane.de/news', adapter: new CochraneAdapter() },
  { name: 'Physio Deutschland', fixture: 'physio-deutschland.html', baseUrl: 'https://www.physio-deutschland.de/fachkreise/news-bundesweit.html', adapter: new PhysioDeutschlandAdapter() },
  { name: 'VDB NRW', fixture: 'vdb-nrw.html', baseUrl: 'https://physio.nrw/', adapter: new VdbNrwAdapter() },
  { name: 'DGSP', fixture: 'dgsp.html', baseUrl: 'https://www.dgsp.de/news/', adapter: new DgspAdapter() },
  { name: 'RA Alt', fixture: 'raalt.html', baseUrl: 'https://www.rechtsanwaltalt.de/aktuelles/', adapter: new RaAltAdapter() },
  { name: 'VPT', fixture: 'vpt.html', baseUrl: 'https://www.vpt.de/', adapter: new VptAdapter() },
  { name: 'VPT NRW', fixture: 'vpt-nrw.html', baseUrl: 'https://vpt-nrw.de/aktuelles/', adapter: new VptNrwAdapter() },
  { name: 'G-BA', fixture: 'gba.html', baseUrl: 'https://www.g-ba.de/presse/pressemitteilungen/', adapter: new GbaAdapter() },
  { name: 'AWMF', fixture: 'awmf.html', baseUrl: 'https://register.awmf.org/de/leitlinien/aktuelle-leitlinien', adapter: new AwmfAdapter() },
  { name: 'DVMT', fixture: 'dvmt.html', baseUrl: 'https://www.dvmt.de/', adapter: new DvmtAdapter() },
];

function makeSource(url: string): Source {
  return {
    id: 'smoke',
    name: 'smoke',
    url,
    adapterType: 'test',
    category: 'evidenz',
    iconName: null,
    isEnabled: true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date(),
  };
}

console.log('Quelle              | Items | Beispiel-Titel');
console.log('--------------------|-------|------------------------------------------------------');

for (const probe of probes) {
  try {
    const html = readFileSync(join(FIX, probe.fixture), 'utf-8');
    const $ = cheerio.load(html);
    const items = probe.adapter.parse($, probe.baseUrl, makeSource(probe.baseUrl));
    const example = items[0]?.title?.slice(0, 60) ?? '—';
    const status = items.length >= 3 ? '✅' : items.length > 0 ? '⚠️ ' : '❌';
    console.log(`${status} ${probe.name.padEnd(18)} | ${String(items.length).padStart(5)} | ${example}`);
  } catch (err) {
    console.log(`❌ ${probe.name.padEnd(18)} | ERROR | ${(err as Error).message}`);
  }
}
