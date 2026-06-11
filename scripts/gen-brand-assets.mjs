/**
 * Genera los assets de marca ANMA Hub desde SVG:
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

// ── Íconos PWA/iOS ──
for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  await sharp(icon, { density: 300 }).resize(size, size).png().toFile(join(PUB, name))
  console.log('✓', name)
}

// ── OG image 1200×630 ──
const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bg" cx="38%" cy="38%" r="90%">
      <stop offset="0" stop-color="#1e0a4a"/>
      <stop offset=".62" stop-color="#120630"/>
      <stop offset="1" stop-color="#0b0214"/>
    </radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8B5CF6"/>
      <stop offset=".55" stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#4C1D95"/>
    </linearGradient>
    <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#059669"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Glow decorativo -->
  <circle cx="1050" cy="80" r="260" fill="#7C3AED" opacity=".10"/>
  <circle cx="120" cy="580" r="220" fill="#10b981" opacity=".06"/>

  <!-- Ícono de marca (versión 96px) -->
  <g transform="translate(92,96)">
    <rect width="96" height="96" rx="21" fill="url(#mark)"/>
    <path fill-rule="evenodd" fill="#fff" transform="scale(1.5)"
      d="M32 13 L49.5 51 H41.2 L37.6 42.6 H26.4 L22.8 51 H14.5 Z M32 25.8 L28.4 35.6 h7.2 Z"/>
    <circle cx="69.75" cy="24.75" r="8.25" fill="#10B981" stroke="#fff" stroke-width="3.6"/>
  </g>

  <!-- Wordmark + tagline -->
  <text x="92" y="305" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="92" fill="#ffffff" letter-spacing="-2">ANMA Hub</text>
  <text x="92" y="372" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="38" fill="#c4b5fd">El centro de control para tu negocio</text>
  <text x="92" y="432" font-family="Segoe UI, Arial, sans-serif" font-weight="500" font-size="27" fill="#94a3b8">Clientes · Pedidos · Stock · Cobros — todo en una sola pantalla</text>

  <!-- Pill CTA -->
  <rect x="92" y="478" width="330" height="62" rx="31" fill="url(#cta)"/>
  <text x="257" y="518" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="26" fill="#ffffff" text-anchor="middle">Probá 7 días gratis</text>

  <!-- Mini mockup de KPI cards a la derecha -->
  <g transform="translate(790,420)" opacity=".95">
    <rect x="0" y="0" width="170" height="110" rx="14" fill="#ffffff" opacity=".07"/>
    <rect x="14" y="16" width="74" height="11" rx="5.5" fill="#a78bfa" opacity=".7"/>
    <rect x="14" y="42" width="108" height="22" rx="7" fill="#ffffff" opacity=".85"/>
    <rect x="14" y="78" width="52" height="11" rx="5.5" fill="#34d399" opacity=".8"/>
    <rect x="190" y="0" width="170" height="110" rx="14" fill="#ffffff" opacity=".07"/>
    <rect x="204" y="16" width="86" height="11" rx="5.5" fill="#a78bfa" opacity=".7"/>
    <rect x="204" y="42" width="96" height="22" rx="7" fill="#ffffff" opacity=".85"/>
    <rect x="204" y="78" width="64" height="11" rx="5.5" fill="#34d399" opacity=".8"/>
  </g>
</svg>`
await sharp(Buffer.from(og), { density: 150 }).png().toFile(join(PUB, 'og-image.png'))
console.log('✓ og-image.png')
