import { useState, useEffect, useRef, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { fmt, db, dbW } from '../../lib/storage'
import { getCategoriesForRubro, getRubroMeta, catsAreOutdated, RUBROS } from '../../lib/rubros'
import { getProductPlaceholder, getEmptyProducts } from '../../lib/voice'

const EMPTY = { name: '', cat: '', cost: '', stock: 0, minStock: 0, unit: 'unidad', supplierId: '', priceB2C: '', priceB2B: '', sku: '', notes: '', image: '' }

const compressImage = (file, maxBytes = 180000) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const maxDim = 600
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
        else { width = Math.round(width * maxDim / height); height = maxDim }
      }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      let q = 0.85
      let result = canvas.toDataURL('image/jpeg', q)
      while (result.length > maxBytes && q > 0.2) { q -= 0.1; result = canvas.toDataURL('image/jpeg', q) }
      resolve(result)
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
})

/* Paleta de colores para categorías */
const CAT_PALETTE = [
  { bg: '#F5F3FF', color: '#8B5CF6' },
  { bg: '#EFF6FF', color: '#60A5FA' },
  { bg: '#ECFDF5', color: '#34D399' },
  { bg: '#FFFBEB', color: '#F59E0B' },
  { bg: '#FDF2F8', color: '#F472B6' },
  { bg: '#F0FDFA', color: '#2DD4BF' },
  { bg: '#FFF7ED', color: '#FB923C' },
  { bg: '#F1F5F9', color: '#94A3B8' },
]

