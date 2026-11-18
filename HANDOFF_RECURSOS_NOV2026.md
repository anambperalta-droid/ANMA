# Handoff · Recursos

**Escrito el 18/11/2026. Reescrito el mismo día, al terminar el trabajo sobre `/recursos`.**
La sección quedó completa: **los 20 archivos sin dependencias de terceros y con una sola paleta.**
Esta hoja dice cómo quedó, con qué criterio, y qué falta.

---

## 1. Reglas de la casa (valen para todo)

- **Textos, precios, testimonios y orden de secciones NO se tocan.** Si un texto está mal, avisar y seguir.
- **No instalar Tailwind.** Se mejora sobre el CSS que ya está.
- **Sin emojis en la app.** Voz rioplatense profesional, sin jerga ("guita", "al toque", "al vuelo").
- **Cero degradés.** Rechazados por Ana: **naranja, magenta y azul** están vetados.
- **Medir, no estimar.** Abrir la página, correr JS, dar el número. Nunca "parece que".
- Trabajar en tandas chicas y verificar a 375 y 1280 después de cada una.
- **El service worker cachea.** "No veo los cambios" casi siempre es caché, no un deploy fallido.
- Las imágenes de `public/` dan 404 en un servidor estático local: Vercel las sirve en la raíz.

### Finales de línea: mirar antes de editar

No son uniformes y **un reemplazo que busca el salto equivocado falla en silencio**:

| Archivo | Salto |
|---|---|
| `index.html` (landing, raíz) | mezclado — abrirlo con `newline=''` y buscar con `\r\n` |
| `public/recursos/index.html`, `primeros-pasos.html`, `guia.html` | CRLF |
| `public/recursos/playbook-ventas.html` | **LF** |
| `public/demo.html` | CRLF |

## 2. La paleta, y el criterio que la ordena

Lo que define el sistema no es la lista de colores: es que **cada color tiene un rol y no se mezcla**.
Antes el violeta estaba en nueve lugares a la vez, botones incluidos, y el CTA no resaltaba más que
un viñetado.

| Rol | Color | Dónde |
|---|---|---|
| **Marca y estructura** | violeta `#652BDF` · `#4718AE` texto chico | títulos, filos, links, markers. **No pide clic.** |
| **Acción** | verde `#0B7D59` (`#095E43` hover) · `#6EE7B7` sobre oscuro | **solo los botones.** Nada más usa verde. |
| **Atención** | amarillo `#F6DE8B` | **solo sobre violeta oscuro.** Ver abajo por qué. |

Resto de la rampa: crema `#F5EFE4` base · `#360C72` bandas a todo el ancho · `#2B0A60` bloques
oscuros embebidos y tinta de títulos · lila `#CFBFF0` y `#B59BF5` sobre violeta · grises de texto
`#574A6B` y `#6E6383` · lavandas `#E2D2FF` `#DECDFC` `#EFE7FE` `#F1EBFD` · alertas `#B42318`
texto, `#FDECEC` fondo, `#F4CDCA` borde · `#25D366` solo WhatsApp.

**Dos números que mandan sobre el gusto, medidos en estas páginas:**

1. **Sobre crema, ningún tinte claro delimita nada.** El amarillo `#FDF6DD` sobre crema da **1.06:1**;
   el blanco, lo mismo. Un bloque sobre crema se separa **con borde o con fondo oscuro**, nunca con
   un tinte. Por eso el amarillo se usa solo sobre `#2B0A60` (11.97:1) y `#360C72` (10.84:1).
2. **`#DECDFC` como borde da 1.29:1 sobre crema: no se ve.** Los bordes van en **`#B59BF5`**
   (2.05:1 sobre crema, 2.34:1 sobre blanco). `#DECDFC` queda para separadores internos.

**Tipografía:** Figtree para todo, Poppins 600 solo en el wordmark. `h1` 800, `h2` 800, `h3` 700,
**sin tracking negativo**. Nunca declarar un peso que no se cargue: el navegador lo falsea.

## 3. Cómo está Recursos hoy (18/11, al cerrar)

`public/recursos/`: **20 HTML + `article.css`**. Más `public/demo.html`, que entró en la misma tanda.

- **Cero pedidos a terceros.** No queda un `<link>`, un `@import` ni un `src` a cdnjs ni a Google.
- **Fuentes propias** desde `/fonts` en todos.
- **Cero degradés** (eran 44) y **cero colores vetados**.
- **Foco de teclado visible** en todos, que no había en ninguno.
- Los 16 artículos salen de un solo archivo: **`article.css`**. Tocarlo cambia las 16.

**Iconos: sprite propio, uno por página, con los símbolos que esa página usa.**

