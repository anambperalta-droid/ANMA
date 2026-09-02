# ORDEN PARA CLAUDE CODE — ANMA Regalos: rediseño de carga de pedidos

> Repo: `C:\Users\anamb\Downloads\ANMA\anma-regalos` (`anambperalta-droid/ANMA-host`)
> Ejecutar **desde ese repo**, no desde anma-app.

---

## 0. Cambio de concepto (leer antes que nada)

La app de Regalos se construyó como **generador de presupuestos para mandarle al cliente final**. Eso no es lo que el negocio necesita.

**Lo que realmente es:** un **registro interno de pedidos** + **herramienta de análisis por cliente**.

Consecuencias directas:

- El presupuesto **no se le manda al cliente**. No hay que perfeccionar el PDF, la estética del documento, ni el desglose "presentable". Todo lo que existe para que el documento se vea lindo hacia afuera es peso muerto.
- El costo real, el margen y la ganancia **son el contenido principal**, no información oculta detrás de un candado "interno".
- El negocio trabaja **100% a pedido para empresas**. **No hay stock de mercadería.** Todo lo que sea inventario, deducción de stock, valor de inventario o rotación **sale**.
- La usuaria viene de **Excel y el celular**. Carga rápido, desprolijo, a mano. La app tiene que ganarle a Excel en velocidad, no imponerle orden. El orden lo agrega la app después, sola.

**Regla que gobierna todo el rediseño:**
> Si un campo no sirve para (a) cargar más rápido, (b) saber cuánta plata gané, o (c) entender mejor al cliente — se va.

---

## 1. Qué NO se toca (bloqueado)

- **Todo el módulo comercial de WhatsApp y recontactos.** No modificar su UI, su lógica ni su modelo de datos. El rediseño puede **leerlo** y **linkear** hacia él, nunca alterarlo.
- Auth, sesión, `allowed_sites`, aislamiento de workspaces.
- Capa de sync con Supabase (`sync.js` y equivalentes): se pueden **agregar** claves al set de datos sincronizados, no reescribir el mecanismo.
- Cualquier integración de cobro existente.

---

## 2. Principios de diseño (no negociables)

1. **Una pantalla, no un wizard.** El flujo de 4 pasos (Cliente → Productos → Entrega → Confirmar) se elimina. Todo el pedido vive en una vista scrolleable con bloques colapsables.
2. **Guardar siempre, nunca perder.** Autosave en cada cambio. No existe "Siguiente" ni "Guardar y continuar". Se puede abandonar el pedido en cualquier estado.
3. **Cero campos obligatorios**, salvo: nombre de cliente + una línea con descripción. Nada más bloquea el guardado.
4. **Nada obliga a pasar por el catálogo.** El catálogo de productos pasa a ser un autocompletado opcional, no una puerta de entrada.
5. **Progresivo, no completo.** Se puede crear un pedido con 3 datos y enriquecerlo después. Un pedido incompleto es un estado válido y visible, no un error.
6. **Los números siempre a la vista y editables en los dos sentidos.** Se puede escribir el precio final redondo y que se recalcule el margen, o escribir el margen y que se recalcule el precio.
7. **Mobile es primer ciudadano** para la carga rápida, desktop para el detalle. No una versión achicada del desktop.
8. **Anti-patrones prohibidos:** wizards, modales anidados, confirmaciones innecesarias, campos que se vacían al fallar la validación, secciones que hay que abrir sí o sí, tooltips que esconden información necesaria.

---

## 3. Fase 0 — Auditoría (hacer esto primero, no escribir features todavía)

Antes de tocar código:

1. Recorrer el repo y **mapear el módulo de presupuestos**: componentes, estado, hooks, helpers de cálculo, claves de storage, tablas/campos en Supabase.
2. Documentar el **modelo de datos actual** de un presupuesto (estructura completa del objeto, incluyendo kits, alternativas, packaging, flags de stock).
3. Identificar **puntos de contacto con el módulo de WhatsApp/recontactos** — qué lee de presupuestos y qué campos espera. Esos campos son contrato: no se pueden borrar sin adaptador.
4. Listar **todo lo que existe hoy por y para el stock** (deducción, flags de idempotencia, columnas, KPIs) y marcarlo como candidato a eliminación.
5. Listar **todo lo que existe para presentar el presupuesto hacia afuera** (PDF, share, plantillas de envío) y marcarlo como candidato a archivo.

**Entregable de Fase 0:** un `PLAN-REDISENO.md` en el repo con el mapeo, el plan por fases, los riesgos y qué se rompe. **Parar acá y esperar aprobación antes de implementar.**

---

## 4. Fase 1 — Modelo de datos

