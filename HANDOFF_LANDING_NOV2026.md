# Handoff · Rediseño landing ANMA Hub

**Cerrado el 13/11/2026. Todo pusheado a `main`.** Seguimos rediseñando la web.

Archivo: `C:\Users\anamb\Downloads\ANMA\anma-app\index.html` (~140 KB, HTML plano con un `<style>` inline gigante; sin dependencias de CSS externas salvo Font Awesome y Google Fonts). **No leerlo entero de una**, buscar por secciones.

---

## Reglas de la casa

- **Textos, precios, testimonios y orden de secciones NO se tocan.** Si un texto está mal, avisar y seguir.
- **No instalar Tailwind.** Se mejora sobre el CSS que ya está.
- Sin emojis. Voz rioplatense profesional, sin jerga ("guita", "al toque", "al vuelo").
- **Medir, no estimar.** Abrir la landing en el navegador, correr JS para medir estilos computados, anchos, desbordes y contraste. Dar el número.
- Trabajar en tandas chicas y verificar a 375 y 1280 después de cada una.
- **Ya no hay Tailwind.** El CDN se saco el 16/11. Las clases con nombre de Tailwind que quedan en el markup son CSS propio, en el bloque UTILIDADES. Si falta una, se escribe ahi: no volver a cargar el CDN.
- **El service worker de la PWA cachea.** "No veo los cambios" casi siempre es caché, no un deploy fallido. Incógnito o recarga forzada.

## Referencias visuales que eligió Ana

| Sitio | Qué se tomó |
|---|---|
| navenegocios.ar | El tono de violeta |
| pilot.com/start | El sistema tipográfico (una sola familia, títulos pesados, sin tracking negativo) |
| duxsoftware.com.ar | Contexto de categoría |

---

## Sistema actual

### Paleta — rampas, no colores sueltos

Se consolidó de ~40 colores sueltos a rampas con roles claros. **Al tocar color, re-auditar contraste.**

- **Base:** crema `#F5EFE4`
- **Violeta:** `#652BDF` marca · `#4718AE` texto chico sobre claro · `#360C72` bandas a todo el ancho (Adentro, Contacto) · `#2B0A60` bloques oscuros embebidos (Planes, "Tu tiempo vale")
- **Sobre violeta el cuerpo va en lila**, nunca blanco puro: `#CFBFF0` y `#B59BF5`
- **Amarillo:** `#F6DE8B` (acento en bandas oscuras) · `#FDF6DD` tinte
- **Verde:** `#0B7D59` botón sobre claro · `#0E9B6E` medio · `#6EE7B7` sobre oscuro · `#25D366` solo WhatsApp
- **Grises de texto:** `#574A6B` y `#6E6383` (dos pasos, no tres)
- **Lavandas:** `#E2D2FF`, `#DECDFC`, `#EFE7FE`, `#F1EBFD`
- **Cero degradés.** Rechazados por Ana, no volver a proponer: **naranja, magenta, azul**. El 16/11 se limpiaron los tres que habian quedado escondidos en Planes: el magenta de la pildora, el naranja del borde del pie y el ambar de un icono. Ahora los tintes son del color que llevan adentro (amarillo con amarillo, violeta con violeta).
- **Rojos:** una sola rampa para alertas — `#B42318` texto · `#DC2626` · `#FDECEC` fondo · `#F4CDCA` borde. El rosa carmin que usaban los testimonios se replego aca.
- Sobre bandas violetas los botones llevan **sombra oscura, no halo verde, y sin pulso**.

### Tipografía

**Figtree para todo** (Poppins solo en el wordmark). Sistema de Pilot:

- `.h1` 50px / line-height 1.08 / **weight 800** / `letter-spacing: normal`
- `.h2` 40px / 1.08 / 800 / normal
- Bajadas de sección: 18px / 1.5, todas iguales
- Resto del display y negritas: 700. Chrome de UI (chips, etiquetas, nav): 600
- **Nunca declarar un peso que el `<link>` no cargue** — el navegador lo falsea

### Espacios

