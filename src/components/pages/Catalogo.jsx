import { useState, useEffect, useRef, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { fmt } from '../../lib/storage'

const EMPTY = { name: '', cat: '', cost: '', stock: 0, minStock: 0, unit: 'unidad', supplierId: '', priceB2C: '', priceB2B: '', sku: '', notes: '', insumos: [] }

/* Paleta de colores para categorías */
const CAT_PALETTE = [
  { bg: '#EDE9FE', color: '#7C3AED' },
  { bg: '#DCFCE7', color: '#16A34A' },
  { bg: '#DBEAFE', color: '#1D4ED8' },
  { bg: '#FEF3C7', color: '#D97706' },
  { bg: '#FCE7F3', color: '#DB2777' },
  { bg: '#CCFBF1', color: '#0D9488' },
  { bg: '#FEE2E2', color: '#DC2626' },
  { bg: '#F0FDF4', color: '#15803D' },
]

export default function Catalogo() {
  const { get, config, saveEntity, deleteEntity, recordStockMove } = useData()
  const toast = useToast()
  const c = config()
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
    if (search) { const s = search.toLowerCase(); f = f.filter(p => (p.name || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s)) }
    return f
  }, [products, catFilter, search])

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

  const open = (p) => {
    if (p) {
      setForm({ ...EMPTY, ...p, cat: p.cat != null ? p.cat : (cats[0] || '') })
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
    priceUpdatePreview.forEach(p => {
      const newCost = Math.round((Number(p.cost) || 0) * factor)
      const prices = autoPrice(newCost)
      saveEntity('products', { ...p, cost: newCost, priceB2C: prices.b2c, priceB2B: prices.b2b })
    })
    toast(`${priceUpdatePreview.length} productos actualizados ${pct > 0 ? '+' : ''}${pct}%`, 'ok')
    setPriceUpdateModal(false); setPricePct(''); setPriceSupplier('all')
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

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (priceUpdateModal) { setPriceUpdateModal(false); return }
        if (moveModal) { setMoveModal(null); return }
        if (csvModal) { setCsvModal(false); setCsvPreview([]); return }
        if (bulkModal) { setBulkModal(false); return }
        if (modal) { setModal(false); return }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [priceUpdateModal, moveModal, csvModal, bulkModal, modal])

  return (
    <div className="page active" style={{ animation: 'pgIn .25s ease both' }}>
      <div className="ph">
        <div className="ph-left">
          <h2>Productos</h2>
          <p>{products.length} productos · Valor en stock: {fmt(totalValue)}</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-ghost btn-sm" onClick={() => { setPriceSupplier('all'); setPricePct(''); setPriceUpdateModal(true) }}>
            <i className="fa fa-percent" /> Actualizar precios
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCsvCat(cats[0] || ''); setCsvModal(true) }}><i className="fa fa-file-csv" /> CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setBulkCat(cats[0] || ''); setBulkModal(true) }}><i className="fa fa-file-import" /> Masivo</button>
          <button className="btn btn-primary btn-sm" onClick={() => open()}><i className="fa fa-plus" /> Nuevo producto</button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: 'var(--red-lt)', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa fa-triangle-exclamation" />
          <span><b>{lowStock.length} producto{lowStock.length > 1 ? 's' : ''}</b> con stock bajo: {lowStock.slice(0, 4).map(x => x.name).join(', ')}</span>
        </div>
      )}

      <div className="pill-row">
        <div className="search-row" style={{ maxWidth: 280 }}><i className="fa fa-magnifying-glass" /><input type="text" placeholder="Buscar producto o SKU..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className={`pill ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>Todos</div>
        {cats.map(cat => <div key={cat} className={`pill ${catFilter === cat ? 'active' : ''}`} onClick={() => setCatFilter(cat)}>{cat}</div>)}
      </div>

      <div className="tbl-card">
        <table>
          <thead><tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Proveedor</th>
            <th style={{ textAlign: 'right' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                Costo
                <button
                  title={showCostInfo ? 'Ocultar última actualización' : 'Mostrar última actualización'}
                  onClick={() => setShowCostInfo(v => !v)}
                  style={{ background: showCostInfo ? 'var(--brand)' : 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: showCostInfo ? '#fff' : 'var(--txt3)', fontSize: 9, padding: '2px 6px', cursor: 'pointer', fontWeight: 700, transition: 'all .2s' }}
                >
                  <i className="fa fa-clock" /> ult. act.
                </button>
              </span>
            </th>
            <th style={{ textAlign: 'right' }}>P. Público</th>
            <th style={{ textAlign: 'right' }}>P. Mayorista</th>
            <th style={{ textAlign: 'center' }}>% Margen</th>
            {showCostInfo && <th>Últ. actualización</th>}
            <th style={{ textAlign: 'center' }}>Stock</th>
            <th>Acciones</th>
          </tr></thead>
          <tbody>
            {loading ? [1,2,3,4].map(i => (
              <tr key={i}><td colSpan={showCostInfo ? 10 : 9}><div className="sk sk-text" style={{ height: 18, width: `${50 + Math.random() * 40}%` }} /></td></tr>
            )) : filtered.length ? filtered.map(p => {
              const isLow = p.minStock > 0 && (p.stock || 0) <= p.minStock
              const mp = marginPct(p)
              const cc = catColor(p.cat)
              return (
                <tr key={p.id} style={isLow ? { background: 'var(--red-lt)' } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.sku && <div style={{ fontSize: 10, color: 'var(--txt3)' }}>SKU: {p.sku}</div>}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', background: cc.bg, color: cc.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      {p.cat || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>{supplierName(p.supplierId)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(p.cost)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--money)' }}>{fmt(p.priceB2C || autoPrice(p.cost).b2c)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--money)' }}>{fmt(p.priceB2B || autoPrice(p.cost).b2b)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {mp !== null ? (
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: marginColor(mp), background: marginColor(mp) + '18', padding: '2px 8px', borderRadius: 10 }}>
                        {mp}%
                      </span>
                    ) : <span style={{ color: 'var(--txt4)', fontSize: 11 }}>—</span>}
                  </td>
                  {showCostInfo && (
                    <td style={{ fontSize: 11 }}>
                      {p.updatedAt ? (
                        <span style={{ color: (() => {
                          const days = Math.floor((Date.now() - new Date(p.updatedAt)) / 86400000)
                          return days > 180 ? '#DC2626' : days > 60 ? '#D97706' : '#16A34A'
                        })(), fontWeight: 600 }}>
                          {(() => {
                            const days = Math.floor((Date.now() - new Date(p.updatedAt)) / 86400000)
                            if (days === 0) return 'Hoy'
                            if (days === 1) return 'Ayer'
                            if (days < 30) return `hace ${days}d`
                            if (days < 365) return `hace ${Math.floor(days/30)}m`
                            return `hace ${Math.floor(days/365)}a`
                          })()}
                        </span>
                      ) : <span style={{ color: 'var(--txt4)' }}>—</span>}
                    </td>
                  )}
                  <td style={{ textAlign: 'center', fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--txt)' }}>
                    {p.stock || 0}
                    {isLow && <i className="fa fa-triangle-exclamation" style={{ color: 'var(--red)', marginLeft: 4, fontSize: 10 }} />}
                  </td>
                  <td><div className="acts">
                    <button className="act" title="Movimiento de stock" onClick={() => openMove(p)}><i className="fa fa-arrows-rotate" /></button>
                    <button className="act edit" onClick={() => open(p)} title="Editar"><i className="fa fa-pen" /></button>
                    <button className="act del" onClick={() => del(p.id)} title="Eliminar"><i className="fa fa-trash" /></button>
                  </div></td>
                </tr>
              )
            }) : <tr><td colSpan={showCostInfo ? 10 : 9}><div className="empty"><div className="ico"><i className="fa fa-box-open" /></div><p>Sin productos</p></div></td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal producto */}
      {modal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal" style={{ maxWidth: 740 }}>
            <div className="mh"><h3>{form.id ? 'Editar' : 'Nuevo'} producto</h3><button className="mclose" onClick={() => setModal(false)}><i className="fa fa-xmark" /></button></div>
            <div className="grid2">
              <div className="fg"><label>Nombre *</label><input type="text" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Remera algodón premium" /></div>
              <div className="fg"><label>SKU / Código</label><input type="text" value={form.sku || ''} onChange={e => setF('sku', e.target.value)} placeholder="Opcional" /></div>
              <div className="fg"><label>Categoría</label>
                <select value={form.cat} onChange={e => setF('cat', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
                <div className="fg"><label>Costo</label><input type="number" value={form.cost} onChange={e => handleCostChange(e.target.value)} placeholder="0" min="0" /></div>
                <div className="fg"><label>Precio B2C (público)</label><input type="number" value={form.priceB2C} onChange={e => setF('priceB2C', e.target.value)} placeholder="0" min="0" style={{ borderColor: 'var(--green)', borderWidth: 2 }} /></div>
                <div className="fg"><label>Precio B2B (mayorista)</label><input type="number" value={form.priceB2B} onChange={e => setF('priceB2B', e.target.value)} placeholder="0" min="0" style={{ borderColor: 'var(--brand)', borderWidth: 2 }} /></div>
              </div>
            </div>
            <div className="grid2" style={{ marginTop: 8 }}>
              <div className="fg"><label>Stock actual</label><input type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} placeholder="0" /></div>
              <div className="fg"><label>Stock mínimo (alerta)</label><input type="number" value={form.minStock} onChange={e => setF('minStock', e.target.value)} placeholder="0" /></div>
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
                Se actualizarán <b>{priceUpdatePreview.length} productos</b> con un ajuste de <b>{Number(pricePct) > 0 ? '+' : ''}{pricePct}%</b>
              </div>
            )}
            <div className="mfooter">
              <button className="btn btn-secondary" onClick={() => setPriceUpdateModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doPriceUpdate} disabled={!pricePct || Number(pricePct) === 0}>
                <i className="fa fa-bolt" /> Actualizar {priceUpdatePreview.length} productos
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
    </div>
  )
}
