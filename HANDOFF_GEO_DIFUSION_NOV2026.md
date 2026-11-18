# Handoff · GEO de `/recursos` y plan de difusión

**Escrito el 18/11/2026.** Dos trabajos en una sesión: dejar `/recursos`
preparada para que una IA la pueda citar, y armar un plan de difusión que se
pueda ejecutar esta semana. Lo técnico está commiteado; el plan de canales es
este documento.

Commits: `c8fe6d7` (artículos) y `526aec7` (demo, robots, llms, sitemap).
Punto de partida: `711c980`.

---

## 0. Lo primero, porque cambia cómo se lee todo lo demás

Ya había mucho SEO/GEO hecho (sitemap, hreflang, schema, IndexNow, Lighthouse
CI, 18 artículos, Google Business, Bing, directorios) y el resultado es tráfico
y consultas casi nulos. **Repetir ese trabajo no iba a cambiar nada.** Así que
esta sesión hizo dos cosas distintas:

1. **Arreglar lo que estaba roto de verdad**, no agregar más de lo mismo. El
   hallazgo principal: los 16 artículos declaraban `FAQPage` en el schema pero
   **13 no mostraban una sola pregunta en la página**. Eso es structured data
   sin respaldo visible — Google lo puede ignorar, y un modelo que lee el HTML
   directamente no encontraba ninguna respuesta en forma de pregunta.
2. **Nombrar el agujero real**, que no es técnico. Está en la sección 3.

### Por qué el contenido actual no trae clientes

Tres razones, en orden de peso:

| Razón | Qué significa |
|---|---|
| **Las 18 guías responden preguntas de problema, no de compra.** | Quien busca "cómo le pongo precio a lo que vendo" está resolviendo un problema a mano, no comprando software. No hay **una sola** página que responda "qué sistema uso". |
| **Todo el trabajo fue sobre el propio dominio.** | Las preguntas de compra las contestan notas de terceros ("los 12 mejores sistemas de gestión para pymes Argentina 2026"). ANMA no figura en ninguna. Una IA no te puede citar de una lista en la que no estás. |
| **El precio pide una conversación.** | $120.000 de ingreso más $30.000 por mes no se cierra con tráfico frío, ni con el mejor artículo del mundo. El tráfico orgánico sirve para que te conozcan; el cierre es 1 a 1. El canal no acompañaba al precio. |

El precio es decisión cerrada de Ana y no se discute acá. Lo que cambia es
**a qué canal le pedimos el cierre**.

---

## 1. Qué cambió en `/recursos`, página por página

25 archivos, +434 / −83. Todo verificado sirviendo `public/` en local y
abriendo las páginas: renderizan, cero errores de consola, los 74 bloques
JSON-LD del sitio parsean.

### Los 16 artículos

| Archivo | FAQ visible | HowTo | Fecha |
|---|---|---|---|
| `como-cobrar-clientes-sin-perder-relacion` | 4 preguntas | 4 pasos | 18/11 |
| `como-poner-precios-comercio` | 4 | 4 | 18/11 |
| `control-de-datos-negocio` | 4 | 4 | 18/11 |
| `control-de-stock-tienda-de-ropa` | 4 | — | 18/11 |
| `excel-vs-sistema-de-gestion` | 4 | 4 | 18/11 |
| `gestion-almacen-distribuidora` | ya tenía | — | 18/11 |
| `gestion-del-tiempo-comercio` | 3 | — | 18/11 |
| `gestion-local-decoracion` | ya tenía | — | 18/11 |
| `implementacion-sistema-gestion` | 3 | 3 | 18/11 |
| `organizacion-optimizacion-negocio` | 4 | 4 | 18/11 |
| `que-es-margen-real-comercio` | 4 | 3 | 18/11 |
| `registro-base-de-clientes` | 3 | 4 | 18/11 |
| `registro-proveedores-compras` | 4 | 5 | 18/11 |
| `relacion-con-proveedores` | 3 | 4 | 18/11 |
| `seguimiento-postventa-clientes` | 3 | 5 | 18/11 |
| `stock-tecnologia-electronica` | ya tenía | — | 18/11 |