export default function Catalogo() {
  const { get, config, updateConfig, saveEntity, deleteEntity, recordStockMove } = useData()
  const toast   = useToast()
  const confirm = useConfirm()
  const c = config()
  const { role } = useAuth()
  const opHideCosts = role === 'operator' && c.opShowCosts === false
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [bulkModal, setBulkModal] = useState(false)
  const [csvModal, setCsvModal] = useState(false)
  const [moveModal, setMoveModal] = useState(null)
  const [moveForm, setMoveForm] = useState({ type: 'in', qty: '', note: '' })
  const [priceUpdateModal, setPriceUpdateModal] = useState(false)
  const [pricePct, setPricePct] = useState('')
  const [priceSupplier, setPriceSupplier] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showCostInfo, setShowCostInfo] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [bulkCat, setBulkCat] = useState('')
  const [bulkData, setBulkData] = useState('')
  const [csvPreview, setCsvPreview] = useState([])
  const [csvCat, setCsvCat] = useState('')
  const csvRef = useRef(null)

  // New state variables
  const [stockAlert, setStockAlert] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkCatModal, setBulkCatModal] = useState(false)
  const [bulkCatValue, setBulkCatValue] = useState('')
  const [bulkSupplierModal, setBulkSupplierModal] = useState(false)
  const [bulkSupplierValue, setBulkSupplierValue] = useState('')
  const [catMgmtModal, setCatMgmtModal] = useState(false)
  const [editingCat, setEditingCat] = useState(null) // { original, value }
  const [viewMode, setViewMode] = useState(() => db('productViewMode', 'grid'))
  const switchView = (mode) => { setViewMode(mode); dbW('productViewMode', mode) }
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [marginInput, setMarginInput] = useState('')
  const imgRef = useRef(null)
  const bodyRef = useRef(null)
  const [hasDraft, setHasDraft] = useState(null)
  const DRAFT_KEY = 'anma_prod_draft'

  useEffect(() => { const t = setTimeout(() => setLoading(false), 80); return () => clearTimeout(t) }, [])

  const products = get('products')
  const suppliers = get('suppliers')
  const cats = c.productCats || []
  const units = c.units || ['unidad','kg','litro','metro','caja','pack','rollo']
  const rules = c.pricingRules || { b2c: { margin: 40 }, b2b: { margin: 25 } }
  /* ── Tipo de venta del onboarding condiciona qué columnas/inputs de precio
     ver: minorista solo B2C, mayorista solo B2B, ambos = ambas. Default
     'ambos' por compatibilidad con usuarios que aún no pasaron el Paso 1. */
  const tipoVenta = c.tipoVenta || 'ambos'
  const showB2C = tipoVenta === 'minorista' || tipoVenta === 'ambos'
  const showB2B = tipoVenta === 'mayorista' || tipoVenta === 'ambos'
  // Total de columnas opcionales activas — para calcular colSpan correctamente.
  const priceColsActive = (showB2C ? 1 : 0) + (showB2B ? 1 : 0)

  const filtered = useMemo(() => {
    let f = products
    if (catFilter !== 'all') f = f.filter(p => p.cat === catFilter)
    if (stockAlert) f = f.filter(p => p.minStock > 0 && (p.stock || 0) <= p.minStock)
    if (search) { const s = search.toLowerCase(); f = f.filter(p => (p.name || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s)) }
    return f
  }, [products, catFilter, stockAlert, search])

  const isAllSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id))

  const lowStock = products.filter(p => p.minStock > 0 && (p.stock || 0) <= p.minStock)
  const totalValue = products.reduce((s, p) => s + (p.stock || 0) * (Number(p.cost) || 0), 0)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n }

  const autoPrice = (cost) => ({
    b2c: Math.round(num(cost) * (1 + (rules.b2c?.margin || 40) / 100)),
    b2b: Math.round(num(cost) * (1 + (rules.b2b?.margin || 25) / 100)),
  })

  /* % margen B2C vs costo */
  const marginPct = (p) => {
    const cost = Number(p.cost) || 0
    if (!cost) return null
    const price = Number(p.priceB2C) || autoPrice(cost).b2c
    return Math.round((price - cost) / cost * 100)
  }
  const marginColor = (pct) => {
    if (pct === null) return 'var(--txt4)'
    if (pct < 20) return 'var(--red)'
    if (pct < 35) return 'var(--amber)'
    return 'var(--green)'
  }

  /* Color badge por categoría */
  const catColor = (cat) => CAT_PALETTE[cats.indexOf(cat) % CAT_PALETTE.length] || CAT_PALETTE[0]

  const safeCat = (val) => (val && cats.includes(val)) ? val : (cats[0] || '')
  const handleImgUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setF('image', compressed)
    e.target.value = ''
  }

  const open = (p) => {
    setShowAdvanced(false)
    setHasDraft(null)
    if (p) {
      setForm({ ...EMPTY, ...p, cat: p.cat ?? '', image: p.image || '' })
      const c = num(p.cost); const pr = num(p.priceB2C)
      setMarginInput(c > 0 && pr > 0 ? String(Math.round((pr - c) / c * 100)) : String(rules.b2c?.margin || 40))
    } else {
      const m = rules.b2c?.margin || 40
      setMarginInput(String(m))
      const prices = autoPrice(0)
      setForm({ ...EMPTY, cat: cats[0] || '', priceB2C: prices.b2c, priceB2B: prices.b2b })
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (raw) {
          const d = JSON.parse(raw)
          if (d._ts && (Date.now() - d._ts) < 86400000) setHasDraft(d)
          else localStorage.removeItem(DRAFT_KEY)
        }
      } catch {}
    }
    setModal(true)
  }

  const onCostChange = (v) => {
    setF('cost', v)
    const c = parseFloat(v)
    const m = parseFloat(marginInput)
    if (!isNaN(c) && c > 0 && !isNaN(m) && marginInput !== '') {
      setF('priceB2C', Math.round(c * (1 + m / 100)))
      setF('priceB2B', Math.round(c * (1 + (rules.b2b?.margin || 25) / 100)))
    }
  }
  const onMarginChange = (v) => {
    setMarginInput(v)
    const c = num(form.cost)
    const m = parseFloat(v)
    if (c > 0 && !isNaN(m)) setF('priceB2C', Math.round(c * (1 + m / 100)))
  }
  const onPriceChange = (v) => {
    setF('priceB2C', v)
    const c = num(form.cost)
    const p = parseFloat(v)
    if (c > 0 && !isNaN(p) && p > 0) setMarginInput(String(Math.round((p - c) / c * 100)))
  }

  const save = () => {
    if (!form.name) { toast('Ingresá el nombre del producto.', 'er'); return }
    const data = { ...form, cat: form.cat ?? '', cost: num(form.cost), stock: num(form.stock), minStock: num(form.minStock), priceB2C: num(form.priceB2C), priceB2B: num(form.priceB2B), updatedAt: new Date().toISOString().slice(0,10) }
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    setHasDraft(null)
    saveEntity('products', data); setModal(false); toast('Producto guardado', 'ok')
  }

  const del = (id) => confirm('¿Eliminar producto?', () => { deleteEntity('products', id); toast('Producto eliminado', 'in') })
  const supplierName = (id) => { const s = suppliers.find(x => x.id === Number(id)); return s?.name || '—' }

  const openMove = (item) => { setMoveModal(item); setMoveForm({ type: 'in', qty: '', note: '' }) }
  const saveMove = () => {
    if (!moveForm.qty || Number(moveForm.qty) <= 0) { toast('Ingresá cantidad válida', 'er'); return }
    recordStockMove({ type: moveForm.type, productId: moveModal.id, qty: Number(moveForm.qty), note: moveForm.note || moveModal.name, ref: moveModal.name })
    setMoveModal(null); toast('Movimiento registrado', 'ok')
  }

  /* Actualización masiva de precios */
  const priceUpdatePreview = priceSupplier === 'all'
    ? products
    : products.filter(p => String(p.supplierId) === String(priceSupplier))

  const doPriceUpdate = () => {
    const pct = Number(pricePct)
    if (!pct) { toast('Ingresá un porcentaje válido', 'er'); return }
    const factor = 1 + pct / 100
    const targets = selectedIds.size > 0 ? products.filter(p => selectedIds.has(p.id)) : priceUpdatePreview
    targets.forEach(p => {
      const newCost = Math.round((Number(p.cost) || 0) * factor)
      const prices = autoPrice(newCost)
      saveEntity('products', { ...p, cost: newCost, priceB2C: prices.b2c, priceB2B: prices.b2b })
    })
    toast(`${targets.length} productos actualizados ${pct > 0 ? '+' : ''}${pct}%`, 'ok')
    setPriceUpdateModal(false); setPricePct(''); setPriceSupplier('all')
    if (selectedIds.size > 0) setSelectedIds(new Set())
  }

  const doBulk = () => {
    const lines = bulkData.split('\n').filter(l => l.trim())
    let count = 0
    lines.forEach(l => {
      const parts = l.split(',')
      if (parts.length >= 2) {
        const cost = Number(parts[1].trim()) || 0
        const prices = autoPrice(cost)
        saveEntity('products', { name: parts[0].trim(), cat: bulkCat || cats[0] || '', cost, supplierId: '', stock: 0, minStock: 0, priceB2C: prices.b2c, priceB2B: prices.b2b, unit: 'unidad' })
        count++
      }
    })
    setBulkModal(false); setBulkData(''); toast(`${count} productos importados`, 'ok')
  }

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(l => l.trim())
      const header = lines[0].toLowerCase()
      const startIdx = header.includes('producto') || header.includes('nombre') || header.includes('name') ? 1 : 0
      const parsed = []
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []
        if (parts.length >= 1 && parts[0]) parsed.push({ name: parts[0], cost: Number(parts[1]) || 0, supplierId: '' })
      }
      setCsvPreview(parsed)
    }
    reader.readAsText(file)
  }

  const doCsvImport = () => {
    csvPreview.forEach(p => {
      const prices = autoPrice(p.cost)
      saveEntity('products', { ...p, cat: csvCat || cats[0] || '', stock: 0, minStock: 0, priceB2C: prices.b2c, priceB2B: prices.b2b, unit: 'unidad' })
    })
    toast(`${csvPreview.length} productos importados`, 'ok')
    setCsvPreview([]); setCsvModal(false)
    if (csvRef.current) csvRef.current.value = ''
  }

  /* Selection helpers */
  const toggleSelect = (id) => { if (id == null) return; setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  const toggleSelectAll = () => setSelectedIds(prev => prev.size === filtered.length && filtered.every(p => prev.has(p.id)) ? new Set() : new Set(filtered.map(p => p.id).filter(Boolean)))

  const doBulkDelete = () => {
    if (!selectedIds.size) return
    confirm({ body: `¿Eliminar ${selectedIds.size} producto${selectedIds.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`, danger: true, confirmLabel: 'Eliminar' }, () => {
      selectedIds.forEach(id => deleteEntity('products', id))
      toast(`${selectedIds.size} productos eliminados`, 'in')
      setSelectedIds(new Set())
    })
  }

  const doBulkCat = () => {
    if (!bulkCatValue) return
    selectedIds.forEach(id => {
      const p = products.find(x => x.id === id)
      if (p) saveEntity('products', { ...p, cat: bulkCatValue })
    })
    toast(`${selectedIds.size} productos movidos a "${bulkCatValue}"`, 'ok')
    setSelectedIds(new Set()); setBulkCatModal(false); setBulkCatValue('')
  }

  const doBulkSupplier = () => {
    selectedIds.forEach(id => {
      const p = products.find(x => x.id === id)
      if (p) saveEntity('products', { ...p, supplierId: bulkSupplierValue })
    })
    toast(`${selectedIds.size} productos actualizados`, 'ok')
    setSelectedIds(new Set()); setBulkSupplierModal(false); setBulkSupplierValue('')
  }

  const doRenamecat = (original, newName) => {
    if (!newName || newName === original) { setEditingCat(null); return }
    const newCats = cats.map(c => c === original ? newName : c)
    updateConfig({ productCats: newCats })
    products.filter(p => p.cat === original).forEach(p => saveEntity('products', { ...p, cat: newName }))
    toast(`Categoría renombrada a "${newName}"`, 'ok')
    setEditingCat(null)
  }

  const doDeleteCat = (cat) => {
    const affected = products.filter(p => p.cat === cat).length
    confirm({ body: `¿Eliminar categoría "${cat}"?${affected > 0 ? `\n${affected} producto${affected !== 1 ? 's' : ''} quedarán sin categoría.` : ''}`, danger: true, confirmLabel: 'Eliminar' }, () => {
      updateConfig({ productCats: cats.filter(c => c !== cat) })
      products.filter(p => p.cat === cat).forEach(p => saveEntity('products', { ...p, cat: '' }))
      toast(`Categoría eliminada`, 'in')
    })
  }

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (catMgmtModal) { setCatMgmtModal(false); setEditingCat(null); return }
        if (bulkCatModal) { setBulkCatModal(false); return }
        if (bulkSupplierModal) { setBulkSupplierModal(false); return }
        if (priceUpdateModal) { setPriceUpdateModal(false); return }
        if (moveModal) { setMoveModal(null); return }
        if (csvModal) { setCsvModal(false); setCsvPreview([]); return }
        if (bulkModal) { setBulkModal(false); return }
        if (modal) { setModal(false); return }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [catMgmtModal, bulkCatModal, bulkSupplierModal, priceUpdateModal, moveModal, csvModal, bulkModal, modal])

  /* Auto-guardar borrador mientras el modal está abierto */
  useEffect(() => {
    if (!modal) return
    const draft = { form, marginInput, _ts: Date.now() }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch {}
  }, [form, marginInput, modal]) // eslint-disable-line

  // ── Auto-detect: ¿el usuario tiene cats viejas para su rubro actual? ──
  // Si sí, mostramos banner ofreciendo upgrade. Dismiss persiste por workspace.
  const dismissKey = `cats_upgrade_dismissed_${c.rubro || 'none'}`
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === '1' } catch { return false }
  })
  const showCatsUpgrade = !bannerDismissed && c.rubro && catsAreOutdated(c.productCats || [], c.rubro)
  const applyUpgrade = () => {
    const suggested = getCategoriesForRubro(c.rubro)
    const meta = RUBROS.find(r => r.val === c.rubro)
    if (window.confirm(`¿Reemplazar tus ${(c.productCats || []).length} categorías actuales por las ${suggested.length} sugeridas para ${meta?.label || c.rubro}?\n\nLos productos con una categoría que ya no esté quedarán como "Sin categoría" hasta que los reasignes.`)) {
      updateConfig({ productCats: suggested })
      toast('Categorías actualizadas', 'ok')
      try { localStorage.removeItem(dismissKey) } catch {}
    }
  }
  const dismissUpgrade = () => {
    try { localStorage.setItem(dismissKey, '1') } catch {}
    setBannerDismissed(true)
  }

  return (
    <div className="page active" style={{ animation: 'pgIn .25s ease both' }}>
      {/* Banner: categorías desactualizadas */}
      {showCatsUpgrade && (() => {
        const meta = RUBROS.find(r => r.val === c.rubro)
        return (
          <div style={{
            background: 'linear-gradient(135deg, #F5F3FF 0%, #EFF6FF 100%)',
            border: '1px solid #C4B5FD', borderRadius: 12,
            padding: '12px 16px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <i className="fa fa-wand-magic-sparkles" style={{ color: '#7C3AED', fontSize: 18, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: '#1E1B4B', lineHeight: 1.5 }}>
              <b>Tenemos nuevas categorías sugeridas para {meta?.label || c.rubro}.</b>
              <br/>
              <span style={{ color: '#4C1D95', opacity: .8 }}>Tus categorías actuales parecen de una versión anterior. ¿Querés actualizarlas?</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={dismissUpgrade}
                style={{ background: 'transparent', border: '1px solid #C4B5FD', color: '#6D28D9', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Ahora no
              </button>
              <button onClick={applyUpgrade}
                style={{ background: '#7C3AED', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa fa-wand-magic-sparkles" /> Aplicar sugeridas
              </button>
            </div>
          </div>
        )
      })()}
      <div className="ph cat-ph" style={{ marginBottom: 6 }}>
        <div className="ph-right" style={{ gap: 6 }}>
          <div className="cli-pill-group">
            <button className="cli-pill" onClick={() => { setPriceSupplier('all'); setPricePct(''); setPriceUpdateModal(true) }}>
              <i className="fa fa-percent" /><span>Precios</span>
            </button>
            <button className="cli-pill" onClick={() => { setCsvCat(cats[0] || ''); setCsvModal(true) }}>
              <i className="fa fa-file-csv" /><span>Exportar</span>
            </button>
            <button className="cli-pill" onClick={() => { setBulkCat(cats[0] || ''); setBulkModal(true) }}>
              <i className="fa fa-file-import" /><span>Importar</span>
            </button>
            {/* ── View mode toggle ── */}
            <div style={{ display: 'inline-flex', border: '1.5px solid var(--border)', borderRadius: 9999, overflow: 'hidden', background: 'var(--surface)' }}>
              <button title="Vista cuadrícula" onClick={() => switchView('grid')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, border: 'none', cursor: 'pointer', fontSize: 13, transition: 'all .15s', background: viewMode === 'grid' ? 'var(--brand)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--txt3)' }}>
                <i className="fa fa-border-all" />
              </button>
              <button title="Vista lista" onClick={() => switchView('table')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, border: 'none', cursor: 'pointer', fontSize: 13, transition: 'all .15s', background: viewMode === 'table' ? 'var(--brand)' : 'transparent', color: viewMode === 'table' ? '#fff' : 'var(--txt3)' }}>
                <i className="fa fa-list" />
              </button>
            </div>
          </div>
          <button className="cli-pill-new" onClick={() => open()}>
            <i className="fa fa-plus" /><span>Nuevo</span>
          </button>
        </div>
      </div>

      <style>{`
        .cli-pill-group{display:inline-flex;align-items:center;gap:6px}
        .cli-pill{display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 18px;border-radius:9999px;border:1.5px solid var(--border);background:var(--surface);color:var(--txt2);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;line-height:1;white-space:nowrap;-webkit-tap-highlight-color:transparent;transition:all .15s}
        .cli-pill:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-xlt)}
        .cli-pill:active{transform:scale(.95)}
        .cli-pill i{font-size:12px}
        .cli-pill-new{display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 20px;border-radius:9999px;border:none;background:var(--color-principal);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;line-height:1;white-space:nowrap;-webkit-tap-highlight-color:transparent;transition:all .18s;box-shadow:0 4px 14px var(--brand-dim)}
        .cli-pill-new:hover{filter:brightness(1.08);transform:translateY(-1px)}
        .cli-pill-new:active{transform:scale(.95)}
        .cli-pill-new i{font-size:11px}
        @media(max-width:640px){.cli-pill{padding:7px 9px}.cli-pill-new{padding:7px 12px}.cat-ph{display:none!important}}
        @media(max-width:480px){.cat-price-calc{grid-template-columns:1fr!important}.cat-price-arrow{display:none!important}}
      `}</style>

      <div className="pill-row cat-pill-row">
        <div className="search-row" style={{ maxWidth: 280 }}><i className="fa fa-magnifying-glass" /><input type="text" placeholder="Buscar producto o SKU..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        {/* Contenedor scroll-horizontal en mobile, flex-wrap normal en desktop */}
        <div className="cat-scroll-row">
          <div className="cat-scroll-pills">
            {cats.length > 6 ? (
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                style={{ padding: '5px 10px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 12, background: 'var(--surface)', color: 'var(--txt)', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                <option value="all">Todas las categorías</option>
                {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            ) : (
              <>
                <div className={`pill ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>Todos</div>
                {cats.map(cat => <div key={cat} className={`pill ${catFilter === cat ? 'active' : ''}`} onClick={() => setCatFilter(cat)}>{cat}</div>)}
              </>
            )}
            {lowStock.length > 0 && (
              <div
                className={`pill ${stockAlert ? 'active' : ''}`}
                style={stockAlert ? {} : { borderColor: '#FCA5A5', color: 'var(--red)' }}
                onClick={() => setStockAlert(v => !v)}
              >
                <i className="fa fa-triangle-exclamation" style={{ marginRight: 4 }} />
                Stock crítico ({lowStock.length})
              </div>
            )}
          </div>
          {/* Gestionar: fijo en extremo derecho con degradado en mobile */}
          <button className="cat-gestionar" onClick={() => setCatMgmtModal(true)} title="Gestionar categorías">
            <i className="fa fa-sliders" /> Gestionar
          </button>
        </div>
      </div>

      {/* ── MOBILE CARD LIST (≤640px) ── */}
      <div className="cat-mob-list">
        {loading ? [1,2,3,4].map(i => (
          <div key={i} className="cat-mob-item">
            <div className="cat-mob-item-l" style={{ flex: 1 }}><div className="sk-line" style={{ height: 16, width: '55%' }} /></div>
          </div>
        )) : filtered.length ? filtered.map(p => {
          const cc = catColor(p.cat)
          return (
            <div key={p.id} className="cat-mob-item" onClick={() => open(p)}>
              <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                style={{ cursor: 'pointer', flexShrink: 0, width: 16, height: 16 }}
                onClick={e => e.stopPropagation()} />
              <div className="cat-mob-item-l">
                {p.image
                  ? <img src={p.image} className="cat-mob-item-img" alt={p.name} />
                  : <div className="cat-mob-item-noimg"><i className="fa fa-box-open" style={{ color: cc.color, fontSize: 16, opacity: .6 }} /></div>
                }
                <div className="cat-mob-item-info">
                  <span className="cat-mob-item-name">{p.name}</span>
                  {p.cat && <span className="cat-mob-item-cat">{p.cat}</span>}
                </div>
                <span className="cat-mob-item-price">{fmt(p.priceB2C || autoPrice(p.cost).b2c)}</span>
              </div>
              <div className="cat-mob-item-acts" onClick={e => e.stopPropagation()}>
                <button onClick={() => open(p)} title="Editar"
                  style={{ width:30,height:30,borderRadius:'50%',border:'1.5px solid var(--border2)',background:'var(--surface2)',color:'var(--txt2)',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0,WebkitTapHighlightColor:'transparent' }}>
                  <i className="fa fa-pen" />
                </button>
                <button onClick={() => del(p.id)} title="Eliminar"
                  style={{ width:30,height:30,borderRadius:'50%',border:'1.5px solid #FECACA',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0,WebkitTapHighlightColor:'transparent' }}>
                  <i className="fa fa-trash" />
                </button>
              </div>
            </div>
          )
        }) : (
          <div className="empty-native">
            <div className="ico"><i className="fa fa-box-open" /></div>
            <h4>{getEmptyProducts(c.rubro).title}</h4>
            <p>{getEmptyProducts(c.rubro).subtitle}</p>
          </div>
        )}
      </div>

      {/* ── DESKTOP TABLE / GRID (≥641px) ── */}
      <div className="cat-desk-view">
      {viewMode === 'table' ? (
        <div className="tbl-card">
          <table>
            <thead><tr>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
              </th>
              <th>Producto</th>
              <th className="col-hide-mobile">Categoría</th>
              <th className="col-hide-mobile">Proveedor</th>
              {!opHideCosts && <th style={{ textAlign: 'right' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  Costo
                  <button title={showCostInfo ? 'Ocultar última actualización' : 'Mostrar última actualización'} onClick={() => setShowCostInfo(v => !v)}
                    style={{ background: showCostInfo ? 'var(--brand)' : 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: showCostInfo ? '#fff' : 'var(--txt3)', fontSize: 9, padding: '2px 6px', cursor: 'pointer', fontWeight: 700, transition: 'all .2s' }}>
                    <i className="fa fa-clock" /> ult. act.
                  </button>
                </span>
              </th>}
              {showB2C && <th style={{ textAlign: 'right' }} className="col-hide-mobile">P. Público</th>}
              {showB2B && <th style={{ textAlign: 'right' }} className="col-hide-mobile">P. Mayorista</th>}
              {!opHideCosts && <th style={{ textAlign: 'center' }} className="col-hide-mobile">% Margen</th>}
              {showCostInfo && <th className="col-hide-mobile">Últ. actualización</th>}
              <th style={{ textAlign: 'right' }}>Stock</th>
              <th>Acciones</th>
            </tr></thead>
            <tbody>
              {loading ? [1,2,3,4].map(i => (
                <tr key={i}><td colSpan={(showCostInfo ? 11 : 10) - (2 - priceColsActive)}><div className="sk sk-text" style={{ height: 18, width: `${50 + Math.random() * 40}%` }} /></td></tr>
              )) : filtered.length ? filtered.map(p => {
                const isLow = p.minStock > 0 && (p.stock || 0) <= p.minStock
                const mp = marginPct(p)
                const cc = catColor(p.cat)
                return (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {p.image && <img src={p.image} alt={p.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />}
                        <div>
                          <div style={{ fontWeight: 800 }}>{p.name}</div>
                          {p.sku && <div style={{ fontSize: 10, color: 'var(--txt3)' }}>SKU: {p.sku}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="col-hide-mobile">
                      {/* Categoría editable inline. Click → abre select con categorías
                          del workspace. Cambio se guarda al instante. */}
                      <select
                        value={p.cat || ''}
                        onChange={e => saveEntity('products', { ...p, cat: e.target.value })}
                        spellCheck={false}
                        title="Click para cambiar categoría"
                        style={{
                          display: 'inline-flex', alignItems: 'center',
                          background: cc.bg, color: cc.color,
                          fontSize: 12, fontWeight: 700,
                          padding: '5px 24px 5px 12px', borderRadius: 20,
                          whiteSpace: 'nowrap', border: 'none',
                          cursor: 'pointer',
                          WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
                          textDecoration: 'none',
                          textDecorationLine: 'none',
                          textDecorationStyle: 'solid',
                          outline: 'none',
                          fontFamily: 'inherit',
                          lineHeight: 1.3,
                        }}
                      >
                        <option value="">— Sin categoría —</option>
                        {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <i className="fa fa-chevron-down" style={{ fontSize: 8, color: cc.color, marginLeft: -18, pointerEvents: 'none', opacity: .6 }} />
                    </td>
                    <td className="col-hide-mobile" style={{ fontSize: 11 }}>{supplierName(p.supplierId)}</td>
                    {!opHideCosts && <td style={{ textAlign: 'right' }}>{fmt(p.cost)}</td>}
                    {showB2C && <td className="col-hide-mobile" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--money)' }}>{fmt(p.priceB2C || autoPrice(p.cost).b2c)}</td>}
                    {showB2B && <td className="col-hide-mobile" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--money)' }}>{fmt(p.priceB2B || autoPrice(p.cost).b2b)}</td>}
                    {!opHideCosts && <td className="col-hide-mobile" style={{ textAlign: 'center' }}>
                      {mp !== null ? <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: marginColor(mp), background: marginColor(mp) + '18', padding: '2px 8px', borderRadius: 10 }}>{mp}%</span> : <span style={{ color: 'var(--txt4)', fontSize: 11 }}>—</span>}
                    </td>}
                    {showCostInfo && (
                      <td className="col-hide-mobile" style={{ fontSize: 11 }}>
                        {p.updatedAt ? (
                          <span style={{ color: (() => { const d = Math.floor((Date.now() - new Date(p.updatedAt)) / 86400000); return d > 180 ? '#DC2626' : d > 60 ? '#D97706' : '#16A34A' })(), fontWeight: 600 }}>
                            {(() => { const d = Math.floor((Date.now() - new Date(p.updatedAt)) / 86400000); if (d === 0) return 'Hoy'; if (d === 1) return 'Ayer'; if (d < 30) return `hace ${d}d`; if (d < 365) return `hace ${Math.floor(d/30)}m`; return `hace ${Math.floor(d/365)}a` })()}
                          </span>
                        ) : <span style={{ color: 'var(--txt4)' }}>—</span>}
                      </td>
                    )}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--txt)' }}>{p.stock || 0}</td>
                    <td><div style={{ display:'flex',gap:4,justifyContent:'flex-end' }}>
                      <button title="Movimiento de stock" onClick={() => openMove(p)}
                        style={{ width:28,height:28,borderRadius:'50%',border:'1.5px solid var(--border2)',background:'var(--surface2)',color:'var(--txt2)',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0 }}>
                        <i className="fa fa-arrows-rotate" />
                      </button>
                      <button onClick={() => open(p)} title="Editar"
                        style={{ width:28,height:28,borderRadius:'50%',border:'1.5px solid var(--border2)',background:'var(--surface2)',color:'var(--txt2)',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0 }}>
                        <i className="fa fa-pen" />
                      </button>
                      <button onClick={() => del(p.id)} title="Eliminar"
                        style={{ width:28,height:28,borderRadius:'50%',border:'1.5px solid #FECACA',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0 }}>
                        <i className="fa fa-trash" />
                      </button>
                    </div></td>
                  </tr>
                )
              }) : <tr><td colSpan={(showCostInfo ? 11 : 10) - (2 - priceColsActive)}><div className="empty"><div className="ico"><i className="fa fa-box-open" /></div><p>{getEmptyProducts(c.rubro).title}</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="prod-grid">
          {loading ? [1,2,3,4,5,6].map(i => (
            <div key={i} className="prod-card">
              <div className="prod-card-img" style={{ background: 'var(--surface3)' }}>
                <div className="sk-ava" style={{ width: 52, height: 52, borderRadius: 14 }} />
              </div>
              <div className="prod-card-body">
                <div className="sk-line" style={{ width: '75%' }} />
                <div className="sk-line" style={{ width: '45%', marginTop: 8 }} />
              </div>
            </div>
          )) : filtered.length ? filtered.map(p => {
            const mp = marginPct(p)
            const cc = catColor(p.cat)
            const isLow = p.minStock > 0 && (p.stock || 0) <= p.minStock
            return (
              <div key={p.id} className="prod-card" onClick={() => open(p)}>
                {/* IMAGE */}
                <div className="prod-card-img" style={{ background: cc.bg }}>
                  {p.image
                    ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <i className="fa fa-box-open" style={{ fontSize: 38, color: cc.color, opacity: .5 }} />
                  }
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                    style={{ position: 'absolute', top: 8, left: 8, width: 16, height: 16, cursor: 'pointer' }}
                    onClick={e => e.stopPropagation()} />
                  {isLow && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6 }}>
                      STOCK BAJO
                    </div>
                  )}
                </div>
                {/* BODY */}
                <div className="prod-card-body">
                  <div className="prod-card-name" title={p.name}>{p.name}</div>
                  {p.sku && <div style={{ fontSize: 10, color: 'var(--txt3)' }}>SKU: {p.sku}</div>}
                  <span className="prod-card-cat" style={{ background: cc.bg, color: cc.color }}>{p.cat || '—'}</span>
                  <div className="prod-card-price">{fmt(p.priceB2C || autoPrice(p.cost).b2c)}</div>
                  {!opHideCosts && <div className="prod-card-cost">Costo: {fmt(p.cost)}</div>}
                  {mp !== null && (
                    <div className="prod-card-margin" style={{ color: marginColor(mp) }}>{mp}% margen</div>
                  )}
                  <div style={{ fontSize: 11, marginTop: 2, color: isLow ? 'var(--red)' : 'var(--txt3)', fontWeight: isLow ? 700 : 400 }}>
                    <i className="fa fa-cubes" style={{ marginRight: 4 }} />Stock: {p.stock || 0}
                  </div>
                </div>
                {/* FOOTER */}
                <div className="prod-card-foot">
                  <button className="prod-card-foot-btn" onClick={e => { e.stopPropagation(); openMove(p) }} title="Mover stock">
                    <i className="fa fa-arrows-rotate" />
                  </button>
                  <div className="prod-card-foot-sep" />
                  <button className="prod-card-foot-btn" onClick={e => { e.stopPropagation(); open(p) }}>
                    <i className="fa fa-pen" /> Editar
                  </button>
                  <div className="prod-card-foot-sep" />
                  <button className="prod-card-foot-btn prod-card-foot-del" onClick={e => { e.stopPropagation(); del(p.id) }}>
                    <i className="fa fa-trash" />
                  </button>
                </div>
              </div>
            )
          }) : (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="empty-native">
                <div className="ico"><i className="fa fa-box-open" /></div>
                <h4>Sin productos</h4>
                <p>Agregá tu primer producto al catálogo.</p>
                <button className="btn btn-brand" onClick={() => setModal(true)}>
                  <i className="fa fa-plus" /> Agregar producto
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>{/* /cat-desk-view */}

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-float" style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface)', border: '2px solid var(--brand)', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,.18)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 200, flexWrap: 'wrap',
          animation: 'pgIn .2s ease both'
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginRight: 4 }}>
            <i className="fa fa-check-square" style={{ marginRight: 6 }} />{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
          <button className="btn btn-ghost btn-sm" onClick={() => { setBulkCatValue(cats[0] || ''); setBulkCatModal(true) }}>
            <i className="fa fa-tag" /> Categoría
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setBulkSupplierValue(''); setBulkSupplierModal(true) }}>
            <i className="fa fa-truck" /> Proveedor
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPricePct(''); setPriceUpdateModal(true) }}>
            <i className="fa fa-percent" /> Precios
          </button>
          <button className="btn btn-sm" onClick={doBulkDelete} style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>
            <i className="fa fa-trash" /> Eliminar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            <i className="fa fa-xmark" />
          </button>
        </div>
      )}

      {/* Modal producto */}
      {modal && (
        <div className="modal-bg open" style={{ padding: '14px' }} onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal-form-card" style={{ maxWidth: 740, width: 'calc(100vw - 28px)', minHeight: 'auto', height: 'auto', maxHeight: 'none', overflow: 'visible' }}>
            <div className="mh"><h3>{form.id ? 'Editar' : 'Nuevo'} producto</h3><button className="mclose" onClick={() => setModal(false)}><i className="fa fa-xmark" /></button></div>
            {/* Banner borrador */}
            {hasDraft && (
              <div style={{ flexShrink: 0, background: '#FFFBEB', borderBottom: '1px solid #FDE68A', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <i className="fa fa-clock-rotate-left" style={{ color: '#D97706' }} />
                <span style={{ flex: 1, color: '#92400E' }}>
                  Borrador guardado: <strong>{hasDraft.form?.name || 'sin nombre'}</strong>
                  {hasDraft._ts ? ` · hace ${Math.round((Date.now() - hasDraft._ts) / 60000)} min` : ''}
                </span>
                <button className="btn btn-ghost btn-sm" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => {
                  const d = hasDraft
                  setForm({ ...EMPTY, ...d.form })
                  setMarginInput(d.marginInput || '')
                  setHasDraft(null)
                }}>Restaurar</button>
                <button className="btn btn-ghost btn-sm" style={{ padding: '3px 10px', fontSize: 11, color: 'var(--txt3)' }} onClick={() => { try { localStorage.removeItem(DRAFT_KEY) } catch {}; setHasDraft(null) }}>Descartar</button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt4)', fontSize: 14, lineHeight: 1, padding: 2 }} onClick={() => setHasDraft(null)}>×</button>
              </div>
            )}
            {/* Body — flujo natural, sin scroll interno ni flex:1 que estire/clipee */}
            <div ref={bodyRef} style={{ padding: '18px 22px 4px' }}>

            {/* ── CARD 1: Datos del producto ── */}
            <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: '18px 22px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--brand-xlt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa fa-tag" style={{ fontSize: 11, color: 'var(--brand)' }} />
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Datos del producto</span>
              </div>
              <div className="grid2" style={{ gap: '14px 16px' }}>
                <div className="fg" style={{ marginBottom: 0 }}><label>Nombre *</label><input autoFocus tabIndex={1} type="text" value={form.name} onChange={e => setF('name', e.target.value)} placeholder={getProductPlaceholder(c.rubro)} /></div>
                <div className="fg" style={{ marginBottom: 0 }}><label>SKU / Código</label><input tabIndex={2} type="text" value={form.sku || ''} onChange={e => setF('sku', e.target.value)} placeholder="Opcional" /></div>
                <div className="fg" style={{ marginBottom: 0 }}><label>Categoría</label>
                  <select value={form.cat} onChange={e => setF('cat', e.target.value)}>
                    <option value="">Sin categoría</option>
                    {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    {form.cat && !cats.includes(form.cat) && <option value={form.cat}>{form.cat}</option>}
                  </select>
                </div>
                <div className="fg" style={{ marginBottom: 0 }}><label>Proveedor</label>
                  <select value={form.supplierId || ''} onChange={e => setF('supplierId', e.target.value)}>
                    <option value="">Sin asignar</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── CARD 2: Costo · Margen · Precio ── */}
            <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: '18px 22px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--brand-xlt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa fa-coins" style={{ fontSize: 11, color: 'var(--brand)' }} />
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Costo · Margen · Precio</span>
              </div>
              <div className="cat-price-calc" style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr 28px 1fr', gap: '0 8px', alignItems: 'end' }}>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="fa fa-arrow-trend-down" style={{ color: 'var(--txt3)', fontSize: 10 }} />
                    Costo del producto
                  </label>
                  <input tabIndex={5} type="number" value={form.cost} onChange={e => onCostChange(e.target.value)} placeholder="0" min="0" />
                </div>
                <div className="cat-price-arrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 2, color: 'var(--txt4)', fontSize: 14, fontWeight: 700 }}>→</div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="fa fa-percent" style={{ color: 'var(--txt3)', fontSize: 10 }} />
                    Margen deseado (%)
                  </label>
                  <input tabIndex={6} type="number" value={marginInput} onChange={e => onMarginChange(e.target.value)} placeholder="%" min="0" />
                </div>
                {showB2C && <div className="cat-price-arrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 2, color: 'var(--txt4)', fontSize: 14, fontWeight: 700 }}>→</div>}
                {showB2C && (
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="fa fa-tag" style={{ color: 'var(--green)', fontSize: 10 }} />
                      Precio de Venta {showB2B ? '(Público)' : ''}
                    </label>
                    <input tabIndex={7} type="number" value={form.priceB2C} onChange={e => onPriceChange(e.target.value)} placeholder="0" min="0" style={{ borderColor: 'var(--green)', borderWidth: 2 }} />
                  </div>
                )}
                {!showB2C && showB2B && (
                  <>
                    <div className="cat-price-arrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 2, color: 'var(--txt4)', fontSize: 14, fontWeight: 700 }}>→</div>
                    <div className="fg" style={{ marginBottom: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="fa fa-handshake" style={{ color: 'var(--brand)', fontSize: 10 }} />
                        Precio Mayorista
                      </label>
                      <input tabIndex={7} type="number" value={form.priceB2B} onChange={e => setF('priceB2B', e.target.value)} placeholder="0" min="0" style={{ borderColor: 'var(--brand)', borderWidth: 2 }} />
                    </div>
                  </>
                )}
              </div>
              {num(form.cost) > 0 && showB2C && num(form.priceB2C) > 0 && (
                <div style={{ marginTop: 12, padding: '9px 13px', borderRadius: 9, background: num(form.priceB2C) > num(form.cost) ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)', border: `1px solid ${num(form.priceB2C) > num(form.cost) ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`, fontSize: 12, color: num(form.priceB2C) > num(form.cost) ? 'var(--green)' : 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className={`fa fa-arrow-${num(form.priceB2C) > num(form.cost) ? 'trend-up' : 'trend-down'}`} />
                  Ganancia por unidad: ${(num(form.priceB2C) - num(form.cost)).toLocaleString('es-AR')} · Margen real: {marginInput || 0}%
                </div>
              )}
              {/* Segundo input de precio solo cuando hay AMBOS canales activos */}
              {showB2C && showB2B && (
                <div className="fg" style={{ marginTop: 14, marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="fa fa-handshake" style={{ color: 'var(--brand)', fontSize: 10 }} />
                    Precio Mayorista (B2B)
                  </label>
                  <input tabIndex={8} type="number" value={form.priceB2B} onChange={e => setF('priceB2B', e.target.value)} placeholder="0" min="0" style={{ borderColor: 'var(--brand)', borderWidth: 2 }} />
                </div>
              )}
            </div>

            {/* ── CARD 3: Inventario ── */}
            <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: '18px 22px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--brand-xlt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa fa-boxes-stacked" style={{ fontSize: 11, color: 'var(--brand)' }} />
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Inventario</span>
              </div>
              <div className="grid2" style={{ gap: '0 16px' }}>
                <div className="fg" style={{ marginBottom: 0 }}><label>Stock actual</label><input tabIndex={9} type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} placeholder="0" /></div>
                <div className="fg" style={{ marginBottom: 0 }}><label>Stock mínimo (alerta)</label><input tabIndex={10} type="number" value={form.minStock} onChange={e => setF('minStock', e.target.value)} placeholder="0" /></div>
              </div>
            </div>

            {/* ── ACORDEÓN: Configuración avanzada ── */}
            <button onClick={() => setShowAdvanced(s => !s)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: showAdvanced ? 0 : 6, transition: 'background .15s' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="fa fa-sliders" style={{ color: 'var(--brand)' }} />
                Configuración avanzada y logística
              </span>
              <i className={`fa fa-chevron-${showAdvanced ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--txt4)' }} />
            </button>
            {showAdvanced && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '18px 22px', marginBottom: 4 }}>
                <div className="fg"><label>Unidad</label>
                  <select value={form.unit || 'unidad'} onChange={e => setF('unit', e.target.value)}>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="fg"><label>Notas internas</label><textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Observaciones internas..." /></div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label>Imagen del producto <span style={{ fontWeight: 400, color: 'var(--txt3)' }}>(opcional)</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {form.image
                      ? <img src={form.image} alt="preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border)', flexShrink: 0 }} />
                      : <div style={{ width: 60, height: 60, borderRadius: 8, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="fa fa-image" style={{ color: 'var(--txt4)', fontSize: 20 }} />
                        </div>
                    }
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input ref={imgRef} type="file" accept="image/*" onChange={handleImgUpload} style={{ display: 'none' }} />
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => imgRef.current?.click()}>
                        <i className="fa fa-upload" /> {form.image ? 'Cambiar imagen' : 'Subir imagen'}
                      </button>
                      {form.image && (
                        <button className="btn btn-ghost btn-sm" type="button" style={{ color: 'var(--red)' }} onClick={() => setF('image', '')}>
                          <i className="fa fa-trash" /> Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            </div>
            <div className="mfooter"><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}><i className="fa fa-floppy-disk" /> Guardar</button></div>
          </div>
        </div>
      )}

      {/* Modal actualizar precios masivo */}
      {priceUpdateModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setPriceUpdateModal(false) }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="mh">
              <h3><i className="fa fa-percent" style={{ color: 'var(--brand)', marginRight: 8 }} />Actualizar precios masivamente</h3>
              <button className="mclose" onClick={() => setPriceUpdateModal(false)}><i className="fa fa-xmark" /></button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6 }}>
              Aumenta o disminuye el <b>costo</b> de un proveedor en un porcentaje. Los precios B2C y B2B se recalculan automáticamente según tus reglas de margen.
            </div>
            {selectedIds.size === 0 && (
              <div className="fg">
                <label>Proveedor</label>
                <select value={priceSupplier} onChange={e => setPriceSupplier(e.target.value)}>
                  <option value="all">Todos los proveedores ({products.length} productos)</option>
                  {suppliers.map(s => {
                    const count = products.filter(p => String(p.supplierId) === String(s.id)).length
                    return <option key={s.id} value={s.id}>{s.name} ({count} productos)</option>
                  })}
                </select>
              </div>
            )}
            <div className="fg">
              <label>% de ajuste</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  value={pricePct}
                  onChange={e => setPricePct(e.target.value)}
                  placeholder="Ej: 15 para +15%, -10 para -10%"
                  style={{ flex: 1 }}
                  autoFocus
                />
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)', minWidth: 28 }}>%</span>
              </div>
            </div>
            {pricePct && Number(pricePct) !== 0 && (
              <div style={{ background: Number(pricePct) > 0 ? '#DCFCE7' : '#FEE2E2', borderRadius: 10, padding: '10px 14px', fontSize: 12, marginBottom: 8 }}>
                <i className={`fa ${Number(pricePct) > 0 ? 'fa-arrow-up' : 'fa-arrow-down'}`} style={{ marginRight: 6, color: Number(pricePct) > 0 ? 'var(--green)' : 'var(--red)' }} />
                Se actualizarán <b>{selectedIds.size > 0 ? selectedIds.size : priceUpdatePreview.length} productos</b> con un ajuste de <b>{Number(pricePct) > 0 ? '+' : ''}{pricePct}%</b>
              </div>
            )}
            <div className="mfooter">
              <button className="btn btn-secondary" onClick={() => setPriceUpdateModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doPriceUpdate} disabled={!pricePct || Number(pricePct) === 0}>
                <i className="fa fa-bolt" /> Actualizar {selectedIds.size > 0 ? selectedIds.size : priceUpdatePreview.length} productos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal movimiento stock */}
      {moveModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setMoveModal(null) }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="mh"><h3>Movimiento de stock</h3><button className="mclose" onClick={() => setMoveModal(null)}><i className="fa fa-xmark" /></button></div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa fa-cube" style={{ color: 'var(--brand)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{moveModal.name}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Stock actual: <b>{moveModal.stock || 0}</b> {moveModal.unit || 'unidad'}</div>
              </div>
            </div>
            <div className="grid2">
              <div className="fg"><label>Tipo</label>
                <select value={moveForm.type} onChange={e => setMoveForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="in">Ingreso (+)</option>
                  <option value="out">Egreso (-)</option>
                  <option value="adjust">Ajuste (=)</option>
                  <option value="return">Devolución (+)</option>
                </select>
              </div>
              <div className="fg"><label>Cantidad</label><input type="number" value={moveForm.qty} onChange={e => setMoveForm(p => ({ ...p, qty: e.target.value }))} placeholder="0" min="0" /></div>
            </div>
            <div className="fg"><label>Nota</label><input type="text" value={moveForm.note} onChange={e => setMoveForm(p => ({ ...p, note: e.target.value }))} placeholder="Ej: Reposición proveedor X" /></div>
            <div className="mfooter"><button className="btn btn-ghost" onClick={() => setMoveModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveMove}><i className="fa fa-check" /> Registrar</button></div>
          </div>
        </div>
      )}

      {/* CSV modal */}
      {csvModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) { setCsvModal(false); setCsvPreview([]) } }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="mh"><h3>Importar productos desde CSV</h3><button className="mclose" onClick={() => { setCsvModal(false); setCsvPreview([]) }}><i className="fa fa-xmark" /></button></div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 12, color: 'var(--txt2)' }}><b>Formato:</b> Nombre del producto, Costo (una por línea)</div>
            <div className="fg"><label>Categoría</label><select value={csvCat} onChange={e => setCsvCat(e.target.value)}>{cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
            <div className="fg"><label>Archivo CSV</label><input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCsvFile} style={{ padding: '10px 14px', border: '2px dashed var(--border)', borderRadius: 10, width: '100%', cursor: 'pointer' }} /></div>
            {csvPreview.length > 0 && (
              <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 8 }}>
                <table style={{ fontSize: 12 }}><thead><tr><th>Producto</th><th>Costo</th></tr></thead><tbody>
                  {csvPreview.slice(0, 10).map((p, i) => <tr key={i}><td>{p.name}</td><td>{fmt(p.cost)}</td></tr>)}
                  {csvPreview.length > 10 && <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--txt3)' }}>...y {csvPreview.length - 10} más</td></tr>}
                </tbody></table>
              </div>
            )}
            <div className="mfooter"><button className="btn btn-secondary" onClick={() => { setCsvModal(false); setCsvPreview([]) }}>Cancelar</button><button className="btn btn-primary" onClick={doCsvImport} disabled={!csvPreview.length}><i className="fa fa-file-import" /> Importar {csvPreview.length}</button></div>
          </div>
        </div>
      )}

      {/* Bulk modal */}
      {bulkModal && (
        <div className="modal-bg open" style={{ alignItems: 'flex-end', padding: 0 }} onClick={e => { if (e.target === e.currentTarget) setBulkModal(false) }}>
          <div style={{ width: '100%', maxWidth: 600, background: 'var(--surface)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '92dvh', overflow: 'hidden', boxShadow: '0 -8px 40px rgba(0,0,0,.18)', animation: 'slideUp .25s cubic-bezier(.32,.72,0,1) both' }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--border2)' }} />
            </div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--brand-xlt)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', fontSize: 17 }}>
                  <i className="fa fa-bolt" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.3px' }}>Carga masiva de productos</div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>Un producto por línea: nombre, costo</div>
                </div>
              </div>
              <button className="mclose" onClick={() => setBulkModal(false)}><i className="fa fa-xmark" /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 20px 8px', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 4 }}>Formato de entrada</div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.7 }}>
                  Una línea por producto: <code style={{ background: 'var(--surface)', padding: '1px 5px', borderRadius: 4 }}>Nombre del producto, costo</code>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--txt3)' }}>Ej: <code>{getProductPlaceholder(c.rubro).replace(/^Ej:\s*/, '')}, 2500</code></div>
              </div>
              <div className="fg"><label>Categoría</label><select value={bulkCat} onChange={e => setBulkCat(e.target.value)}>{cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
              <div className="fg" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Datos de productos</label>
                  {bulkData.trim() && (
                    <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>
                      {bulkData.trim().split('\n').filter(l => l.trim()).length} producto{bulkData.trim().split('\n').filter(l => l.trim()).length !== 1 ? 's' : ''} detectado{bulkData.trim().split('\n').filter(l => l.trim()).length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <textarea value={bulkData} onChange={e => setBulkData(e.target.value)} rows={10} placeholder={'Remera algodón, 2500\nPantalón cargo, 4800\nCampera impermeable, 8900'} style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
              </div>
            </div>
            <div className="mfooter" style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
              <button className="btn btn-secondary" onClick={() => setBulkModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doBulk} disabled={!bulkData.trim()}>
                <i className="fa fa-bolt" /> {bulkData.trim() ? `Importar ${bulkData.trim().split('\n').filter(l => l.trim()).length} producto${bulkData.trim().split('\n').filter(l => l.trim()).length !== 1 ? 's' : ''}` : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk category modal */}
      {bulkCatModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setBulkCatModal(false) }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="mh"><h3><i className="fa fa-tag" style={{ marginRight: 8 }} />Cambiar categoría</h3><button className="mclose" onClick={() => setBulkCatModal(false)}><i className="fa fa-xmark" /></button></div>
            <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>Mover <b>{selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''}</b> a:</p>
            <div className="fg">
              <select value={bulkCatValue} onChange={e => setBulkCatValue(e.target.value)}>
                <option value="">Sin categoría</option>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mfooter">
              <button className="btn btn-secondary" onClick={() => setBulkCatModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doBulkCat}><i className="fa fa-check" /> Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk supplier modal */}
      {bulkSupplierModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setBulkSupplierModal(false) }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="mh"><h3><i className="fa fa-truck" style={{ marginRight: 8 }} />Cambiar proveedor</h3><button className="mclose" onClick={() => setBulkSupplierModal(false)}><i className="fa fa-xmark" /></button></div>
            <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>Asignar proveedor a <b>{selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''}</b>:</p>
            <div className="fg">
              <select value={bulkSupplierValue} onChange={e => setBulkSupplierValue(e.target.value)}>
                <option value="">Sin asignar</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="mfooter">
              <button className="btn btn-secondary" onClick={() => setBulkSupplierModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doBulkSupplier}><i className="fa fa-check" /> Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Category management modal */}
      {catMgmtModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) { setCatMgmtModal(false); setEditingCat(null) } }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="mh"><h3><i className="fa fa-sliders" style={{ marginRight: 8 }} />Gestionar categorías</h3><button className="mclose" onClick={() => { setCatMgmtModal(false); setEditingCat(null) }}><i className="fa fa-xmark" /></button></div>
            {/* Banner: aplicar categorías sugeridas según el rubro del onboarding */}
            {c.rubro && (() => {
              const meta = getRubroMeta(c.rubro)
              const suggested = getCategoriesForRubro(c.rubro)
              const missing = suggested.filter(s => !cats.includes(s))
              if (missing.length === 0) return null
              return (
                <div style={{
                  background: 'linear-gradient(135deg,#F5F3FF,#FDF2F8)',
                  border: '1.5px solid #DDD6FE', borderRadius: 10,
                  padding: '12px 14px', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <div style={{ fontSize: 22 }}>{meta?.icon || '✨'}</div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED', marginBottom: 2 }}>
                      Sugeridas para {meta?.label || 'tu rubro'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      Agregamos {missing.length} categoría{missing.length !== 1 ? 's' : ''} alineada{missing.length !== 1 ? 's' : ''} a tu rubro: <i>{missing.slice(0, 4).join(', ')}{missing.length > 4 ? '...' : ''}</i>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const merged = Array.from(new Set([...cats, ...suggested]))
                      updateConfig({ productCats: merged })
                      toast(`+${missing.length} categorías agregadas`, 'ok')
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    <i className="fa fa-wand-magic-sparkles" /> Aplicar
                  </button>
                </div>
              )
            })()}
            {cats.length === 0 && <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: 20 }}>No hay categorías definidas.<br/>Creá una desde Configuración.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {cats.map((cat, i) => {
                const cc = catColor(cat)
                const count = products.filter(p => p.cat === cat).length
                const isEditing = editingCat?.original === cat
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: isEditing ? 'var(--brand-xlt)' : 'var(--surface)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', background: cc.bg, color: cc.color, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap', minWidth: 0, flexShrink: 0 }}>{cat}</span>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingCat.value}
                        onChange={e => setEditingCat(ec => ({ ...ec, value: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') doRenamecat(cat, editingCat.value); if (e.key === 'Escape') setEditingCat(null) }}
                        style={{ flex: 1, padding: '5px 8px', border: '2px solid var(--brand)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit' }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--txt2)' }}>{count} producto{count !== 1 ? 's' : ''}</span>
                    )}
                    {isEditing ? (
                      <>
                        <button className="btn btn-primary btn-xs" onClick={() => doRenamecat(cat, editingCat.value)}><i className="fa fa-check" /></button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditingCat(null)}><i className="fa fa-xmark" /></button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-ghost btn-xs" title="Renombrar" onClick={() => setEditingCat({ original: cat, value: cat })}><i className="fa fa-pen" /></button>
                        <button className="btn btn-ghost btn-xs" title="Eliminar" style={{ color: 'var(--red)' }} onClick={() => doDeleteCat(cat)}><i className="fa fa-trash" /></button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mfooter" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setCatMgmtModal(false); setEditingCat(null) }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
