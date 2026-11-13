/* ═══════════════════════════════════════════════════════════════
   ANMA Hub — Datos de ejemplo para sacar las capturas de la landing

   PARA QUE: las cuentas nuevas arrancan vacías (seedData v2 ya no
   inyecta demo), y capturar desde la cuenta real publicaría nombres,
   teléfonos y montos de clientas de verdad en una página abierta.

   COMO USARLO
     1. Entrá a la app con la CUENTA DE PRUEBA (no la tuya real).
     2. Abrí la consola del navegador: F12 → pestaña Console.
     3. Pegá todo este archivo y Enter.
     4. Recargá la página.

   SEGURIDAD: si la cuenta ya tiene productos, clientes o pedidos, el
   script se niega a correr. Para pisarlos igual, cambiá FORZAR a true
   en la línea de abajo. Nunca lo corras en tu cuenta real.

   Las claves que escribe son anma4_u_<userId>_<colección>: todo queda
   en el localStorage de ese navegador, no toca el servidor.
   ═══════════════════════════════════════════════════════════════ */

(() => {
  const FORZAR = false

  // ── 1. Encontrar el usuario logueado ──────────────────────────
  const prefijos = [...new Set(
    Object.keys(localStorage)
      .map(k => k.match(/^(anma4_u_[^_]+_)/)?.[1])
      .filter(Boolean)
  )]

  if (prefijos.length === 0) {
    console.error('[ANMA] No encontré ninguna cuenta en este navegador. Entrá a la app primero.')
    return
  }
  if (prefijos.length > 1) {
    console.error('[ANMA] Hay varias cuentas en este navegador:', prefijos,
      '\nAbrí la app con la cuenta de prueba y volvé a correr el script.')
    return
  }
  const P = prefijos[0]
  const leer = (k, f = []) => { try { return JSON.parse(localStorage.getItem(P + k)) ?? f } catch { return f } }
  const escribir = (k, v) => localStorage.setItem(P + k, JSON.stringify(v))

  // ── 2. Guardrail: no pisar datos existentes ───────────────────
  const yaHay = ['products', 'clients', 'budgets'].filter(k => (leer(k, []) || []).length > 0)
  if (yaHay.length && !FORZAR) {
    console.error(`[ANMA] Esta cuenta ya tiene datos en: ${yaHay.join(', ')}.`,
      '\nSi es la cuenta de prueba y querés pisarlos, poné FORZAR = true arriba del script.')
    return
  }

  // ── 3. Fechas relativas a hoy ─────────────────────────────────
  const d = (dias) => {
    const f = new Date()
    f.setDate(f.getDate() + dias)
    return f.toISOString().slice(0, 10)
  }
  const ts = (dias) => Date.now() + dias * 86400000

  // ── 4. Proveedores ────────────────────────────────────────────
  const suppliers = [
    { id: 9101, name: 'Textil Norte',      contact: 'Mariano Gil',  wa: '', email: '', notes: '', rubro: 'Telas' },
    { id: 9102, name: 'Distribuidora Sur', contact: 'Ana Rivas',    wa: '', email: '', notes: '', rubro: 'Insumos' },
    { id: 9103, name: 'Packaging Central', contact: 'Juan Peralta', wa: '', email: '', notes: '', rubro: 'Packaging' },
  ]

  /* ── 5. Productos ───────────────────────────────────────────────
     Los márgenes están repartidos a propósito: hay altos (verde),
     medios y bajos (rojo). La captura del catálogo tiene que mostrar
     esa diferencia — es lo que prueba el "inteligencia comercial" de
     la landing. Margen = (priceB2C - cost) / priceB2C.             */
  const prod = (id, name, cat, cost, priceB2C, priceB2B, stock, minStock, sku, supplierId) => ({
    id, name, cat, cost, priceB2C, priceB2B, stock, minStock, sku, supplierId,
    unit: 'unidad', notes: '', image: '', variants: [], tipo: 'producto', componentes: [],
    lastMove: d(-3), updatedAt: ts(-3),
  })

  const products = [
    prod(9201, 'Remera algodón peinado',   'Indumentaria', 4200,  12900, 9800,  48, 10, 'REM-001', 9101), // 67%
    prod(9202, 'Buzo frisa con capucha',   'Indumentaria', 11800, 28900, 23500, 22, 8,  'BUZ-014', 9101), // 59%
    prod(9203, 'Pantalón cargo',           'Indumentaria', 13400, 24900, 20900, 6,  10, 'PAN-007', 9101), // 46%
    prod(9204, 'Gorra bordada',            'Accesorios',   3900,  9500,  7600,  64, 15, 'GOR-003', 9102), // 59%
    prod(9205, 'Mochila urbana',           'Accesorios',   18600, 29900, 25400, 9,  5,  'MOC-002', 9102), // 38%
    prod(9206, 'Medias pack x3',           'Accesorios',   2100,  5900,  4400,  120, 24, 'MED-011', 9102), // 64%
    prod(9207, 'Campera rompeviento',      'Indumentaria', 24800, 32900, 29900, 4,  6,  'CAM-005', 9101), // 25% — bajo
    prod(9208, 'Taza cerámica grabada',    'Bazar',        5400,  11900, 9200,  38, 12, 'TAZ-001', 9103), // 55%
    prod(9209, 'Botella térmica 750ml',    'Bazar',        16900, 21900, 19500, 15, 8,  'BOT-004', 9103), // 23% — bajo
    prod(9210, 'Cuaderno tapa dura',       'Librería',     3100,  8900,  6900,  72, 20, 'CUA-009', 9103), // 65%
    prod(9211, 'Lápices pack x12',         'Librería',     2600,  6400,  5100,  90, 24, 'LAP-002', 9103), // 59%
    prod(9212, 'Set mate completo',        'Bazar',        19400, 44900, 37500, 11, 4,  'MAT-001', 9103), // 57%
  ]

  // ── 6. Clientes ───────────────────────────────────────────────
  const clients = [
    { id: 9301, company: 'Verde Deco',        contact: 'Carolina Ruiz',  wa: '1150000001', email: 'hola@verdedeco.test',   rubro: 'Decoración',   notes: '', discount: 0 },
    { id: 9302, company: 'Kiosco El Puente',  contact: 'Martín Torres',  wa: '1150000002', email: 'elpuente@mail.test',    rubro: 'Almacén',      notes: '', discount: 5 },
    { id: 9303, company: 'Estudio Lupe',      contact: 'Lucía Paz',      wa: '1150000003', email: 'lu@estudiolupe.test',   rubro: 'Servicios',    notes: '', discount: 0 },
    { id: 9304, company: 'Bazar Nuevo Sol',   contact: 'Sofía Medina',   wa: '1150000004', email: 'compras@nsol.test',     rubro: 'Bazar',        notes: '', discount: 10 },
    { id: 9305, company: 'Regalos Camelia',   contact: 'Camila Rossi',   wa: '1150000005', email: 'camelia@mail.test',     rubro: 'Regalería',    notes: '', discount: 0 },
    { id: 9306, company: 'Uniformes Lanús',   contact: 'Diego Arce',     wa: '1150000006', email: 'diego@unilanus.test',   rubro: 'Indumentaria', notes: '', discount: 8 },
  ]

  /* ── 7. Pedidos ─────────────────────────────────────────────────
     Repartidos en los últimos 28 días para que el gráfico de ingresos
     del Dashboard tenga barras en varios días, y en estados distintos
     para que el donut y los chips de cobro tengan de todo: cobrado,
     seña, pendiente y uno vencido.                                 */
  const item = (p, qty, precio) => ({
    productId: p.id, name: p.name, qty,
    costUnit: p.cost, priceUnit: precio ?? p.priceB2C,
    unit: 'unidad', notes: '',
  })

  const mkBudget = (o) => {
    const subtotal = o.items.reduce((s, i) => s + i.qty * i.priceUnit, 0)
    const costo    = o.items.reduce((s, i) => s + i.qty * i.costUnit, 0)
    const ivaRate  = o.iva === false ? 0 : 0.21
    const ivaAmt   = Math.round(subtotal * ivaRate)
    const totalFinal = subtotal + ivaAmt
    const pagado = (o.payments || []).reduce((s, p) => s + p.amount, 0)
    return {
      id: o.id, num: o.num, date: o.date,
      contact: o.cli.contact, company: o.cli.company, wa: o.cli.wa, clientEmail: o.cli.email,
      clientId: o.cli.id,
      delivery: o.delivery || 'Retira en local', deliveryDate: o.deliveryDate || o.date,
      items: o.items,
      shipCost: 0, shipCharged: false, envioACotizar: false,
      status: o.status, payStatus: o.payStatus,
      noteInt: '', noteCli: '',
      margin: 40, deposit: 50, logoCost: 0, discount: 0,
      dispatchInsumos: [], viajeId: null, logisticaParadas: [], comisionista: '',
      totalCost: costo,
      totalGain: subtotal - costo,
      total: subtotal,
      ivaRate, ivaAmt, totalFinal,
      depositAmt: Math.round(subtotal * 0.5),
      depositFinal: Math.round(totalFinal * 0.5),
      marginBudgeted: Number((((subtotal - costo) / subtotal) * 100).toFixed(1)),
      stockDeducted: o.status !== 'draft',
      payments: o.payments || [],
      paid: pagado,
      updatedAt: ts(0),
    }
  }

  const pago = (dias, amount, method) => ({ id: 9500 + Math.abs(dias), date: d(dias), amount, method, notes: '' })
  const P2 = (id) => products.find(p => p.id === id)
  const C  = (id) => clients.find(c => c.id === id)

  const budgets = [
    mkBudget({ id: 9401, num: 'AN-0041', date: d(-26), cli: C(9301), status: 'delivered', payStatus: 'paid',
      items: [item(P2(9201), 12), item(P2(9204), 6)],
      payments: [pago(-26, 248000, 'Transferencia')] }),

    mkBudget({ id: 9402, num: 'AN-0042', date: d(-21), cli: C(9302), status: 'delivered', payStatus: 'paid',
      items: [item(P2(9206), 24), item(P2(9210), 10)],
      payments: [pago(-21, 265000, 'Efectivo')] }),

    mkBudget({ id: 9403, num: 'AN-0043', date: d(-16), cli: C(9304), status: 'delivered', payStatus: 'paid',
      items: [item(P2(9208), 15), item(P2(9212), 4)],
      payments: [pago(-16, 433000, 'Mercado Pago')] }),

    mkBudget({ id: 9404, num: 'AN-0044', date: d(-11), cli: C(9306), status: 'confirmed', payStatus: 'partial',
      items: [item(P2(9202), 10), item(P2(9203), 6)],
      payments: [pago(-11, 200000, 'Transferencia')] }),

    mkBudget({ id: 9405, num: 'AN-0045', date: d(-7), cli: C(9305), status: 'confirmed', payStatus: 'partial',
      items: [item(P2(9209), 8), item(P2(9211), 12)],
      payments: [pago(-7, 120000, 'Mercado Pago')] }),

    // Vencido: entrega pasada y sin un peso cobrado
    mkBudget({ id: 9406, num: 'AN-0046', date: d(-9), deliveryDate: d(-2), cli: C(9303), status: 'confirmed', payStatus: 'pending',
      items: [item(P2(9205), 3), item(P2(9204), 8)] }),

    mkBudget({ id: 9407, num: 'AN-0047', date: d(-2), cli: C(9301), status: 'confirmed', payStatus: 'pending',
      items: [item(P2(9201), 20), item(P2(9206), 15)] }),

    mkBudget({ id: 9408, num: 'AN-0048', date: d(0), cli: C(9304), status: 'draft', payStatus: 'pending',
      items: [item(P2(9212), 6), item(P2(9208), 10)] }),
  ]

  // ── 8. Escribir todo ──────────────────────────────────────────
  const cfgActual = (() => { try { return JSON.parse(localStorage.getItem(P + 'cfg')) || {} } catch { return {} } })()
  escribir('cfg', {
    ...cfgActual,
    businessName: cfgActual.businessName || 'Tienda Demo',
    subtitle: 'Tu negocio en un solo lugar',
    budgetPrefix: 'AN',
    nextNum: 49,
  })
  escribir('suppliers', suppliers)
  escribir('products', products)
  escribir('clients', clients)
  escribir('budgets', budgets)

  const facturado = budgets.filter(b => b.status !== 'draft').reduce((s, b) => s + b.totalFinal, 0)
  const cobrado   = budgets.reduce((s, b) => s + (b.paid || 0), 0)
  console.log('%c[ANMA] Datos de ejemplo cargados', 'color:#6429D1;font-weight:bold')
  console.table({
    cuenta: P,
    productos: products.length,
    clientes: clients.length,
    pedidos: budgets.length,
    facturado: '$' + facturado.toLocaleString('es-AR'),
    cobrado: '$' + cobrado.toLocaleString('es-AR'),
  })
  console.log('Recargá la página para verlos.')
})()