| Página | Usos | Símbolos | Sprite |
|---|---|---|---|
| `demo.html` | 195 | 73 | 13.781 bytes |
| `guia.html` | 121 | 52 | 9.761 bytes |
| `playbook-ventas.html` | 79 | 43 | 9.121 bytes |

Convención, igual que la landing: `24×24`, trazo 2, `currentColor`, y el `<i>` que envuelve deja en pie
las reglas de tamaño y color:

```html
<i class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-tag"/></svg></i>
```

**Los sprites se generan leyendo los `<use>` reales de cada página, no una lista escrita a mano.**
Hacerlo al revés ya falló dos veces: en `demo.html` tres iconos tenían una clase extra
(`fa-chevron-right today-arr`), se convirtieron después de armar el sprite y quedaron sin símbolo.
El catálogo maestro tiene **116 símbolos**; si hace falta uno nuevo, se agrega ahí y se regenera.

**CSP cerrado** en `vercel.json`, que era la razón de todo esto:

```
style-src 'self' 'unsafe-inline'
font-src  'self' data:
script-src 'self' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms
```

Para verificarlo **servir el CSP de verdad en local** y mirar la consola, no leer los archivos: así
apareció todo lo que faltaba. Con eso: 0 errores en 6 páginas, 0 símbolos rotos, 0 desbordes.

**Lo que NO sé y conviene medir antes de seguir optimizando:** qué artículos traen tráfico y cuáles
convierten. Hay Search Console y Clarity conectados. Con esos números, "mejorar Recursos" deja de ser
una corazonada y pasa a ser "rehacer los 3 que traen el 80%".

## 4. Pendientes

1. **`public/sw.js` tiene entradas muertas.** `BYPASS_PATTERNS` todavía lista `googleapis.com`,
   `gstatic.com` y `cdnjs.cloudflare.com`. Ya no se pide nada de ahí. No se tocó para no mover el
   service worker en el mismo cambio que el CSP.
2. **`demo.html` desborda a 375** en el strip de tabs y en las tablas. El documento no scrollea en
   horizontal (son contenedores con scroll propio) y es anterior a este trabajo: ahí solo se sacaron
   las dependencias, el diseño no se tocó porque imita la app, no la landing.
3. **`dateModified` de los 16 artículos quedó en `2026-09-10`.** No se tocó a propósito: cambiarlo sin
   cambiar el contenido es una señal falsa a Google. Se actualiza cuando se edite el texto.
4. **Las 4 capturas de escritorio de la landing son de septiembre.** Depende de Ana: 1920 de ancho y
   las cuatro con la misma altura. Después `node scripts/optimizar-capturas.cjs`.
5. **Las dos paletas no son la misma.** La landing y Recursos son violeta y crema; los tokens de la
   app (`src/index.css`) siguen siendo los de "feria" de junio, con `--brand:#F2762E` naranja y
   `--sidebar-bg:#2A2118`. Decisión pendiente.
6. Queda un emoji 👋 en el saludo del login de Hub (regla de la casa: sin emojis). Es texto, no se tocó.
7. `public/og-image.svg` quedó huérfano: es la fuente del diseño de junio y no lo usa nadie.
8. En la app pesan `app-*.css` 253 KB y la fuente de Font Awesome 153 KB. Recortarla es posible, pero
   hay nombres de icono que se arman en tiempo de ejecución: un subconjunto mal hecho deja huecos.

## 5. Los cuatro commits de esta tanda

| | Qué |
|---|---|
| `f2d087e` | `article.css`: Figtree propia y color por función. Un archivo, 16 páginas. |
| `1d9830f` | Portada y primeros pasos fuera de los CDN. Salió el naranja `#ea580c` y el ámbar `#F59E0B`. |
| `9ca9eeb` | La guía deja Font Awesome: 171 KB de cdnjs → 9.761 bytes de sprite. |
| `2ef03ea` | Playbook y `demo.html` fuera, y **CSP cerrado**. |

## 6. Dónde está todo

| | Hub | Regalos |
|---|---|---|
| Repo | `C:\Users\anamb\Downloads\ANMA\anma-app` | `C:\Users\anamb\Downloads\ANMA\anma-regalos` |
| Dominio | anmahub.com | anmaregalos.com |
| Landing | `index.html` en la raíz | `public/landing.html` |
| App | `/app` (React + Vite) | `/` (React + Vite) |
| Recursos | `public/recursos/` | — |

Ojo: en Hub `/landing.html` es un stub que redirige a `/`; en Regalos **es la landing de verdad**.

Los handoffs anteriores siguen valiendo: `HANDOFF_LANDING_NOV2026.md` (el detalle fino de la landing,
el sistema de iconos y las fuentes) y `HANDOFF.md` en `anma-regalos` (arquitectura general).
