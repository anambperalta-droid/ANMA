import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { fmt, fmtDec, MOVE_TYPES, MOVE_CLS } from '../../lib/storage'
import MoneyInput from '../common/MoneyInput'

const EMPTY = { name: '', cat: '', subcat: '', unit: 'un', cost: '', stock: '', minStock: '', supplierId: '', notes: '', packCost: '', packQty: '', qtyPerGift: '', shippingCost: '' }
const numFocus = e => e.target.select()

const SUBCAT_SUGGESTIONS = {
  prod_core:    ['Textiles', 'Químicos', 'Madera', 'Metales', 'Papel/Cartón'],
  packaging:    ['Cajas', 'Bolsas', 'Papel de seda', 'Cintas', 'Tarjetas'],
  insumos_op:   ['Limpieza', 'Librería', 'Etiquetas de envío', 'Precintos'],
  herramientas: ['Agujas', 'Lubricantes', 'Brocas', 'Filtros'],
  promo:        ['Folletos', 'Stickers', 'Muestras', 'Merchandising'],
}

const MOVE_NOTES = {
  in:     ['Compra a proveedor', 'Devolución de cliente', 'Ajuste de inventario'],
  out:    ['Venta', 'Merma / Desperdicio', 'Uso interno', 'Ajuste de inventario'],
  adjust: ['Conteo físico', 'Corrección de error'],
  return: ['Devolución de cliente', 'Reposición de proveedor'],
}

const CAT_CLS = {
  prod_core:    'b-confirmed',
  packaging:    'b-sent',
  insumos_op:   'b-negotiating',
  herramientas: 'b-draft',
  promo:        'b-lost',
}

// LED logic: isLow = critical, isWarn = within 10% above min
const stockLevel = (stock, minStock) => {
  const s = stock || 0
  const m = minStock || 0
  if (m <= 0) return 'ok'
  if (s <= m) return 'low'
  if (s <= m * 1.1) return 'warn'
  return 'ok'
}

const LED_DOT = {
  low:  { bg: '#DC2626', pulse: true },
  warn: { bg: '#F59E0B', pulse: false },
  ok:   { bg: '#10B981', pulse: false },
}