Tres detalles de criterio que importan:

- **El texto de las FAQ visibles no es nuevo.** Es exactamente el que ya
  estaba en el `FAQPage` del head. Nada que volver a verificar, y el schema y
  la página dicen lo mismo palabra por palabra, que es justo lo que se pedía.
- **Los `HowTo` se armaron leyendo el `<ol>` real de cada página**, igual que
  el sprite de iconos. Solo en los 11 artículos que tienen pasos de verdad; un
  listado de "5 señales" o "4 errores" no es un `HowTo` y no lo lleva.
- **Las fechas estaban en tres versiones a la vez**: el schema decía
  septiembre, el `<div class="meta">` decía junio en la mitad de los archivos,
  y unos pocos decían "Publicado" en lugar de "Actualizado". Ahora las tres
  dicen 18/11/2026: visible, `dateModified` y `article:modified_time`.

### Las otras cinco páginas

| Archivo | Qué cambió |
|---|---|
| `recursos/primeros-pasos.html` | `HowTo` de 5 pasos leído de los pasos visibles. `dateModified` al día y fecha visible en el footer. |
| `recursos/guia.html` | `SoftwareApplication` con los **tres precios reales** (prueba $0, ingreso $120.000, mensual $30.000) y `featureList` de 10 ítems. Fecha al día. |
| `recursos/index.html` | `dateModified` e `inLanguage` en el `CollectionPage`. |
| `public/demo.html` | **Era el agujero más grande.** Estaba en el sitemap y no tenía canonical, ni hreflang, ni OG, ni un solo bloque de schema. Y su description hablaba de un "sistema de distribución", que no es lo que vende Hub. Ahora: canonical, hreflang `es-AR` + `x-default`, OG completo, geo, `WebPage` + `BreadcrumbList` y description reescrita. |
| `recursos/playbook-ventas.html` | Sin tocar: es `noindex` y documento interno. |

### Infraestructura

**`robots.txt`** — faltaban los user-agents que de verdad deciden la citación.
Los nombres se verificaron contra la documentación de cada operador, no contra
una lista de blog:

| Agregado | Para qué sirve |
|---|---|
| `OAI-SearchBot` | **El que decide si aparecés en las respuestas de ChatGPT.** No estaba. `GPTBot` (que sí estaba) es el de entrenamiento, no el de búsqueda. |
| `Claude-SearchBot`, `Claude-User` | Indexación y búsqueda de Claude. `ClaudeBot` solo es el de entrenamiento. |
| `Perplexity-User` | Va a buscar la página cuando alguien pregunta. |
| `Applebot`, `Applebot-Extended` | Apple. El `-Extended` no crawlea, es solo la señal de permiso. |
| `DuckAssistBot`, `MistralAI-User`, `Meta-ExternalAgent` | DuckDuckGo, Mistral y Meta. |

Además cada bloque ahora repite el `Disallow` de `/api/` y `/app/`, que antes
solo valía para el `*`: los bots de IA tenían vía libre a la app.

**`llms.txt`** — tres cambios: precios en números (antes decía "pago de
ingreso único + cuota mensual", sin una sola cifra, y un agente que compara
productos descarta lo que no puede leer); un mapa de **pregunta → página** para
las 18 guías; y un bloque **"Qué no es ANMA Hub"**, para que no lo recomienden
donde no sirve (no factura ante ARCA, no es e-commerce, no es ERP, no hay plan
gratis permanente). Decir qué no hacés es lo que hace confiable lo que sí.

**`pricing.md`** — fecha al día y el mismo bloque de "qué no incluye".

**`sitemap.xml`** — 20 `lastmod` al día. **`lighthouserc.json`** — de 4 a 8 URLs
auditadas, suma `como-poner-precios`, `control-de-stock-tienda-de-ropa`, `guia`
y `demo.html`.

### Lo que NO se hizo, y por qué