- Secciones: **44px** arriba y abajo (34px en mobile)
- Encabezado de sección, idéntico en las 8: **ojo → título 12px**, **título → bajada 10px**
- Cards: padding 22px
- Hero: 40px / 48px
- **Cortes responsive (16/11):** 400 · 420 · 480 · 540 · 640 · 680 · 768 · 920 · 1023 · 1180. No agregar uno nuevo sin mirar si alguno de esos sirve. **Mobile first: terminado el 17/11.** No queda un solo `max-width` en el archivo. Hecho: NAV (481, 769), HERO (421, 541, 641, 681, 921, 1181), PIE y FAQ (681, 769), COMO FUNCIONA / PARA QUIEN / CONTACTO (681, 921, 1024), ADENTRO (641, 681, 921), BOLSILLO (641, 769, 921) y PLANES (681). Falta: testimonios (planes es la mas enredada: tiene cuatro selectores que enganchan por `[style*=...]`). Al convertir, medir la escalera real en el navegador en vez de leer el CSS: en el pie, catorce reglas repartidas en cinco cortes eran en los hechos dos escalones. Ojo con borrar por texto exacto: si la linea que se borra es igual a una que se acaba de escribir en el escalon, se borran las dos. **Estilos inline (16/11):** de los 128 elementos con `style=`, los 37 que chocaban con una media query ya pasaron al CSS, al bloque LO QUE ESTABA INLINE del final (ahi es donde estaba parada la declaracion inline en la cascada). Los otros 91 no molestan: ninguna media query los toca. Ojo con los selectores tipo `div[style*="..."]`: si se saca ese inline, el selector deja de enganchar. Quedan cuatro, todos en Planes.  Falta: hero, pasos, adentro, bolsillo, rubros, testimonios, planes, FAQ, pie. Regla al convertir: la base lleva los valores de telefono y los `min-width` solo agregan lo que entra con mas ancho; si una regla no tiene base con el mismo selector, hay que escribir el valor de escritorio a mano (son 160 casos, por eso va de a una seccion).

### Accesibilidad

Auditoría de contraste sobre toda la página: **0 fallos AA**. El 16/11 se sumaron cuatro cosas: un skip link (`.skip-link`, aparece al tabular), `prefers-reduced-motion` que apaga las once animaciones y el scroll suave de los carruseles, areas de toque de 24x24 minimo en los puntos y en dos enlaces de Planes, y los rotulos de los pasos de Planes pasaron de `<h4>` a `<p class="pay-step-t">` porque venian antes del `<h3>` de la seccion. Áreas de toque en celular corregidas (menú 44px, flechas 40px, puntos del carrusel con padding, enlaces del pie 36px).

---

## Las fotos de las manos

La sección "La misma app, desde el celu" usa **fotos reales** de una mano sosteniendo un celular, con la captura montada dentro de la pantalla.

- `public/screens/mano-base.png` — foto original 1024×1536, pantalla en verde `#00FF00`. **No borrar.**
- `public/screens/celu-*.webp` — las tres finales, 680×1039, ~60 KB
- Para rehacerlas: reemplazar `mobile-analisis.png`, `mobile-pedido.png`, `mobile-logistica.png` (540×1170) y correr:

```bash
node scripts/montar-celus.cjs
```

El script recorta la foto, detecta el rectángulo verde, mete la captura con esquinas redondeadas y exporta las tres `.webp`. Las tres van en el mismo sentido (mano derecha): el espejado del medio se sacÃ³ el 16/11.

El panel usa `#DECDFC`, **el mismo fondo de las fotos**, por eso no se ve el borde de las imágenes. Si se recomprimen, verificar que el fondo siga dando `#DECDFC`.

---


## La marca (16/11)

Se reemplazo el logo viejo: tenia degrades y magenta, los dos vetados, y desaparecia sobre la banda violeta.

- `public/logo-mark.svg` — fondo claro (nav). Tile violeta con esquina squircle, corte diagonal en violeta profundo y la A calada en crema. La A es grande y llega al borde de arriba.
- `public/logo-mark-inv.svg` — fondo oscuro (pie).
- `public/favicon.svg` — la misma marca a sangre, sin el tile mas bajo, para que aguante a 16px.

