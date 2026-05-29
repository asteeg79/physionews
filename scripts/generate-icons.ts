/**
 * App-Icon-Generator.
 *
 * Motiv: stilisierte Figur mit ausgestreckten Armen, einer aus Punkten
 * gebildeten Wirbelsäule und einem Bewegungsbogen am unteren Rand.
 * Übersetzung des hochgeladenen Brand-Bildes in minimalistische Form,
 * skalierungsstabil von 32px bis 512px.
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'public/icons');
mkdirSync(OUT, { recursive: true });

const BRAND = '#75b72d';
const WHITE = '#ffffff';

/**
 * Erzeugt das SVG-Motiv im viewBox 0..32. Die `bg`-Funktion zeichnet
 * den Hintergrund (rect mit gerundeten Ecken oder voller Fläche bei
 * maskable). Die übrigen Pfade bleiben unverändert.
 */
function symbolPaths(): string {
  return `
  <!-- Kopf -->
  <circle cx="16" cy="6.6" r="1.9" fill="${WHITE}"/>

  <!-- Arme ausgestreckt, leicht nach außen geschwungen -->
  <path d="M 14.7 10 C 11 9.2, 7 10, 4 8.6"
        stroke="${WHITE}" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M 17.3 10 C 21 9.2, 25 10, 28 8.6"
        stroke="${WHITE}" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <!-- Wirbelsäule als dezent verlaufende Punkte -->
  <circle cx="16" cy="12.2" r="0.6"  fill="${WHITE}"/>
  <circle cx="16" cy="14.0" r="0.75" fill="${WHITE}"/>
  <circle cx="16" cy="15.9" r="0.9"  fill="${WHITE}"/>
  <circle cx="16" cy="17.8" r="0.9"  fill="${WHITE}"/>
  <circle cx="16" cy="19.7" r="0.85" fill="${WHITE}"/>
  <circle cx="16" cy="21.6" r="0.7"  fill="${WHITE}"/>
  <circle cx="16" cy="23.4" r="0.55" fill="${WHITE}"/>

  <!-- Bewegungsbogen unten -->
  <path d="M 5 27.2 Q 16 29.6, 27 27.2"
        stroke="${WHITE}" stroke-width="1.6"
        stroke-linecap="round" fill="none" opacity="0.85"/>
  `;
}

/**
 * Vollflächiges Icon (192/512/180/32) mit abgerundeten Ecken.
 * `radiusRatio` legt fest, wie stark die Ecken im Verhältnis zur Größe gerundet sind.
 */
function makeIcon(size: number, radiusRatio: number): string {
  const corner = (radiusRatio * 32).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${corner}" ry="${corner}" fill="${BRAND}"/>
  ${symbolPaths()}
</svg>`;
}

/**
 * Maskable-Icon: 80%-Safe-Area, voller Brand-Hintergrund.
 * Das Motiv wird auf 0.7 skaliert, damit es bei Android-Adaptive-Icons
 * niemals beschnitten wird.
 */
function makeMaskable(size: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${BRAND}"/>
  <g transform="translate(16 16) scale(0.7) translate(-16 -16)">
    ${symbolPaths()}
  </g>
</svg>`;
}

async function generate() {
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
