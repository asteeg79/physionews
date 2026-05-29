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
 * Erzeugt das SVG-Motiv im viewBox 0..32 — Design „Bewegung":
 * dynamische Figur mit nach oben gestreckten Armen, gekrümmter
 * Wirbelsäule, dezentem Halo und ausgeprägtem Schwung-Bogen.
 *
 * Skalierungsstabil von 32px (Favicon) bis 512px (PWA-Icon).
 */
function symbolPaths(): string {
  return `
  <!-- Bewegungs-Halo: subtiler Energie-Kreis um die Figur -->
  <circle cx="16" cy="16" r="13" stroke="${WHITE}" stroke-width="0.7" fill="none" opacity="0.25"/>

  <!-- Kopf (leicht versetzt zur Andeutung der Bewegung) -->
  <circle cx="14.6" cy="6.4" r="2" fill="${WHITE}"/>

  <!-- Arme strecken nach oben/außen — Sprung-/Reichen-Geste -->
  <path d="M 13.5 9 Q 8 6.5, 3 4"
        stroke="${WHITE}" stroke-width="2.1" fill="none" stroke-linecap="round"/>
  <path d="M 15.5 9 Q 21 6, 27 5"
        stroke="${WHITE}" stroke-width="2.1" fill="none" stroke-linecap="round"/>

  <!-- Hand-Punkte an den Enden -->
  <circle cx="3.2" cy="4.2" r="1" fill="${WHITE}"/>
  <circle cx="27"  cy="5.1" r="1.05" fill="${WHITE}"/>

  <!-- Gekrümmte Wirbel-Linie — folgt der Bewegung -->
  <circle cx="14.5" cy="11"   r="0.65" fill="${WHITE}"/>
  <circle cx="14.8" cy="13.1" r="0.8"  fill="${WHITE}"/>
  <circle cx="15.3" cy="15.2" r="0.95" fill="${WHITE}"/>
  <circle cx="16"   cy="17.3" r="0.95" fill="${WHITE}"/>
  <circle cx="16.7" cy="19.3" r="0.9"  fill="${WHITE}"/>
  <circle cx="17.4" cy="21.2" r="0.75" fill="${WHITE}"/>
  <circle cx="18"   cy="23"   r="0.6"  fill="${WHITE}"/>

  <!-- Schwung-Bogen unten -->
  <path d="M 4 27 Q 17 30.8, 28 26"
        stroke="${WHITE}" stroke-width="1.6"
        stroke-linecap="round" fill="none"/>
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