Migrar el concepto de `presupuesto` a `pedido`. Mantener compatibilidad hacia atrás con un adaptador de lectura: **ningún pedido viejo puede dejar de abrirse**.

Estructura objetivo (orientativa, ajustar a las convenciones del repo):

```
pedido {
  id, numero, createdAt, updatedAt
  clienteId, clienteNombre        // nombre denormalizado, sobrevive si se borra el cliente
  estado                          // consulta | presupuestado | confirmado | produccion | entregado | cerrado | perdido
  esKit: bool                     // toggle, no decisión de arranque
  cantKits: number                // solo si esKit
  lineas: [{
    id, descripcion,              // texto libre — único campo obligatorio
    tag,                          // producto | packaging | manoDeObra | diseno | envio | otro  (opcional)
    cantidad, costoUnit, precioUnit,
    esCostoUnico: bool,           // true = no se multiplica por cantidad
    productoId?,                  // opcional, solo si vino del catálogo
    proveedorId?,                 // opcional
    estadoCompra                  // pendiente | pedido | recibido   ← reemplaza al stock
  }]
  precioFinalManual?: number      // si la usuaria escribió un número redondo, este manda
  aplicaIva: bool                 // default false
  fechaEntrega?, seniaMonto?, 
  notaInterna: string             // texto libre, largo, sin estructura
  incompleto: bool                // true si vino de carga rápida
}
```

**Eliminar del modelo:** `stockDeducted` y toda la lógica de deducción, cantidades de inventario, alertas de stock mínimo.

**Alternativas:** el sistema de "Alternativa 1 / Alternativa 2" se conserva pero **deja de estar en la pantalla por defecto**. Se accede desde un menú "…" → "Comparar opciones". El 90% de los pedidos tiene una sola opción y no debe pagar el costo visual de las otras.

---

## 5. Fase 2 — La nueva carga de pedido (el corazón)

### 5.1 Vista única `Nuevo pedido`

Una sola pantalla scrolleable. Sin stepper. Sin numeración de pasos.

---

**BLOQUE 1 — ¿Para quién?**

- Un solo input con autocompletado sobre clientes existentes.
- Si el nombre no existe: se crea el cliente al vuelo **con solo el nombre**. Teléfono, email y empresa quedan vacíos y se completan después desde la ficha (o nunca).
- Debajo del input: chips con los **últimos 5 clientes**, para elegir en un tap.
- Al seleccionar un cliente que ya compró, mostrar una **barra de contexto** compacta:
  `4 pedidos · último hace 5 meses · ticket promedio $840.000 · margen 38%`
  Esto es análisis interno apareciendo justo cuando sirve: mientras se cotiza.

---

**BLOQUE 2 — ¿Qué le vendés?** *(donde se gana o se pierde la batalla)*

Tres formas de cargar. La usuaria elige, ninguna es obligatoria.

**a) Línea libre — modo por defecto**

Una tabla editable. Una fila = `Descripción | Cant | Costo u. | Precio u. | Subtotal`.

- `Enter` desde la última celda crea la fila siguiente y pone el foco en Descripción.
- `Tab` navega entre celdas. Se carga entero sin tocar el mouse.
- Solo Descripción es obligatoria. Todo lo demás puede quedar en cero.
- Sin categoría obligatoria, sin proveedor obligatorio, sin selector de producto.
- Cada fila tiene un **tag opcional** (Producto / Packaging / Mano de obra / Diseño / Envío / Otro) accesible desde un ícono chico. Es un tag, **no una sección aparte**. Se acabó tener bloques separados de "Packaging / Insumos" y "Contenido del kit".
- Toggle por fila: `× cant` / `único`. Default `× cant`. Resuelve diseño, matricería, envío.

**b) Desde catálogo — atajo, no obligación**

- Al tipear 3+ letras en Descripción, sugerir productos del catálogo con su costo precargado.
- Elegirlo completa costo y proveedor. Ignorarlo y seguir tipeando también es válido.

**c) Pegar desde Excel — el más importante para esta usuaria**

- Botón `Pegar desde Excel`.
- Abre un textarea. La usuaria pega directo de la planilla o del celular.
- Detectar separación por tabs / comas / saltos de línea.
- Mostrar **preview con mapeo de columnas** (Descripción / Cant / Costo / Precio), corregible con selects.
- Recordar el mapeo elegido para la próxima vez.
- Confirmar → se crean todas las líneas de una.

**Toggle Kit**

- Un switch arriba de la tabla: `Es un kit`. **Apagado por defecto.**
- Al prenderlo: aparece un campo `Cantidad de kits` y las líneas pasan a interpretarse como "componentes de un kit"; el precio se calcula por kit.
- Al apagarlo: vuelve a pedido simple **sin perder ninguna línea**. Reversible siempre.
- Se elimina la pantalla de decidir "Kit / Box regalo" vs "Pedido simple" **antes** de cargar nada.

