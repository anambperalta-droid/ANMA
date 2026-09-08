Capturas de la app para la seccion "Asi se ve por dentro" de la landing.

4 archivos requeridos (PNG, ancho >= 1200px):

  productos.png    -> Catalogo. La captura del listado de Productos con
                       imagenes, categorias coloreadas, costo, precio y
                       margen. Es la featured del grid (mas grande, arriba).

  dashboard.png    -> Dashboard. La captura del panel principal con KPIs
                       (Ventas brutas / Ingresos caja / Ticket / Presupuestos),
                       grafico "Ingresos cobrados dia a dia" y donut "Estado
                       de pedidos".

  presupuesto.png  -> Nuevo pedido. La captura del wizard Paso 1 con el
                       panel Resumen lateral (P-0027 Borrador). Enfocar
                       en los pasos numerados y el resumen a la derecha.

  mensajes-wa.png  -> Mensajes WhatsApp. La captura con los tabs del
                       embudo (Captacion 15 / Presupuestos 13 / Pagos 10 /
                       Logistica 10 / Post-Venta 10) y los cards de
                       plantillas con variables {{nombre}}, {{negocio}}.

Ademas — 3 capturas MOBILE para la seccion "En el celu" (#bolsillo).
Elegidas por criterio de venta: NO repetir lo que ya se muestra en
#adentro, mostrar features que refuercen el uso mobile especifico.
Tomarlas desde el celular abriendo anmahub.com/app, o desde DevTools
en modo mobile (Ctrl+Shift+M, ancho ~375px):

  mobile-analisis.png    -> Dashboard PESTAÑA ANALISIS (no Resumen).
                             Muestra profundidad — "hay MAS de lo que
                             viste arriba". Ideal: producto/cliente
                             que mas ganancia da.

  mobile-pedido.png      -> Nuevo pedido mobile. Wizard Paso 2
                             (productos) o Paso 3 (entrega+precio) —
                             mostrar el flujo trabajando, no la
                             pantalla en blanco del Paso 1.

  mobile-logistica.png   -> Logistica mobile. Vista de paradas del
                             dia / entregas / ruta. Refuerza que ANMA
                             cubre el ciclo COMPLETO (no solo vender).

Aspect ratio ideal: 9:19.5 (aprox iPhone estandar). Ancho >= 750px si
querés que se vean bien al zoomear. Peso <= 250 KB cada una.

Consejos de crop (NO alterar datos ni diseño real):

  - Recortar el marco/borde negro de la ventana del navegador o del OS.
  - Sidebar: dejarlo visible entero solo si no roba mas del 25% del ancho.
    Si tapa mucho, cortar por el limite derecho del sidebar dejando solo
    3-5 items visibles como pista.
  - Bottom nav: si aparece por scroll, dejarlo (transmite mobile-first).
  - Notificaciones/toasts flotantes: cortar si estan mid-transicion.
  - Nada de retocar precios, nombres, colores o layout.

Formato recomendado:

  - PNG. JPG solo si necesitas ahorrar peso (evitar bandas de compresion
    en las categorias coloreadas).
  - Peso ideal: <= 300 KB por imagen. Usar tinypng.com si superan eso.
  - Aspecto ratio libre — el frame se adapta.

Como reemplazar:

  1. Guardar los 3 archivos en esta misma carpeta con los nombres exactos
     de arriba (todo en minusculas, .png).
  2. Commit y push. Vercel deploya solo.
  3. Recargar la landing (Ctrl+Shift+R por PWA).

Mientras no esten subidas, el frame muestra un patron rayado violeta
como placeholder — la seccion queda visible pero sin distraer.
