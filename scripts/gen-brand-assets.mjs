/**
 * Genera los assets de marca ANMA Hub desde SVG:
 *   public/favicon-32.png, favicon-48.png, favicon-a.png (160) — pestaña
 *   public/icon-192.png, icon-512.png, apple-touch-icon.png (180) — PWA/iOS
 *   public/og-image.png (1200×630) — preview al compartir en WA/redes
 * Uso: node scripts/gen-brand-assets.mjs  (requiere `npm i --no-save sharp`)
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const icon = readFileSync(join(PUB, 'favicon.svg'))

// ── Íconos: favicon, PWA, iOS ──
// Se rasteriza el SVG al tamaño final (width/height reescritos) para que no
// haya reescalado: a 16/32px la marca se tiene que leer nítida.
const ICONS = [
  [32, 'favicon-32.png'],
  [48, 'favicon-48.png'],
  [160, 'favicon-a.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
]

for (const [size, name] of ICONS) {
  const svg = Buffer.from(
    icon.toString('utf8').replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)
  )
  await sharp(svg).png({ compressionLevel: 9 }).toFile(join(PUB, name))
  console.log('✓', name, `${size}×${size}`)
}

// ── OG image 1200×630 ──
const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="tile"><path d="M32 0c17.7 0 22.6 1.1 26.7 5.3C62.9 9.4 64 14.3 64 32s-1.1 22.6-5.3 26.7C54.6 62.9 49.7 64 32 64s-22.6-1.1-26.7-5.3C1.1 54.6 0 49.7 0 32S1.1 9.4 5.3 5.3 14.3 0 32 0z" transform="translate(0,6) scale(1,0.9)"/></clipPath>
  </defs>

  <rect width="1200" height="630" fill="#360C72"/>
  <rect x="0" y="0" width="1200" height="10" fill="#F6DE8B"/>

  <!-- Marca: el mismo tile con corte que el nav -->
  <g transform="translate(92,86) scale(1.5)">
    <g clip-path="url(#tile)">
      <path d="M32 0c17.7 0 22.6 1.1 26.7 5.3C62.9 9.4 64 14.3 64 32s-1.1 22.6-5.3 26.7C54.6 62.9 49.7 64 32 64s-22.6-1.1-26.7-5.3C1.1 54.6 0 49.7 0 32S1.1 9.4 5.3 5.3 14.3 0 32 0z" transform="translate(0,6) scale(1,0.9)" fill="#652BDF"/>
      <path d="M64 6 L64 26 L26 64 L2 64 Z" fill="#4718AE"/>
    </g>
    <g transform="translate(32,33) scale(0.86) translate(-32,-32)">
      <path d="M32 9 L55 55 H43 L32 32 L21 55 H9 Z" fill="#F5EFE4"/>
      <rect x="19.5" y="37" width="25" height="8.6" fill="#F5EFE4"/>
    </g>
  </g>

  <!-- Wordmark + tagline -->
  <text x="92" y="305" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="92" fill="#F5EFE4">ANMA Hub</text>
  <text x="92" y="372" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="38" fill="#CFBFF0">El centro de control para tu negocio</text>
  <text x="92" y="432" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="27" fill="#B59BF5">Clientes · Pedidos · Stock · Cobros — todo en una sola pantalla</text>

  <!-- Pill CTA -->
  <rect x="92" y="478" width="330" height="62" rx="31" fill="#F6DE8B"/>
  <text x="257" y="518" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="26" fill="#2B0A60" text-anchor="middle">Probá 7 días gratis</text>

  <!-- Mini mockup de KPI cards a la derecha -->
  <g transform="translate(790,150)">
    <rect x="0" y="0" width="170" height="110" rx="14" fill="#2B0A60"/>
    <rect x="14" y="16" width="74" height="11" rx="5.5" fill="#B59BF5"/>
    <rect x="14" y="42" width="108" height="22" rx="7" fill="#F5EFE4"/>
    <rect x="14" y="78" width="52" height="11" rx="5.5" fill="#6EE7B7"/>
    <rect x="190" y="0" width="170" height="110" rx="14" fill="#2B0A60"/>
    <rect x="204" y="16" width="86" height="11" rx="5.5" fill="#B59BF5"/>
    <rect x="204" y="42" width="96" height="22" rx="7" fill="#F5EFE4"/>
    <rect x="204" y="78" width="64" height="11" rx="5.5" fill="#6EE7B7"/>
  </g>
</svg>`
// OG con la marca nueva: colores planos de la rampa, sin degrades.
await sharp(Buffer.from(og), { density: 150 }).png({ compressionLevel: 9 }).toFile(join(PUB, 'og-image.png'))
console.log('✓ og-image.png', '1200×630')
