# Handoff · Arrancar con la sección Recursos

**Escrito el 18/11/2026, al cerrar la sesión anterior. Todo pusheado a `main` en los dos repos.**
El próximo tema es **optimizar y potenciar `/recursos`**. Esta hoja tiene lo que hace falta para
empezar sin re-descubrir nada.

---

## 1. Reglas de la casa (valen para todo)

- **Textos, precios, testimonios y orden de secciones NO se tocan.** Si un texto está mal, avisar y seguir.
- **No instalar Tailwind.** Se mejora sobre el CSS que ya está.
- **Sin emojis en la app.** Voz rioplatense profesional, sin jerga ("guita", "al toque", "al vuelo").
- **Cero degradés.** Rechazados por Ana y no vuelven: **naranja, magenta y azul** están vetados.
- **Medir, no estimar.** Abrir la página en el navegador, correr JS para medir estilos computados,
  anchos, desbordes y contraste. Dar el número. Nunca "parece que".
- Trabajar en tandas chicas y verificar a 375 y 1280 después de cada una.
- **El service worker cachea.** "No veo los cambios" casi siempre es caché, no un deploy fallido.
- `index.html` tiene finales de línea mezclados (2297 CR contra 2255 LF). Si se lee y escribe con
  traducción de saltos, git marca el archivo entero como cambiado. Abrirlo con `newline=''` y buscar
  con `\r\n`.
- Las imágenes de `public/` dan 404 en un servidor estático local: Vercel las sirve en la raíz.

## 2. La paleta de hoy (landing)

- **Base:** crema `#F5EFE4`
- **Violeta:** `#652BDF` marca · `#4718AE` texto chico sobre claro · `#360C72` bandas a todo el ancho ·
  `#2B0A60` bloques oscuros embebidos
- **Sobre violeta el cuerpo va en lila**, nunca blanco puro: `#CFBFF0` y `#B59BF5`
- **Amarillo:** `#F6DE8B` acento · `#FDF6DD` tinte
- **Verde:** `#0B7D59` botón sobre claro · `#0E9B6E` medio · `#6EE7B7` sobre oscuro · `#25D366` solo WhatsApp
- **Grises de texto:** `#574A6B` y `#6E6383`
- **Lavandas:** `#E2D2FF`, `#DECDFC`, `#EFE7FE`, `#F1EBFD`
- **Rojos (alertas):** `#B42318` texto · `#DC2626` · `#FDECEC` fondo · `#F4CDCA` borde
- **Tipografía:** Figtree para todo (Poppins solo en el wordmark). `.h1` 50px/800, `.h2` 40px/800,
  bajadas 18px/1.5. **Nunca declarar un peso que no se cargue**, el navegador lo falsea.

## 3. Cómo está Recursos hoy (medido el 18/11)

`public/recursos/`, **20 archivos HTML estáticos** más `article.css`. Último cambio: **5 de octubre**.

| Archivo | Peso | Qué es |
|---|---|---|
| `playbook-ventas.html` | 71 KB | Playbook de ventas v1.1 |
| `guia.html` | 57 KB | Guía completa tipo manual SaaS |
| `primeros-pasos.html` | 36 KB | Primeros pasos (10 min) |
| `index.html` | 29 KB | Portada de la sección |
| 16 artículos | 12–16 KB c/u | SEO: precios, stock, margen, cobros, proveedores, rubros |

**Lo que encontré al mirarla, sin tocar nada:**

1. **Los 16 artículos no cargan ninguna tipografía.** No tienen `<link>` de fuentes. `article.css` pide
   `Fraunces` en 7 reglas, más `Poppins` e `Inter`, y **ninguna de las tres llega**: los artículos se
   ven con la fuente de sistema. Son la puerta de entrada de SEO y están sin marca tipográfica.
2. **Fraunces no se usa en ningún otro lado.** La landing es Figtree desde el 16/11. Recursos quedó con
   la tipografía vieja declarada.
3. **La paleta es la vieja.** `#7C3AED`, `#5B21B6`, `#A78BFA`, `#F0ABFC` (violeta Tailwind y un magenta).
   Nada del crema `#F5EFE4` ni de la rampa actual. La sección se ve de otro producto.
4. **Cuatro archivos cargan CDNs** (`index.html`, `guia.html`, `primeros-pasos.html`, `playbook-ventas.html`):
   Font Awesome desde cdnjs y hasta **cuatro familias** de Google Fonts (Fraunces, Inter, Poppins,
   JetBrains). La landing y la app ya no cargan nada de terceros: las fuentes se sirven desde
   `public/fonts/` y los iconos son un sprite SVG propio. **Recursos es lo único que quedó afuera**, y
   es lo que mantiene abierto el CSP a cdnjs y Google Fonts en `vercel.json`.