**Cerrado el 17/11.** Los PNG (`favicon-32`, `favicon-48`, `favicon-a`, `icon-192`, `icon-512`, `apple-touch-icon`) se regeneraron desde `favicon.svg`, y la imagen de compartir (`public/og-image.png`, 1200x630) se rehizo con la marca nueva: banda violeta `#360C72`, el mismo tile con corte del nav, wordmark en crema, bajadas en lila, pildora en amarillo `#F6DE8B` sobre texto `#2B0A60`. Cero degrades, cero verde de marca. Los textos de la OG no se tocaron.

Todo sale de un solo comando:

```bash
node scripts/gen-brand-assets.mjs
```

Regenera los seis iconos **y** la OG (antes la OG estaba detras de un flag `--og` para no pisar la version vieja; ya no hace falta).

`public/og-image.svg` quedo viejo: es la fuente del diseno de junio y no lo usa nadie (el `<meta>` apunta al PNG). Borrarlo o rehacerlo cuando se pase por ahi.

## Estructura y carga (17/11)

- **`<main id="contenido">`**: la pagina no tenia landmark principal. Envuelve de `#top` hasta `#contact`; el pie y la barra sticky quedan afuera. El salto de teclado (`.skip-link`) apuntaba a `#top`, el hero; ahora cae en el `<main>`.
- **Los titulos del pie eran `<h6>`** despues de un `<h2>`: dos niveles de salto. Pasaron a `<h3>` y el selector `.foot-col h6` a `.foot-col h3`. Mismo tamano, mismo peso, misma caja: verificado a 12 anchos, las unicas diferencias son los tres nombres de etiqueta.
- **`preconnect` a cdnjs**: Font Awesome abria un origen nuevo recien al encontrar el `<link>`. Ahora el navegador arranca la conexion antes.

### Las tipografias se sirven desde el dominio (17/11)

Google Fonts obligaba a dos conexiones nuevas (`fonts.googleapis.com` y `fonts.gstatic.com`) y a una hoja de estilos que frenaba el pintado. Los `.woff2` ahora viven en `public/fonts/` y se declaran con `@font-face` en el `<style>` de siempre. Son **los mismos archivos que servia Google**: medido a 375, 768 y 1280, los 578 elementos dan identicos, letra por letra.

- `figtree-latin.woff2` (20 KB) — la variable 400..800, lo unico que la pagina baja de verdad
- `figtree-latin-ext.woff2` (10 KB) — queda declarado con su `unicode-range` y **no se descarga**: ningun texto de la landing usa esos caracteres. Si algun dia entra uno, aparece solo
- `poppins-600-anmahub.woff2` (896 bytes) — Poppins dibuja unicamente el wordmark, asi que el archivo trae los siete signos de "ANMA Hub" y nada mas. **Si el nombre cambia hay que rehacer el subconjunto** (`https://fonts.googleapis.com/css2?family=Poppins:wght@600&text=...` y bajar el woff2 que indica)

Antes se bajaban Poppins 600 **y** 700, y el 700 no lo usaba nadie. El `<link rel="preload">` del Figtree latin esta arriba de todo para que empiece junto con el HTML. Las licencias OFL de las dos familias estan al lado de los archivos.

`vercel.json` cachea `/fonts/` un ano con `immutable`. **Por eso, para cambiar una fuente hay que cambiarle el nombre al archivo**, no pisarlo: el navegador de quien ya entro no vuelve a preguntar.

El CSP de `vercel.json` sigue permitiendo Google Fonts y cdnjs porque **la app de `/app` los sigue usando**. Cuando a la app le toque el mismo tratamiento, ahi se puede cerrar.

### Los iconos son propios (17/11)

