import { useState, useEffect, useRef, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fmt } from '../../lib/storage'

const EMPTY = { name: '', cat: '', cost: '', stock: 0, minStock: 0, unit: 'unidad', supplierId: '', priceB2C: '', priceB2B: '', sku: '', notes: '', insumos: [], image: '' }

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
  const toast = useToast()
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
  const [viewMode, setViewMode] = useState('grid')
  const imgRef = useRef(null)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 80); return () => clearTimeout(t) }, [])

  const products = get('products')
  const suppliers = get('suppliers')
  const insumosList = get('insumos', [])
  const cats = c.productCats || []
  const units = c.units || ['unidad','kg','litro','metro','caja','pack','rollo']
  const rules = c.pricingRules || { b2c: { margin: 40 }, b2b: { margin: 25 } }

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
    if (p) {
      setForm({ ...EMPTY, ...p, cat: p.cat ?? '', image: p.image || '' })
    } else {
      const prices = autoPrice(0)
      setForm({ ...EMPTY, cat: cats[0] || '', priceB2C: prices.b2c, priceB2B: prices.b2b })
    }
    setModal(true)
  }

  const handleCostChange = (val) => {
    setF('cost', val)
    const prices = autoPrice(val)
    if (!form.priceB2C || form.priceB2C === autoPrice(form.cost).b2c) setF('priceB2C', prices.b2c)
    if (!form.priceB2B || form.priceB2B === autoPrice(form.cost).b2b) setF('priceB2B', prices.b2b)
  }

  const save = () => {
    if (!form.name) { toast('Ingresá el nombre del producto.', 'er'); return }
    const data = { ...form, cat: form.cat ?? '', cost: num(form.cost), stock: num(form.stock), minStock: num(form.minStock), priceB2C: num(form.priceB2C), priceB2B: num(form.priceB2B), updatedAt: new Date().toISOString().slice(0,10) }
    saveEntity('products', data); setModal(false); toast('Producto guardado', 'ok')
  }

  const del = (id) => { if (window.confirm('¿Eliminar producto?')) { deleteEntity('products', id); toast('Producto eliminado', 'in') } }
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

  const addInsumo = () => setForm(f => ({ ...f, insumos: [...(f.insumos || []), { insumoId: '', qtyNeeded: 1 }] }))
  const updateInsumo = (idx, field, val) => setForm(f => {
    const ins = [...(f.insumos || [])]
    ins[idx] = { ...ins[idx], [field]: field === 'insumoId' ? Number(val) : Number(val) }
    return { ...f, insumos: ins }
  })
  const removeInsumo = (idx) => setForm(f => ({ ...f, insumos: (f.insumos || []).filter((_, i) => i !== idx) }))

  const doBulk = () => {
    const lines = bulkData.split('\n').filter(l => l.trim())
    let count = 0
    lines.forEach(l => {
      const parts = l.split(',')
      if (parts.length >= 2) {
        const cost = Number(parts[1].trim()) || 0
        const prices = autoPrice(cost)
        saveEntity('products', { name: parts[0].trim(), cat: bulkCat || cats[0] || '', cost, supplierId: '', stock: 0, minStock: 0, priceB2C: prices.b2c, priceB2B: prices.b2b, unit: 'unidad', insumos: [] })
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
      saveEntity('products', { ...p, cat: csvCat || cats[0] || '', stock: 0, minStock: 0, priceB2C: prices.b2c, priceB2B: prices.b2b, unit: 'unidad', insumos: [] })
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
    if (!window.confirm(`¿Eliminar ${selectedIds.size} producto${selectedIds.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
    selectedIds.forEach(id => deleteEntity('products', id))
    toast(`${selectedIds.size} productos eliminados`, 'in')
    setSelectedIds(new Set())
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
    if (!window.confirm(`¿Eliminar categoría "${cat}"?${affected > 0 ? `\n${affected} producto${affected !== 1 ? 's' : ''} quedarán sin categoría.` : ''}`)) return
    updateConfig({ productCats: cats.filter(c => c !== cat) })
    products.filter(p => p.cat === cat).forEach(p => saveEntity('products', { ...p, cat: '' }))
    toast(`Categoría eliminada`, 'in')
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

  return (
    <div className="page active" style={{ animation: 'pgIn .25s ease both' }}>
      <div className="ph">
        <div className="ph-left">
          <h2>Productos</h2>
        </div>
        <div className="ph-right">
          <button className="btn btn-ghost btn-sm" onClick={() => { setPriceSupplier('all'); setPricePct(''); setPriceUpdateModal(true) }}>
            <i className="fa fa-percent" /> Actualizar precios
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCsvCat(cats[0] || ''); setCsvModal(true) }}><i className="fa fa-file-csv" /> CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setBulkCat(cats[0] || ''); setBulkModal(true) }}><i className="fa fa-file-import" /> Masivo</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setViewMode(v => v === 'table' ? 'grid' : 'table')}
            title={viewMode === 'table' ? 'Vista grilla' : 'Vista tabla'}
          >
            <i className={`fa ${viewMode === 'table' ? 'fa-grip' : 'fa-table-list'}`} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => open()}><i className="fa fa-plus" /> Nuevo producto</button>
        </div>
      </div>

      <div className="pill-row">
        <div className="search-row" style={{ maxWidth: 280 }}><i className="fa fa-magnifying-glass" /><input type="text" placeholder="Buscar producto o SKU..." value={search} onChange={e => setSearch(e.target.value)} /></div>
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
        <button
          onClick={() => setCatMgmtModal(true)}
          style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--txt3)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
          title="Gestionar categorías"
        >
          <i className="fa fa-sliders" /> Gestionar
        </button>
      </div>

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
              <th style={{ textAlign: 'right' }} className="col-hide-mobile">P. Público</th>
              <th style={{ textAlign: 'right' }} className="col-hide-mobile">P. Mayorista</th>
              {!opHideCosts && <th style={{ textAlign: 'center' }} className="col-hide-mobile">% Margen</th>}
              {showCostInfo && <th className="col-hide-mobile">Últ. actualización</th>}
              <th style={{ textAlign: 'right' }}>Stock</th>
              <th>Acciones</th>
            </tr></thead>
            <tbody>
              {loading ? [1,2,3,4].map(i => (
                <tr key={i}><td colSpan={showCostInfo ? 11 : 10}><div className="sk sk-text" style={{ height: 18, width: `${50 + Math.random() * 40}%` }} /></td></tr>
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
                    <td className="col-hide-mobile"><span style={{ display: 'inline-flex', alignItems: 'center', background: cc.bg, color: cc.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{p.cat || '—'}</span></td>
                    <td className="col-hide-mobile" style={{ fontSize: 11 }}>{supplierName(p.supplierId)}</td>
                    {!opHideCosts && <td style={{ textAlign: 'right' }}>{fmt(p.cost)}</td>}
                    <td className="col-hide-mobile" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--money)' }}>{fmt(p.priceB2C || autoPrice(p.cost).b2c)}</td>
                    <td className="col-hide-mobile" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--money)' }}>{fmt(p.priceB2B || autoPrice(p.cost).b2b)}</td>
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
                    <td><div className="acts">
                      <button className="act" title="Movimiento de stock" onClick={() => openMove(p)}><i className="fa fa-arrows-rotate" /></button>
                      <button className="act edit" onClick={() => open(p)} title="Editar"><i className="fa fa-pen" /></button>
                      <button className="act del" onClick={() => del(p.id)} title="Eliminar"><i className="fa fa-trash" /></button>
                    </div></td>
                  </tr>
                )
              }) : <tr><td colSpan={showCostInfo ? 11 : 10}><div className="empty"><div className="ico"><i className="fa fa-box-open" /></div><p>Sin productos</p></div></td></tr>}
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

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
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
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal" style={{ maxWidth: 740 }}>
            <div className="mh"><h3>{form.id ? 'Editar' : 'Nuevo'} producto</h3><button className="mclose" onClick={() => setModal(false)}><i className="fa fa-xmark" /></button></div>
            <div className="grid2">
              <div className="fg"><label>Nombre *</label><input autoFocus tabIndex={1} type="text" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Remera algodón premium" /></div>
              <div className="fg"><label>SKU / Código</label><input tabIndex={2} type="text" value={form.sku || ''} onChange={e => setF('sku', e.target.value)} placeholder="Opcional" /></div>
              <div className="fg"><label>Categoría</label>
                <select value={form.cat} onChange={e => setF('cat', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  {form.cat && !cats.includes(form.cat) && (
                    <option value={form.cat}>{form.cat}</option>
                  )}
                </select>
              </div>
              <div className="fg"><label>Unidad</label>
                <select value={form.unit || 'unidad'} onChange={e => setF('unit', e.target.value)}>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', marginTop: 8, marginBottom: 8, border: '1.5px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 10 }}>Precios</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="fg"><label>Costo</label><input tabIndex={5} type="number" value={form.cost} onChange={e => handleCostChange(e.target.value)} placeholder="0" min="0" /></div>
                <div className="fg"><label>Precio B2C (público)</label><input tabIndex={6} type="number" value={form.priceB2C} onChange={e => setF('priceB2C', e.target.value)} placeholder="0" min="0" style={{ borderColor: 'var(--green)', borderWidth: 2 }} /></div>
                <div className="fg"><label>Precio B2B (mayorista)</label><input tabIndex={7} type="number" value={form.priceB2B} onChange={e => setF('priceB2B', e.target.value)} placeholder="0" min="0" style={{ borderColor: 'var(--brand)', borderWidth: 2 }} /></div>
              </div>
            </div>
            <div className="grid2" style={{ marginTop: 8 }}>
              <div className="fg"><label>Stock actual</label><input tabIndex={8} type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} placeholder="0" /></div>
              <div className="fg"><label>Stock mínimo (alerta)</label><input tabIndex={9} type="number" value={form.minStock} onChange={e => setF('minStock', e.target.value)} placeholder="0" /></div>
            </div>
            <div className="fg"><label>Proveedor</label>
              <select value={form.supplierId || ''} onChange={e => setF('supplierId', e.target.value)}>
                <option value="">Sin asignar</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', marginTop: 8, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', letterSpacing: '.6px', textTransform: 'uppercase' }}>Composición (insumos necesarios)</div>
                <button className="btn btn-ghost btn-xs" onClick={addInsumo}><i className="fa fa-plus" /> Agregar</button>
              </div>
              {(form.insumos || []).length === 0 && <div style={{ fontSize: 11, color: 'var(--txt3)', textAlign: 'center', padding: '8px 0' }}>Sin insumos asociados (opcional)</div>}
              {(form.insumos || []).map((ins, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 6, alignItems: 'end' }}>
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <select value={ins.insumoId || ''} onChange={e => updateInsumo(idx, 'insumoId', e.target.value)}>
                      <option value="">Seleccionar insumo</option>
                      {insumosList.map(i => <option key={i.id} value={i.id}>{i.name} ({i.stock || 0} {i.unit || 'un'})</option>)}
                    </select>
                  </div>
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <input type="number" value={ins.qtyNeeded} onChange={e => updateInsumo(idx, 'qtyNeeded', e.target.value)} placeholder="Cant." min="0" step="0.1" />
                  </div>
                  <button className="act del" onClick={() => removeInsumo(idx)} style={{ height: 34 }}><i className="fa fa-xmark" /></button>
                </div>
              ))}
            </div>
            <div className="fg" style={{ marginTop: 8 }}><label>Notas</label><textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Observaciones internas..." /></div>
            <div className="fg" style={{ marginTop: 8 }}>
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
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setBulkModal(false) }}>
          <div className="modal">
            <div className="mh"><h3>Carga masiva de productos</h3><button className="mclose" onClick={() => setBulkModal(false)}><i className="fa fa-xmark" /></button></div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 14, background: 'var(--surface2)', padding: '10px 14px', borderRadius: 8 }}>Formato: <code>Nombre, costo</code> (una por línea)</div>
            <div className="fg"><label>Categoría</label><select value={bulkCat} onChange={e => setBulkCat(e.target.value)}>{cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
            <div className="fg"><label>Datos</label><textarea value={bulkData} onChange={e => setBulkData(e.target.value)} rows={8} placeholder={'Remera algodón, 2500\nPantalón cargo, 4800'} /></div>
            <div className="mfooter"><button className="btn btn-secondary" onClick={() => setBulkModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={doBulk}><i className="fa fa-bolt" /> Importar</button></div>
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