---

**BLOQUE 3 — Los números** *(siempre visibles, nunca un paso aparte)*

- Desktop: panel lateral sticky. Mobile: barra fija inferior, expandible con un tap.
- Muestra siempre: **Costo · Precio · Ganancia · Margen %**.
- **Edición bidireccional (crítico):**
  - Escribir en `Precio final` un número redondo (lo que realmente se cerró con el cliente) → recalcula margen y ganancia, y guarda `precioFinalManual`.
  - Escribir en `Margen %` → recalcula el precio sugerido.
  - Ambas direcciones, siempre. El precio real se negocia redondo, no sale de una fórmula.
- **IVA:** switch apagado por defecto. Si el negocio factura, se prende una vez en Configuración y queda persistido. No preguntar en cada pedido.
- Ocultar el candado "interno / pre-margen". Ya no hay nadie externo mirando esta pantalla.

---

**BLOQUE 4 — Estado y plata** *(reemplaza los pasos "Entrega" y "Confirmar")*

- **Estado:** una fila de chips grandes, un tap: `Consulta · Presupuestado · Confirmado · En producción · Entregado · Cerrado` (+ `Perdido` en el menú "…").
- **Fecha de entrega:** date picker con atajos: `Esta semana · Próxima semana · Fin de mes · Elegir fecha`.
- **Seña:** botones `30% · 50% · Total · Otro`. Guarda monto.
- **Nota interna:** textarea grande, libre, sin estructura. Acá va todo lo desprolijo: *"la compra Vale de RRHH, quiere logo bordado, pidió factura A, el año pasado compró 80 el 20/12"*. Es la información más valiosa del sistema y la más fácil de perder. Que sea cómoda de escribir y buscable después.

---

**Guardado**

- Autosave en cada cambio, con indicador discreto (`Guardado`).
- Un solo botón `Listo` que cierra y vuelve al listado. No valida nada más allá de cliente + una línea.
- Al abandonar sin guardar explícitamente, el pedido queda igual. No hay confirmación de descarte.

---

### 5.2 Carga rápida móvil (10 segundos)

Un FAB `+` presente en **todas** las pantallas. Abre un bottom sheet con **tres campos**:

1. **Cliente** (autocomplete + últimos 5 en chips)
2. **Qué es** (texto libre — *"80 boxes fin de año"*)
3. **Cuánto** (precio, teclado numérico)

Guarda como `estado: consulta`, `incompleto: true`. Listo.

El pedido aparece en el dashboard bajo **"Pedidos por completar"**. Desde la computadora se abre y se enriquece.

Esto no es una feature secundaria: **respeta el hábito real**. Anota en el celular con el cliente enfrente, ordena después. Si la app no permite eso, vuelve a Excel.

---

## 6. Fase 3 — Ficha de cliente (el análisis interno)

Esta es la razón de ser de la app. Hoy prácticamente no existe.

Cada cliente tiene una ficha con:

**Cabecera:** nombre, empresa, contacto, tags libres (rubro, tamaño, cómo llegó).

**Métricas:**

- Total facturado · Total ganancia · Margen promedio
- Cantidad de pedidos · Ticket promedio
- Primer pedido · Último pedido · Días desde el último
- Frecuencia promedio de compra

**Línea de tiempo** de pedidos: fecha, descripción corta, monto, margen, estado. Clickeable.

**Qué suele pedir:** agregado de las descripciones y productos más repetidos de ese cliente.

**Estacionalidad:** mini-heatmap de 12 meses mostrando en qué meses compró históricamente. En regalos corporativos esto es decisivo — hay clientes que solo compran en diciembre y otros para el día de la mujer.

**Rentabilidad real:** destacar la diferencia entre facturar mucho y ganar. Un cliente que factura $5M al 12% de margen vale menos que uno que factura $2M al 45%.

**Alerta de recontacto:** `Suele comprar cada ~5 meses. Pasaron 7.` — con un botón que **linkea al módulo de WhatsApp existente**. Solo lectura y navegación: no se modifica ese módulo.

---

## 7. Fase 4 — Dashboard

Rediseñar para un negocio 100% a pedido. El dashboard responde **cuatro preguntas**, en este orden:

**1. ¿Cuánta plata tengo que cobrar?**
Saldos pendientes (precio − cobrado), ordenados por antigüedad, con semáforo. Total arriba, grande.