**Se saco Font Awesome.** Costaba 171 KB (18 de CSS que bloqueaba el pintado + 153 del `fa-solid-900.woff2`) para dibujar 17 simbolos, y abria un origen de terceros. En su lugar hay un sprite propio al principio del `<body>`: 17 `<symbol>` de trazo 2 sobre caja de 24, el mismo lenguaje de los SVG sueltos que ya estaban en la pagina (tildes, flechas, WhatsApp). Pesa 3 KB (1 KB comprimido), asi que el saldo es **-171 KB de red y +1,2 KB de HTML**, y un origen externo menos.

Como se usan:

```html
<i class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-tag"/></svg></i>
```

El `<i>` que envuelve no es decorativo: es lo que deja en pie las reglas viejas (`.nav-cta .btn i{font-size:11px}`, `.nav-menu-mobile a i{width:18px;text-align:center}`, `.foot-bot .badges i{color:...}`). El `<svg>` mide `1em` y toma `currentColor`, asi que el tamano sigue saliendo del `font-size` y el color del `color`, igual que con la fuente de iconos. Para un icono nuevo: se agrega un `<symbol>` al sprite y se usa con `<use href="#i-loquesea"/>`. **No volver a cargar Font Awesome.**

Los nombres son en castellano y describen el dibujo, no la marca: `bars`, `xmark`, `rocket`, `login`, `eye`, `celu`, `users`, `tag`, `libro`, `pregunta`, `check`, `capas`, `importar`, `escudo`, `sobre`, `base`, `soporte`.

Dos cambiaron de dibujo a proposito: el escudo de `shield-halved` (la linea del medio lo hacia parecer un banderin) ahora lleva un tilde adentro, y `file-import` paso a ser una bandeja con una flecha entrando, que a 13px se lee y la hoja con flecha al lado no.

## La app de /app tambien (17/11)

Medido sobre produccion, la pantalla de login bajaba **1.060 KB**. Dos de esos pedidos sobraban:

- **La hoja de Font Awesome de cdnjs, 18 KB, no la usaba nadie.** `src/main.jsx` ya importa `@fortawesome/fontawesome-free`, asi que Vite mete el CSS y la fuente en el bundle (`assets/fa-solid-900-*.woff2`, 153 KB) y esa es la que dibuja los iconos. La de cdnjs se bajaba y la pisaba la del bundle. Se saco el `<link>` y el `<noscript>`.
- **Las tipografias ahora salen del propio dominio**, igual que en la landing: `inter-var-latin.woff2` (48 KB, la variable 300..800 en un solo archivo) y `poppins-600-latin.woff2`. Antes el `<link>` pedia Poppins 500, 600 **y** 700, y la app usa solo la 600, en dos lugares: el nombre del negocio en la barra lateral y la marca del login.

Saldo: tres origenes de terceros menos (cdnjs, fonts.googleapis, fonts.gstatic) y 18 KB que se bajaban al pedo. Verificado en el dev server y en el build: cero pedidos externos salvo Clarity, y `document.fonts.check` da verdadero para Inter, Poppins y Font Awesome.

**Lo que queda pesando en la app**, por si se encara: `app-*.css` 253 KB, `vendor-react` 227, `vendor-supabase` 181, `app-*.js` 163, y la fuente de Font Awesome 153. Esa ultima se podria recortar muchisimo (la app usa 214 iconos distintos de los miles que trae), pero hace falta `fonttools` y, sobre todo, cuidado: hay nombres de icono que se arman en tiempo de ejecucion (`` `fa fa-${cond ? 'x' : 'y'}` ``), asi que un subconjunto mal hecho deja huecos que no se ven hasta que un usuario llega a esa pantalla.

**Space Grotesk se fue (18/11).** El CSS de la app la pedia primera en el stack en 66 lugares repartidos en 10 archivos, pero **no se cargaba en ningun lado**: ni `<link>`, ni `@import`, ni paquete de npm. La app siempre se vio con Inter, el segundo de la lista. Quedaba una sola puerta abierta: quien tuviera Space Grotesk instalada en su propia maquina veia la app distinta a todos los demas. Ahora el stack es `'Inter',sans-serif` y listo. Medido en el navegador antes de sacarla: el mismo texto con los dos stacks daba 239,24 px exactos. Tambien se corrigieron dos comentarios del CSS que la nombraban.

