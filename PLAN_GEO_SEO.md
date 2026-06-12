# 📈 Plan GEO + SEO — ANMA Hub

> GEO (Generative Engine Optimization) = aparecer **citado** en respuestas de IA
> (ChatGPT, Perplexity, Google AI Overviews, Gemini, Claude). SEO tradicional te
> rankea; GEO te hace la respuesta. ~45% de las búsquedas de Google ya muestran
> AI Overviews. Actualizado: 11/06/2026.

---

## ✅ FASE 1 — Fundación técnica (IMPLEMENTADA 11/06/2026)

| Pieza | Estado | Para qué sirve |
|---|---|---|
| `robots.txt` con bots de IA permitidos (GPTBot, PerplexityBot, ClaudeBot, Google-Extended, Bingbot) | ✅ | Si el bot no entra, esa IA no te puede citar |
| `sitemap.xml` | ✅ | Descubrimiento de páginas |
| `llms.txt` | ✅ | Resumen del producto legible por IAs (qué es, para quién, links clave) |
| `pricing.md` | ✅ | Los agentes de IA comparan productos programáticamente; precio opaco = filtrado |
| Schema `SoftwareApplication` con audiencia + features + precio | ✅ | Entidad reconocible, +30-40% visibilidad |
| Schema `FAQPage` (4 preguntas) | ✅ | Extracción directa de Q&A en AI Overviews |
| Canonical + OG image + twitter cards | ✅ | Ya existían |
| Sección "Para quién" con 4 rubros explícitos (indumentaria, decoración, tecnología, almacén) | ✅ | Las IAs citan contenido entity-rich: "mejor sistema de gestión para tienda de ropa Argentina" |

## 🔜 FASE 2 — Contenido citable (próximas 2-4 semanas)

Las IAs citan ~33% artículos comparativos y ~15% guías definitivas. Crear en `/blog/` o como páginas estáticas:

1. **Comparativa honesta**: "Excel vs sistema de gestión: cuándo conviene cada uno" — tabla comparativa, balanceada (las IAs penalizan el sesgo obvio).
2. **Guía por rubro** (programmatic-lite, 4 páginas): "Cómo controlar stock en una tienda de indumentaria / decoración / tecnología / almacén" — H2 que matchean cómo pregunta la gente, respuesta directa en los primeros 60 caracteres de cada sección.
3. **Datos propios** (+37% citación): cuando haya ≥20 clientes, publicar un dato original tipo "los comercios que usan seguimiento por WhatsApp recuperan X% de presupuestos pendientes". Los datos originales son lo MÁS citado.

Reglas de redacción: respuesta directa primero (40-60 palabras), fecha de actualización visible, estadísticas con fuente, nada de keyword stuffing (-10% en IAs).

## 🔜 FASE 3 — Presencia de terceros (cuando haya tracción)

Las marcas se citan 6,5× más vía terceros que por su propio dominio:
- Perfil en directorios SaaS hispanos y reviews (Capterra tiene versión es-AR).
- Responder en Reddit (r/Argentina, r/emprendedores) y foros donde se pregunta "sistema de gestión para mi local" — auténtico, no spam.
- Nota/entrevista en algún medio pyme argentino (genera el backlink + la cita).

## 📊 Monitoreo (mensual, 15 minutos, sin herramientas pagas)

Probar estas queries en ChatGPT, Perplexity y Google, y anotar si ANMA Hub aparece:
1. "sistema de gestión para tienda de ropa Argentina"
2. "programa para controlar stock de un almacén"
3. "app para hacer presupuestos y enviarlos por WhatsApp"
4. "alternativa a Excel para gestionar mi negocio"
5. "software de gestión con lista mayorista y minorista"

Registrar: ¿aparece ANMA? ¿quién aparece? ¿qué página citan? Eso define el contenido del mes siguiente.

## SEO tradicional — estado actual

✅ Title/description alineados, canonical, OG/twitter completos, sitemap, robots,
lang es, headings jerárquicos, mobile-first, fonts no-bloqueantes.
⚠️ Pendiente menor: Lighthouse de landing post-cambios (objetivo ≥90) y Google
Search Console (dar de alta la propiedad para ver queries reales — gratis, 10 min).