**2. ¿Qué tengo que entregar y cuándo?**
Pedidos en `Confirmado` y `En producción`, ordenados por fecha de entrega, con semáforo (vencido / esta semana / más adelante). Indicador de líneas con `estadoCompra: pendiente` → *"te faltan 3 insumos para poder entregar"*.

**3. ¿Cómo vengo este mes?**
Facturado · Ganancia · Margen promedio · Cantidad de pedidos. Comparado contra **mes anterior** y contra **mismo mes del año pasado** (clave por la estacionalidad).

**4. ¿A quién tengo que llamar?**
Clientes dormidos (pasaron más días que su frecuencia habitual) + consultas sin respuesta. Cada uno linkea al módulo de WhatsApp existente.

Más abajo:

- **Top clientes por ganancia**, no por facturación.
- Evolución mensual (facturado y ganancia).
- Pedidos por completar (los de carga rápida).

**Eliminar del dashboard:** todo KPI de stock, valor de inventario, rotación, productos con stock bajo.

---

## 8. Fase 5 — Movimientos (sin stock)

**No hay movimientos de mercadería. Se elimina el concepto.**

`Movimientos` pasa a ser **movimientos de plata**, siempre atados a un pedido:

- **Cobro** (seña o saldo)
- **Pago a proveedor**

Reglas:

- Registrar un cobro desde el pedido en 2 taps: botón `Registrar cobro` → monto sugerido = saldo pendiente → confirmar.
- Vista de caja simple: entradas, salidas, resultado del mes.
- El costo se considera **comprometido** cuando el pedido pasa a `Confirmado`, y **pagado** cuando se registra el pago.

**Reemplazo del stock:** el campo `estadoCompra` por línea (`Pendiente / Pedido al proveedor / Recibido`). Responde la única pregunta de inventario que este negocio se hace: *"¿qué me falta para poder entregar?"*. No es stock, es checklist de compra de un pedido puntual.

---

## 9. Criterios de aceptación

- [ ] Cargar un pedido completo de 5 líneas en **≤ 60 segundos** en desktop, sin mouse.
- [ ] Carga rápida móvil en **≤ 10 segundos**, 3 campos, 1 tap para abrir.
- [ ] Pegar 10 filas desde Excel y que queden cargadas correctamente en **≤ 15 segundos**.
- [ ] Ningún flujo obliga a pasar por catálogo, packaging, alternativas ni stock.
- [ ] No queda ninguna referencia a stock de mercadería en UI ni en cálculos.
- [ ] **Todo pedido existente sigue abriéndose y calculando igual** (adaptador de lectura + migración no destructiva).
- [ ] El módulo de WhatsApp/recontactos funciona exactamente igual que antes del cambio.
- [ ] Cada cliente con ≥2 pedidos muestra métricas correctas en su ficha (verificar a mano contra los datos).
- [ ] Todo el copy en **español rioplatense** (vos/tenés), voz cálida y cercana. Nada de tono técnico ni transaccional.

---

## 10. Reglas técnicas del repo (respetar)

- Regalos **no** tiene split `/app` — las URLs son directas (a diferencia de Hub).
- Storage: usar siempre los helpers `db()` / `dbW()` con prefijo por userId. **Nunca** `localStorage` crudo.
- Proyecto Supabase compartido (`paxsvjdimqlfxnlipplx`), aislamiento por `allowed_sites: ['host']`.
- Roles: `owner` / `operator` / `viewer`. Nunca `admin` ni `user`.
- Nada de `dangerouslySetInnerHTML` con datos de APIs externas.
- Nada de Resend ni Telegram.
- Claves `service_role` y tokens de MP solo server-side.
- PowerShell: encadenar con `;`, no con `&&`.

---

## 11. Cómo trabajar

1. Ejecutar **Fase 0** y entregar `PLAN-REDISENO.md`. **Parar y esperar aprobación.**
2. Implementar detrás de un **feature flag** (`nuevoFlujoPedidos`) para poder volver atrás.
3. Una fase por PR/commit, en orden. No mezclar fases.
4. Antes de cada commit: verificar que un pedido viejo abre bien y que el módulo de WhatsApp no cambió.
5. Al terminar cada fase, reportar en una línea qué cambió y qué falta.

---

## 12. Lo que hay que tener en la cabeza todo el tiempo

La usuaria **no quiere aprender un sistema**. Quiere que anotar un pedido le cueste menos que abrir Excel, y que a fin de mes la app le diga cosas que Excel no le dice: *quién le deja plata, quién se le está durmiendo, cuánto ganó de verdad*.

Si en algún momento del rediseño una decisión suma un paso para ganar prolijidad de datos — **elegí el paso menos**. Los datos incompletos se pueden completar después. Un flujo engorroso hace que la usuaria deje de cargar, y entonces no hay datos de nada.