- **Autor `Person` en lugar de `Organization`.** Es el cambio de mayor retorno
  que queda en la parte técnica: un autor con nombre y credenciales pesa en la
  citación mucho más que "Equipo ANMA Hub". Pero publicar el nombre completo de
  Ana en 18 páginas es una decisión suya, no mía. Hoy el nombre no aparece en
  ningún lado del sitio. **Si Ana dice que sí, es media hora de trabajo.**
- **Citas y fuentes externas en los artículos.** Hay números en el cuerpo
  ("Mercado Libre se lleva entre 13% y 36%") sin link a la fuente. Agregar la
  fuente real sube la citación, pero hay que verificar cada número antes de
  linkearlo. No se inventó ninguna fuente.
- **Dato propio.** Lo más citado de todo es un dato original. Para tenerlo
  hacen falta clientes suficientes como para que el número signifique algo. Hoy
  no están. **No se fabricó ninguno.**
- **Landings comerciales y páginas de comparación.** Es la sección 3. Es el
  trabajo que falta, y no es trabajo de schema.

---

## 2. El plan de difusión

### La regla de base: sin redes sociales, y sin plan de abrirlas

Confirmado por Ana el 18/11/2026: **no tiene redes sociales para ANMA y no las
va a desarrollar en el corto plazo.** Eso incluye Instagram, Facebook, TikTok
**y también publicar contenido en LinkedIn.**

Entonces ninguna de las diez acciones de abajo depende de abrir una cuenta, de
sostener un calendario de publicaciones ni de juntar seguidores. Las diez
funcionan con lo que ya existe: el sitio, el mail, el WhatsApp y el teléfono.

LinkedIn aparece una sola vez, y como **directorio de lectura** para encontrar
el nombre de un contador — opcional, con alternativa que no lo necesita. No
como lugar donde publicar.

### Lo que ya estaba escrito, y lo que le pasa

El `playbook-ventas.html` (v1.1, julio 2026) es bueno y está lleno de cosas
ejecutables: la oferta con garantía, la semana modelo de 3 horas por día, las
11 plantillas, los canales A a F, el tablero de métricas. **Este plan se monta
encima, no lo reemplaza.** Pero hay que decir dos cosas:

1. **Una parte del playbook ya no corre.** Da por sentado Instagram y Facebook:
   el canal B incluye DMs de Instagram, el calendario de contenido pide reels,
   stories y carruseles, la bio de Instagram es un CTA, el canal D arranca con
   "sumate a 5-8 grupos de Facebook", y el tablero de métricas pide "10 DMs de
   Instagram" y "4 posts publicados" por semana. Ana no abre esas redes para
   ANMA. **Un tablero con metas imposibles no se llena**, y probablemente sea
   parte de por qué el seguimiento se abandonó. Hay que reemplazar esas filas,
   no ignorarlas.
2. **El canal E ($54.000) queda en pausa declarada.** No es que esté mal: es
   que hoy no hay presupuesto de ads y el canal E depende de tenerlo. Queda
   anotado como "cuando haya plata, el primer peso va a Google Ads Search",
   porque es el único pago que corre sin red social. No se lo borra ni se lo
   cuenta como activo.

### Los canales, ordenados por esfuerzo contra retorno

Honesto incluye los que descarto.

