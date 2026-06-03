/**
 * voice.js — Vocabulario y mensajes adaptativos según el perfil comercial
 *
 * Centraliza TODO el copy que cambia según `tipoVenta` (minorista/mayorista/ambos)
 * y opcionalmente `rubro`. La idea es que cualquier label, placeholder, toast o
 * mensaje que hoy diga "Empresa" hardcodeado pase por estos helpers para que la
 * voz se sienta coherente con el modelo de negocio de cada usuario.
 *
 * Fuente única — si querés cambiar cómo se llama al cliente en toda la app,
 * editás acá y se propaga.
 */

/* ─────────────────────────────────────────────────────────────────
   VOCABULARIO DEL CRM
   ─ Cómo se llama al "cliente" en cada modelo comercial.
   ─ Minorista vende a personas → cliente.
   ─ Mayorista vende a empresas → empresa.
   ─ Ambos → término inclusivo.
───────────────────────────────────────────────────────────────── */
export function getClientVocab(tipoVenta) {
  const t = tipoVenta || 'ambos'
  if (t === 'minorista') {
    return {
      // Label principal del registro
      primaryLabel:   'Cliente',
      primaryReq:     false,                       // No obligatorio (no siempre hay empresa)
      // Label del segundo campo (empresa, si aplica)
      secondaryLabel: 'Empresa (opcional)',
      // Placeholder del campo primario
      primaryPh:      'Nombre y apellido',
      // Placeholder del campo secundario
      secondaryPh:    'Si compra a nombre de una empresa',
      // Toast cuando falta el primario
      missingMsg:     'Ingresá el nombre del cliente.',
      // Texto del buscador
      searchPh:       'Buscar cliente, contacto…',
      // Empty state title
      emptyTitle:     'Sin clientes',
      emptySubtitle:  'Agregá tu primer cliente',
      // Cómo referenciar al cliente en mensajes ("para tu pedido" vs "para Distribuidora")
      forPhrase:      'para vos',
    }
  }
  if (t === 'mayorista') {
    return {
      primaryLabel:   'Empresa',
      primaryReq:     true,
      secondaryLabel: 'Contacto',
      primaryPh:      'Razón social o nombre comercial',
      secondaryPh:    'Persona de contacto',
      missingMsg:     'Ingresá el nombre de la empresa.',
      searchPh:       'Buscar empresa, contacto, rubro…',
      emptyTitle:     'Sin empresas',
      emptySubtitle:  'Agregá tu primera empresa al CRM',
      forPhrase:      'para {{empresa}}',
    }
  }
  // ambos (o desconocido)
  return {
    primaryLabel:   'Cliente o empresa',
    primaryReq:     false,
    secondaryLabel: 'Contacto',
    primaryPh:      'Nombre del cliente o empresa',
    secondaryPh:    'Persona de contacto',
    missingMsg:     'Ingresá el nombre del cliente o empresa.',
    searchPh:       'Buscar cliente, empresa, contacto…',
    emptyTitle:     'Sin clientes',
    emptySubtitle:  'Agregá tu primer cliente o empresa',
    forPhrase:      'para {{empresa}}',  // si hay empresa → la usa; sino, omite
  }
}

/* ─────────────────────────────────────────────────────────────────
   MENSAJE DEL PRESUPUESTO — WhatsApp directo
   ─ Construye el texto adaptado al tipo de venta y a si hay empresa.
───────────────────────────────────────────────────────────────── */
export function buildBudgetWA({ tipoVenta, businessName, contact, company, prodList, total, deliveryDate, noteCli }) {
  const bName = businessName || 'ANMA'
  const nombre = contact || '[NOMBRE]'
  const t = tipoVenta || 'ambos'

  // Frase contextual: minorista nunca menciona empresa; mayorista siempre la pone;
  // ambos depende de si hay company cargada.
  let dest = ''
  if (t === 'mayorista') {
    dest = company ? ` para ${company}` : ''
  } else if (t === 'ambos') {
    dest = company ? ` para ${company}` : ''
  } // minorista → dest queda vacío

  const fechaTxt = deliveryDate ? deliveryDate : 'A coordinar'
  const notaTxt  = noteCli ? `\n*Nota:* ${noteCli}` : ''

  return `Hola ${nombre}! Te paso el presupuesto de *${bName}*${dest}:\n\n${prodList}\n\n*Total:* ${total}\n*Entrega estimada:* ${fechaTxt}${notaTxt}\n\n¿Te queda alguna duda? Estamos a disposición.`
}