**El CSP de `vercel.json` sigue permitiendo cdnjs y Google Fonts** porque `public/demo.html` y las cuatro paginas de `public/recursos/` los siguen usando. Cuando les toque, ahi se puede cerrar `style-src` y `font-src` a `'self'`.

## La entrada a la app (18/11)

`src/components/layout/Login.jsx`. El fondo era un degrade de violeta, naranja y magenta con tres orbes borrosos animados y una capa de grano, y la tarjeta era vidrio esmerilado oscuro. Tres de esos colores estan vetados por la marca y degrades no queda ninguno en la web.

Ahora: **violeta pleno `#360C72`** con el corte diagonal del isotipo a escala de pantalla (una sola figura plana, `clip-path`, sin un solo degrade) y el filo amarillo de la imagen de compartir arriba. La tarjeta va **blanca**, como el mock del hero, y todo lo de adentro pasa a la rampa clara: violeta `#4718AE` para lo que lleva a algun lado, verde `#0B7D59` para la accion, amarillo `#F6DE8B` solo en la pildora "Nuevo".

Se fueron los tres `.lp-orb`, el `.lp-grain`, las tres animaciones de orbe, el texto con degrade del saludo, el boton con degrade y el `linear-gradient(#F2762E,#a855f7)` del modal. Tambien los seis estilos sueltos escritos para fondo oscuro (`rgba(255,255,255,...)`, `#a78bfa`) que con la tarjeta blanca quedaban invisibles.

Tres cosas que no eran de color y se arreglaron de paso:

- **La tarjeta se cortaba.** El contenedor era `overflow:hidden` con la tarjeta centrada: en apaisado, o con el teclado abierto, el pie quedaba fuera de alcance. Ahora es `overflow:auto` con `margin:auto`, que centra cuando entra y deja scrollear cuando no.
- **No habia foco visible.** Quien navega con el teclado dependia del contorno del navegador. Ahora hay anillo violeta propio en todo lo que recibe foco dentro de la tarjeta y del modal.
- El link de rescate ("¿Tuviste link invalido antes?") quedaba pegado al separador de abajo.

Contraste medido sobre la pantalla renderizada: **0 fallos AA** en 48 nodos de texto. El isotipo pasa de `/favicon-a.png` a `/logo-mark.svg`.

**Ojo con esto:** la app y la landing tienen hoy dos paletas distintas. La landing es violeta + crema; los tokens de `src/index.css` siguen siendo los de "feria" con `--brand:#F2762E` naranja y `--sidebar-bg:#2A2118` calido. El login quedo del lado de la landing, que es de donde llega el usuario al apretar "Ingresar". Si se decide que la app tiene que ir a violeta, este login ya es el puente; si se decide al reves, hay que volver sobre el.

**Queda un emoji** en el saludo (`<em> 👋</em>` cuando no hay nombre conocido), y la regla de la casa es que en la app no van emojis. No lo toque porque es texto.

## Pendientes

1. **Las 4 capturas de escritorio son de septiembre.** Al reemplazar cualquier PNG, correr `node scripts/optimizar-capturas.cjs`: genera el `.webp` que la pagina sirve e imprime el width/height que hay que poner en el `<img>`. El PNG queda como fuente, no se publica a nadie (el `<source>` gana siempre). Siguen valiendo las reglas: `dashboard.png`, `productos.png`, `presupuesto.png`, `mensajes-wa.png`. Deben ir a 1920 de ancho y **las 4 con la misma altura** (el marco no recorta, pero el carrusel pega un salto si difieren). Hay un inyector de datos de ejemplo en `scripts/demo-capturas.js` para no publicar datos de clientes reales.
2. **En celular esas capturas se ven borrosas** (1920px metidos en 290px). Ana decidió dejarlo por ahora. La solución sería un recorte de la zona importante + `srcset`.
3. **No hay Tailwind.** El CDN se saco el 16/11: compilaba CSS en el navegador para veinte clases. Esas clases viven ahora en el bloque UTILIDADES del `<style>`, con los mismos valores que generaba Tailwind (incluidos los line-height, que Tailwind ata al font-size). Si aparece una clase nueva tipo `text-sm`, se escribe ahi.
4. `sharp` está instalado con `--no-save`: está en `node_modules` pero no en `package.json`. Si alguna vez se corre `npm ci`, hay que reinstalarlo para usar el script de las manos.