| # | Canal | Esfuerzo | Retorno esperable | Veredicto |
|---|---|---|---|---|
| 1 | **Listas de terceros** ("los 12 mejores sistemas 2026", comparativas de blogs AR) | Bajo: un mail por nota | **Alto.** Es literalmente de dónde sacan la respuesta ChatGPT y Perplexity para "qué sistema uso" | **Hacer primero** |
| 2 | **Directorios de software** (AlternativeTo, SaaSHub, Capterra, GetApp, Software Advice) | Bajo: 2 horas una vez | Alto y permanente. Tráfico de intención de compra + autoridad | **Hacer primero** |
| 3 | **Contadores y estudios contables** | Medio, sostenido | **El más alto por hora invertida.** Un contador tiene 30 a 80 pymes y ya recomienda herramientas | **Hacer primero** |
| 4 | **Cámaras de comercio del interior** | Medio: un mail, después una charla de 30 min | Alto. Es el atajo al interior sin viajar ni tener marca previa | Hacer, semana 2 |
| 5 | **Contacto directo 1 a 1** (visitas, WhatsApp, email) | Alto y constante | Medio-alto, y es el único que **cierra** al precio actual | Mantener: es el motor |
| 6 | **La red inmediata por WhatsApp** | Muy bajo: un mensaje por semana | Medio. Tus contactos son emprendedores o conocen a uno, y el canal ya lo usás | Hacer, es gratis y es tuyo |
| 7 | **Reddit y Quora en español** | Medio: respuestas largas de verdad | Medio-alto para IA. ChatGPT cita Reddit seguido | **Opcional.** Nada más del plan depende de esto |
| 8 | **Google Business Profile** | Bajo: completar + 1 post semanal | Medio. Local, y Google premia los perfiles activos | Hacer, está a medias |
| 9 | **Referidos de clientes activos** | Muy bajo: un mensaje los viernes | Alto cuando hay clientes contentos | Hacer en cuanto haya base |
| 10 | **Universidades y cátedras** | Medio | Bajo y lento. Alumnos no compran a $120.000 | Después, no ahora |
| 11 | **Prensa y medios de nicho** | Alto: hay que tener una historia | Bajo sin dato propio ni clientes que contar | Esperar |
| 12 | **Radios y podcasts del interior** | Medio | Difícil de medir, audiencia poco calificada | Esperar |
| 13 | **Grupos de Facebook** | Bajo | Era el corazón del canal D | **Descartado: Ana no usa Facebook** |
| 14 | **Instagram, TikTok, reels, carruseles** | Alto y permanente | — | **Descartado por decisión de Ana** |
| 14b | **Publicar contenido en LinkedIn** | Bajo por post, alto sostenido | Medio | **Descartado: tampoco es un canal que Ana vaya a sostener** |
| 15 | **Meta Ads** | — | — | **Descartado, ya estaba** |
| 16 | **Product Hunt** | Medio | Bajo: audiencia global y técnica, producto en español para Argentina | Descartado por desalineación |
| 17 | **Google Ads Search** | Bajo de tiempo, requiere plata | Medio | En pausa hasta que haya presupuesto |
| 18 | **Más artículos en `/recursos`** | Alto | **Bajo hoy.** Ya hay 18 y ninguno trae clientes. El problema no es cantidad de guías | **No escribir más por ahora** |

El punto 18 es el más importante de la tabla. La respuesta a "no tengo tráfico"
no es la guía número 19.

### Las primeras 10 acciones

En orden. Cada una con el mensaje, a quién, y cómo se sabe si funcionó.

---

**1 · Mirar Search Console antes de hacer nada** · 15 minutos · hoy

Entrar a Search Console → Rendimiento, últimos 3 meses. Anotar dos números:
impresiones totales y clics totales.

- Impresiones con casi cero clics → el problema son los títulos y las
  descripciones, y se arregla en un día.
- Casi cero impresiones → el problema es autoridad e indexación, y lo arreglan
  las acciones 2 a 5.

**Son dos trabajos distintos y hasta no mirar ese número estamos adivinando.**
Es la única acción que nadie puede hacer en lugar de Ana.

*Medida:* los dos números, anotados en `GEO_MEDICION.md`.

---

**2 · Pedir entrar en las notas "mejores sistemas de gestión 2026"** · 2 horas · esta semana

Cuando alguien le pregunta a una IA "qué sistema de gestión me conviene en
Argentina", la respuesta sale de notas de terceros, no del sitio del producto.
Los que hoy aparecen para esas búsquedas son blogs y comparadores:
`commercy.com.ar`, `wynges.com`, `directoriolatam.com`, `cajaos.com`,
`developargentina.com`, `controlcomercio.com`. ANMA no figura en ninguno.

Mandar el mismo mail a los seis, buscando el contacto en cada sitio:

