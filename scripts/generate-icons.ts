import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'public/icons');
mkdirSync(OUT, { recursive: true });

const BRAND = '#75b72d';
const WHITE = '#ffffff';

/**
 * Vollflächiges Icon (192/512/apple) mit abgerundeten Ecken.
 * Pulswellen-Motiv mittig — gleiches Design wie das Header-Logo.
 */
function makeIcon(size: number, radiusRatio: number): string {
  const radius = size * radiusRatio;
  // Die Welle skaliert mit size: Pfade beziehen sich auf viewBox 0..32
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${(radius / size) * 32}" ry="${(radius / size) * 32}" fill="${BRAND}"/>
  <path d="M 5 16 L 10 16 L 12 11 L 15 23 L 18 9 L 21 18 L 23 16 L 27 16"
        stroke="${WHITE}" stroke-width="2.3"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
}

/**
 * Maskable-Icon: 80% Safe-Area, voller Brand-Hintergrund.
 * Die Welle ist etwas kleiner platziert, damit sie nicht ans Edge stößt.
 */
function makeMaskable(size: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${BRAND}"/>
  <g transform="translate(16 16) scale(0.7) translate(-16 -16)">
    <path d="M 5 16 L 10 16 L 12 11 L 15 23 L 18 9 L 21 18 L 23 16 L 27 16"
          stroke="${WHITE}" stroke-width="2.3"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;
}

async function generate() {
  // Source-SVG für Diagnose speichern
  writeFileSync(join(OUT, 'icon-source.svg'), makeIcon(512, 9 / 32));

  await sharp(Buffer.from(makeIcon(192, 9 / 32))).png().toFile(join(OUT, 'icon-192.png'));
  await sharp(Buffer.from(makeIcon(512, 9 / 32))).png().toFile(join(OUT, 'icon-512.png'));
  await sharp(Buffer.from(makeIcon(180, 9 / 32))).png().toFile(join(OUT, 'apple-touch-icon.png'));
  await sharp(Buffer.from(makeMaskable(512))).png().toFile(join(OUT, 'icon-maskable-512.png'));
  await sharp(Buffer.from(makeIcon(32, 4 / 32))).png().toFile(join(OUT, 'favicon-32.png'));

  console.log('✅ Icons generiert in public/icons/');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
