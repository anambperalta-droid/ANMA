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

## Pendientes

1. **Las 4 capturas de escritorio son de septiembre.** Al reemplazar cualquier PNG, correr `node scripts/optimizar-capturas.cjs`: genera el `.webp` que la pagina sirve e imprime el width/height que hay que poner en el `<img>`. El PNG queda como fuente, no se publica a nadie (el `<source>` gana siempre). Siguen valiendo las reglas: `dashboard.png`, `productos.png`, `presupuesto.png`, `mensajes-wa.png`. Deben ir a 1920 de ancho y **las 4 con la misma altura** (el marco no recorta, pero el carrusel pega un salto si difieren). Hay un inyector de datos de ejemplo en `scripts/demo-capturas.js` para no publicar datos de clientes reales.
2. **En celular esas capturas se ven borrosas** (1920px metidos en 290px). Ana decidió dejarlo por ahora. La solución sería un recorte de la zona importante + `srcset`.
3. **No hay Tailwind.** El CDN se saco el 16/11: compilaba CSS en el navegador para veinte clases. Esas clases viven ahora en el bloque UTILIDADES del `<style>`, con los mismos valores que generaba Tailwind (incluidos los line-height, que Tailwind ata al font-size). Si aparece una clase nueva tipo `text-sm`, se escribe ahi.
4. `sharp` está instalado con `--no-save`: está en `node_modules` pero no en `package.json`. Si alguna vez se corre `npm ci`, hay que reinstalarlo para usar el script de las manos.

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