5. Por eso mismo: **cuando Recursos salga de los CDNs se puede cerrar el CSP** (`style-src` y `font-src`
   a `'self'`), que hoy sigue abierto solo por estas páginas y por `public/demo.html`.

**Lo que NO sé todavía y conviene medir antes de decidir:** qué artículos traen tráfico real (hay Search
Console y Clarity conectados), cuáles convierten a registro, y si el index de la sección se usa como
portada o la gente entra directo desde Google.

## 4. Qué se hizo el 17 y 18/11 (contexto, no hace falta repetirlo)

**Landing (`index.html`, repo `anma-app`):**
- Mobile first terminado: **no queda un solo `max-width`** en el archivo. Base de teléfono + `min-width`
  en 401, 421, 481, 541, 641, 681, 769, 921, 1181. Se borraron 8 reglas que no matcheaban nada.
- `<main id="contenido">` (no había landmark) y la skip link apunta ahí. Los títulos del pie pasaron de
  `<h6>` a `<h3>`: ya no hay saltos de jerarquía.
- **Font Awesome afuera:** costaba 171 KB (18 de CSS + 153 del woff2) para 17 iconos. Ahora hay un sprite
  propio de 17 `<symbol>`, trazo 2 sobre caja de 24, al principio del `<body>`. Se usan así:
  `<i class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-tag"/></svg></i>`.
  El `<i>` que envuelve deja en pie las reglas de tamaño y color de siempre.
- **Tipografías propias:** `public/fonts/` con Figtree variable (latin y latin-ext) y un subconjunto de
  Poppins 600 de **896 bytes** con los siete signos de "ANMA Hub". `/fonts/` cachea un año con
  `immutable`: **para cambiar una fuente hay que cambiarle el nombre al archivo**, no pisarlo.
- La imagen de compartir (`og-image.png`) se rehizo con la paleta nueva. Un solo comando regenera iconos
  y OG: `node scripts/gen-brand-assets.mjs`.

**App (`anma-app` y `anma-regalos`):**
- La hoja de Font Awesome de cdnjs no la usaba nadie (el bundle ya la trae): fuera, 18 KB menos.
  Tipografías desde `public/fonts/`: Inter variable en un solo archivo y Poppins 600.
- `Space Grotesk` salió de 66 stacks en 10 archivos: **no se cargaba en ningún lado**, la app siempre se
  vio con Inter.
- **Login rediseñado en los dos.** Era un degradé con orbes borrosos, naranja y magenta. Ahora: color
  pleno de fondo (violeta `#360C72` en Hub, rosa `#831843` en Regalos), filo de color arriba, tarjeta
  clara (crema `#F5EFE4` / rosa `#FDF2F8`) y campos en blanco. **0 fallos AA** en los dos. De paso: la
  tarjeta se cortaba en apaisado (`overflow:hidden`), no había foco visible para teclado, y el borde de
  los campos no llegaba al 3:1 que pide la WCAG.
- **"Cifrado E2E" → "Conexión cifrada"** en los siete lugares donde estaba (logins, registro, Activar y
  la landing de Regalos). No era cierto: Supabase cifra en tránsito y en reposo, que es otra cosa.
- `sharp` quedó anotado en `package.json` (estaba con `--no-save`).

## 5. Pendientes al cerrar

1. **Las 4 capturas de escritorio de la landing son de septiembre** (`dashboard.png`, `productos.png`,
   `presupuesto.png`, `mensajes-wa.png`). Depende de Ana: 1920 de ancho y **las cuatro con la misma
   altura**. Después corre `node scripts/optimizar-capturas.cjs`.
2. **Las dos paletas no son la misma.** La landing es violeta y crema; los tokens de la app
   (`src/index.css`) siguen siendo los de "feria" de junio, con `--brand:#F2762E` naranja y
   `--sidebar-bg:#2A2118`. El login quedó del lado de la landing. Decisión pendiente.
3. Queda un emoji 👋 en el saludo del login de Hub (regla de la casa: sin emojis). Es texto, no se tocó.
4. En celular las capturas se ven borrosas (1920 metidos en 290). Ana decidió dejarlo.
5. `public/og-image.svg` quedó huérfano: es la fuente del diseño de junio y no lo usa nadie.
6. En la app pesan `app-*.css` 253 KB y la fuente de Font Awesome 153 KB. Recortar la fuente es posible
   pero hay nombres de icono que se arman en tiempo de ejecución: un subconjunto mal hecho deja huecos.

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
