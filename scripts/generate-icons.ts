import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'public/icons');
mkdirSync(OUT, { recursive: true });

const BRAND = '#0E7C7B';
const WHITE = '#ffffff';

// Vollflächiges Icon (für 192, 512, apple-touch — abgerundete Ecken)
function makeIcon(size: number, rounded: number): string {
  const padding = size * 0.12;
  const fontSize = size * 0.42;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded}" ry="${rounded}" fill="${BRAND}"/>
  <!-- Welle (Pulsmotiv für Physio + Aktualität) -->
  <g transform="translate(${size * 0.5} ${size * 0.62})" stroke="${WHITE}" stroke-width="${size * 0.045}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M ${-size * 0.32} 0 L ${-size * 0.16} 0 L ${-size * 0.08} ${-size * 0.18} L 0 ${size * 0.18} L ${size * 0.08} ${-size * 0.12} L ${size * 0.16} 0 L ${size * 0.32} 0"/>
  </g>
  <text x="50%" y="${padding + fontSize * 0.7}" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-size="${fontSize}" font-weight="700" fill="${WHITE}" text-anchor="middle" letter-spacing="-2">PN</text>
</svg>`;
}

// Maskable: 80% Safe-Area, voller Hintergrund
function makeMaskable(size: number): string {
  const fontSize = size * 0.28;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BRAND}"/>
  <g transform="translate(${size * 0.5} ${size * 0.62})" stroke="${WHITE}" stroke-width="${size * 0.035}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M ${-size * 0.22} 0 L ${-size * 0.11} 0 L ${-size * 0.055} ${-size * 0.13} L 0 ${size * 0.13} L ${size * 0.055} ${-size * 0.085} L ${size * 0.11} 0 L ${size * 0.22} 0"/>
  </g>
  <text x="50%" y="${size * 0.42}" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-size="${fontSize}" font-weight="700" fill="${WHITE}" text-anchor="middle" letter-spacing="-2">PN</text>
</svg>`;
}

async function generate() {
  // Source-SVG für Diagnose speichern
  writeFileSync(join(OUT, 'icon-source.svg'), makeIcon(512, 96));

  await sharp(Buffer.from(makeIcon(192, 32))).png().toFile(join(OUT, 'icon-192.png'));
  await sharp(Buffer.from(makeIcon(512, 96))).png().toFile(join(OUT, 'icon-512.png'));
  await sharp(Buffer.from(makeIcon(180, 32))).png().toFile(join(OUT, 'apple-touch-icon.png'));
  await sharp(Buffer.from(makeMaskable(512))).png().toFile(join(OUT, 'icon-maskable-512.png'));

  // Zusätzliches favicon (transparent für browser tab)
  await sharp(Buffer.from(makeIcon(32, 4))).png().toFile(join(OUT, 'favicon-32.png'));

  console.log('✅ Icons generiert in public/icons/:');
  console.log('   - icon-192.png');
  console.log('   - icon-512.png');
  console.log('   - icon-maskable-512.png');
  console.log('   - apple-touch-icon.png');
  console.log('   - favicon-32.png');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