/* ─────────────────────────────────────────────────────────────────
   TEMPLATES DE WHATSAPP — 12 por tipoVenta
   ─ Minorista: tono cercano persona-a-persona.
   ─ Mayorista: tono profesional B2B.
   ─ Ambos: neutro, sirve para los dos casos.
───────────────────────────────────────────────────────────────── */

const TEMPLATES_MINORISTA = [
  // ─────── CAPTACIÓN — Minorista (B2C, tono cercano) ───────
  { stage: 'Captación', title: 'Presentación inicial', isDefault: true,
    text: 'Hola {{nombre}}! 👋\n\nSoy de *{{negocio}}*. Te escribo para contarte qué tenemos disponible y ver si te puede interesar algo.\n\n¿Te paso el catálogo?\n\n¡Saludos!' },
  { stage: 'Captación', title: 'Contacto por referencia', isDefault: true,
    text: 'Hola {{nombre}}!\n\nMe pasaron tu contacto. Soy de *{{negocio}}* y tenemos productos que creo te van a gustar.\n\n¿Te interesa que te muestre lo que tenemos?\n\n¡Saludos!' },
  { stage: 'Captación', title: 'Seguimiento amable', isDefault: true,
    text: 'Hola {{nombre}}! ¿Cómo andás?\n\nTe escribo para saber si pudiste mirar lo que te mandé el {{fecha}}.\n\n¿Necesitás que te ajuste algo? Cualquier cosa, acá estoy.\n\n¡Saludos!' },
  /* ── Mensajes FRÍOS (sin contacto previo) — directos y naturales ── */
  { stage: 'Captación', title: '❄️ Frío · Promo del mes', isDefault: true,
    text: 'Hola {{nombre}}! ¿Cómo va?\n\nSoy de *{{negocio}}*. Tenemos promo hasta fin de mes en varios productos y me pareció que te podía interesar.\n\n¿Te paso el catálogo con precios actualizados? Sin compromiso 🙌' },
  { stage: 'Captación', title: '❄️ Frío · Vi tu perfil', isDefault: true,
    text: 'Hola {{nombre}}! 👋\n\nMe encontré con tu perfil/contacto y soy de *{{negocio}}*. Vendemos [tu producto principal] y creo que algo de lo nuestro te puede servir.\n\n¿Querés que te mande 2-3 opciones que pensé en vos? Si no es momento, no hay drama.' },
  { stage: 'Captación', title: '❄️ Frío · Novedad / lanzamiento', isDefault: true,
    text: 'Hola {{nombre}}!\n\nSoy de *{{negocio}}*. Acabamos de recibir productos nuevos y quería contarte primero a quienes pensé podrían gustarle.\n\nTe mando el catálogo en un toque, ¿dale? Cualquier duda me escribís y arreglamos.' },

  // ─────── PRESUPUESTOS — Minorista (5) ───────
  { stage: 'Presupuestos', title: 'Envío de presupuesto', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe paso tu presupuesto:\n\n📦 {{producto}}\n*Total:* {{precio}}\n*Entrega:* {{fecha}}\n\nCualquier cosa que necesites ajustar, me avisás. ¡Espero tu confirmación!' },
  { stage: 'Presupuestos', title: 'Cotización con opciones', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe armé un par de opciones:\n\n- *Opción A:* {{producto}} — {{precio}}\n- *Opción B:* [completar]\n\n¿Cuál te gusta más?' },
  { stage: 'Presupuestos', title: 'Contrapropuesta', isDefault: true,
    text: 'Hola {{nombre}}!\n\nRevisé los números y te puedo ofrecer:\n\n📦 {{producto}} — {{precio}}\n✅ Lista/o para coordinar entrega\n\nEs el mejor precio que tengo. ¿Lo cerramos?' },
  { stage: 'Presupuestos', title: 'Recordatorio suave', isDefault: true,
    text: 'Hola {{nombre}}! ¿Cómo estás?\n\n¿Pudiste ver el presupuesto que te mandé el {{fecha}}? Quería confirmar que no quedó en spam.\n\nSi querés que ajuste algo, decime y lo modifico 👍' },
  { stage: 'Presupuestos', title: 'Reserva / lo aparto', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTengo el {{producto}} disponible. Si me confirmás hoy, te lo aparto y coordinamos entrega para {{fecha}}.\n\nQueda poca cantidad, así que avisame si lo querés que lo separo 🙌' },

  // ─────── PAGOS — Minorista (4) ───────
  { stage: 'Pagos', title: 'Confirmación de pedido', isDefault: true,
    text: '¡Genial {{nombre}}!\n\nQueda confirmado tu pedido:\n\n📦 {{producto}}\n*Total:* {{precio}}\n*Seña:* [monto seña]\n*Entrega:* {{fecha}}\n\nTe paso los datos para el pago. ¡Gracias por elegir *{{negocio}}*!' },
  { stage: 'Pagos', title: 'Recordatorio de pago', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe escribo porque queda pendiente el pago de *{{precio}}*.\n\n¿Necesitás los datos bancarios de nuevo? Cualquier cosa, avisame.\n\n¡Saludos!' },
  { stage: 'Pagos', title: 'Pago recibido · gracias', isDefault: true,
    text: 'Hola {{nombre}}! ✅\n\nRecibí tu pago de *{{precio}}*. Todo en orden.\n\nYa lo paso a despacho y te aviso cuando esté listo. ¡Gracias por la compra! 🙌' },
  { stage: 'Pagos', title: 'Datos para transferencia', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe paso los datos para la transferencia:\n\n*CBU:* [cargar]\n*Alias:* [cargar]\n*Titular:* [cargar]\n*Monto:* {{precio}}\n\nCuando puedas, mandame el comprobante y te confirmo. ¡Gracias!' },

  // ─────── LOGÍSTICA — Minorista (4) ───────
  { stage: 'Logística', title: 'Aviso de despacho', isDefault: true,
    text: 'Hola {{nombre}}! 🚀\n\nYa despachamos tu pedido.\n\n📦 {{producto}}\n*Entrega estimada:* {{fecha}}\n\nTe aviso cuando llegue. ¡Cualquier consulta, escribime!' },
  { stage: 'Logística', title: 'Recordatorio de plazo', isDefault: true,
    text: 'Hola {{nombre}}!\n\nPara llegar con la fecha que necesitabas, lo ideal es confirmar esta semana.\n\n¿Avanzamos?' },
  { stage: 'Logística', title: 'Coordinar retiro / entrega', isDefault: true,
    text: 'Hola {{nombre}}! 📦\n\nTu pedido ya está listo. ¿Lo retirás o te lo enviamos?\n\nSi es envío, confirmame:\n- Dirección\n- Día/horario que te queda mejor\n\n¡Lo arreglamos cuando me digas!' },
  { stage: 'Logística', title: 'Entrega completada', isDefault: true,
    text: 'Hola {{nombre}}! ✅\n\nYa entregamos tu pedido. ¿Te llegó todo bien?\n\nCualquier cosa que necesites, escribime al toque 🙌' },

  // ─────── POST-VENTA — Minorista (4) ───────
  { stage: 'Post-Venta', title: 'Agradecimiento post-entrega', isDefault: true,
    text: 'Hola {{nombre}}! ✅\n\n¿Llegó todo bien? Si te gustó, contame.\n\nTu opinión nos ayuda a mejorar. ¡Gracias por la compra!' },
  { stage: 'Post-Venta', title: 'Reactivación de cliente', isDefault: true,
    text: 'Hola {{nombre}}! 👋\n\nHace un tiempo que no hablamos. En *{{negocio}}* tenemos novedades que creo te van a gustar.\n\n¿Te paso el catálogo actualizado?\n\n¡Saludos!' },
  { stage: 'Post-Venta', title: 'Recordatorio · 2da compra', isDefault: true,
    text: 'Hola {{nombre}}! 😊\n\n¿Cómo te fue con {{producto}}? Ya pasó un tiempo, capaz se te va terminando.\n\nSi querés reponer, lo tengo en stock — te lo armo en un toque y coordinamos entrega.' },
  { stage: 'Post-Venta', title: 'Cross-sell · productos relacionados', isDefault: true,
    text: 'Hola {{nombre}}! 🛍️\n\nMe acordé de vos porque llegaron productos que combinan con lo que te llevaste antes.\n\n¿Te paso fotos? Sin compromiso — si te gusta algo, lo separamos.' },
]

const TEMPLATES_MAYORISTA = [
  // ─────── CAPTACIÓN — Mayorista (B2B, tono profesional pero cercano) ───────
  { stage: 'Captación', title: 'Presentación inicial', isDefault: true,
    text: 'Hola {{nombre}}! 👋\n\nSoy de *{{negocio}}*, proveemos productos para empresas y negocios.\n\nMe encantaría contarte qué opciones tenemos para {{empresa}}. ¿Tenés unos minutos esta semana?\n\n¡Saludos!' },
  { stage: 'Captación', title: 'Contacto por referencia', isDefault: true,
    text: 'Hola {{nombre}}!\n\nMe pasaron tu contacto a través de {{empresa}}. Somos *{{negocio}}* y trabajamos con empresas que buscan productos de calidad al mejor precio.\n\n¿Te interesaría ver nuestro catálogo actualizado?\n\n¡Quedo atento!' },
  { stage: 'Captación', title: 'Seguimiento amable', isDefault: true,
    text: 'Hola {{nombre}}! ¿Cómo andás?\n\nTe escribo para saber si pudiste revisar la propuesta que te mandé el {{fecha}}.\n\n¿Necesitás que ajustemos cantidades o condiciones? Estamos para ayudarte.\n\n¡Saludos!' },
  /* ── Mensajes FRÍOS (sin contacto previo) — propuestas B2B directas ── */
  { stage: 'Captación', title: '❄️ Frío · Propuesta de valor', isDefault: true,
    text: 'Hola {{nombre}}! ¿Cómo andás?\n\nSoy de *{{negocio}}*. Trabajamos con varios negocios del rubro y vi que en {{empresa}} podrían interesarles nuestros productos al mayoreo.\n\n¿Te paso lista de precios B2B y condiciones de pago? Si no es momento, no hay drama — quedo a la orden.' },
  { stage: 'Captación', title: '❄️ Frío · Reposición de stock', isDefault: true,
    text: 'Hola {{nombre}}!\n\nSoy de *{{negocio}}*, distribuimos a comercios y empresas. Sé que esta época suelen reponer stock — quería ofrecerte nuestra lista mayorista con condiciones especiales:\n\n- Plazo de pago a 30 días\n- Envío bonificado desde [X] unidades\n- Descuentos progresivos\n\n¿Le mando catálogo a {{empresa}}?' },
  { stage: 'Captación', title: '❄️ Frío · Reunión / muestrario', isDefault: true,
    text: 'Hola {{nombre}}!\n\nSoy de *{{negocio}}*. Trabajamos productos al por mayor y me gustaría llevarte un muestrario / agendarte una reunión para mostrarte qué ofrecemos.\n\n¿Tenés 15 minutos esta semana? Sin compromiso, solo para que veas si te puede servir para {{empresa}}.' },

  // ─────── PRESUPUESTOS — Mayorista (5) ───────
  { stage: 'Presupuestos', title: 'Envío de presupuesto', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe envío el presupuesto para {{empresa}}:\n\n📦 {{producto}}\n*Total:* {{precio}}\n*Entrega estimada:* {{fecha}}\n\nQuedamos a disposición para cualquier ajuste. ¡Esperamos tu confirmación!' },
  { stage: 'Presupuestos', title: 'Cotización con opciones', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe armé las opciones que charlamos para {{empresa}}:\n\n- *Opción A:* {{producto}} — {{precio}}\n- *Opción B:* [completar]\n\nAmbas con entrega incluida. ¿Cuál te cierra más?' },
  { stage: 'Presupuestos', title: 'Contrapropuesta', isDefault: true,
    text: 'Hola {{nombre}}!\n\nRevisé los números para {{empresa}} y puedo ofrecerte:\n\n📦 {{producto}} — {{precio}} *(descuento por volumen incluido)*\n✅ Envío bonificado\n\nEs nuestro mejor precio. ¿Confirmamos?' },
  { stage: 'Presupuestos', title: 'Recordatorio formal con plazo', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe escribo para confirmar si avanzamos con el presupuesto enviado el {{fecha}} para {{empresa}}.\n\nLos precios cotizados los mantengo hasta fin de semana. Si necesitás ajustar condiciones, decime y lo revisamos.\n\n¡Saludos!' },
  { stage: 'Presupuestos', title: 'Disponibilidad de stock', isDefault: true,
    text: 'Hola {{nombre}}!\n\nConfirmo stock disponible para el pedido de {{empresa}}:\n\n📦 {{producto}}\n*Total:* {{precio}}\n*Listo para despachar:* {{fecha}}\n\nSi querés que aparte la mercadería, mandame OK y la separo de inmediato.' },

  // ─────── PAGOS — Mayorista (4) ───────
  { stage: 'Pagos', title: 'Confirmación de pedido', isDefault: true,
    text: '¡Excelente {{nombre}}!\n\nQueda confirmado el pedido para {{empresa}}:\n\n📦 {{producto}}\n*Total:* {{precio}}\n*Seña:* [monto seña]\n*Entrega:* {{fecha}}\n\nTe paso los datos para la transferencia. ¡Gracias por elegir *{{negocio}}*!' },
  { stage: 'Pagos', title: 'Recordatorio de pago', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe escribo porque queda pendiente el saldo del pedido de {{empresa}} por *{{precio}}*.\n\n¿Necesitás los datos bancarios de nuevo? Estamos para ayudarte.\n\n¡Saludos!' },
  { stage: 'Pagos', title: 'Confirmación de seña recibida', isDefault: true,
    text: 'Hola {{nombre}}! ✅\n\nRecibimos la seña de *{{precio}}* para el pedido de {{empresa}}. ¡Todo en orden!\n\nYa pasamos a producción/despacho. Te aviso cuando esté listo.\n\nGracias por la confianza! 🙌' },
  { stage: 'Pagos', title: 'Datos de transferencia', isDefault: true,
    text: 'Hola {{nombre}}!\n\nTe paso los datos para la transferencia:\n\n*Titular:* [cargar]\n*CBU:* [cargar]\n*Alias:* [cargar]\n*CUIT:* [cargar]\n*Monto:* {{precio}}\n*Concepto:* Pedido {{empresa}}\n\nCuando se acredite, te envío la factura. ¡Gracias!' },

  // ─────── LOGÍSTICA — Mayorista (4) ───────
  { stage: 'Logística', title: 'Aviso de despacho', isDefault: true,
    text: 'Hola {{nombre}}! 🚀\n\nYa despachamos tu pedido para {{empresa}}.\n\n📦 {{producto}}\n*Entrega estimada:* {{fecha}}\n\nTe avisamos cuando llegue. ¡Cualquier consulta, escribinos!' },
  { stage: 'Logística', title: 'Recordatorio de plazo', isDefault: true,
    text: 'Hola {{nombre}}!\n\nLos plazos de entrega están ajustados y quería confirmar si avanzamos con el pedido de {{empresa}}.\n\nPara llegar a la fecha que necesitás, lo ideal es confirmar esta semana. ¿Qué te parece?' },
  { stage: 'Logística', title: 'Coordinar entrega · dirección', isDefault: true,
    text: 'Hola {{nombre}}! 📦\n\nEl pedido de {{empresa}} ya está listo. Para coordinar entrega necesito confirmar:\n\n- Dirección exacta\n- Persona que recibe (con DNI si es transportista)\n- Horario disponible: ¿mañana o tarde?\n- Fecha tope: {{fecha}}\n\n¡Avisame y lo organizamos!' },
  { stage: 'Logística', title: 'Despacho con remito · tracking', isDefault: true,
    text: 'Hola {{nombre}}! 🚚\n\nDespachamos el pedido de {{empresa}}:\n\n*Remito:* [número]\n*Empresa de envío:* [transportista]\n*Tracking:* [link]\n*Llegada estimada:* {{fecha}}\n\nCualquier inconveniente con la entrega, decime y lo resolvemos!' },

  // ─────── POST-VENTA — Mayorista (4) ───────
  { stage: 'Post-Venta', title: 'Agradecimiento post-entrega', isDefault: true,
    text: 'Hola {{nombre}}! ✅\n\nEsperamos que el pedido haya llegado perfecto a {{empresa}}.\n\n¿Nos contás cómo les fue? Tu opinión nos ayuda a mejorar.\n\nPara futuros pedidos ya tenemos tu perfil guardado. ¡Gracias!' },
  { stage: 'Post-Venta', title: 'Reactivación de cliente', isDefault: true,
    text: 'Hola {{nombre}}! 👋\n\nHace un tiempo que no hablamos. En *{{negocio}}* tenemos stock renovado y productos que creo que le van a servir a {{empresa}}.\n\n¿Te mando el catálogo actualizado?\n\n¡Saludos!' },
  { stage: 'Post-Venta', title: 'Encuesta breve · NPS', isDefault: true,
    text: 'Hola {{nombre}}! ⭐\n\nQuería pedirte un favor chico — del 1 al 10, ¿qué tan probable es que nos recomendarías a otra empresa?\n\nTu feedback nos ayuda muchísimo a mejorar el servicio. ¡Gracias por el tiempo!' },
  { stage: 'Post-Venta', title: 'Cliente recurrente · promo especial', isDefault: true,
    text: 'Hola {{nombre}}! 🎁\n\nComo {{empresa}} ya es cliente recurrente, te apartamos un descuento especial del [X]% para tu próxima reposición.\n\nVálido todo este mes. Si querés que te arme un presupuesto con el bonus, decime los productos y lo paso.' },
]

/**
 * Devuelve los 12 templates default adaptados al modelo comercial.
 * - minorista → set B2C (tono cercano, sin {{empresa}})
 * - mayorista → set B2B (tono profesional, con {{empresa}})
 * - ambos    → set B2B (más completo, el usuario puede editar)
 */
export function getDefaultTemplates(tipoVenta) {
  if (tipoVenta === 'minorista') return TEMPLATES_MINORISTA
  return TEMPLATES_MAYORISTA   // mayorista + ambos
}

/**
 * Detecta si los templates almacenados del usuario están DESACTUALIZADOS para
 * su modelo comercial actual. Caso clásico: usuario es minorista pero tiene los
 * templates B2B viejos seedeados (de cuando éramos solo B2B o de registro previo
 * a la auditoría de voz).
 *
 * Heurística: si tipoVenta = 'minorista' y la mayoría (>=50%) de sus templates
 * matchea EXACTAMENTE textos del set MAYORISTA → están desactualizados.
 * Si la mayoría matchea el set actual de su tipoVenta → están al día.
 */
export function templatesAreOutdated(stored, tipoVenta) {
  if (!Array.isArray(stored) || stored.length === 0) return false
  if (!tipoVenta || tipoVenta === 'ambos') return false  // 'ambos' usa mayorista — no consideramos desactualizado
  if (tipoVenta !== 'minorista') return false             // solo tiene sentido para minorista

  const currentDefaults = getDefaultTemplates(tipoVenta)
  const currentTexts = new Set(currentDefaults.map(t => t.text))
  const currentMatch = stored.filter(t => currentTexts.has(t.text)).length

  // Si ya están al día (>=70% matchea current), no es outdated
  if (currentMatch >= currentDefaults.length * 0.7) return false

  // ¿Matchea el OTRO set (mayorista) en mayoría?
  const otherDefaults = TEMPLATES_MAYORISTA
  const otherTexts = new Set(otherDefaults.map(t => t.text))
  const otherMatch = stored.filter(t => otherTexts.has(t.text)).length
  return otherMatch >= otherDefaults.length * 0.5
}

/* ─────────────────────────────────────────────────────────────────
   PLACEHOLDERS CONTEXTUALES POR RUBRO
   ─ Los ejemplos en inputs ("Ej: Remera algodón premium") se sienten
     personalizados al rubro del usuario.
───────────────────────────────────────────────────────────────── */
const PRODUCT_PLACEHOLDERS = {
  indumentaria: 'Ej: Remera algodón premium',
  tecnologia:   'Ej: Cargador USB-C 65W',
  decoracion:   'Ej: Vela aromática lavanda',
  almacen:      'Ej: Aceite de oliva 500ml',
}

const CLIENT_RUBRO_PLACEHOLDERS = {
  indumentaria: 'Boutique, Showroom, Distribuidora…',
  tecnologia:   'Empresa, Comercio, Particular…',
  decoracion:   'Hogar, Evento, Comercio…',
  almacen:      'Restó, Kiosco, Particular…',
}

export function getProductPlaceholder(rubro) {
  return PRODUCT_PLACEHOLDERS[rubro] || 'Ej: Nombre del producto'
}

export function getClientRubroPlaceholder(rubro) {
  return CLIENT_RUBRO_PLACEHOLDERS[rubro] || 'Tecnología, Salud, Eventos…'
}

/* ─────────────────────────────────────────────────────────────────
   EMPTY STATES — Mensajes warm cuando no hay datos
   ─ Sirven para Catálogo, Clientes, Presupuestos, Insumos.
   ─ Adaptan tono según rubro: indumentaria habla de "prendas",
     almacén de "productos", etc.
───────────────────────────────────────────────────────────────── */
const EMPTY_PRODUCTS = {
  indumentaria: { title: 'Sin prendas en el catálogo', subtitle: 'Agregá tu primer producto (remera, pantalón, calzado…)' },
  tecnologia:   { title: 'Sin productos cargados',     subtitle: 'Agregá tu primer dispositivo o accesorio' },
  decoracion:   { title: 'Sin productos cargados',     subtitle: 'Agregá tu primera pieza al catálogo' },
  almacen:      { title: 'Sin productos cargados',     subtitle: 'Agregá tu primer producto del almacén' },
  default:      { title: 'Sin productos',              subtitle: 'Agregá tu primer producto al catálogo' },
}

export function getEmptyProducts(rubro) {
  return EMPTY_PRODUCTS[rubro] || EMPTY_PRODUCTS.default
}

/* ─────────────────────────────────────────────────────────────────
   SUBTITLE SUGERIDO POR RUBRO (para Onboarding)
   ─ Reemplaza el genérico "Tu negocio en un solo lugar" por algo
     que se sienta del usuario.
───────────────────────────────────────────────────────────────── */
const SUBTITLES = {
  indumentaria: 'Tu marca, ordenada',
  tecnologia:   'Stock + ventas en un solo lugar',
  decoracion:   'Tu showroom organizado',
  almacen:      'Las cuentas claras de tu almacén',
}

export function getSuggestedSubtitle(rubro) {
  return SUBTITLES[rubro] || 'Tu negocio en un solo lugar'
}
