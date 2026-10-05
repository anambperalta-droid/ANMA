#!/usr/bin/env node
// IndexNow ping — notifica a Bing, Yandex, DuckDuckGo y Seznam al toque
// cuando cambia contenido en anmahub.com. Google NO soporta IndexNow (usa GSC).
//
// Uso:
//   node scripts/indexnow-ping.mjs                 → envía todas las URLs del sitemap
//   node scripts/indexnow-ping.mjs url1 url2 ...   → envía solo esas URLs
//
// Docs: https://www.indexnow.org/documentation

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const HOST = 'anmahub.com'
const KEY = 'c0a497317daf8921e2ea8f39c2a1ddb4'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`
// api.indexnow.org acepta el POST una vez y distribuye a los motores.
const ENDPOINT = 'https://api.indexnow.org/indexnow'

async function urlsFromSitemap() {
  const xml = await fs.readFile(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
}

async function main() {
  const argUrls = process.argv.slice(2).filter(Boolean)
  const urls = argUrls.length ? argUrls : await urlsFromSitemap()

  if (!urls.length) {
    console.error('✘ Sin URLs para enviar.')
    process.exit(1)
  }

  // Validación: todas las URLs tienen que ser del mismo host
  const bad = urls.filter(u => !u.startsWith(`https://${HOST}`))
  if (bad.length) {
    console.error('✘ URLs fuera del host autorizado:', bad)
    process.exit(1)
  }

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  }

  console.log(`→ POST ${ENDPOINT}`)
  console.log(`  host: ${HOST}`)
  console.log(`  urls: ${urls.length}`)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  console.log(`← ${res.status} ${res.statusText}`)
  if (text) console.log(text)

  // 200/202 = ok; 400 = payload inválido; 403 = key no verificado; 422 = urls no indexables
  if (!res.ok && res.status !== 202) {
    console.error('✘ IndexNow rechazó el ping. Verificá que', KEY_LOCATION, 'exista y contenga la key.')
    process.exit(1)
  }
  console.log('✓ Ping enviado. Bing/Yandex/DuckDuckGo lo recogen en minutos.')
}

main().catch(err => {
  console.error('✘ Error:', err)
  process.exit(1)
})
