#!/usr/bin/env node
// Genera public/sitemap-images.xml escaneando el filesystem.
// Fuente de verdad: /public/screens/*.png + og-image + logo.
// Cada <image:image> tiene loc, title y caption (los dos usan keywords
// de busqueda real: "sistema gestion ropa", "control stock argentina", etc).
//
// Uso: node scripts/gen-image-sitemap.mjs
// En CI: corre como prebuild del workflow IndexNow.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const HOST = 'https://anmahub.com'

// Mapeo imagen -> metadata para SEO
// title: aparece en Google Images como titulo del resultado
// caption: contexto adicional, afecta ranking por keywords
const IMAGES = {
  '/screens/dashboard.png': {
    title: 'Dashboard de gestión para pymes con KPIs e ingresos',
    caption: 'Panel de control de ANMA Hub con ingresos del mes, pedidos activos y métricas de ventas para comercios y pymes argentinas.',
  },
  '/screens/productos.png': {
    title: 'Catálogo de productos con costos, precios y margen real',
    caption: 'Gestión de catálogo con costo de reposición actualizado, dos listas de precios (público y mayorista) y cálculo automático de margen por producto.',
  },
  '/screens/presupuesto.png': {
    title: 'Wizard de presupuesto en 4 pasos con panel de resumen',
    caption: 'Alta de pedido rápida con wizard de 4 pasos, cálculo automático de seña, saldo e IVA discriminado según Ley 27.743.',
  },
  '/screens/mensajes-wa.png': {
    title: 'Seguimiento de ventas por WhatsApp organizado por etapa',
    caption: 'Mensajes de WhatsApp agrupados por embudo de ventas: presupuestos pendientes, clientes a recontactar y pedidos en producción.',
  },
  '/screens/mobile-analisis.png': {
    title: 'Insights y métricas de ventas en versión mobile',
    caption: 'Panel mobile con insights del período: ticket promedio, crecimiento mensual, cobros vencidos y top productos por ganancia real.',
  },
  '/screens/mobile-pedido.png': {
    title: 'Alta de pedido mobile para comercios argentinos',
    caption: 'Carga de pedido optimizada para celular con selector de cliente, catálogo con stock en vivo y botón de envío por WhatsApp.',
  },
  '/screens/mobile-logistica.png': {
    title: 'Logística de entregas y retiros del día en mobile',
    caption: 'Paradas de reparto y retiro con direcciones, horarios y estado de cada pedido, pensado para comercios con reparto propio en Argentina.',
  },
  '/og-image.png': {
    title: 'ANMA Hub — Sistema de gestión para comercios y pymes',
    caption: 'Open Graph de ANMA Hub: app de gestión con inteligencia comercial para pymes argentinas. Presupuestos, cobros, stock y WhatsApp en un solo lugar.',
  },
  '/logo-anmahub.png': {
    title: 'Logo ANMA Hub',
    caption: 'Isotipo del sistema de gestión ANMA Hub para pymes de Argentina.',
  },
}

// Pagina donde se muestran las imagenes
const PAGE_LOC = `${HOST}/`

async function fileExists(relPath) {
  try {
    await fs.access(path.join(ROOT, 'public', relPath.replace(/^\//, '')))
    return true
  } catch { return false }
}

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

async function main() {
  const items = []
  for (const [rel, meta] of Object.entries(IMAGES)) {
    if (!(await fileExists(rel))) {
      console.warn(`  skip (no existe): ${rel}`)
      continue
    }
    items.push(
      `    <image:image>\n` +
      `      <image:loc>${HOST}${rel}</image:loc>\n` +
      `      <image:title>${xmlEscape(meta.title)}</image:title>\n` +
      `      <image:caption>${xmlEscape(meta.caption)}</image:caption>\n` +
      `    </image:image>`
    )
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    `  <url>\n` +
    `    <loc>${PAGE_LOC}</loc>\n` +
    items.join('\n') + '\n' +
    `  </url>\n` +
    `</urlset>\n`

  const out = path.join(ROOT, 'public', 'sitemap-images.xml')
  await fs.writeFile(out, xml, 'utf8')
  console.log(`✓ Generated ${out} (${items.length} imagenes)`)
}

main().catch(err => { console.error(err); process.exit(1) })
