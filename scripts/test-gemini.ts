import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { classifyBatch } = await import('../src/lib/relevance/gemini');

  const testItems = [
    { id: '1', title: 'Bundestag beschließt Apothekenreform', sourceName: 'BMG' },
    { id: '2', title: 'Neue S3-Leitlinie zum unspezifischen Kreuzschmerz veröffentlicht', sourceName: 'AWMF' },
    { id: '3', title: 'Lilly Deutschland GmbH neuer DGSP-Bronzepartner', sourceName: 'DGSP' },
    { id: '4', title: 'Wirksamkeit der Manuellen Therapie bei chronischen Nackenschmerzen', sourceName: 'Cochrane' },
    { id: '5', title: 'Bericht zur Epidemiologie der Tuberkulose in Deutschland', sourceName: 'RKI' },
    { id: '6', title: 'PSA-Screening senkt die Sterblichkeit durch Prostatakrebs', sourceName: 'Cochrane' },
    { id: '7', title: 'Frohe Ostern wünscht der Verband', sourceName: 'VDB' },
    { id: '8', title: 'Hochintensives Intervalltraining bei gesunden Erwachsenen', sourceName: 'Cochrane' },
  ];

  console.log(`Teste Gemini mit ${testItems.length} Items...\n`);
  const start = Date.now();
  const results = await classifyBatch(testItems);
  const ms = Date.now() - start;
  console.log(`Antwort in ${ms}ms\n`);

  if (!results) {
    console.error('❌ Kein Ergebnis (API-Key fehlt oder Call gescheitert)');
    process.exit(1);
  }

  for (const item of testItems) {
    const r = results.find((x) => x.id === item.id);
    if (r) console.log(`[${r.score}] ${item.title}\n     → ${r.reason}`);
    else console.log(`[??] ${item.title} — nicht klassifiziert`);
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