> Asunto: ANMA Hub para tu comparativa de sistemas de gestión
>
> Hola, soy Ana, hice ANMA Hub: un sistema de gestión para comercios chicos
> de Argentina — pedidos, stock con variantes, clientes mayoristas y
> minoristas, cobros y WhatsApp, pensado para quien hoy trabaja con Excel.
>
> Vi tu nota de los mejores sistemas de gestión para pymes. Te dejo los datos
> para que lo evalúes si te parece que suma: anmahub.com, demo sin registro en
> anmahub.com/demo.html y los precios abiertos en anmahub.com/pricing.md.
>
> Si querés probarlo con datos reales te abro una cuenta sin cargo y sin
> compromiso de que lo incluyas.

*Medida:* mails enviados / respuestas / notas donde apareciste. Una sola
inclusión cambia la respuesta de las IA para la pregunta que más importa.

---

**3 · Cargar los 5 directorios de software** · 2 horas · un sábado a la mañana

AlternativeTo, SaaSHub, Capterra, GetApp y Software Advice. Mismo texto en los
cinco, sacado de `llms.txt` (ya está escrito y es verificable), mismas
capturas, link a `anmahub.com` y a `/recursos/guia`.

En AlternativeTo listarlo explícitamente como alternativa a **Excel** y a los
nombres que aparecen en todas las comparativas argentinas: Tango, Xubio,
Colppy, Contabilium, Alegra, Dux. Esa es la búsqueda que hace la gente.

*Medida:* 5 perfiles publicados. Después, visitas con `utm_source` del
directorio en el panel de la app.

---

**4 · Cinco estudios contables** · 3 horas · esta semana

El canal de mejor relación costo/beneficio del playbook, y el que sigue sin
arrancar. **No hace falta LinkedIn para esto.** De dónde salen los nombres, en
orden de practicidad:

1. **El Consejo Profesional de Ciencias Económicas** de la jurisdicción publica
   el padrón de matriculados, con estudio y contacto. Es la fuente más limpia.
2. **Google Maps**, buscando "estudio contable" + el barrio o la ciudad. Da
   teléfono, mail y web, y sirve para quedarte con los estudios chicos.
3. **La cámara de comercio local** suele tener socios contadores listados.
4. LinkedIn, solo si ya tenés cuenta y solo para leer: "contador público" + la
   zona, filtrando estudios de 2 a 10 personas. Es opcional.

El primer contacto va por mail o por teléfono, y **no vende ANMA** (está en el
playbook y conviene respetarlo):

> Hola [nombre], trabajo con comercios y emprendedores que quieren salir de
> Excel. ¿Tenés clientes que se pierden entre planillas y papeles? Me
> interesa saber cómo lo resolvés hoy.

Cuando responden, la oferta: cuenta completa sin cargo para el estudio
mientras trabajen juntos, y condición preferencial para sus clientes.

*Medida:* 5 mensajes / respuestas / estudios con cuenta abierta / clientes
derivados. Este canal se mide en clientes, no en clics.

---

**5 · Completar Google Business al 100% y dejarlo activo** · 1 hora + 10 min semanales

Está creado pero a medias. Categoría "Software company", descripción con las
palabras que usa la gente, todas las fotos, horario, link al sitio. Después, un
posteo por semana: una novedad, un tip, una captura. Google muestra más los
perfiles activos.

*Medida:* el propio panel de Google Business da impresiones y clics por semana.

---

**6 · Reemplazar las filas imposibles del tablero** · 20 minutos · esta semana

El tablero de métricas del playbook pide "10 DMs de Instagram" y "4 posts
publicados" por semana. Eso no va a pasar. Cambiarlo por lo que sí se hace:

| Métrica nueva | Meta semanal |
|---|---|
| Mails a aliados (contadores, cámaras, blogs) | 5 |
| Respuestas de aliados | registrar, sin meta |
| Mensajes a la red inmediata con la guía | 1 |
| Posteos en Google Business | 1 |
| Respuestas en Reddit o Quora (opcional) | 2 |
| Visitas presenciales | 10 |
| WhatsApps en frío | 20 |
| Demos agendadas | 3 |
| Registros nuevos | 4 |
| Clientes activos nuevos | 1 |

