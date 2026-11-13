CAPTURAS DE LA APP PARA LA LANDING
Actualizado: 13/11/2026 — reemplaza la version de 09/2026, que describia
una grilla con una captura "featured". Hoy son dos carruseles.

═══════════════════════════════════════════════════════════════
1. LAS 4 DE DESKTOP — seccion "Asi se ve por dentro" (#adentro)
═══════════════════════════════════════════════════════════════

Se ven dentro de un marco de navegador de 950px de ancho, con dots y
barra de URL propios. Por eso:

  Tamano      1920 x 880 px   (ratio 2.18 — el del marco)
  Formato     PNG
  Peso        hasta 300 KB cada una (cargan lazy, pero igual)
  Ventana     navegador a 1920 de ancho, zoom 100%, tema claro

NO incluir en la captura:
  - La barra del navegador ni la del sistema. El marco de la landing ya
    pone la suya: si la captura trae otra, quedan dos navegadores uno
    adentro del otro.
  - Notificaciones, barra de favoritos, extensiones.
  - Datos de clientas reales. Nombres, telefonos y montos de gente de
    verdad se publican en una pagina abierta.

Del sidebar: dejarlo entero si no se come mas del 25% del ancho. Si
tapa mucho, cortar por su limite derecho dejando 3-5 items como pista.
Nunca retocar precios, nombres ni layout: que sea la app de verdad.

───────────────────────────────────────────────────────────────
dashboard.png      ruta: /app/dashboard  (pestana Resumen)

  Que tiene que estar en pantalla:
    - El grafico "Ingresos cobrados dia a dia" con varios dias cargados
    - El donut de estado de pedidos
    - La fila de KPIs del mes

  El hero de la landing ya muestra el DIA (cobrado hoy, por cobrar,
  pedidos). Esta captura tiene que mostrar el MES, para que las dos no
  cuenten lo mismo: que se vea el grafico, no solo los numeros de arriba.

───────────────────────────────────────────────────────────────
productos.png      ruta: /app/catalogo

  Que tiene que estar en pantalla:
    - La columna de margen, visible y con valores distintos entre si:
      alguno alto en verde y alguno bajo en rojo
    - Categorias con color
    - 8 a 12 filas, que se vea una tabla con vida

  Es LA captura que prueba el "inteligencia comercial" del titulo. Si
  todos los margenes se ven iguales, o la columna queda cortada, la
  captura no dice nada que una planilla no diga.

───────────────────────────────────────────────────────────────
presupuesto.png    ruta: /app/pedido  (paso 2 o 3, NO el paso 1)

  Que tiene que estar en pantalla:
    - El pedido ya cargado, con productos y cantidades
    - El panel Resumen de la derecha con totales calculados
    - Los pasos numerados arriba, con el actual marcado

  El paso 1 vacio no vende: muestra un formulario en blanco. Lo que
  convence es ver la cuenta armandose sola mientras cargas.

───────────────────────────────────────────────────────────────
mensajes-wa.png    ruta: /app/mensajes

  Que tiene que estar en pantalla:
    - Los tabs del embudo con sus contadores (Captacion, Presupuestos,
      Pagos, Logistica, Post-venta)
    - Las tarjetas de plantillas, con las variables {{nombre}} y
      {{negocio}} a la vista

  Conceptualmente ya estaba bien: hay que re-sacarla con la estetica
  nueva, nada mas.

═══════════════════════════════════════════════════════════════
2. LAS 3 DE CELU — seccion "En el celu" (#bolsillo)
═══════════════════════════════════════════════════════════════

Van dentro de telefonos de 218 x 498 px con object-fit: cover.

  Tamano      540 x 1170 px   (ratio 9:19.5 exacto). Las actuales son
              540 x 1204: por eso se les recorta un poco arriba o abajo.
  Formato     PNG de verdad. Las tres actuales son JPEG con extension
              .png; funciona por sniffing del navegador, pero conviene
              guardarlas bien.
  Como        DevTools a 375px (Ctrl+Shift+M) y exportar a 540 de ancho,
              o directo desde el telefono.

  mobile-analisis.png    Dashboard, pestana Analisis. Que se vea el
                         producto o cliente que mas ganancia deja.

  mobile-pedido.png      PENDIENTE DE DECISION: hoy repite "Nuevo
                         pedido", que ya esta en desktop. Propuesta:
                         cambiarla por Ventas o Cobros, que es lo que
                         se hace parada en el local con el celu.

  mobile-logistica.png   Logistica, paradas del dia. Esta queda.

═══════════════════════════════════════════════════════════════
3. OJO CON LOS EPIGRAFES
═══════════════════════════════════════════════════════════════

Cada captura tiene su texto abajo, en index.html:

  dashboard.png     "Dashboard · el pulso del mes"
  productos.png     "Productos · catalogo con margen en vivo"
  presupuesto.png   "Nuevo pedido · en 4 pasos"
  mensajes-wa.png   "WhatsApp · con embudo listo"

Si se cambia QUE pantalla va en un slot, hay que cambiar tambien el
epigrafe. Si solo se re-saca la misma pantalla, los textos quedan como
estan.

═══════════════════════════════════════════════════════════════
4. DE DONDE SACAR LOS DATOS
═══════════════════════════════════════════════════════════════

Desde la v2 del seed, las cuentas nuevas arrancan vacias: ya no hay
datos de demo. Para capturar sin exponer clientas reales hay dos
caminos:

  a) Cuenta de prueba cargada a mano: 8-12 productos, 5 clientas,
     6 pedidos en estados distintos. Es un rato de trabajo pero queda
     reusable para las proximas capturas.

  b) Correr scripts/demo-capturas.js — ya esta hecho. Se pega en la
     consola del navegador (F12 → Console) estando logueada con la
     cuenta de prueba, y carga 12 productos con margenes repartidos
     del 23% al 67%, 6 clientas, 3 proveedores y 8 pedidos de los
     ultimos 26 dias en todos los estados: cobrados, con seña,
     pendientes y uno vencido.

     Si la cuenta ya tiene datos, el script se niega a correr. Nunca
     en la cuenta real.

═══════════════════════════════════════════════════════════════
5. COMO REEMPLAZAR
═══════════════════════════════════════════════════════════════

  1. Guardar los archivos en esta carpeta con los nombres exactos de
     arriba (minusculas, .png).
  2. Commit y push. Vercel deploya solo.
  3. Recargar la landing con Ctrl+Shift+R: el service worker cachea y
     si no, se siguen viendo las viejas.

Si un archivo falta o esta roto, el marco no muestra una imagen rota:
el <img> se oculta solo y queda el fondo lila con "Vista previa".