const relTime = (iso) => {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'hace <1h'
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d}d`
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function Insumos() {
  const { get, config, saveEntity, deleteEntity, recordStockMove } = useData()
  const toast   = useToast()
  const confirm = useConfirm()
  const c = config()
  const cats = c.insumoCats || []
  const units = c.units || ['un', 'kg', 'lt', 'm', 'pack', 'caja', 'rollo']

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [sortField, setSortField] = useState(() => { try { return localStorage.getItem('ins_sort_f') || 'recent' } catch { return 'recent' } })
  const [sortDir, setSortDir] = useState(() => { try { return localStorage.getItem('ins_sort_d') || 'desc' } catch { return 'desc' } })
  const [modal, setModal] = useState(false)
  const [moveModal, setMoveModal] = useState(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [moveForm, setMoveForm] = useState({ type: 'in', qty: '', purchaseCost: '', note: '' })
  const [tab, setTab] = useState('list')

  const toggleSort = (field) => {
    if (sortField === field) {
      const nd = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(nd)
      try { localStorage.setItem('ins_sort_d', nd) } catch {}
    } else {
      setSortField(field); setSortDir('asc')
      try { localStorage.setItem('ins_sort_f', field); localStorage.setItem('ins_sort_d', 'asc') } catch {}
    }
  }

  const sortIcon = (field) => {
    if (sortField !== field) return <i className="fa fa-sort" style={{ fontSize: 8, marginLeft: 4, opacity: .3 }} />
    return <i className={`fa fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ fontSize: 9, marginLeft: 4, color: 'var(--brand)' }} />
  }
  const [showAdvancedModal, setShowAdvancedModal] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(() => {
    try { return sessionStorage.getItem('insumos_low_dismissed') === '1' } catch { return false }
  })
  const dismissLowAlert = () => {
    try { sessionStorage.setItem('insumos_low_dismissed', '1') } catch { }
    setAlertDismissed(true)
  }

  const insumos = get('insumos', [])
  const suppliers = get('suppliers', [])
  const stockMoves = get('stockMoves', [])

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const filtered = useMemo(() => {
    let f = insumos
    if (catFilter !== 'all') f = f.filter(x => x.cat === catFilter)
    if (showLowOnly) f = f.filter(x => stockLevel(x.stock, x.minStock) === 'low')
    if (search) {
      const s = search.toLowerCase()
      f = f.filter(x =>
        x.name.toLowerCase().includes(s) ||
        (x.cat || '').toLowerCase().includes(s) ||
        (x.subcat || '').toLowerCase().includes(s)
      )
    }
    const arr = [...f]
    if (sortField === 'recent') {
      arr.sort((a, b) => (b.id || 0) - (a.id || 0))
    } else {
      const dir = sortDir === 'asc' ? 1 : -1
      arr.sort((a, b) => {
        if (sortField === 'name') {
          const av = (a.name || '').toLowerCase(), bv = (b.name || '').toLowerCase()
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
        }
        if (sortField === 'cost')  return ((Number(a.cost) || 0) - (Number(b.cost) || 0)) * dir
        if (sortField === 'stock') return ((a.stock || 0) - (b.stock || 0)) * dir
        return 0
      })
    }
    return arr
  }, [insumos, catFilter, showLowOnly, search, sortField, sortDir])

  const lowStock = useMemo(() => insumos.filter(x => stockLevel(x.stock, x.minStock) === 'low'), [insumos])
  const totalValue = insumos.reduce((s, x) => s + (x.stock || 0) * (Number(x.cost) || 0), 0)

  const catLabel = (id) => cats.find(cat => cat.id === id)?.label || id || '—'

  const openNew = () => { setShowAdvancedModal(false); setForm({ ...EMPTY, cat: cats[0]?.id || '' }); setModal(true) }
  const openEdit = (item) => { setShowAdvancedModal(false); setForm({ ...item }); setModal(true) }

  const save = () => {
    if (!form.name) { toast('Ingresá un nombre', 'er'); return }
    saveEntity('insumos', {
      ...form,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
    })
    setModal(false)
    toast(form.id ? 'Insumo actualizado' : 'Insumo creado', 'ok')
  }

  const remove = (id) => confirm('¿Eliminar este insumo?', () => { deleteEntity('insumos', id); toast('Eliminado', 'in') })

  const openMove = (item) => {
    setMoveModal(item)
    setMoveForm({ type: 'in', qty: '', purchaseCost: '', note: '' })
  }

  const saveMove = () => {
    if (!moveForm.qty || Number(moveForm.qty) <= 0) { toast('Ingresá una cantidad válida', 'er'); return }
    const isIncoming = moveForm.type === 'in' || moveForm.type === 'return'
    recordStockMove({
      type: moveForm.type,
      insumoId: moveModal.id,
      qty: Number(moveForm.qty),
      purchaseCost: isIncoming && moveForm.purchaseCost ? Number(moveForm.purchaseCost) : undefined,
      costAtTime: Number(moveModal.cost) || 0,
      note: moveForm.note || moveModal.name,
      ref: moveModal.name,
    })
    setMoveModal(null)
    toast('Movimiento registrado', 'ok')
  }

  const costPerGift = useMemo(() => {
    const pc = parseFloat(form.packCost)
    const pq = parseFloat(form.packQty)
    const qpg = parseFloat(form.qtyPerGift)
    const sc = parseFloat(form.shippingCost) || 0
    if (!pc || !pq || !qpg || pq <= 0 || qpg <= 0) return null
    return ((pc + sc) / pq) * qpg
  }, [form.packCost, form.packQty, form.qtyPerGift, form.shippingCost])

  const cppPreview = useMemo(() => {
    if (!moveModal) return null
    const isIncoming = moveForm.type === 'in' || moveForm.type === 'return'
    if (!isIncoming) return null
    const qty = Number(moveForm.qty)
    const purchaseCost = Number(moveForm.purchaseCost)
    if (!qty || !purchaseCost) return null
    const currentStock = moveModal.stock || 0
    const currentCost = Number(moveModal.cost) || 0
    const newTotal = currentStock + qty
    if (newTotal <= 0) return null
    return ((currentStock * currentCost) + (qty * purchaseCost)) / newTotal
  }, [moveModal, moveForm])

  const insumoMoves = useMemo(() => {
    return stockMoves.filter(m => m.insumoId).sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 100)
  }, [stockMoves])

  const supplierName = (id) => { const s = suppliers.find(x => x.id === id); return s ? s.name : '—' }

  const exportCsv = () => {
    if (!filtered.length) { toast('Sin datos para exportar', 'er'); return }
    const rows = [['Nombre', 'Categoria', 'Subcategoria', 'Unidad', 'Stock', 'Stock minimo', 'Costo unitario', 'Valor total', 'Proveedor']]
    filtered.forEach(x => rows.push([
      x.name || '', catLabel(x.cat), x.subcat || '', x.unit || 'un',
      x.stock || 0, x.minStock || 0, Number(x.cost) || 0,
      ((x.stock || 0) * (Number(x.cost) || 0)).toFixed(2),
      supplierName(x.supplierId),
    ]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `insumos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 100)
    toast('CSV exportado', 'ok')
  }

  const quickPlus = (item) => {
    recordStockMove({ type: 'in', insumoId: item.id, qty: 1, costAtTime: Number(item.cost) || 0, ref: item.name, note: '+1 rápido' })
    toast(`+1 ${item.unit || 'un'} → ${item.name}`, 'ok')
  }

  const quickAdjust = (item, delta) => {
    const newQty = Math.max(0, (item.stock || 0) + delta)
    recordStockMove({ type: 'adjust', insumoId: item.id, qty: newQty, costAtTime: Number(item.cost) || 0, ref: item.name, note: 'Ajuste rápido desde tabla' })
    toast(`Stock: ${newQty} ${item.unit || 'un'}`, 'ok')
  }

  return (
    <div className="page active" style={{ animation: 'pgIn .25s ease both' }}>
      <div className="ph">
        <div className="ph-right ins-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm ins-act-export" onClick={exportCsv} title="Exportar CSV">
            <i className="fa fa-file-arrow-down" /><span className="ins-act-txt"> Exportar</span>
          </button>
          <button className="btn btn-primary ins-act-new" onClick={openNew} title="Nuevo insumo">
            <i className="fa fa-plus" /><span className="ins-act-txt"> Nuevo insumo</span><span className="ins-act-txt-short"> Nuevo</span>
          </button>
        </div>
      </div>

      {/* ── Status bar mobile (una línea delgada, tap-to-filter) ── */}
      <div
        className={`ins-statusbar ${lowStock.length > 0 ? 'alert' : 'ok'}`}
        onClick={() => { if (lowStock.length > 0) setShowLowOnly(v => !v) }}
        role={lowStock.length > 0 ? 'button' : undefined}
      >
        <i className={`ins-statusbar-ic fa fa-${lowStock.length > 0 ? 'triangle-exclamation' : 'circle-check'}`} />
        <span className="ins-statusbar-label">
          {lowStock.length === 0 ? 'Todo en orden' : `${lowStock.length} ${lowStock.length === 1 ? 'crítico' : 'críticos'}`}
        </span>
        <span className="ins-statusbar-meta">{insumos.length} ítems · {fmt(totalValue)}</span>
        {lowStock.length > 0 && <i className="ins-statusbar-arrow fa fa-chevron-right" />}
      </div>

      {/* ── KPIs desktop ── */}
      <div className="bento bento-kpis-4 ins-desk-only" style={{ marginBottom: 14 }}>
        <div className="bento-kpi" style={{ borderLeft: '3px solid var(--brand)', padding: '12px 14px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Total insumos</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-.03em', lineHeight: 1.1 }}>{insumos.length}</div>
        </div>
        <div className="bento-kpi" style={{ borderLeft: '3px solid var(--green)', padding: '12px 14px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Valor Total en Stock</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--money)', letterSpacing: '-.03em', lineHeight: 1.1 }}>{fmtDec(totalValue)}</div>
        </div>
        <div className="bento-kpi" style={{ borderLeft: `3px solid ${lowStock.length > 0 ? 'var(--red)' : 'var(--green)'}`, ...(lowStock.length === 0 ? { borderTop: '4px solid #10B981' } : {}), padding: '12px 14px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Stock bajo</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, color: lowStock.length > 0 ? 'var(--red)' : 'var(--green)' }}>{lowStock.length}</div>
          {lowStock.length === 0
            ? <div style={{ fontSize: 9.5, color: '#16A34A', marginTop: 2, fontWeight: 600 }}>Todo en orden</div>
            : <button
                onClick={() => { setShowLowOnly(true); setTab('list') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, fontWeight: 700, color: '#DC2626', marginTop: 5, display: 'flex', alignItems: 'center', gap: 3, lineHeight: 1 }}>
                Ver faltantes <i className="fa fa-arrow-right" style={{ fontSize: 8 }} />
              </button>
          }
        </div>
        <div className="bento-kpi" style={{ borderLeft: '3px solid var(--amber)', padding: '12px 14px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Categorías</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-.03em', lineHeight: 1.1 }}>{cats.length}</div>
        </div>
      </div>

      {/* Low stock banner (desktop) — mobile ya lo cubre el HERO */}
      {lowStock.length > 0 && !alertDismissed && (
        <div className="ins-desk-only" style={{ background: 'var(--red-lt)', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa fa-triangle-exclamation" />
          <span style={{ flex: 1 }}><b>{lowStock.length} insumo{lowStock.length > 1 ? 's' : ''}</b> con stock bajo o agotado: {lowStock.slice(0, 5).map(x => x.name).join(', ')}{lowStock.length > 5 ? '...' : ''}</span>
          <button onClick={dismissLowAlert} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, fontSize: 14, flexShrink: 0, opacity: 0.7 }}><i className="fa fa-xmark" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="cfg-tabs" style={{ marginBottom: 14 }}>
        <div className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          <i className="fa fa-boxes-stacked" style={{ marginRight: 6 }} />Inventario
        </div>
        <div className={`tab-btn ${tab === 'moves' ? 'active' : ''}`} onClick={() => setTab('moves')}>
          <i className="fa fa-arrows-rotate" style={{ marginRight: 6 }} />Movimientos
        </div>
      </div>

      {/* ── TAB: Inventario ── */}
      {tab === 'list' && (
        <div className="ins-layout">

          {/* ── LEFT: tabla principal ── */}
          <div className="ins-main">
            {showLowOnly && (
              <div style={{ background: '#FFF1F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '8px 14px', marginBottom: 10, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa fa-triangle-exclamation" style={{ fontSize: 11 }} />
                <span style={{ flex: 1 }}>Mostrando solo insumos con stock bajo</span>
                <button onClick={() => setShowLowOnly(false)} style={{ background: 'none', border: '1px solid #FECACA', cursor: 'pointer', color: '#DC2626', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className="fa fa-xmark" /> Limpiar
                </button>
              </div>
            )}

            {/* Filters — grid 2 cols en mobile, flow en desktop */}
            <div className="ins-filter-grid">
              <div className="search-row ins-fg-search">
                <i className="fa fa-magnifying-glass" />
                <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="ins-filter-sel ins-fg-cat" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="all">Todas las categorías</option>
                {cats.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
              </select>
              <select
                className="ins-filter-sel ins-fg-sort"
                value={`${sortField}:${sortDir}`}
                onChange={e => {
                  const [f, d] = e.target.value.split(':')
                  setSortField(f); setSortDir(d)
                  try { localStorage.setItem('ins_sort_f', f); localStorage.setItem('ins_sort_d', d) } catch {}
                }}
              >
                <option value="recent:desc">Recientes</option>
                <option value="name:asc">Nombre A-Z</option>
                <option value="stock:desc">Stock ↓</option>
                <option value="stock:asc">Stock ↑</option>
                <option value="cost:desc">Costo ↓</option>
              </select>
              <button
                onClick={() => setShowLowOnly(v => !v)}
                className={`ins-chip-toggle ins-fg-alert${showLowOnly ? ' active' : ''}`}
                title="Filtrar solo stock bajo"
              >
                <i className="fa fa-triangle-exclamation" style={{ fontSize: 10 }} />
                <span className="ins-fg-alert-txt">Stock bajo</span>
                {lowStock.length > 0 && <span className="cnt">{lowStock.length}</span>}
              </button>
            </div>

            {/* ── Mobile: pill cards ── */}
            <div className="ins-mob-list">
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--txt3)' }}>
                  <i className="fa fa-box-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                  No hay insumos cargados
                </div>
              )}
              {filtered.map(item => {
                const level = stockLevel(item.stock, item.minStock)
                const stock = item.stock || 0
                const minS = item.minStock || 0
                // Progreso visual: si hay mínimo, comparar contra 2x mínimo (target razonable)
                const target = minS > 0 ? minS * 2 : Math.max(stock, 10)
                const pct = Math.max(4, Math.min(100, Math.round((stock / target) * 100)))
                const barColor = level === 'low' ? '#DC2626' : level === 'warn' ? '#F59E0B' : '#16A34A'
                return (
                  <div key={item.id} className={`ins-mob-card v2 ${level}`} onClick={() => openEdit(item)}>
                    <div className="ins-mob-card-head">
                      <div className="ins-mob-card-name-wrap">
                        <div className="ins-mob-card-name">{item.name}</div>
                        <div className="ins-mob-card-cat">
                          <span className={`badge ${CAT_CLS[item.cat] || 'b-draft'}`} style={{ fontSize: 9, padding: '1px 6px' }}>{catLabel(item.cat)}</span>
                          {item.subcat && <span className="ins-mob-card-sub">{item.subcat}</span>}
                        </div>
                      </div>
                      <div className="ins-mob-card-stock" style={{ color: barColor }}>
                        <div className="stk-num">{stock}</div>
                        <div className="stk-unit">{item.unit || 'un'}</div>
                      </div>
                    </div>

                    <div className="ins-mob-card-bar">
                      <div className="ins-mob-card-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                      {minS > 0 && <div className="ins-mob-card-bar-min" style={{ left: `${Math.min(95, Math.round((minS / target) * 100))}%` }} title={`mín ${minS}`} />}
                    </div>

                    <div className="ins-mob-card-foot">
                      <div className="ins-mob-card-foot-info">
                        {minS > 0 && (
                          <span className="ins-mob-card-min">
                            <i className="fa fa-flag" style={{ fontSize: 8, marginRight: 3, opacity: .6 }} />
                            mín {minS}
                          </span>
                        )}
                        <span className="ins-mob-card-price">{fmtDec(item.cost)}<span className="ins-mob-card-unit">/{item.unit || 'un'}</span></span>
                      </div>
                      <div className="ins-mob-card-acts" onClick={e => e.stopPropagation()}>
                        <button className="ins-mob-card-btn" title="-1" onClick={() => quickAdjust(item, -1)} disabled={stock <= 0}>
                          <i className="fa fa-minus" />
                        </button>
                        <button className="ins-mob-card-btn green" title="+1" onClick={() => quickPlus(item)}>
                          <i className="fa fa-plus" />
                        </button>
                        <button className="ins-mob-card-btn red" title="Eliminar" onClick={() => remove(item.id)}>
                          <i className="fa fa-trash" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop: tabla compacta premium (6 cols) ── */}
            <div className="ins-desk-view">
              <div className="card tbl-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="tbl-sort" onClick={() => toggleSort('name')}>Insumo {sortIcon('name')}</th>
                      <th>Unidad</th>
                      <th className="tbl-sort" style={{ textAlign: 'right' }} onClick={() => toggleSort('cost')}>Costo U. {sortIcon('cost')}</th>
                      <th>Proveedor</th>
                      <th style={{ textAlign: 'right', color: 'var(--txt3)', fontWeight: 500 }}>Última act.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--txt3)' }}>
                        <i className="fa fa-box-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                        No hay insumos cargados
                      </td></tr>
                    )}
                    {filtered.map(item => {
                      const level = stockLevel(item.stock, item.minStock)
                      const led = LED_DOT[level]
                      return (
                        <tr key={item.id} style={level === 'low' ? { borderLeft: '3px solid #DC2626' } : undefined}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span className={led.pulse ? 'ins-led-pulse' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: led.bg, flexShrink: 0, display: 'inline-block', marginTop: 5 }} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                                <div style={{ fontSize: 10.5, marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: level === 'low' ? '#DC2626' : level === 'warn' ? '#D97706' : 'var(--txt3)', fontWeight: level !== 'ok' ? 700 : 400 }}>
                                    {item.stock || 0} en stock
                                  </span>
                                  {item.minStock > 0 && <span style={{ color: 'var(--txt4)' }}>· mín {item.minStock}</span>}
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }} onClick={e => e.stopPropagation()}>
                                    <button className="ins-stk-btn" title="+1 unidad" onClick={() => quickAdjust(item, 1)}>+</button>
                                    <button className="ins-stk-btn" title="-1 unidad" onClick={() => quickAdjust(item, -1)} disabled={(item.stock || 0) <= 0}>−</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--txt3)' }}>{item.unit || 'un'}</td>
                          <td style={{ textAlign: 'right' }}>{fmtDec(item.cost)}</td>
                          <td style={{ fontSize: 11 }}>{supplierName(item.supplierId)}</td>
                          <td style={{ textAlign: 'right', fontSize: 10, color: 'var(--txt4)', whiteSpace: 'nowrap' }}>
                            {relTime(item.lastMove) || '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button title="Registrar movimiento" onClick={() => openMove(item)}
                                style={{ width:28,height:28,borderRadius:'50%',border:'1.5px solid var(--border2)',background:'var(--surface2)',color:'var(--txt2)',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0 }}>
                                <i className="fa fa-arrows-rotate" />
                              </button>
                              <button title="Editar" onClick={() => openEdit(item)}
                                style={{ width:28,height:28,borderRadius:'50%',border:'1.5px solid var(--border2)',background:'var(--surface2)',color:'var(--txt2)',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0 }}>
                                <i className="fa fa-pen" />
                              </button>
                              <button title="Eliminar" onClick={() => remove(item.id)}
                                style={{ width:28,height:28,borderRadius:'50%',border:'1.5px solid #FECACA',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0 }}>
                                <i className="fa fa-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── RIGHT: panel lateral (desktop only) ── */}
          <div className="ins-panel">

            {/* Resumen stats */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="fa fa-chart-simple" /> Resumen
              </div>
              <div className="ins-pstat">
                <span><i className="fa fa-boxes-stacked" style={{ color: 'var(--brand)', marginRight: 5, fontSize: 11 }} />Total insumos</span>
                <b>{insumos.length}</b>
              </div>
              <div className="ins-pstat">
                <span><i className="fa fa-coins" style={{ color: '#F59E0B', marginRight: 5, fontSize: 11 }} />Valor stock</span>
                <b style={{ color: 'var(--money)' }}>{fmtDec(totalValue)}</b>
              </div>
              <div className="ins-pstat">
                <span><i className="fa fa-tag" style={{ color: '#64748B', marginRight: 5, fontSize: 11 }} />Categorías</span>
                <b>{cats.length}</b>
              </div>
            </div>

            {/* Stock crítico / Todo OK */}
            {lowStock.length > 0 ? (
              <div className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fa fa-triangle-exclamation" /> Stock crítico ({lowStock.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {lowStock.slice(0, 7).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--txt)', marginRight: 8 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, flexShrink: 0 }}>
                        {item.stock || 0}<span style={{ color: 'var(--txt4)', fontWeight: 400, marginLeft: 2 }}>{item.unit || 'un'}</span>
                      </div>
                    </div>
                  ))}
                  {lowStock.length > 7 && <div style={{ fontSize: 10, color: 'var(--txt4)', paddingTop: 6 }}>+{lowStock.length - 7} insumos más</div>}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
                <i className="fa fa-circle-check" style={{ color: 'var(--green)', fontSize: 24, marginBottom: 8, display: 'block' }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 3 }}>Stock al día</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Todos los insumos tienen stock suficiente</div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── TAB: Movimientos ── */}
      {tab === 'moves' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{insumoMoves.length} movimiento{insumoMoves.length !== 1 ? 's' : ''} registrado{insumoMoves.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setTab('list')}>
              <i className="fa fa-arrow-left" style={{ marginRight: 4 }} />Volver a inventario
            </button>
          </div>
          {insumoMoves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <i className="fa fa-arrows-rotate" style={{ fontSize: 32, color: 'var(--txt4)', marginBottom: 12, display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt2)', marginBottom: 6 }}>Sin movimientos registrados</div>
              <div style={{ fontSize: 12, color: 'var(--txt4)', lineHeight: 1.6, maxWidth: 340, margin: '0 auto 16px' }}>
                Los ingresos, egresos y ajustes de stock aparecerán acá.<br />Usá el botón <i className="fa fa-arrows-rotate" style={{ fontSize: 10 }} /> en cada insumo para registrar movimientos.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setTab('list')}>
                <i className="fa fa-boxes-stacked" style={{ marginRight: 6 }} />Ir a inventario
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Insumo</th>
                    <th style={{ textAlign: 'right' }}>Cant.</th>
                    <th className="col-hide-mobile" style={{ textAlign: 'right' }}>Costo Total</th>
                    <th className="col-hide-mobile">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {insumoMoves.map(m => {
                    const isIn = m.type === 'in' || m.type === 'return'
                    const isAdjust = m.type === 'adjust'
                    const insumo = insumos.find(x => x.id === m.insumoId)
                    const costoTotal = m.costAtTime ? m.qty * m.costAtTime : null
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{m.date}</td>
                        <td><span className={`badge ${MOVE_CLS[m.type] || 'b-draft'}`}>{MOVE_TYPES[m.type] || m.type}</span></td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{m.ref || insumo?.name || '—'}</div>
                          {insumo?.subcat && <div style={{ fontSize: 10, color: '#64748B' }}>{insumo.subcat}</div>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: isAdjust ? 'var(--brand)' : isIn ? '#16A34A' : '#DC2626', fontFamily: 'ui-monospace,SFMono-Regular,monospace' }}>
                            {isAdjust ? '=' : isIn ? '+' : '−'}{m.qty}
                          </span>
                          {insumo?.unit && <span style={{ fontSize: 10, color: 'var(--txt4)', marginLeft: 3 }}>{insumo.unit}</span>}
                        </td>
                        <td className="col-hide-mobile" style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                          {costoTotal !== null ? fmtDec(costoTotal) : <span style={{ color: 'var(--txt4)' }}>—</span>}
                        </td>
                        <td className="col-hide-mobile" style={{ fontSize: 11, color: 'var(--txt3)' }}>{m.note || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modal: crear / editar insumo — FRICCION CERO ── */}
      {modal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal-form-card" style={{ maxWidth: 560 }}>

            {/* Header fijo */}
            <div style={{ padding: '16px 22px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{form.id ? 'Editar insumo' : 'Nuevo insumo'}</h3>
                <div style={{ fontSize: 10, color: 'var(--txt4)', marginTop: 2 }}>Materias primas, packaging, herramientas, materiales operativos…</div>
              </div>
              <button className="mclose" onClick={() => setModal(false)}><i className="fa fa-xmark" /></button>
            </div>

            {/* Body scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 22px 8px', WebkitOverflowScrolling: 'touch' }}>

              {/* Fila 1: Nombre */}
              <div className="fg">
                <label><i className="fa fa-box" style={{ color: 'var(--brand)', fontSize: 10, marginRight: 4 }} />Nombre *</label>
                <input type="text" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Tela algodón 180gr" autoFocus />
              </div>

              {/* Fila 2: Costo + Unidad */}
              <div className="grid2" style={{ marginTop: 10 }}>
                <div className="fg">
                  <label><i className="fa fa-coins" style={{ color: '#F59E0B', fontSize: 10, marginRight: 4 }} />Costo unitario</label>
                  <MoneyInput value={form.cost === '' ? '' : Number(form.cost)} onChange={v => setF('cost', v)} allowEmpty placeholder="0" />
                </div>
                <div className="fg">
                  <label><i className="fa fa-ruler-combined" style={{ color: '#64748B', fontSize: 10, marginRight: 4 }} />Unidad de medida</label>
                  <select value={form.unit} onChange={e => setF('unit', e.target.value)}>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Calculadora de fraccionamiento ── */}
              <button
                onClick={() => setShowCalc(p => !p)}
                style={{ background: showCalc ? 'rgba(99,102,241,.08)' : 'var(--surface2)', border: `1.5px solid ${showCalc ? 'rgba(99,102,241,.3)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', padding: '7px 12px', fontSize: 11.5, fontWeight: 700, color: showCalc ? 'var(--brand)' : 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 10, transition: 'all .15s' }}
              >
                <i className="fa fa-calculator" style={{ fontSize: 10 }} />
                {showCalc ? 'Ocultar calculadora de fraccionamiento' : '🧮 Calcular costo por unidad desde un pack'}
                <i className={`fa fa-chevron-${showCalc ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: 9, opacity: .6 }} />
              </button>

              {showCalc && (
                <div style={{ background: 'rgba(99,102,241,.05)', border: '1.5px solid rgba(99,102,241,.18)', borderRadius: 10, padding: '14px 14px 10px', marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i className="fa fa-calculator" style={{ fontSize: 9 }} /> Fraccionamiento de pack
                  </div>
                  <div className="grid2" style={{ marginBottom: 10 }}>
                    <div className="fg">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="fa fa-tag" style={{ color: 'var(--brand)', fontSize: 10 }} />
                        Costo del pack
                      </label>
                      <MoneyInput value={form.packCost === '' || form.packCost == null ? '' : Number(form.packCost)} onChange={v => setF('packCost', v)} allowEmpty placeholder="0" />
                    </div>
                    <div className="fg">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="fa fa-cubes" style={{ color: '#10B981', fontSize: 10 }} />
                        Unidades en el pack
                      </label>
                      <input type="number" value={form.packQty || ''} onChange={e => setF('packQty', e.target.value)} onFocus={numFocus} placeholder="0" min="1" />
                    </div>
                  </div>
                  <div className="fg" style={{ marginBottom: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <i className="fa fa-truck" style={{ color: '#8B5CF6', fontSize: 10 }} />
                      Envío del pedido
                      <span style={{ fontWeight: 400, color: 'var(--txt4)', fontSize: 10 }}>(opcional — se suma al costo total)</span>
                    </label>
                    <MoneyInput value={form.shippingCost === '' || form.shippingCost == null ? '' : Number(form.shippingCost)} onChange={v => setF('shippingCost', v)} allowEmpty placeholder="0" />
                  </div>
                  <div className="fg" style={{ marginBottom: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <i className="fa fa-cube" style={{ color: '#F59E0B', fontSize: 10 }} />
                      Unidades que usás por insumo / regalo
                    </label>
                    <input type="number" value={form.qtyPerGift || ''} onChange={e => setF('qtyPerGift', e.target.value)} onFocus={numFocus} placeholder="1" min="0" step="0.1" />
                  </div>
                  {costPerGift !== null && (
                    <div style={{ background: 'rgba(99,102,241,.12)', borderRadius: 8, padding: '10px 14px', marginTop: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        <i className="fa fa-equals" style={{ marginRight: 4 }} />Costo por unidad calculado
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)', letterSpacing: '-.03em', lineHeight: 1.1 }}>
                        {fmtDec(costPerGift)}
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt3)', marginLeft: 5 }}>/ {form.unit || 'un'}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(99,102,241,.7)', marginTop: 3 }}>
                        {fmtDec((parseFloat(form.packCost) || 0) + (parseFloat(form.shippingCost) || 0))} ÷ {form.packQty} × {form.qtyPerGift} {form.unit || 'un'}
                        {parseFloat(form.shippingCost) > 0 && (
                          <span style={{ display: 'block', color: '#8B5CF6', marginTop: 1 }}>
                            <i className="fa fa-truck" style={{ marginRight: 3 }} />
                            incl. {fmtDec(parseFloat(form.shippingCost))} de envío ({fmtDec((parseFloat(form.shippingCost) / (parseFloat(form.packQty) || 1)) * (parseFloat(form.qtyPerGift) || 1))} por unidad)
                          </span>
                        )}
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 10, fontSize: 11, padding: '5px 12px' }}
                        onClick={() => setF('cost', costPerGift.toFixed(4))}
                      >
                        <i className="fa fa-arrow-down" /> Usar como costo unitario
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Fila 3: Proveedor */}
              <div className="fg" style={{ marginTop: 10 }}>
                <label><i className="fa fa-truck" style={{ color: '#8B5CF6', fontSize: 10, marginRight: 4 }} />Proveedor</label>
                <select value={form.supplierId || ''} onChange={e => setF('supplierId', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Sin proveedor asignado</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Acordeón: más opciones */}
              <button
                onClick={() => setShowAdvancedModal(p => !p)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0 2px', fontSize: 12, fontWeight: 700, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 5, width: '100%', marginTop: 6 }}
              >
                <i className={`fa fa-chevron-${showAdvancedModal ? 'up' : 'down'}`} style={{ fontSize: 9 }} />
                {showAdvancedModal ? 'Menos opciones' : 'Más opciones (categoría, stock, notas)'}
              </button>

              {showAdvancedModal && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 2 }}>
                  <div className="grid2">
                    <div className="fg">
                      <label>Categoría</label>
                      <select value={form.cat} onChange={e => { setF('cat', e.target.value); setF('subcat', '') }}>
                        <option value="">Sin categoría</option>
                        {cats.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                      </select>
                    </div>
                    <div className="fg">
                      <label>Subcategoría <span style={{ fontWeight: 400, color: 'var(--txt3)', fontSize: 11 }}>(opc.)</span></label>
                      <input
                        type="text"
                        list={`subcat-list-${form.cat}`}
                        value={form.subcat || ''}
                        onChange={e => setF('subcat', e.target.value)}
                        placeholder={form.cat ? 'Elegí o escribí...' : 'Seleccioná categoría'}
                        disabled={!form.cat}
                      />
                      {form.cat && (
                        <datalist id={`subcat-list-${form.cat}`}>
                          {(SUBCAT_SUGGESTIONS[form.cat] || []).map(s => <option key={s} value={s} />)}
                        </datalist>
                      )}
                    </div>
                  </div>
                  <div className="grid2">
                    <div className="fg">
                      <label>Stock actual</label>
                      <input type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} onFocus={numFocus} placeholder="0" />
                    </div>
                    <div className="fg">
                      <label>Stock mínimo (alerta)</label>
                      <input type="number" value={form.minStock} onChange={e => setF('minStock', e.target.value)} onFocus={numFocus} placeholder="0" />
                    </div>
                  </div>
                  <div className="fg">
                    <label>Notas</label>
                    <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Observaciones internas..." />
                  </div>
                </div>
              )}

            </div>{/* /body scrollable */}

            {/* Footer fijo */}
            <div style={{ flexShrink: 0, position: 'sticky', bottom: 0, borderTop: '1px solid var(--border)', padding: '12px 22px 18px', background: 'var(--surface)', display: 'flex', gap: 8, justifyContent: 'flex-end', zIndex: 5 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={save}>
                <i className="fa fa-floppy-disk" /> {form.id ? 'Guardar cambios' : 'Crear insumo'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal: movimiento de stock ── */}
      {moveModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setMoveModal(null) }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="mh">
              <h3>Movimiento de stock</h3>
              <button className="mclose" onClick={() => setMoveModal(null)}><i className="fa fa-xmark" /></button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa fa-box" style={{ color: 'var(--brand)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{moveModal.name}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                  Stock actual: <b>{moveModal.stock || 0}</b> {moveModal.unit || 'un'}
                  {moveModal.cost > 0 && <> · Costo actual: <b>{fmtDec(moveModal.cost)}</b></>}
                </div>
              </div>
            </div>
            <div className="grid2">
              <div className="fg">
                <label>Tipo de movimiento</label>
                <select value={moveForm.type} onChange={e => setMoveForm(p => ({ ...p, type: e.target.value, purchaseCost: '', note: '' }))}>
                  <option value="in">Ingreso (+)</option>
                  <option value="out">Egreso (-)</option>
                  <option value="adjust">Ajuste (=)</option>
                  <option value="return">Devolución (+)</option>
                </select>
              </div>
              <div className="fg">
                <label>Cantidad</label>
                <input type="number" value={moveForm.qty} onChange={e => setMoveForm(p => ({ ...p, qty: e.target.value }))} onFocus={numFocus} placeholder="0" min="0" />
              </div>
            </div>
            {(moveForm.type === 'in' || moveForm.type === 'return') && (
              <div className="fg">
                <label>Costo de compra por unidad <span style={{ fontWeight: 400, color: 'var(--txt3)', fontSize: 11 }}>(actualiza CPP)</span></label>
                <MoneyInput
                  value={moveForm.purchaseCost === '' || moveForm.purchaseCost == null ? '' : Number(moveForm.purchaseCost)}
                  onChange={v => setMoveForm(p => ({ ...p, purchaseCost: v }))}
                  allowEmpty
                  placeholder={`Actual: ${fmtDec(moveModal.cost || 0)}`}
                />
                <div style={{ fontSize: 11, color: 'var(--txt4)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className="fa fa-circle-info" style={{ fontSize: 10 }} />
                  Esto actualizará tu costo promedio unitario.
                </div>
              </div>
            )}
            {cppPreview !== null && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 12px', marginTop: 4, fontSize: 12, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa fa-calculator" style={{ fontSize: 11 }} />
                Nuevo costo promedio ponderado: <b style={{ marginLeft: 4 }}>{fmtDec(cppPreview)}</b> / {moveModal.unit || 'un'}
              </div>
            )}
            <div className="fg" style={{ marginTop: 8 }}>
              <label>Motivo</label>
              <input
                type="text"
                list="move-notes-list"
                value={moveForm.note}
                onChange={e => setMoveForm(p => ({ ...p, note: e.target.value }))}
                placeholder="Elegí o escribí el motivo..."
              />
              <datalist id="move-notes-list">
                {(MOVE_NOTES[moveForm.type] || []).map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setMoveModal(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={saveMove}><i className="fa fa-check" /> Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