Lo demás del tablero queda como está. Y la métrica que de verdad importa sigue
siendo la del playbook: **horas invertidas por cliente conseguido.** Si pasa de
5, algo del proceso hay que cambiar.

*Medida:* la planilla llena los viernes. Si tres viernes seguidos está vacía,
el problema es el tablero, no Ana.

---

**7 · Mandar la guía a tu red inmediata, uno por semana** · 15 minutos · todos los viernes

Sin red social y sin publicar nada. Es un mensaje de WhatsApp a una persona
distinta por semana, de tu propia agenda: conocidos con un comercio, ex
compañeros, proveedores, la contadora, el que te arregla la vidriera. Tus
contactos son emprendedores o conocen a uno.

La regla del playbook que importa acá: **mandá la guía, no la landing.**
`anmahub.com/recursos/guia` es valor puro y convierte mucho más que "mirá mi
app". Un mensaje, sin archivo adjunto y sin pitch:

> Hola [nombre], ¿cómo andás? Armé una guía de gestión para comercios chicos
> y me acordé de vos. Te la dejo por si te sirve o si conocés a alguien a
> quien le sume: anmahub.com/recursos/guia

Cuatro cosas de las que podés hablar si te preguntan, todas ya escritas en
`/recursos`: el margen real y por qué se calcula mal, cuándo Excel todavía
alcanza y cuándo empieza a costar plata, los cinco números de cada semana, y
cómo se le reclama un pago a un cliente sin quedar mal.

*Medida:* mensajes por semana, respuestas, y visitas a `/recursos/guia`.

---

**8 · Dos respuestas de verdad en Reddit o Quora** · 1 hora semanal · desde la semana 3

En `r/argentina`, `r/emprendedores`, `r/merval` y Quora en español aparecen
hilos pidiendo recomendaciones de software de gestión (son los que ya marcaba
el playbook; conviene confirmar que sigan activos). La regla del playbook es la
correcta y no se negocia: **90% ayuda, 10% mención**. Una respuesta completa
que resuelve la duda, y el link solo si realmente suma. El spam te banea.

Importa doble: ChatGPT cita Reddit seguido, así que una respuesta buena
posiciona en la búsqueda y en la IA al mismo tiempo.

*Medida:* respuestas publicadas, upvotes, y si aparecés en la medición mensual
de `GEO_MEDICION.md`.

---

**9 · Mail a tres cámaras de comercio del interior** · 1 hora · semana 2

Rosario, Córdoba y Mendoza para arrancar. Buscar en la web de cada cámara al
referente de capacitación o comunicación. La oferta es la del playbook y no
cuesta nada: una charla virtual de 30 minutos, gratis, sobre cómo se pierde
plata por desorganización. ANMA se menciona al final como ejemplo, no como
venta.

*Medida:* mails / respuestas / charlas agendadas / asistentes. Una charla de
30 personas de una cámara vale más que 300 visitas al sitio.

---

**10 · Pedir dos referidos y una reseña cada viernes** · 10 minutos semanales

A cada cliente activo y contento. La plantilla 11 del playbook ya está escrita
y funciona. La reseña va a Google Business (acción 5) y a los directorios
(acción 3), donde sirve dos veces.

*Medida:* pedidos / referidos recibidos / reseñas publicadas.

---

### Lo que viene después de estas diez

No es para esta semana, pero es el trabajo que mueve el Grupo 2 de
`GEO_MEDICION.md` — las preguntas de compra, las que hoy ANMA no puede ganar:

1. **Tres páginas de comparación**: ANMA Hub vs Excel (ya existe como
   artículo, hay que volverla comercial), vs Xubio y vs Contabilium. Las
   comparativas son el tipo de contenido más citado por las IA. Honestas, con
   los casos en que el otro conviene.
2. **Tres landings por rubro**: `/sistema-gestion-tienda-de-ropa`,
   `/sistema-gestion-regaleria`, `/sistema-gestion-almacen`. Ya estaban en el
   backlog de SEO de octubre, diferidas. Son las que responden "qué programa
   uso para mi rubro".
3. **Autor `Person`**, si Ana acepta poner su nombre.
4. **El primer dato propio**, cuando haya clientes suficientes para que el
   número signifique algo.

