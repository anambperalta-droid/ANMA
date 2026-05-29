import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { fmt, db, dbW, dbDel } from '../../lib/storage'
import { getMPConfig, createPaymentLink, getBankConfig, buildBankInfoText } from '../../lib/mercadopago'
import { pushBudget, getSheetsConfig } from '../../lib/sheets'

const emptyItem = () => ({ name: '', variant: '', qty: 1, costUnit: '', priceUnit: '' })

/* ── Selector de producto (BottomSheet / modal) ── */
function ProductPicker({ open, onClose, products, onSelect }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 120) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sq = q.toLowerCase()
  const filtered = q
    ? products.filter(p => (p.name || '').toLowerCase().includes(sq) || (p.cat || '').toLowerCase().includes(sq))
    : products

  return (
    <>
      <div className={`bsheet-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`bsheet${open ? ' open' : ''}`} style={{ maxHeight: '70vh' }}>
        <div className="bsheet-handle" />
        <div style={{ padding: '6px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0 12px', height: 44 }}>
            <i className="fa fa-magnifying-glass" style={{ color: 'var(--txt4)', fontSize: 13 }} />
            <input ref={inputRef} type="text" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar producto..."
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--txt)', width: '100%', fontFamily: 'inherit' }} />
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: 'var(--txt4)', cursor: 'pointer', fontSize: 13, padding: 4 }}><i className="fa fa-xmark" /></button>}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '6px 8px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--txt3)', fontSize: 13 }}>
              <i className="fa fa-box-open" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: .4 }} />
              {q ? 'Sin resultados' : 'No hay productos cargados'}
            </div>
          ) : filtered.map(p => (
            <button key={p.id} className="bsheet-item" onClick={() => { onSelect(p); onClose() }}>
              <div className="bsheet-item-ico" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 15 }}>
                <i className="fa fa-box-open" />
              </div>
              <div className="bsheet-item-body">
                <div className="bsheet-item-title" style={{ fontSize: 13 }}>{p.name}</div>
                <div className="bsheet-item-sub">
                  {p.cat && <span>{p.cat} · </span>}
                  Costo: {fmt(p.cost || 0)}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--money)', flexShrink: 0 }}>
                {fmt(Math.round((p.cost || 0) * 1.4))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/* Utilidades de fecha: hoy en ISO, weekend check */
const todayISO = () => new Date().toISOString().slice(0, 10)
const isWeekend = (iso) => { if (!iso) return false; const d = new Date(iso + 'T00:00'); const w = d.getDay(); return w === 0 || w === 6 }
const fmtDate = (iso) => { if (!iso) return ''; const [y,m,d] = String(iso).slice(0,10).split('-'); return `${d}/${m}/${y.slice(2)}` }
const daysUntil = (iso) => { if (!iso) return null; const t = new Date(); t.setHours(0, 0, 0, 0); const d = new Date(iso + 'T00:00'); return Math.ceil((d - t) / 86400000) }

/* ── Helpers para inputs numéricos sin NaN ── */
const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n }
const selectOnFocus = (e) => e.target.select()
// Formato visual de inputs numéricos de tabla: "10000" → "10.000" (es-AR), sin signo $
const fmtTbl = (v) => (v === '' || v === undefined || v === null) ? '' : (Number(v) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
const parseTbl = (s) => s.replace(/\./g, '').replace(/[^\d]/g, '')

/* ── Validación WhatsApp ── */
const isValidWA = (v) => { if (!v) return true; const cleaned = v.replace(/[\s\-()]/g, ''); return /^[+]?\d{8,15}$/.test(cleaned) }

/* ── Pasos del wizard ── */
const WIZARD_STEPS = [
  { id: 1, icon: 'fa-user-tie', label: 'Cliente', desc: 'Contacto y datos' },
  { id: 2, icon: 'fa-box-open', label: 'Productos', desc: 'Items del pedido' },
  { id: 3, icon: 'fa-truck', label: 'Entrega', desc: 'Envío y precio' },
  { id: 4, icon: 'fa-check-double', label: 'Confirmar', desc: 'Revisar y enviar' },
]

/* ── Encabezado de panel ── */
function PaneHeader({ icon, title, subtitle }) {
  return (
    <div className="wiz-pane-head">
      <div className="wiz-pane-ico"><i className={`fa ${icon}`} /></div>
      <div>
        <div className="wiz-pane-title">{title}</div>
        {subtitle && <div className="wiz-pane-sub">{subtitle}</div>}
      </div>
    </div>
  )
}

/* ── Combobox buscador de clientes ── */
function ClientCombo({ clients, value, onSelect, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(value)
  const ref = useRef()

  useEffect(() => { setQ(value) }, [value])

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const lq = q.toLowerCase()
  const filtered = q
    ? clients.filter(c => (c.contact || '').toLowerCase().includes(lq) || (c.company || '').toLowerCase().includes(lq)).slice(0, 8)
    : clients.slice(0, 8)

  const pick = (c) => { setQ(c.contact || c.company); onSelect(c); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input type="text" value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar cliente por nombre o empresa..."
        autoComplete="off" />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1.5px solid var(--brand)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.1)', maxHeight: 220, overflowY: 'auto', marginTop: 3
        }}>
          {filtered.map(c => (
            <div key={c.id} onClick={() => pick(c)} style={{
              padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--border)', transition: 'background .1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-xlt)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {(c.company || c.contact || '?')[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{c.contact || '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.company}{c.wa ? ` · ${c.wa}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Presupuesto() {
  const { id } = useParams()
  const nav = useNavigate()
  const { get, config, saveBudget, deductStockForOrder } = useData()
  const toast = useToast()
  const c = config()
  const feats = c.features || {}

  const [form, setForm] = useState({
    contact: '', company: '', wa: '', clientEmail: '', delivery: '', deliveryDate: '',
    shipCost: 0, shipCharged: false, envioACotizar: true, status: 'draft', payStatus: 'pending', noteInt: '', noteCli: '',
    margin: c.defaultMargin || 40, deposit: c.defaultDeposit || 50, logoCost: 0, discount: 0,
    dispatchInsumos: [], // Dynamic dispatch packaging — set per order in Step 3
  })
  const [items, setItems] = useState([emptyItem()])
  const [editId, setEditId] = useState(null)
  const [marginBudgetedSaved, setMarginBudgetedSaved] = useState(null)
  const [mpResult, setMpResult] = useState(null)
  const [mpLoading, setMpLoading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [waTouched, setWaTouched] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [draftRestored, setDraftRestored] = useState(false)

  const clients = get('clients')
  const products = get('products')
  const insumosList = get('insumos', [])
  const marginPct = c.defaultMargin || 40

  /* ── Draft persistence ── */
  const DRAFT_KEY = 'presupDraft'  // user-scoped via dbW/db/dbDel

  useEffect(() => {
    if (id) {
      const b = get('budgets').find(x => x.id === Number(id))
      if (b) {
        setForm({
          contact: b.contact || '', company: b.company || '', wa: b.wa || '', clientEmail: b.clientEmail || '',
          delivery: b.delivery || '', deliveryDate: b.deliveryDate || '',
          shipCost: b.shipCost || 0, shipCharged: b.shipCharged !== false,
          status: b.status || 'draft',
          noteInt: b.noteInt || '', noteCli: b.noteCli || '',
          payStatus: b.payStatus || 'pending',
          margin: b.margin ?? c.defaultMargin ?? 40,
          deposit: b.deposit ?? c.defaultDeposit ?? 50,
          logoCost: b.logoCost || 0,
          discount: b.discount || 0,
          dispatchInsumos: b.dispatchInsumos || [],
        })
        setItems(b.items?.length ? b.items : [emptyItem()])
        setEditId(b.id)
        setMarginBudgetedSaved(typeof b.marginBudgeted === 'number' ? b.marginBudgeted : null)
      }
    } else {
      // Restaurar borrador si existe
      const saved = db(DRAFT_KEY, null)
      if (saved) {
        const { f, it, step } = saved
        if (f) setForm(prev => ({ ...prev, ...f }))
        if (it?.length) setItems(it)
        if (step) setCurrentStep(step)
        setDraftRestored(true)
        toast('Borrador restaurado — tus datos anteriores están cargados', 'ok')
      }
    }
  }, [id]) // eslint-disable-line

  // Auto-guardar borrador mientras se edita un presupuesto nuevo
  useEffect(() => {
    if (id) return
    const hasSomeData = form.contact || form.company || items.some(i => i.name)
    if (hasSomeData) {
      dbW(DRAFT_KEY, { f: form, it: items, step: currentStep })
    }
  }, [form, items, currentStep]) // eslint-disable-line

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleClientSelect = (client) => {
    setForm(f => ({ ...f, contact: client.contact || '', company: client.company || '', wa: client.wa || '', clientEmail: client.email || '' }))
    const m = (c.defaultMargin || 40) / 100
    setItems(prev => prev.map(it => {
      if (!it.name || !it.costUnit) return it
      const match = products.find(p => p.name === it.name)
      if (match) {
        const price = match.priceB2C || Math.round(num(match.cost) * (1 + m))
        return { ...it, priceUnit: price }
      }
      return it
    }))
  }

  const updateItem = (idx, key, val) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [key]: val }
      if (key === 'name') {
        const match = products.find(p => p.name === val)
        if (match) {
          updated.costUnit = match.cost || 0
          updated.productId = match.id
          updated.priceUnit = match.priceB2C || Math.round(num(match.cost) * (1 + marginPct / 100))
          updated.stockAvailable = match.stock || 0
        }
      }
      return updated
    }))
  }
  const addItem = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (idx) => setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerIdx, setPickerIdx] = useState(null)
  const openPicker = (idx) => { setPickerIdx(idx); setPickerOpen(true) }
  const handlePickProduct = useCallback((p) => {
    if (pickerIdx === null) return
    setItems(prev => prev.map((it, i) => {
      if (i !== pickerIdx) return it
      return { ...it, name: p.name, costUnit: p.cost || 0, priceUnit: Math.round(num(p.cost) * (1 + marginPct / 100)) }
    }))
  }, [pickerIdx, marginPct])

  /* ── Drag & drop de filas ── */
  const dragIdxRef = useRef(null)
  const [dragOver, setDragOver] = useState(null)
  const handleDragStart = (idx) => (e) => { dragIdxRef.current = idx; e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (idx) => (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== idx) setDragOver(idx) }
  const handleDragLeave = () => setDragOver(null)
  const handleDrop = (idx) => (e) => {
    e.preventDefault()
    const from = dragIdxRef.current
    setDragOver(null)
    dragIdxRef.current = null
    if (from == null || from === idx) return
    setItems(prev => {
      const copy = [...prev]
      const [moved] = copy.splice(from, 1)
      copy.splice(idx, 0, moved)
      return copy
    })
  }

  /* ── Dispatch insumo management (Step 3 dynamic packaging) ── */
  const addDispatchInsumo = () => setF('dispatchInsumos', [...(form.dispatchInsumos || []), { insumoId: '', qty: 1 }])
  const updateDispatchInsumo = (idx, field, val) =>
    setF('dispatchInsumos', (form.dispatchInsumos || []).map((d, i) => i !== idx ? d : { ...d, [field]: Number(val) }))
  const removeDispatchInsumo = (idx) =>
    setF('dispatchInsumos', (form.dispatchInsumos || []).filter((_, i) => i !== idx))

  const loadBolsaEcommerce = () => {
    const bolsa = insumosList.find(i => { const n = i.name.toLowerCase(); return n.includes('bolsa') || n.includes('mailer') || n.includes('sobre') || n.includes('ecommerce') })
    if (bolsa) {
      setF('dispatchInsumos', [...(form.dispatchInsumos || []).filter(d => d.insumoId !== bolsa.id), { insumoId: bolsa.id, qty: 1 }])
      toast('✉️ Bolsa eCommerce cargada', 'ok')
    } else {
      toast('No encontré un insumo tipo bolsa. Cargá uno en /insumos.', 'er')
    }
  }
  const loadCajaFragil = () => {
    const caja = insumosList.find(i => i.name.toLowerCase().includes('caja'))
    const protec = insumosList.find(i => { const n = i.name.toLowerCase(); return n.includes('burbuja') || n.includes('protec') || n.includes('foam') || n.includes('nylon') })
    const preload = []
    if (caja) preload.push({ insumoId: caja.id, qty: 1 })
    if (protec) preload.push({ insumoId: protec.id, qty: 1 })
    if (preload.length) { setF('dispatchInsumos', preload); toast('📦 Caja Frágil cargada', 'ok') }
    else toast('No encontré insumos de caja o protección. Cargá en /insumos.', 'er')
  }

  /* ── Auto-suggest dispatch packaging when entering Step 3 ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentStep !== 3) return
    if ((form.dispatchInsumos || []).length > 0) return
    const isPickup = ['retira', 'local', 'showroom'].some(kw => (form.delivery || '').toLowerCase().includes(kw))
    if (isPickup || !insumosList.length) return
    const allProducts = get('products')
    const cartCats = items.filter(i => i.productId).map(i => {
      const prod = allProducts.find(p => p.id === i.productId)
      return (prod?.cat || '').toLowerCase()
    })
    if (!cartCats.length) return
    const hasFrag = cartCats.some(cat => ['tecno', 'electro', 'decor', 'frágil', 'fragil'].some(kw => cat.includes(kw)))
    const hasCloth = cartCats.some(cat => ['indument', 'ropa', 'textil'].some(kw => cat.includes(kw)))
    if (hasFrag) {
      const caja = insumosList.find(i => i.name.toLowerCase().includes('caja'))
      const protec = insumosList.find(i => { const n = i.name.toLowerCase(); return n.includes('burbuja') || n.includes('protec') || n.includes('foam') })
      const preload = []
      if (caja) preload.push({ insumoId: caja.id, qty: 1 })
      if (protec) preload.push({ insumoId: protec.id, qty: 1 })
      if (preload.length) { setF('dispatchInsumos', preload); toast('📦 Caja Frágil sugerida por los productos del carrito', 'ok') }
    } else if (hasCloth) {
      const bolsa = insumosList.find(i => { const n = i.name.toLowerCase(); return n.includes('bolsa') || n.includes('mailer') || n.includes('sobre') })
      if (bolsa) { setF('dispatchInsumos', [{ insumoId: bolsa.id, qty: 1 }]); toast('✉️ Bolsa eCommerce sugerida por los productos del carrito', 'ok') }
    }
  }, [currentStep])

  const calc = useMemo(() => {
    const allInsumos = get('insumos', [])
    let totalCost = 0, totalRevenue = 0, totalQty = 0
    items.forEach(i => {
      const q = num(i.qty), cv = num(i.costUnit), p = num(i.priceUnit)
      // Round per-item to avoid floating-point accumulation across many lines
      totalCost    += Math.round(q * cv)
      totalRevenue += Math.round(q * p)
      totalQty     += q
    })
    // Flat per-order dispatch packaging cost (invisible to client)
    // Uses live insumo costs — frozen at save time when stockDeducted becomes true
    const dispatchCost = Math.round((form.dispatchInsumos || []).reduce((s, d) => {
      const insumo = allInsumos.find(x => x.id === Number(d.insumoId))
      const cost = insumo ? Number(insumo.cost) || 0 : 0
      return s + cost * (Number(d.qty) || 0)
    }, 0))
    const logTotal = Math.round(num(form.logoCost) * totalQty)
    const ship = num(form.shipCost)
    const shipCharged = form.shipCharged !== false
    const baseCost = totalCost + logTotal + ship + dispatchCost
    const discountPct = Math.min(Math.max(num(form.discount), 0), 100)
    const discountAmt = Math.round(totalRevenue * discountPct / 100)
    const total = totalRevenue - discountAmt + (shipCharged ? ship : 0)
    const gain = total - baseCost
    const marginReal = total > 0 ? ((gain / total) * 100).toFixed(1) : '0.0'
    const marginThreshold = num(c.marginLowThreshold) || 10
    const marginLow = total > 0 && Number(marginReal) < marginThreshold
    const depositAmt = Math.round(total * num(form.deposit) / 100)
    return { totalCost, totalRevenue, logTotal, baseCost, total, gain, marginReal, marginLow, marginThreshold, depositAmt, totalQty, discountAmt, discountPct, dispatchCost }
  }, [items, form.shipCost, form.shipCharged, form.logoCost, form.deposit, form.discount, form.dispatchInsumos, c.marginLowThreshold, get])

  const budgetNum = useMemo(() => {
    if (editId) { const b = get('budgets').find(x => x.id === editId); return b?.num || '#—' }
    const num = c.nextNum || 1
    return `${c.budgetPrefix || 'AN'}-${String(num).padStart(4, '0')}`
  }, [editId, c.nextNum, c.budgetPrefix])

  const handleSave = () => {
    if (!form.contact && !form.company) { toast('Falta el cliente. Cargá un nombre de contacto o empresa.', 'er'); return }
    if (form.wa && !isValidWA(form.wa)) { toast('El WhatsApp no tiene un formato válido. Ej: +54 351 1234567', 'er'); setWaTouched(true); return }
    const validItems = items.filter(i => i.name).map(i => ({ ...i, qty: num(i.qty), costUnit: num(i.costUnit), priceUnit: num(i.priceUnit) }))
    if (!validItems.length) { toast('Necesitás al menos un producto. Agregá uno desde "Productos".', 'er'); return }

    // Qualifying = order has started / is confirmed as real.
    // Uses a Set so it handles:
    //   - English key values (current selects: 'inprogress', 'delivered')
    //   - Spanish label values saved by legacy versions of the app
    //   - payStatus 'paid' (independent of order status)
    const QUALIFYING_STATES = new Set([
      'inprogress', 'delivered',                        // current English keys
      'En preparación', 'En producción', 'Entregado',   // legacy Spanish label values
    ])
    const qualifyingStatus = QUALIFYING_STATES.has(form.status) || form.payStatus === 'paid'
    // stockDeducted flag prevents double-deduction if status goes qualifying → draft → qualifying
    const prevBudget = editId ? get('budgets').find(x => x.id === editId) : null
    const wasStockDeducted = prevBudget?.stockDeducted === true
    const willDeductStock = qualifyingStatus && !wasStockDeducted

    // ── Cost freeze ──────────────────────────────────────────────────────────────
    // Once stock is deducted, the COST side is frozen to the values at confirmation
    // time. This prevents retroactive gain changes if insumo/dispatch costs change
    // later. Revenue (total) and depositAmt always reflect the current form so
    // payment tracking stays accurate.
    const frozenTotalCost = wasStockDeducted ? (prevBudget.totalCost ?? calc.baseCost) : calc.baseCost
    const totalGain       = calc.total - frozenTotalCost

    const saveForm = { ...form, shipCost: 0, shipCharged: false, envioACotizar: form.envioACotizar !== false, logoCost: num(form.logoCost), margin: num(form.margin), deposit: num(form.deposit), payStatus: form.payStatus || 'pending' }
    const marginBudgeted = marginBudgetedSaved !== null ? marginBudgetedSaved : Number(calc.marginReal)
    const savedBudget = saveBudget({
      ...(editId ? { id: editId } : {}), ...saveForm,
      items: validItems,
      totalCost: frozenTotalCost,
      totalGain,
      total: calc.total,
      depositAmt: calc.depositAmt,
      marginBudgeted,
      stockDeducted: wasStockDeducted || willDeductStock,
      // Snapshot frozen on first confirmation — immutable audit record of costs at sale time
      ...(willDeductStock ? { costSnapshot: { date: new Date().toISOString().slice(0, 10), baseCost: calc.baseCost, dispatchCost: calc.dispatchCost } } : {}),
    })
    if (!editId) setMarginBudgetedSaved(marginBudgeted)

    // Silent stock deduction — only fires on first transition to a qualifying status
    // Deducts product stock AND flat dispatch insumo quantities
    if (willDeductStock) {
      deductStockForOrder(validItems, form.dispatchInsumos || [], savedBudget?.num || '')
    }

    setDraftRestored(false)
    dbDel(DRAFT_KEY)
    toast('Presupuesto guardado', 'ok')
    // ─── Auto-sync a Google Sheets (fire-and-forget) ───
    const gs = getSheetsConfig()
    if (gs.enabled && gs.autoSync && gs.url && savedBudget) {
      pushBudget(savedBudget).then(r => {
        if (r.ok) toast('Sincronizado con Google Sheets', 'ok')
      }).catch(() => {})
    }
    nav('/')
  }

  /* ── Validación por paso ── */
  const stepError = (step) => {
    if (step === 1) {
      if (!form.contact && !form.company) return 'Cargá un contacto o nombre de empresa para continuar.'
      if (form.wa && !isValidWA(form.wa)) return 'El WhatsApp no tiene un formato válido. Ej: +54 351 1234567'
      return null
    }
    if (step === 2) {
      if (!items.some(i => i.name)) return 'Agregá al menos un producto al pedido.'
      return null
    }
    return null
  }
  const goNext = () => {
    const err = stepError(currentStep)
    if (err) { toast(err, 'er'); if (currentStep === 1 && form.wa) setWaTouched(true); return }
    setCurrentStep(s => Math.min(WIZARD_STEPS.length, s + 1))
  }
  const goPrev = () => setCurrentStep(s => Math.max(1, s - 1))
  const goStep = (id) => {
    // permitir volver atrás libremente; avanzar sólo si los pasos previos están OK
    if (id <= currentStep) { setCurrentStep(id); return }
    for (let s = currentStep; s < id; s++) {
      const err = stepError(s)
      if (err) { toast(err, 'er'); return }
    }
    setCurrentStep(id)
  }

  const waText = useMemo(() => {
    const bName = c.businessName || 'ANMA'
    const prodList = items.filter(i => i.name).map(i => `• ${i.qty}x ${i.name}`).join('\n')
    return `Hola ${form.contact || '[NOMBRE]'}! Te envio el presupuesto de *${bName}* para ${form.company || '[EMPRESA]'}:\n\n${prodList}\n\n*Total:* ${fmt(calc.total)}\n*Entrega estimada:* ${form.deliveryDate ? fmtDate(form.deliveryDate) : 'A coordinar'}${form.noteCli ? '\n*Nota:* ' + form.noteCli : ''}\n\nTe queda alguna duda? Quedamos a disposicion!`
  }, [form, items, calc.total, c.businessName])

  const copyWA = () => navigator.clipboard.writeText(waText).then(() => toast('Mensaje WA copiado', 'ok'))

  const mpCfg = getMPConfig()
  const bankCfg = getBankConfig()

  const generateMP = async () => {
    const mp = getMPConfig()
    if (!mp.enabled || !mp.token) { toast('Activá y configurá Mercado Pago en Configuración > Pagos.', 'er'); return }
    setMpLoading(true)
    try {
      const budget = { num: budgetNum, contact: form.contact, company: form.company, items, shipCost: form.shipCost }
      const result = await createPaymentLink({ budget, mp, depositPct: form.deposit })
      if (result.ok) {
        setMpResult({ ok: true, link: result.link, label: `${result.amountLabel}: ${fmt(result.amount)}` })
        toast('Link de pago creado', 'ok')
      } else {
        setMpResult({ ok: false, message: result.message })
      }
    } catch { setMpResult({ ok: false, message: 'Error de conexión' }) }
    setMpLoading(false)
  }

  const copyBankInfo = () => {
    const bank = getBankConfig()
    if (!bank.enabled) { toast('Activá la transferencia bancaria en Configuración > Pagos.', 'er'); return }
    if (!bank.cbu && !bank.alias) { toast('Cargá al menos CBU o Alias en Configuración > Pagos.', 'er'); return }
    const text = buildBankInfoText(bank, c.businessName || 'ANMA')
    navigator.clipboard.writeText(text).then(() => toast('Datos de transferencia copiados', 'ok'))
  }

  const copyBankWithBudget = () => {
    const bank = getBankConfig()
    if (!bank.enabled) { toast('Activá la transferencia bancaria en Configuración > Pagos.', 'er'); return }
    const bankText = buildBankInfoText(bank, c.businessName || 'ANMA')
    const fullText = `${waText}\n\n${bankText}`
    navigator.clipboard.writeText(fullText).then(() => toast('Presupuesto + datos bancarios copiados', 'ok'))
  }

  /* ── WhatsApp directo — abre wa.me con el texto del presupuesto ── */
  const waPhone = () => form.wa.replace(/[^\d]/g, '')

  const sendWhatsApp = () => {
    const phone = waPhone()
    if (!phone) { toast('El cliente no tiene número de WhatsApp cargado.', 'er'); return }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`, '_blank')
  }

  /* ── Finalizar y Enviar Cobro — presupuesto + datos bancarios por WA ── */
  const sendPaymentByWA = () => {
    const bank = getBankConfig()
    if (!bank.enabled) { toast('Activá la transferencia bancaria en Configuración > Pagos.', 'er'); return }
    const phone = waPhone()
    if (!phone) { toast('El cliente no tiene número de WhatsApp cargado.', 'er'); return }
    const fullText = `${waText}\n\n${buildBankInfoText(bank, c.businessName || 'ANMA')}`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(fullText)}`, '_blank')
  }

  /* ── Enviar Datos de Pago — solo CBU/Alias por WA ── */
  const sendBankDataByWA = () => {
    const bank = getBankConfig()
    if (!bank.enabled) { toast('Activá la transferencia bancaria en Configuración > Pagos.', 'er'); return }
    if (!bank.cbu && !bank.alias) { toast('Cargá al menos CBU o Alias en Configuración > Pagos.', 'er'); return }
    const phone = waPhone()
    if (!phone) { toast('El cliente no tiene número de WhatsApp cargado.', 'er'); return }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildBankInfoText(bank, c.businessName || 'ANMA'))}`, '_blank')
  }

  /* ── ESC cierra modales ── */
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (previewHtml) { setPreviewHtml(''); return }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [previewHtml])

  const buildPdfHtml = () => {
    const fmtD = iso => { if (!iso) return ''; const p = String(iso).slice(0,10).split('-'); return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : iso }
    const brandColor = c.brandColor || '#7C3AED'
    const bName = c.businessName || 'ANMA'
    const prodRows = items.filter(i => i.name).map(i =>
      `<tr><td>${i.name}${i.variant ? ' <span style="color:#888;font-size:10px">· ' + i.variant + '</span>' : ''}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${fmt(i.priceUnit)}</td><td style="text-align:right">${fmt(i.qty * i.priceUnit)}</td></tr>`
    ).join('')
    // Vigencia auto-calculada
    const validDays = num(c.budgetValidityDays) || 7
    const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + validDays)
    const vigenciaISO = validUntil.toISOString().slice(0, 10)
    // Link WA dueño para "Aceptar presupuesto"
    const ownerWA = (c.ownerWA || c.businessWA || '').replace(/[^\d+]/g, '')
    const acceptMsg = encodeURIComponent(`Hola! Acepto el presupuesto ${budgetNum} de ${bName}. Cliente: ${form.contact || form.company || ''}. Total: ${fmt(calc.total)}.`)
    const waLink = ownerWA ? `https://wa.me/${ownerWA.replace('+','')}?text=${acceptMsg}` : ''
    const showEnvioLeyenda = form.envioACotizar !== false
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${budgetNum}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;margin:0;padding:22px 28px 70px;color:#1E1B4B;font-size:11.5px;line-height:1.45;background:#fff}
      .header-tbl{width:100%;border-collapse:collapse;margin-bottom:14px}
      .header-tbl td{padding-bottom:10px;border-bottom:2.5px solid ${brandColor};vertical-align:top}
      .brand{font-size:18px;font-weight:800;color:${brandColor};letter-spacing:-.3px}
      .brand img{height:38px;display:block}
      .hd-meta{text-align:right;font-size:10.5px;color:#555;line-height:1.5}
      .hd-meta .num{font-size:15px;font-weight:800;color:#1E1B4B;margin-bottom:2px}
      .vig{display:inline-block;margin-top:5px;padding:3px 8px;background:#FEF3C7;color:#92400E;font-size:9.5px;font-weight:700;border-radius:4px;letter-spacing:.2px}
      .client-tbl{width:100%;border-collapse:collapse;background:#F8F9FC;border-radius:6px;margin-bottom:12px;font-size:11px}
      .client-tbl td{padding:6px 8px}
      .client-tbl .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#888;font-weight:700;margin-bottom:1px}
      .client-tbl .val{font-weight:600;color:#1E1B4B}
      table{width:100%;border-collapse:collapse;margin:4px 0 0}
      th{background:${brandColor};color:#fff;padding:7px 9px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:700}
      td{padding:6px 9px;border-bottom:1px solid #EEF0F7;font-size:11px}
      tr:last-child td{border-bottom:none}
      .variant{color:#888;font-size:9.5px;margin-left:4px}
      .totals{margin-top:6px}
      .totals-box{width:260px;margin-left:auto;padding:10px 14px;background:linear-gradient(135deg,${brandColor}0d,${brandColor}1a);border-radius:8px;border:1px solid ${brandColor}33}
      .totals-row{width:100%;border-collapse:collapse;font-size:11px;color:#555;margin:2px 0}
      .totals-row td{padding:2px 0}
      .totals-row .tv{text-align:right;font-family:monospace;font-weight:600;white-space:nowrap}
      .tr-big td{font-size:16px;font-weight:800;color:${brandColor};padding-top:6px;border-top:1px solid ${brandColor}33}
      .tr-big .tv{font-size:16px;font-weight:800}
      .tr-senia td{font-size:11.5px;font-weight:700;color:${brandColor}}
      .note{margin-top:12px;padding:9px 12px;background:#F4F6FD;border-left:3px solid ${brandColor};border-radius:4px;font-size:11px;color:#333}
      .footer{margin-top:14px;padding-top:8px;border-top:1px solid #E5E7F0;font-size:9.5px;color:#999;line-height:1.5}
      .cobro-block{margin-top:12px;padding:10px 14px;background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:8px}
      .cobro-title{font-size:10px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
      .cobro-tbl{width:100%;border-collapse:collapse;font-size:11px}
      .cobro-tbl td{padding:3px 0}
      .cobro-lbl{color:#666;font-weight:500}
      .cobro-val{font-weight:700;color:#1E1B4B;font-family:monospace;text-align:right}
      .copy-cbu{background:#fff;border:1px solid #86EFAC;border-radius:5px;padding:2px 8px;font-size:9.5px;color:#065F46;cursor:pointer;margin-left:8px;font-family:inherit}
      .copy-cbu:hover{background:#DCFCE7}
      @media print{.copy-cbu{display:none}}
      .iva-box{margin-top:10px;padding:10px 14px;background:#FAFBFD;border:1px solid #E5E7F0;border-radius:6px;font-size:10.5px;color:#374151}
      .iva-title{font-weight:700;margin-bottom:5px;font-size:10px;color:#1E1B4B;text-transform:uppercase;letter-spacing:.3px}
      .iva-tbl{width:100%;border-collapse:collapse}
      .iva-tbl td{padding:1.5px 0}
      .iva-tbl .iv{text-align:right;font-family:monospace;font-weight:600}
      .accept-fab{position:fixed;bottom:18px;right:18px;background:#25D366;color:#fff;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none;box-shadow:0 6px 20px rgba(37,211,102,.4);font-size:12.5px;display:inline-flex;align-items:center;gap:7px}
      .accept-fab:hover{background:#1da851}
      @media print{.accept-fab{display:none}body{padding:18px 22px}}
    </style></head><body>
    <table class="header-tbl" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div class="brand">${c.logo ? '<img src="' + c.logo + '" alt="' + bName + '">' : bName}</div></td>
      <td style="text-align:right">
        <div class="hd-meta">
          <div class="num">${budgetNum}</div>
          ${c.razonSocial ? '<div style="font-weight:600">' + c.razonSocial + '</div>' : ''}
          ${c.cuit ? '<div>CUIT: ' + c.cuit + '</div>' : ''}
          ${c.ptoVenta ? '<div>Pto. Venta: ' + c.ptoVenta + '</div>' : ''}
          ${c.condIva && c.ivaEnabled ? '<div>' + c.condIva + '</div>' : ''}
          <div>Fecha de emisión: ${fmtD(new Date().toISOString().slice(0, 10))}</div>
          ${form.deliveryDate ? '<div>Entrega: ' + fmtD(form.deliveryDate) + '</div>' : ''}
          <div class="vig">⏱ Válido hasta: ${fmtD(vigenciaISO)}</div>
        </div>
      </td>
    </tr></table>
    <table class="client-tbl" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${form.contact ? `<td><div class="lbl">Contacto</div><div class="val">${form.contact}</div></td>` : '<td></td>'}
      ${form.company ? `<td><div class="lbl">Empresa</div><div class="val">${form.company}</div></td>` : '<td></td>'}
    </tr>${(form.wa || form.delivery) ? `<tr>
      ${form.wa ? `<td><div class="lbl">WhatsApp</div><div class="val">${form.wa}</div></td>` : '<td></td>'}
      ${form.delivery ? `<td><div class="lbl">Modalidad</div><div class="val">${form.delivery}</div></td>` : '<td></td>'}
    </tr>` : ''}</table>
    <table>
      <thead><tr><th>Producto</th><th style="text-align:center;width:55px">Cant.</th><th style="text-align:right;width:90px">P. unit.</th><th style="text-align:right;width:95px">Subtotal</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table>
    <div class="totals"><div class="totals-box">
      <table class="totals-row" width="100%" cellpadding="0" cellspacing="0"><tr><td>Subtotal productos</td><td class="tv">${fmt(calc.totalRevenue)}</td></tr></table>
      ${calc.discountAmt > 0 ? `<table class="totals-row" width="100%" cellpadding="0" cellspacing="0" style="color:#DC2626"><tr><td>Descuento (${calc.discountPct}%)</td><td class="tv">−${fmt(calc.discountAmt)}</td></tr></table>` : ''}
      ${showEnvioLeyenda ? `<table class="totals-row" width="100%" cellpadding="0" cellspacing="0" style="font-size:10px;color:#92400E;font-style:italic"><tr><td>🚚 Costo de envío sujeto a pesaje y despacho</td><td class="tv">A cotizar</td></tr></table>` : ''}
      <table class="totals-row tr-big" width="100%" cellpadding="0" cellspacing="0"><tr><td>Total</td><td class="tv">${fmt(calc.total)}</td></tr></table>
      <table class="totals-row tr-senia" width="100%" cellpadding="0" cellspacing="0"><tr><td>Seña (${form.deposit}%)</td><td class="tv">${fmt(calc.depositAmt)}</td></tr></table>
      <table class="totals-row" width="100%" cellpadding="0" cellspacing="0" style="color:#059669;font-weight:700"><tr><td>Saldo contra entrega</td><td class="tv">${fmt(calc.total - calc.depositAmt)}</td></tr></table>
    </div></div>
    ${c.ivaEnabled ? (() => {
      const total = calc.total
      const ivaR = (Number(c.ivaRate) || 21) / 100
      const otrosR = (Number(c.otrosImpuestosRate) || 0) / 100
      const ivaContenido = total - (total / (1 + ivaR))
      const otrosImpAmt = total * otrosR
      return `<div class="iva-box">
        <div class="iva-title">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</div>
        <table class="iva-tbl" width="100%" cellpadding="0" cellspacing="0"><tr><td>IVA Contenido (${(ivaR*100).toFixed(0)}%)</td><td class="iv">${fmt(ivaContenido)}</td></tr></table>
        ${otrosR > 0 ? `<table class="iva-tbl" width="100%" cellpadding="0" cellspacing="0"><tr><td>Otros Impuestos Nacionales Indirectos</td><td class="iv">${fmt(otrosImpAmt)}</td></tr></table>` : ''}
      </div>`
    })() : ''}
    ${form.noteCli ? `<div class="note">${form.noteCli}</div>` : ''}
    ${(() => {
      const bank = getBankConfig ? getBankConfig() : null
      const mp = getMPConfig ? getMPConfig() : null
      const hasCobro = (bank && bank.enabled && (bank.cbu || bank.alias)) || (mp && mp.enabled)
      if (!hasCobro) return ''
      return `<div class="cobro-block">
        <div class="cobro-title">💳 Datos para el pago</div>
        ${bank && bank.enabled && (bank.cbu || bank.alias) ? `
          <table class="cobro-tbl" width="100%" cellpadding="0" cellspacing="0">
          ${bank.cbu ? '<tr><td class="cobro-lbl">CBU</td><td class="cobro-val">' + bank.cbu + '<button class="copy-cbu" onclick="navigator.clipboard.writeText(\'' + bank.cbu + '\').catch(()=>{});var b=this;b.textContent=\'✓ Copiado\';setTimeout(function(){b.innerHTML=\'⎘ Copiar\'},1400)">⎘ Copiar</button></td></tr>' : ''}
          ${bank.alias ? '<tr><td class="cobro-lbl">Alias</td><td class="cobro-val">' + bank.alias + '<button class="copy-cbu" onclick="navigator.clipboard.writeText(\'' + bank.alias + '\').catch(()=>{});var b=this;b.textContent=\'✓ Copiado\';setTimeout(function(){b.innerHTML=\'⎘ Copiar\'},1400)">⎘ Copiar</button></td></tr>' : ''}
          ${bank.accountName ? '<tr><td class="cobro-lbl">Titular</td><td class="cobro-val">' + bank.accountName + '</td></tr>' : ''}
          ${bank.bank ? '<tr><td class="cobro-lbl">Banco</td><td class="cobro-val">' + bank.bank + '</td></tr>' : ''}
          </table>
        ` : ''}
      </div>`
    })()}
    ${(c.paymentConditions || c.legalNote) ? `<div class="footer">${c.paymentConditions ? '<div>' + c.paymentConditions + '</div>' : ''}${c.legalNote ? '<div style="margin-top:2px">' + c.legalNote + '</div>' : ''}</div>` : ''}
    ${waLink ? `<a class="accept-fab" href="${waLink}" target="_blank" rel="noopener"><span style="font-size:15px">✓</span> Aceptar Presupuesto</a>` : ''}
    </body></html>`
  }

  const openPreview = () => setPreviewHtml(buildPdfHtml())
  const printPDF = () => {
    const html = buildPdfHtml()
    const win = window.open('', '_blank')
    win.document.write(html); win.document.close()
    setTimeout(() => win.print(), 300)
  }

  /* ── Enviar por email (EmailJS) ── */
  const [emailSending, setEmailSending] = useState(false)
  const sendByEmail = async () => {
    const clientEmail = form.clientEmail.trim()
    if (!clientEmail) { toast('Agregá el email del cliente en el Paso 1.', 'er'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) { toast('El email del cliente no es válido.', 'er'); return }
    const svc = (c.ejsServiceId || '').trim()
    const tpl = (c.ejsTemplateId || '').trim()
    const pub = (c.ejsPublicKey || '').trim()
    if (!svc || !tpl || !pub) { toast('Configurá el email en Configuración → Integraciones → Email.', 'er'); return }
    setEmailSending(true)
    try {
      const emailjs = (await import('@emailjs/browser')).default
      await emailjs.send(svc, tpl, {
        to_email: clientEmail,
        subject: `Presupuesto ${budgetNum} — ${c.businessName || 'ANMA'}`,
        html_body: buildPdfHtml(),
        from_name: c.businessName || 'ANMA',
        client_name: form.contact || form.company || 'Cliente',
        budget_num: budgetNum,
      }, pub)
      toast(`Presupuesto enviado a ${clientEmail}`, 'ok')
    } catch (e) {
      toast(`Error al enviar: ${e?.text || e?.message || 'intentá de nuevo'}`, 'er')
    }
    setEmailSending(false)
  }

  return (
    <div className="page active" style={{ animation: 'pgIn .2s ease both' }}>
      <div className="ph ph-pres">
        <div className="ph-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '.01em', color: 'var(--txt)' }}>{budgetNum}</span>
          {(form.status === 'draft' || !editId) && (
            <span style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 9999, padding: '2px 9px', fontSize: 11, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' }}>Borrador</span>
          )}
        </div>
        <div className="ph-right"><button className="btn btn-ghost btn-sm" onClick={() => { dbDel(DRAFT_KEY); setDraftRestored(false); nav('/') }}><i className="fa fa-xmark" /><span className="desc-txt"> Descartar</span></button></div>
      </div>


      {/* MOBILE STEP INDICATOR */}
      <div className="wiz-mobile-hd">
        <div className="wmh-label">Paso {currentStep} de {WIZARD_STEPS.length} &nbsp;·&nbsp; <b>{WIZARD_STEPS[currentStep - 1]?.label}</b></div>
        <div className="wmh-bar"><div className="wmh-fill" style={{ width: `${Math.round((currentStep / WIZARD_STEPS.length) * 100)}%` }} /></div>
      </div>

      {/* STEPPER */}
      <div className="wizard-steps">
        {WIZARD_STEPS.map((s, idx) => {
          const state = currentStep === s.id ? 'active' : currentStep > s.id ? 'done' : 'pending'
          return (
            <div key={s.id} className="wiz-step-wrap">
              <div className={`wiz-step ${state}`} onClick={() => goStep(s.id)}>
                <div className="wiz-step-num">
                  {state === 'done' ? <i className="fa fa-check" /> : s.id}
                </div>
                <div className="wiz-step-txt">
                  <div className="wiz-step-lbl">{s.label}</div>
                  <div className="wiz-step-desc">{s.desc}</div>
                </div>
                <i className={`fa ${s.icon} wiz-step-bgicon`} />
              </div>
              {idx < WIZARD_STEPS.length - 1 && <div className={`wiz-conn ${currentStep > s.id ? 'done' : ''}`} />}
            </div>
          )
        })}
      </div>

      <div className="budget-layout">
        <div>
          <div className="wiz-pane">
            {/* ─── PASO 1: CLIENTE ─── */}
            {currentStep === 1 && (
              <>
                <PaneHeader icon="fa-user-tie" title="Paso 1 · Cliente" subtitle="¿A quién le estás haciendo el presupuesto?" />
                <div className="grid2">
                  <div className="fg">
                    <label>Contacto (buscar en CRM)</label>
                    <ClientCombo clients={clients} value={form.contact} onSelect={handleClientSelect} onChange={val => setF('contact', val)} />
                  </div>
                  <div className="fg"><label>Empresa</label><input type="text" value={form.company} onChange={e => setF('company', e.target.value)} placeholder="Empresa S.A." /></div>
                  <div className="fg">
                    <label>WhatsApp</label>
                    <input type="text" value={form.wa}
                      onChange={e => { setF('wa', e.target.value); if (!waTouched) setWaTouched(true) }}
                      onBlur={() => setWaTouched(true)}
                      placeholder="+54 351 1234567"
                      className={waTouched && form.wa && !isValidWA(form.wa) ? 'inp-err' : ''} />
                    {waTouched && form.wa && !isValidWA(form.wa) && (
                      <div className="fg-err"><i className="fa fa-circle-exclamation" /> Formato no válido. Ej: <b>+54 351 1234567</b> (8 a 15 dígitos)</div>
                    )}
                  </div>
                  <div className="fg">
                    <label>Email del cliente</label>
                    <input type="email" value={form.clientEmail} onChange={e => setF('clientEmail', e.target.value)} placeholder="cliente@email.com" />
                  </div>
                </div>
                <div className="wiz-tip">
                  <i className="fa fa-lightbulb" /> Buscá un contacto existente o creá uno nuevo escribiendo el nombre.
                </div>
              </>
            )}

            {/* ─── PASO 2: PRODUCTOS ─── */}
            {currentStep === 2 && (
              <>
                <PaneHeader icon="fa-box-open" title="Paso 2 · Productos" subtitle="Agregá los ítems que incluye el pedido" />
                <div className="items-scroll" style={{ overflowX: 'auto' }}>
                  <table style={{ tableLayout: 'fixed', width: '100%', minWidth: 720 }}>
                    <thead><tr>
                      <th style={{ width: 24 }}></th>
                      <th>Producto</th>
                      <th style={{ width: 82 }}>Variante</th>
                      <th style={{ width: 48, textAlign: 'center' }}>Stock</th>
                      <th style={{ width: 85, textAlign: 'right' }}>Cant.</th>
                      {feats.costoInterno && <th style={{ width: 110, textAlign: 'right' }}>Costo u.</th>}
                      <th style={{ width: 110, textAlign: 'right' }}>Precio u.</th>
                      <th style={{ width: 130, textAlign: 'right' }}>Subtotal</th>
                      <th style={{ width: 40 }}></th>
                    </tr></thead>
                    <tbody>
                      {items.map((it, i) => {
                        const overStock = it.stockAvailable !== undefined && num(it.qty) > it.stockAvailable
                        return (
                          <tr key={i}
                            onDragOver={handleDragOver(i)} onDrop={handleDrop(i)} onDragLeave={handleDragLeave}
                            style={{ height: 36, ...(dragOver === i ? { background: 'var(--brand-xlt)', outline: '2px dashed var(--brand)' } : {}) }}>
                            <td style={{ textAlign: 'center', cursor: 'grab', color: 'var(--txt3)', verticalAlign: 'middle' }}
                              draggable onDragStart={handleDragStart(i)} title="Arrastrar para reordenar">
                              <i className="fa fa-grip-vertical" />
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="text" value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Nombre del producto" style={{ padding: '0 8px', fontSize: 12, flex: 1, minWidth: 0, height: 36, boxSizing: 'border-box' }} />
                                <button onClick={() => openPicker(i)} type="button" title="Elegir del catálogo"
                                  style={{ width: 28, height: 28, borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--brand)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, transition: 'background .12s' }}>
                                  <i className="fa fa-list" />
                                </button>
                              </div>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}><input type="text" value={it.variant || ''} onChange={e => updateItem(i, 'variant', e.target.value)} placeholder="Color / talle" style={{ padding: '0 6px', fontSize: 12, width: '100%', height: 36, boxSizing: 'border-box' }} /></td>
                            <td style={{ textAlign: 'center', fontSize: 11, color: overStock ? 'var(--red)' : 'var(--txt3)', fontWeight: overStock ? 700 : 400, verticalAlign: 'middle' }}>
                              {it.stockAvailable !== undefined ? it.stockAvailable : '—'}
                              {overStock && <i className="fa fa-triangle-exclamation" style={{ color: 'var(--red)', marginLeft: 2, fontSize: 9 }} />}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}><input type="text" inputMode="numeric" value={it.qty === '' ? '' : String(it.qty)} onFocus={selectOnFocus} onChange={e => { const r = parseTbl(e.target.value); updateItem(i, 'qty', r === '' ? '' : Math.max(1, parseInt(r) || 1)) }} onBlur={e => { if (e.target.value === '') updateItem(i, 'qty', 1) }} style={{ padding: '0 8px', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit', width: '100%', textAlign: 'right', height: 36, boxSizing: 'border-box' }} /></td>
                            {feats.costoInterno && <td style={{ verticalAlign: 'middle' }}><input type="text" inputMode="numeric" value={fmtTbl(it.costUnit)} onFocus={selectOnFocus} onChange={e => { const r = parseTbl(e.target.value); updateItem(i, 'costUnit', r === '' ? '' : Number(r)) }} onBlur={e => { if (e.target.value === '') updateItem(i, 'costUnit', 0) }} style={{ padding: '0 8px', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit', width: '100%', textAlign: 'right', height: 36, boxSizing: 'border-box' }} /></td>}
                            <td style={{ verticalAlign: 'middle' }}><input type="text" inputMode="numeric" value={fmtTbl(it.priceUnit)} onFocus={selectOnFocus} onChange={e => { const r = parseTbl(e.target.value); updateItem(i, 'priceUnit', r === '' ? '' : Number(r)) }} onBlur={e => { if (e.target.value === '') updateItem(i, 'priceUnit', 0) }} style={{ padding: '0 8px', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit', width: '100%', textAlign: 'right', height: 36, boxSizing: 'border-box' }} /></td>
                            <td style={{ fontWeight: 700, color: 'var(--money)', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit', textAlign: 'right', paddingRight: 8, verticalAlign: 'middle' }}>{fmt(num(it.qty) * num(it.priceUnit))}</td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}><button onClick={() => removeItem(i)} title="Eliminar" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--txt3)', cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'color .15s, background .15s' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-lt)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt3)'; e.currentTarget.style.background = 'transparent' }}><i className="fa fa-xmark" /></button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ─── Mobile: card list — visible only on mobile via CSS ─── */}
                <div className="mob-items-list">
                  {items.map((it, i) => {
                    const overStock = it.stockAvailable !== undefined && num(it.qty) > it.stockAvailable
                    return (
                      <div key={i} className="mob-item-card">

                        {/* Fila 1: Nombre del producto + picker + eliminar */}
                        <div className="mic-header">
                          <input
                            type="text"
                            value={it.name}
                            onChange={e => updateItem(i, 'name', e.target.value)}
                            placeholder="Nombre del producto"
                            className="mic-name-input"
                          />
                          <button
                            onClick={() => openPicker(i)}
                            type="button"
                            title="Elegir del catálogo"
                            className="mic-picker-btn"
                          >
                            <i className="fa fa-list" />
                          </button>
                          <button
                            onClick={() => removeItem(i)}
                            type="button"
                            title="Eliminar producto"
                            className="mic-del-btn"
                          >
                            <i className="fa fa-xmark" />
                          </button>
                        </div>

                        {/* Fila 2: Variante + Stock */}
                        <div className="mic-meta-row">
                          <div className="mic-field" style={{ flex: 1, minWidth: 0 }}>
                            <span className="mic-label">Variante</span>
                            <input
                              type="text"
                              value={it.variant || ''}
                              onChange={e => updateItem(i, 'variant', e.target.value)}
                              placeholder="Color / talle"
                              className="mic-variant-input"
                            />
                          </div>
                          <div className="mic-field mic-stock-field">
                            <span className="mic-label">Stock</span>
                            <span className="mic-stock-val" style={overStock ? { color: '#DC2626' } : {}}>
                              {it.stockAvailable !== undefined ? it.stockAvailable : '—'}
                              {overStock && (
                                <i className="fa fa-triangle-exclamation" style={{ marginLeft: 5, fontSize: 11, color: '#DC2626' }} />
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Fila 3: Cant. + Precio u. + Subtotal */}
                        <div className="mic-nums-row">
                          <div className="mic-field">
                            <span className="mic-label">Cant.</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={it.qty === '' ? '' : String(it.qty)}
                              onFocus={selectOnFocus}
                              onChange={e => { const r = parseTbl(e.target.value); updateItem(i, 'qty', r === '' ? '' : Math.max(1, parseInt(r) || 1)) }}
                              onBlur={e => { if (e.target.value === '') updateItem(i, 'qty', 1) }}
                              className="mic-qty-input"
                            />
                          </div>
                          <div className="mic-field mic-price-field">
                            <span className="mic-label">Precio u.</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={fmtTbl(it.priceUnit)}
                              onFocus={selectOnFocus}
                              onChange={e => { const r = parseTbl(e.target.value); updateItem(i, 'priceUnit', r === '' ? '' : Number(r)) }}
                              onBlur={e => { if (e.target.value === '') updateItem(i, 'priceUnit', 0) }}
                              className="mic-price-input"
                            />
                          </div>
                          <div className="mic-field mic-subtotal-field">
                            <span className="mic-label">Subtotal</span>
                            <span className="mic-subtotal">{fmt(num(it.qty) * num(it.priceUnit))}</span>
                          </div>
                        </div>

                      </div>
                    )
                  })}
                </div>

                <ProductPicker open={pickerOpen} onClose={() => setPickerOpen(false)} products={products} onSelect={handlePickProduct} />
                <button className="btn btn-ghost btn-xs" style={{ marginTop: 8 }} onClick={addItem}><i className="fa fa-plus" /> Agregar producto</button>
                <div className="wiz-tip">
                  <i className="fa fa-lightbulb" /> Escribí el nombre del producto para autocompletar desde tu catálogo — el costo y precio se llenan solos.
                </div>
              </>
            )}

            {/* ─── PASO 3: ENTREGA ─── */}
            {currentStep === 3 && (
              <>
                <PaneHeader icon="fa-truck" title="Paso 3 · Entrega y precio" subtitle="Configurá modalidad, fechas y parámetros" />
                <div className="grid2">
                  <div className="fg"><label>Modalidad</label>
                    <select value={form.delivery} onChange={e => {
                      const val = e.target.value
                      setF('delivery', val)
                      // Auto-clear dispatch insumos when customer picks up in person
                      if (['retira', 'local', 'showroom'].some(kw => val.toLowerCase().includes(kw))) {
                        setF('dispatchInsumos', [])
                      }
                    }}>
                      <option value="">— seleccionar —</option>
                      {(c.deliveryModes || []).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="fg">
                    <label>Fecha pactada</label>
                    <input type="date" value={form.deliveryDate} onChange={e => setF('deliveryDate', e.target.value)} {...(editId ? {} : { min: todayISO() })} />
                    {form.deliveryDate && isWeekend(form.deliveryDate) && (
                      <div style={{ fontSize: 10, color: 'var(--amber,#F59E0B)', marginTop: 3 }}>
                        <i className="fa fa-triangle-exclamation" /> Es fin de semana. Verificá si entregás ese día.
                      </div>
                    )}
                  </div>
                  <div className="fg">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                      <input type="checkbox" checked={form.envioACotizar !== false} onChange={e => setF('envioACotizar', e.target.checked)} style={{ width: 'auto' }} />
                      Envío a cotizar (mostrar leyenda en PDF)
                    </label>
                  </div>
                  <div className="fg"><label>Estado del pedido</label>
                    <select value={form.status} onChange={e => setF('status', e.target.value)}>
                      <option value="draft">Borrador</option>
                      <option value="sent">Enviado al cliente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="inprogress">En producción</option>
                      <option value="delivered">Entregado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  <div className="fg"><label>Estado de pago</label>
                    <select value={form.payStatus} onChange={e => setF('payStatus', e.target.value)}>
                      <option value="pending">Pago pendiente</option>
                      <option value="partial">Seña abonada</option>
                      <option value="paid">Pagado</option>
                    </select>
                  </div>
                </div>
                <div className="grid3" style={{ marginTop: 4 }}>
                  <div className="fg"><label>Margen ganancia (%)</label><input type="number" value={form.margin} onFocus={selectOnFocus} onChange={e => setF('margin', e.target.value)} onBlur={e => { if (e.target.value === '') setF('margin', 0) }} min="0" max="100" style={{ maxWidth: 120 }} /></div>
                  <div className="fg"><label>Seña requerida (%)</label><input type="number" value={form.deposit} onFocus={selectOnFocus} onChange={e => setF('deposit', e.target.value)} onBlur={e => { if (e.target.value === '') setF('deposit', 0) }} min="0" max="100" style={{ maxWidth: 120 }} /></div>
                  <div className="fg"><label>Impresión/logo x u. ($)</label><input type="number" value={form.logoCost} onFocus={selectOnFocus} onChange={e => setF('logoCost', e.target.value)} onBlur={e => { if (e.target.value === '') setF('logoCost', 0) }} min="0" style={{ maxWidth: 140 }} /></div>
                </div>
                {feats.descuentoCliente && (
                  <div className="fg" style={{ maxWidth: 200, marginTop: 4 }}>
                    <label>Descuento al cliente (%)</label>
                    <input type="number" value={form.discount} onFocus={selectOnFocus} onChange={e => setF('discount', e.target.value)} onBlur={e => { if (e.target.value === '') setF('discount', 0) }} min="0" max="100" style={{ maxWidth: 120 }} />
                  </div>
                )}

                {/* ─── 📦 Insumos Operativos de Despacho ─── */}
                {!['retira', 'local', 'showroom'].some(kw => (form.delivery || '').toLowerCase().includes(kw)) && (
                  <div style={{ marginTop: 20, padding: '18px 20px', background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #E5E7EB)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📦</span> Insumos Operativos de Despacho
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Packaging y materiales del envío — invisibles para el cliente, impactan en tu costo real
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={loadBolsaEcommerce} title="Cargar Bolsa eCommerce / mailer">
                          ✉️ Bolsa eCommerce
                        </button>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={loadCajaFragil} title="Cargar Caja + protección para frágiles">
                          📦 Caja Frágil
                        </button>
                      </div>
                    </div>

                    {insumosList.length === 0 ? (
                      <div className="wiz-tip">
                        <i className="fa fa-circle-info" /> Todavía no tenés insumos cargados.{' '}
                        <a href="/insumos" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Ir a Insumos</a> para agregar bolsas, cajas y materiales de packaging.
                      </div>
                    ) : (
                      <>
                        {(form.dispatchInsumos || []).length === 0 && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0', fontStyle: 'italic' }}>
                            Sin insumos cargados para este envío.
                          </div>
                        )}
                        {(form.dispatchInsumos || []).map((d, idx) => {
                          const ins = insumosList.find(x => x.id === Number(d.insumoId))
                          const lineCost = ins ? Number(ins.cost || 0) * Number(d.qty || 0) : 0
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              <select
                                value={d.insumoId || ''}
                                onChange={e => updateDispatchInsumo(idx, 'insumoId', e.target.value)}
                                style={{ flex: '1 1 180px', minWidth: 140 }}
                              >
                                <option value="">— insumo —</option>
                                <option value="" disabled>── Packaging ──</option>
                                {insumosList.filter(i => {
                                  const n = i.name.toLowerCase()
                                  return n.includes('bolsa') || n.includes('caja') || n.includes('mailer') || n.includes('sobre') || n.includes('burbuja') || n.includes('protec') || n.includes('foam') || n.includes('nylon') || n.includes('pack')
                                }).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                <option value="" disabled>── Otros ──</option>
                                {insumosList.filter(i => {
                                  const n = i.name.toLowerCase()
                                  return !n.includes('bolsa') && !n.includes('caja') && !n.includes('mailer') && !n.includes('sobre') && !n.includes('burbuja') && !n.includes('protec') && !n.includes('foam') && !n.includes('nylon') && !n.includes('pack')
                                }).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                              </select>
                              <input
                                type="number" min="1" value={d.qty}
                                onChange={e => updateDispatchInsumo(idx, 'qty', e.target.value)}
                                style={{ width: 64, textAlign: 'center' }}
                                placeholder="Cant."
                              />
                              {ins && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 80, textAlign: 'right' }}>
                                  {fmt(lineCost)}
                                </span>
                              )}
                              <button type="button" className="btn btn-ghost btn-xs" onClick={() => removeDispatchInsumo(idx)} style={{ color: 'var(--red, #EF4444)', padding: '2px 6px' }}>
                                <i className="fa fa-trash" />
                              </button>
                            </div>
                          )
                        })}
                        <button type="button" className="btn btn-ghost btn-xs" style={{ marginTop: 4 }} onClick={addDispatchInsumo}>
                          <i className="fa fa-plus" /> Agregar insumo
                        </button>
                        {(form.dispatchInsumos || []).length > 0 && calc.dispatchCost > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total packaging este envío</span>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{fmt(calc.dispatchCost)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="grid2" style={{ marginTop: 12 }}>
                  {feats.notasInternas && (
                    <div className="fg"><label>Nota interna</label><textarea value={form.noteInt} onChange={e => setF('noteInt', e.target.value)} rows={2} placeholder="Solo para vos..." /></div>
                  )}
                  <div className="fg"><label>Nota al cliente (PDF)</label><textarea value={form.noteCli} onChange={e => setF('noteCli', e.target.value)} rows={2} placeholder="Visible en el presupuesto..." /></div>
                </div>
              </>
            )}

            {/* ─── PASO 4: CONFIRMAR ─── */}
            {currentStep === 4 && (
              <>
                <PaneHeader icon="fa-check-double" title="Paso 4 · Confirmar y enviar" subtitle="Revisá todo antes de guardar" />
                <div className="wiz-review">
                  <div className="wiz-rev-card">
                    <div className="wiz-rev-card-h"><i className="fa fa-user-tie" /> Cliente <button className="wiz-rev-edit" onClick={() => goStep(1)}>Editar</button></div>
                    <div className="wiz-rev-body">
                      <div><b>{form.contact || '—'}</b>{form.company ? ` · ${form.company}` : ''}</div>
                      <div className="wiz-rev-meta">{form.wa || 'Sin WhatsApp'}</div>
                    </div>
                  </div>
                  <div className="wiz-rev-card">
                    <div className="wiz-rev-card-h"><i className="fa fa-box-open" /> Productos ({items.filter(i => i.name).length}) <button className="wiz-rev-edit" onClick={() => goStep(2)}>Editar</button></div>
                    <div className="wiz-rev-body">
                      {items.filter(i => i.name).map((it, idx) => (
                        <div key={idx} className="wiz-rev-item">
                          <span>{it.qty}× {it.name}</span>
                          <span>{fmt(num(it.qty) * num(it.priceUnit))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="wiz-rev-card">
                    <div className="wiz-rev-card-h"><i className="fa fa-truck" /> Entrega <button className="wiz-rev-edit" onClick={() => goStep(3)}>Editar</button></div>
                    <div className="wiz-rev-body">
                      <div>{form.delivery || 'Sin modalidad'} · {form.deliveryDate ? fmtDate(form.deliveryDate) : 'Sin fecha'}</div>
                      <div className="wiz-rev-meta">Envío {fmt(num(form.shipCost))} · Margen {form.margin}% · Seña {form.deposit}%</div>
                    </div>
                  </div>
                </div>
                <div className="wiz-tip" style={{ marginTop: 14 }}>
                  <i className="fa fa-circle-check" /> Todo listo. Al confirmar guardás el presupuesto y volvés al dashboard.
                </div>
              </>
            )}

            {/* QUICK ACTIONS BAR — visible solo en mobile */}
            <div className="pres-mob-total">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pmt-label">Total</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="pmt-val">{fmt(calc.total)}</div>
                  {feats.margenTabla && calc.marginLow && <span className="pmt-warn" title={`Margen bajo (< ${calc.marginThreshold}%)`}><i className="fa fa-triangle-exclamation" /></span>}
                  {feats.margenTabla && <div className="pmt-margin">{calc.marginReal}%</div>}
                </div>
              </div>
              <div className="pmt-acts">
                <button className="pmt-act-btn" onClick={sendWhatsApp} title="Enviar presupuesto">
                  <i className="fa-brands fa-whatsapp" style={{ fontSize: 20, color: '#4ade80' }} />
                  <span>Enviar</span>
                </button>
                {bankCfg.enabled && (
                  <button className="pmt-act-btn" onClick={sendBankDataByWA} title="Enviar datos de pago">
                    <i className="fa-brands fa-whatsapp" style={{ fontSize: 20, color: '#86efac' }} />
                    <span>Pago</span>
                  </button>
                )}
                <button className="pmt-act-btn" onClick={printPDF} title="Descargar PDF">
                  <i className="fa fa-file-pdf" style={{ fontSize: 20, color: '#93C5FD' }} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* NAV WIZARD */}
            <div className="wiz-nav">
              <button className="btn btn-ghost" onClick={goPrev} disabled={currentStep === 1}>
                <i className="fa fa-arrow-left" /> Anterior
              </button>
              <div className="wiz-nav-mid">Paso {currentStep} de {WIZARD_STEPS.length}</div>
              {currentStep < WIZARD_STEPS.length ? (
                <button className="btn btn-primary" onClick={goNext}>
                  Siguiente <i className="fa fa-arrow-right" />
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleSave}>
                  <i className="fa fa-floppy-disk" /> Confirmar y guardar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PANEL LATERAL */}
        <div>
          <div className="calc-panel">
            <div className="cp-title"><i className="fa fa-calculator" />Resumen</div>
            <div className="cp-row"><span className="cp-lbl">N° Presupuesto</span><span className="cp-val">{budgetNum}</span></div>
            {feats.costoInterno && <div className="cp-row"><span className="cp-lbl">Costo proveedor</span><span className="cp-val">{fmt(calc.totalCost)}</span></div>}
            {calc.logTotal > 0 && <div className="cp-row"><span className="cp-lbl">Impresión</span><span className="cp-val">{fmt(calc.logTotal)}</span></div>}
            {num(form.shipCost) > 0 && <div className="cp-row"><span className="cp-lbl">Envío</span><span className="cp-val">{fmt(num(form.shipCost))}</span></div>}
            {calc.dispatchCost > 0 && <div className="cp-row"><span className="cp-lbl">📦 Despacho</span><span className="cp-val">{fmt(calc.dispatchCost)}</span></div>}
            {calc.discountAmt > 0 && (
              <div className="cp-row" style={{ borderTop: '1px dashed rgba(255,255,255,.10)', marginTop: 2, paddingTop: 4 }}>
                <span className="cp-lbl" style={{ color: 'rgba(255,255,255,.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className="fa fa-tag" style={{ fontSize: 9, opacity: .7 }} />
                  Descuento ({calc.discountPct}%)
                </span>
                <span className="cp-val" style={{ color: '#FCA5A5', fontWeight: 700 }}>
                  −{fmt(calc.discountAmt)}
                </span>
              </div>
            )}
            {feats.margenTabla && <div className="cp-row"><span className="cp-lbl">Ganancia</span><span className="cp-val" style={{ color: '#86EFAC' }}>{fmt(calc.gain)}</span></div>}
            {feats.margenTabla && <div className="cp-row"><span className="cp-lbl">Margen real</span><span className="cp-val" style={calc.marginLow ? { color: 'var(--red)', fontWeight: 800 } : undefined}>{calc.marginReal}%{calc.marginLow && <i className="fa fa-triangle-exclamation" style={{ marginLeft: 4, fontSize: 10 }} title={`Margen bajo (< ${calc.marginThreshold}%)`} />}</span></div>}
            {feats.margenTabla && marginBudgetedSaved !== null && Math.abs(marginBudgetedSaved - Number(calc.marginReal)) >= 0.5 && (() => {
              const delta = (Number(calc.marginReal) - marginBudgetedSaved).toFixed(1)
              const positive = Number(delta) >= 0
              return (
                <div className="cp-margin-cmp">
                  <div className="cmp-row"><span className="cmp-lbl"><i className="fa fa-bookmark" /> Presupuestado</span><span className="cmp-val">{marginBudgetedSaved.toFixed(1)}%</span></div>
                  <div className="cmp-row"><span className="cmp-lbl"><i className="fa fa-bullseye" /> Real actual</span><span className="cmp-val">{calc.marginReal}%</span></div>
                  <div className={`cmp-delta ${positive ? 'pos' : 'neg'}`}>
                    <i className={`fa fa-arrow-${positive ? 'up' : 'down'}`} />
                    {positive ? '+' : ''}{delta}% {positive ? 'mejor que lo presupuestado' : 'por debajo de lo presupuestado'}
                  </div>
                </div>
              )
            })()}
            <div className="cp-total-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div className="cp-total-val">{fmt(calc.total)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Seña: {fmt(calc.depositAmt)}</div>
                </div>
              </div>
            </div>
            <div className="cp-actions">

              {/* ── 1. GUARDAR ── acción principal */}
              <button className="cp-btn cp-btn-primary"
                onClick={handleSave}
                style={{ fontSize: 14, padding: '13px 16px', fontWeight: 800, letterSpacing: '.01em', boxShadow: '0 4px 16px rgba(var(--brand-rgb),.35)' }}>
                <i className="fa fa-floppy-disk" /> Guardar Presupuesto
              </button>

              {/* ── 2. COMUNICACIÓN — compact ghost row ── */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.32)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Comunicación</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={sendWhatsApp}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.22)', borderRadius: 7, color: '#4ade80', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,.16)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,211,102,.08)'}>
                    <i className="fa-brands fa-whatsapp" style={{ fontSize: 13 }} /> Enviar
                  </button>
                  {bankCfg.enabled ? (
                    <button onClick={sendBankDataByWA}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.18)', borderRadius: 7, color: '#86efac', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,.14)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,211,102,.06)'}>
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: 13 }} /> Pago
                    </button>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 6px', background: 'rgba(100,116,139,.05)', border: '1px dashed rgba(100,116,139,.18)', borderRadius: 7, color: 'rgba(255,255,255,.18)', fontSize: 11 }}>
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: 12 }} /> Pago
                    </div>
                  )}
                </div>
              </div>

              {/* ── 3. DOCUMENTOS ── herramientas, fila compacta slate */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Documentos</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={openPreview}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', background: 'rgba(100,116,139,.18)', border: '1px solid rgba(100,116,139,.32)', borderRadius: 7, color: 'rgba(255,255,255,.72)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,116,139,.3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,116,139,.18)'}>
                    <i className="fa fa-eye" style={{ fontSize: 12 }} /> Vista previa
                  </button>
                  <button onClick={printPDF}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px', background: 'rgba(100,116,139,.18)', border: '1px solid rgba(100,116,139,.32)', borderRadius: 7, color: 'rgba(255,255,255,.72)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,116,139,.3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,116,139,.18)'}>
                    <i className="fa fa-file-pdf" style={{ fontSize: 12 }} /> PDF
                  </button>
                </div>
                {c.ejsEnabled && (
                  <button onClick={sendByEmail} disabled={emailSending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 5, padding: '7px', background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.22)', borderRadius: 7, color: 'rgba(255,255,255,.55)', fontSize: 11, fontWeight: 500, cursor: emailSending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: emailSending ? .6 : 1, transition: 'background .15s' }}
                    onMouseEnter={e => { if (!emailSending) e.currentTarget.style.background = 'rgba(100,116,139,.22)' }}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,116,139,.12)'}>
                    <i className={`fa ${emailSending ? 'fa-spinner fa-spin' : 'fa-envelope'}`} style={{ fontSize: 11 }} />
                    {emailSending ? 'Enviando email...' : 'Enviar por email'}
                  </button>
                )}
              </div>

              {mpResult && (
                <div style={{ marginTop: 6, fontSize: 10, wordBreak: 'break-all' }}>
                  {mpResult.ok
                    ? <a href={mpResult.link} target="_blank" rel="noopener noreferrer" style={{ color: '#009EE3' }}>{mpResult.label} — Abrir link</a>
                    : <span style={{ color: 'var(--red)' }}>Error: {mpResult.message}</span>}
                </div>
              )}
            </div>

            {/* ── 4. PAGO ONLINE ── Mercado Pago (si está activo) */}
            {mpCfg.enabled && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                  <i className="fa fa-credit-card" style={{ marginRight: 4 }} />Pago online
                </div>
                <button onClick={generateMP} disabled={mpLoading}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 10px', background: 'rgba(0,132,255,.12)', border: '1px solid rgba(0,132,255,.26)', borderRadius: 8, color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: mpLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: mpLoading ? .7 : 1, transition: 'background .15s' }}
                  onMouseEnter={e => { if (!mpLoading) e.currentTarget.style.background = 'rgba(0,132,255,.2)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,132,255,.12)'}>
                  <i className="fa fa-credit-card" style={{ fontSize: 13 }} />
                  {mpLoading ? 'Generando link...' : 'Generar link de pago (MP)'}
                </button>
              </div>
            )}
            {!mpCfg.enabled && !bankCfg.enabled && (
              <div className="cp-pay-empty">
                <i className="fa fa-circle-info" /> Activá un método de cobro en Config › Pagos
              </div>
            )}
            <div className="wa-prev">
              <div className="wa-prev-lbl">Vista previa WA</div>
              <div className="wa-bubble">{waText}</div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PREVIEW */}
      {previewHtml && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setPreviewHtml('') }}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 940, height: 'min(900px, 90vh)', boxShadow: 'var(--sh-lg)', animation: 'pgIn .2s ease both', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, margin: 'auto 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface2)', borderRadius: '18px 18px 0 0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Vista previa — {budgetNum}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={() => { printPDF(); setPreviewHtml('') }}><i className="fa fa-print" /> Imprimir</button>
                <button className="mclose" onClick={() => setPreviewHtml('')}><i className="fa fa-xmark" /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <iframe title="Vista previa PDF" srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
