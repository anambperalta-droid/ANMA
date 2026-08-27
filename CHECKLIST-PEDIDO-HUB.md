# Checklist de paridad — Carga de pedidos (ANMA Hub)

**Para qué:** verificar que cualquier cambio en la pantalla de pedidos NO rompe
lo que hoy funciona. Se corre **antes** de empezar (baseline) y **después** de
cada cambio. Si un ítem falla después de un cambio → ahí está el problema.

**Regla de oro:** la lógica de stock / costos / PDF / IVA / listas de precios
**se reutiliza, nunca se reescribe.** Esta lista existe para probarlo.

> Estado base (Fase 0): correr toda la lista sobre el wizard actual y confirmar
> que TODO da ✓. Ese es el punto de comparación.

---

## 1. Cliente
- [ ] Buscar un cliente existente en el CRM y elegirlo → autocompleta contacto, empresa, WhatsApp y email
- [ ] Escribir un cliente nuevo (no existente) → deja continuar sin romperse

## 2. Productos · catálogo y stock  ⚠️ zona crítica
- [ ] Buscar un producto del catálogo → aparece con su precio
- [ ] Producto con variantes (talle / color / modelo) → se elige la variante correcta
- [ ] Cliente **mayorista** → toma precio **B2B**; **minorista** → precio **B2C** (con fallback si falta uno)
- [ ] Agregar una **línea libre** (fuera de catálogo) con precio manual → funciona
- [ ] El **stock disponible** se muestra por ítem
- [ ] Al **confirmar** el pedido → el stock del producto **baja** la cantidad vendida
- [ ] Confirmar/guardar el MISMO pedido dos veces → el stock **NO** vuelve a bajar (anti-doble-descuento, flag `stockDeducted`)

## 3. Precio · margen · seña  ⚠️ zona crítica
- [ ] Margen objetivo (ej. 40%) se aplica y el Resumen muestra el **Margen real**
- [ ] Descuento al cliente → el **margen real se mantiene** (Opción C: el margen no reescribe los precios)
- [ ] Seña (ej. 50%) → calcula el monto correcto
- [ ] **IVA** activado → se suma al total y la **seña se calcula sobre el total final** (con IVA)
- [ ] Ganancia = total − costo real, y el costo **se congela al confirmar** (`costSnapshot`): si después cambia el costo del insumo, la ganancia del pedido confirmado NO cambia

## 4. Logística (integrada al pedido)
- [ ] Agregar **dispatch insumos** (packaging del pedido) → se descuentan del inventario
- [ ] Agregar **paradas de logística** → se reflejan según corresponda
- [ ] Flag "cobrar logística" → se suma al total que paga el cliente
- [ ] Flag "mostrar detalle" → se discrimina (o no) en PDF / WhatsApp

## 5. Acciones
- [ ] **Vista previa de WhatsApp** → muestra el mensaje correcto
- [ ] **Enviar por WhatsApp** → abre WA con el texto
- [ ] **WhatsApp Pago** → genera el link de pago (Mercado Pago)
- [ ] **Generar PDF** → sale correcto
- [ ] **Enviar por email** → llega al cliente
- [ ] **Estado de pago** (pendiente / seña / pagado) → se guarda

## 6. Guardado y borrador
- [ ] Empezar un pedido, salir sin guardar, volver → el **borrador se restaura** (autosave)
- [ ] Guardar presupuesto → aparece en **Historial** con el N° correcto
- [ ] Editar un presupuesto existente → carga TODOS los datos (cliente, ítems, precio, entrega, logística)

## 7. Estados
- [ ] Cambiar estado (Enviado → Confirmado → Entregado…) → se guarda y se ve en Historial

---

### Cómo se usa en cada fase
- **Fase 0:** correr todo sobre el wizard actual → debe dar todo ✓ (baseline).
- **Fase 1** (mejoras dentro del wizard): correr las secciones 3 y 6.
- **Fase 2** (pantalla única en paralelo): correr **toda** la lista sobre la pantalla nueva.
- **Fase 3** (default): correr **toda** la lista una vez más antes de redirigir el viejo.

### Funciones del código que NO se tocan (se reutilizan)
`deductStockForOrder` · `stockDeducted` flag · `costSnapshot` · `catalogPriceFor` /
`canalVenta` (B2C/B2B) · cálculo de IVA y seña · generación de PDF · email · pago MP ·
autosave del borrador (`DRAFT_KEY`).