---

## 3. Cómo se mide todo esto

Tres planillas, tres ritmos. Ninguna lleva más de 20 minutos.

| Ritmo | Qué se mira | Dónde |
|---|---|---|
| **Viernes, 5 min** | El tablero de la acción 6: mails, posts, visitas, demos, registros, clientes | La planilla del playbook, con las filas nuevas |
| **Semanal, 5 min** | Impresiones y clics por consulta; visitas por `utm_source` | Search Console y el panel `/admin` de la app |
| **Primer lunes del mes, 20 min** | Las 24 preguntas: ¿te citan?, ¿qué página?, ¿a quién citan en tu lugar? | `GEO_MEDICION.md` |

La regla que ordena las tres: **una fila vacía es información, una fila
inventada arruina la serie.** Si no se midió, se deja en blanco.

### Qué esperar, y cuándo

Para que nadie se desanime en la semana tres:

- **Semanas 1 a 2** — nada visible. Se están sembrando mails y perfiles.
- **Semanas 3 a 6** — primeras visitas de los directorios y de Google
  Business. Primeras
  respuestas de contadores y cámaras. Los clientes de este período, si hay,
  vienen del 1 a 1, no del sitio.
- **Meses 2 a 3** — si alguna nota de terceros te incluyó, el Grupo 2 de la
  medición mensual empieza a moverse. Las charlas de cámara se concretan acá.
- **Meses 3 a 6** — el SEO del contenido madura. Recién acá tiene sentido
  juzgar si las 18 guías sirven, y con qué número.

---

## 4. Lo que conviene no re-descubrir

- **Un `FAQPage` en el schema sin preguntas visibles en la página no sirve.**
  Era el caso de 13 de 16 artículos. Si se agrega un artículo nuevo, el bloque
  visible va junto con el schema, y con el mismo texto.
- **`GPTBot` no es el bot que decide si ChatGPT te cita.** Ese es
  `OAI-SearchBot`. Lo mismo con `ClaudeBot` (entrenamiento) contra
  `Claude-SearchBot` y `Claude-User` (búsqueda). Permitir solo el de
  entrenamiento no te hace citable.
- **Los finales de línea siguen sin ser uniformes.** Todo lo de esta sesión se
  hizo leyendo y escribiendo con `newline=''` en Python, detectando el salto
  por archivo. Un reemplazo con el salto equivocado falla en silencio.
- **El sprite de iconos y los `HowTo` se generan leyendo el HTML real**, nunca
  una lista escrita a mano. Mismo criterio, misma razón.
- **`cleanUrls: true` en `vercel.json`: la URL real de la demo es `/demo`, no
  `/demo.html`.** `/demo.html` responde 308 y redirige. Apareció verificando el
  deploy: el canonical que le puse apuntaba a la URL que redirige, y los 18
  links internos de los artículos iban al mismo lado. Corregido en todo
  (canonical, hreflang, og:url, los dos schemas, sitemap, `llms.txt`,
  `pricing.md`, `lighthouserc.json` y los links). **Toda URL del sitio va sin
  `.html`** — era el único archivo que no seguía la regla.
- **Verificar un deploy con `curl` requiere `-L`.** Sin seguir la redirección,
  `/demo.html` devuelve 15 bytes y parece que el deploy falló.
- **Los bloques JSON-LD no los bloquea el CSP**: `application/ld+json` no se
  ejecuta. Esta sesión no agregó ningún recurso externo, así que el CSP cerrado
  en `vercel.json` sigue intacto.
- **La paleta naranja de "feria" en `src/index.css` sigue abierta** y esta
  sesión no la tocó.
- **El playbook de ventas es v1.1 de julio y tiene secciones que ya no
  corren** (Instagram, Facebook, y publicar en LinkedIn). Vale como fuente de
  plantillas y de ritmo; no como lista de canales vigentes.
- **Ninguna acción del plan requiere abrir ni sostener una red social.** Si una
  propuesta futura empieza con "publicá", está fuera del tablero antes de
  evaluarla.