## Mobile first (cerrado el 17/11)

Los 17 bloques `max-width` que quedaban pasaron a base de telefono + `min-width` (401, 421, 541, 641, 681, 769, 921). Ningun valor cambio de numero. Tres cosas que aparecieron en el camino y conviene no olvidar:

- **Reglas muertas:** `.sub`, `.form .row`, `.roi-stats-col`, `#demo .wrap`, `.eyebrow strong`, `.hero-cta-row a[href="/demo.html"]` y los dos selectores del bloque ROI (`div[style*="border-radius:22px"]`) no matcheaban ningun elemento. Se borraron.
- **El orden importa mas que antes.** Con `max-width` alcanzaba con poner la regla al final; con `min-width` el escalon tiene que vivir al lado de su regla base. El del `.nav-in`, escrito 600 lineas mas abajo, le pisaba el padding al escalon de 769. Y `.wrap{padding-left/right}` en longhand le ganaba al `padding` shorthand del nav, aunque el nav viniera despues. Los dos escalones del `.wrap` y del nav ahora estan arriba, pegados a su base.
- **El inset de iOS de la barra sticky nunca aplico.** `@supports{.mobile-cta-bar{padding-bottom:max(12px,env(safe-area-inset-bottom))!important}}` lo pisaba el `padding:10px 12px!important` del bloque mobile, que venia despues. Como el resultado en pantalla era siempre el mismo, se saco la declaracion muerta. Si lo queres activo (que la barra respete el notch de abajo en iPhone), hay que volver a escribirlo: es un cambio de aspecto, no un arreglo invisible.

## Lo que falta de mobile first

Nada. La seccion que el markup llama `<!-- TESTIMONIOS -->` no tiene testimonios: es "Tu dia con ANMA", tres escenas de uso (`.esc-grid`). Tambien quedo mobile first (base 1 columna, `min-width:540` dos, `min-width:921` tres).

Planes se dio vuelta el 17/11 y resulto mucho menos enredado de lo que decia este handoff: de los seis selectores que enganchaban por `[style*=...]`, cinco ya no matcheaban nada (los montos se habian mudado a `.pay-step-amt` y la tarjeta cambio de `#221433` a `#1F0845`). Se borraron esos cinco; el unico vivo, `.pricing-pie > div[style*="width:1px"]`, quedo como estaba, con su inline intacto. **Cero valores tocados:** todo lo que se movio conserva el numero que tenia.

Un detalle del metodo: al medir dentro de un iframe, `max-width:680px` y `min-width:681px` dejan una banda muerta de 1px, porque el ancho que ve la media query es fraccionario. En una ventana real de 681px exactos no pasa: `min-width:681px` matchea y la tarjeta se abre en dos columnas igual que antes. Verificado.

Metodo que funciono: medir la escalera real en el navegador (iframe, descontando el ancho de la barra de scroll), escribir base de telefono + `min-width`, y comparar los 578 elementos de la pagina en varios anchos antes y despues. Las reglas viejas se borran ANTES de escribir los escalones, para no borrar lo que uno acaba de escribir.

## Commits de esta ronda

```
4abcb28  Landing: ajustes de responsive en celular
2c0130d  Landing: una sola paleta, con rampas en vez de colores sueltos
ce4aaa1  Landing: menos aire todavia, sellos en una linea y mas contraste
dd41919  Landing: menos aire y tamanos mas chicos en toda la pagina
eea553d  Landing: titulos a 800
477d30d  Landing: una sola tipografia, con el sistema de Pilot
b1f33b8  Landing: manos reales en la seccion mobile
8ad0eb2  Landing: tono Nave, banda de contraste en las capturas
```
