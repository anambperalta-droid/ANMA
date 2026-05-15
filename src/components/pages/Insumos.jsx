import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { fmt, fmtDec, MOVE_TYPES, MOVE_CLS } from '../../lib/storage'

const EMPTY = { name: '', cat: '', subcat: '', unit: 'un', cost: '', stock: '', minStock: '', supplierId: '', notes: '' }
const numFocus = e => e.target.select()

const SUBCAT_SUGGESTIONS = {
  prod_core:    ['Textiles', 'Químicos', 'Madera', 'Metales', 'Papel/Cartón'],
  packaging:    ['Cajas', 'Bolsas', 'Papel de seda', 'Cintas', 'Tarjetas'],
  insumos_op:   ['Limpieza', 'Librería', 'Etiquetas de envío', 'Precintos'],
  herramientas: ['Agujas', 'Lubricantes', 'Brocas', 'Filtros'],
  promo:        ['Folletos', 'Stickers', 'Muestras', 'Merchandising'],
}

const CAT_CLS = {
  prod_core:    'b-confirmed',
  packaging:    'b-sent',
  insumos_op:   'b-negotiating',
  herramientas: 'b-draft',
  promo:        'b-lost',
}

export default function Insumos() {
  const { get, config, saveEntity, deleteEntity, recordStockMove } = useData()
  const toast = useToast()
  const c = config()
  const cats = c.insumoCats || []
  const units = c.units || ['un', 'kg', 'lt', 'm', 'pack', 'caja', 'rollo']

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [modal, setModal] = useState(false)
  const [moveModal, setMoveModal] = useState(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [moveForm, setMoveForm] = useState({ type: 'in', qty: '', purchaseCost: '', note: '' })
  const [tab, setTab] = useState('list')
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
    if (showLowOnly) f = f.filter(x => x.minStock > 0 && (x.stock || 0) <= x.minStock)
    if (search) {
      const s = search.toLowerCase()
      f = f.filter(x =>
        x.name.toLowerCase().includes(s) ||
        (x.cat || '').toLowerCase().includes(s) ||
        (x.subcat || '').toLowerCase().includes(s)
      )
    }
    return f.sort((a, b) => (b.id || 0) - (a.id || 0))
  }, [insumos, catFilter, showLowOnly, search])

  const lowStock = insumos.filter(x => x.minStock > 0 && (x.stock || 0) <= x.minStock)
  const totalValue = insumos.reduce((s, x) => s + (x.stock || 0) * (Number(x.cost) || 0), 0)

  const catLabel = (id) => cats.find(cat => cat.id === id)?.label || id || '—'

  const openNew = () => { setForm({ ...EMPTY, cat: cats[0]?.id || '' }); setModal(true) }
  const openEdit = (item) => { setForm({ ...item }); setModal(true) }

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

  const remove = (id) => {
    if (window.confirm('¿Eliminar este insumo?')) { deleteEntity('insumos', id); toast('Eliminado', 'in') }
  }

  const openMove = (item) => { setMoveModal(item); setMoveForm({ type: 'in', qty: '', purchaseCost: '', note: '' }) }

  const saveMove = () => {
    if (!moveForm.qty || Number(moveForm.qty) <= 0) { toast('Ingresá una cantidad válida', 'er'); return }
    const isIncoming = moveForm.type === 'in' || moveForm.type === 'return'
    recordStockMove({
      type: moveForm.type,
      insumoId: moveModal.id,
      qty: Number(moveForm.qty),
      purchaseCost: isIncoming && moveForm.purchaseCost ? Number(moveForm.purchaseCost) : undefined,
      note: moveForm.note || moveModal.name,
      ref: moveModal.name,
    })
    setMoveModal(null)
    toast('Movimiento registrado', 'ok')
  }

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

  const quickPlus = (item) => {
    recordStockMove({ type: 'in', insumoId: item.id, qty: 1, ref: item.name, note: '+1 rápido' })
    toast(`+1 ${item.unit || 'un'} → ${item.name}`, 'ok')
  }

  return (
    <div className="page active" style={{ animation: 'pgIn .25s ease both' }}>
      <div className="ph">
        <div className="ph-left"><h2>Insumos y Materias Primas</h2></div>
        <div className="ph-right">
          <button className="btn btn-primary btn-sm" onClick={openNew}><i className="fa fa-plus" /> Nuevo insumo</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="bento" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 14 }}>
        <div className="bento-kpi" style={{ borderLeft: '3px solid var(--brand)', padding: '12px 14px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Total insumos</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-.03em', lineHeight: 1.1 }}>{insumos.length}</div>
        </div>

        <div className="bento-kpi" style={{ borderLeft: '3px solid var(--green)', padding: '12px 14px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Valor Total en Stock</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--money)', letterSpacing: '-.03em', lineHeight: 1.1 }}>{fmtDec(totalValue)}</div>
        </div>

        <div className="bento-kpi" style={{ borderLeft: `3px solid ${lowStock.length > 0 ? 'var(--red)' : 'var(--green)'}`, padding: '12px 14px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Stock bajo</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, color: lowStock.length > 0 ? 'var(--red)' : 'var(--green)' }}>{lowStock.length}</div>
          {lowStock.length === 0
            ? <div style={{ fontSize: 9.5, color: 'var(--txt4)', marginTop: 2 }}>Todo OK</div>
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

      {/* Low stock banner */}
      {lowStock.length > 0 && !alertDismissed && (
        <div style={{ background: 'var(--red-lt)', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {tab === 'list' && (
        <>
          {/* Active low-only filter chip */}
          {showLowOnly && (
            <div style={{ background: '#FFF1F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '8px 14px', marginBottom: 10, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa fa-triangle-exclamation" style={{ fontSize: 11 }} />
              <span style={{ flex: 1 }}>Mostrando solo insumos con stock bajo</span>
              <button onClick={() => setShowLowOnly(false)} style={{ background: 'none', border: '1px solid #FECACA', cursor: 'pointer', color: '#DC2626', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="fa fa-xmark" /> Limpiar
              </button>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-row" style={{ maxWidth: 280 }}>
              <i className="fa fa-magnifying-glass" />
              <input type="text" placeholder="Buscar insumo o subcategoría..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="f-inp" style={{ maxWidth: 220 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {cats.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>

          {/* ── Mobile: card list ── */}
          <div className="ins-mob-list">
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--txt3)' }}>
                <i className="fa fa-box-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                No hay insumos cargados
              </div>
            )}
            {filtered.map(item => {
              const isLow = item.minStock > 0 && (item.stock || 0) <= item.minStock
              return (
                <div key={item.id} className={`ins-mob-card${isLow ? ' low' : ''}`}>
                  <div className="ins-mob-card-dot" style={{ background: isLow ? '#DC2626' : (item.stock || 0) === 0 ? '#9CA3AF' : '#16A34A' }} />
                  <div className="ins-mob-card-body">
                    <div className="ins-mob-card-name">{item.name}</div>
                    {item.subcat && <div className="ins-mob-card-sub">{item.subcat}</div>}
                    <div className="ins-mob-card-meta">
                      Stock: <b style={{ color: isLow ? '#DC2626' : 'var(--txt)' }}>{item.stock || 0}</b> {item.unit || 'un'}
                      {item.minStock > 0 && <span style={{ color: 'var(--txt4)', marginLeft: 6 }}>· mín {item.minStock}</span>}
                    </div>
                  </div>
                  <div className="ins-mob-card-right">
                    <div>
                      <div className="ins-mob-card-price">{fmtDec(item.cost)}</div>
                      <div className="ins-mob-card-unit">/{item.unit || 'un'}</div>
                    </div>
                    <div className="ins-mob-card-acts">
                      <button className="ins-mob-card-btn green" title="+1 stock" onClick={() => quickPlus(item)}>
                        <i className="fa fa-plus" />
                      </button>
                      <button className="ins-mob-card-btn" title="Editar" onClick={() => openEdit(item)}>
                        <i className="fa fa-pen" />
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

          {/* ── Desktop: table ── */}
          <div className="ins-desk-view">
            <div className="card tbl-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th>Categoría</th>
                    <th>Proveedor</th>
                    <th style={{ textAlign: 'right' }}>Costo</th>
                    <th style={{ textAlign: 'right' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Mín.</th>
                    <th style={{ textAlign: 'right' }}>Unidad</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--txt3)' }}>
                      <i className="fa fa-box-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                      No hay insumos cargados
                    </td></tr>
                  )}
                  {filtered.map(item => {
                    const isLow = item.minStock > 0 && (item.stock || 0) <= item.minStock
                    return (
                      <tr key={item.id} style={isLow ? { borderLeft: '4px solid #DC2626', background: '#FFF1F2' } : undefined}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          {item.subcat && <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{item.subcat}</div>}
                        </td>
                        <td><span className={`badge ${CAT_CLS[item.cat] || 'b-draft'}`}>{catLabel(item.cat)}</span></td>
                        <td style={{ fontSize: 11 }}>{supplierName(item.supplierId)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtDec(item.cost)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isLow ? '#DC2626' : 'var(--txt)' }}>
                          {item.stock || 0}
                          {isLow && <i className="fa fa-triangle-exclamation" style={{ color: '#DC2626', marginLeft: 4, fontSize: 10 }} />}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--txt3)' }}>{item.minStock || '—'}</td>
                        <td style={{ textAlign: 'right', fontSize: 11 }}>{item.unit || 'un'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtDec((item.stock || 0) * (Number(item.cost) || 0))}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="act" title="Ingreso rápido (+1)" style={{ color: '#16A34A', background: '#DCFCE7' }} onClick={() => quickPlus(item)}>
                              <i className="fa fa-plus" style={{ fontSize: 10 }} />
                            </button>
                            <button className="act" title="Registrar movimiento" onClick={() => openMove(item)}><i className="fa fa-arrows-rotate" /></button>
                            <button className="act" title="Editar" onClick={() => openEdit(item)}><i className="fa fa-pen" /></button>
                            <button className="act del" title="Eliminar" onClick={() => remove(item.id)}><i className="fa fa-trash" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAB — mobile only */}
          <button className="mob-fab" onClick={openNew} style={{ background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <i className="fa fa-plus" />
          </button>
        </>
      )}

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
                Los ingresos, egresos y ajustes de stock aparecerán acá.<br />Usá el botón <b>+1</b> o <i className="fa fa-arrows-rotate" style={{ fontSize: 10 }} /> en cada insumo para registrar movimientos.
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
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th className="col-hide-mobile">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {insumoMoves.map(m => {
                    const isIn = m.type === 'in' || m.type === 'return'
                    const isAdjust = m.type === 'adjust'
                    const insumo = insumos.find(x => x.id === m.insumoId)
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{m.date}</td>
                        <td><span className={`badge ${MOVE_CLS[m.type] || 'b-draft'}`}>{MOVE_TYPES[m.type] || m.type}</span></td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{m.ref || insumo?.name || '—'}</div>
                          {insumo?.cat && <div style={{ fontSize: 10, color: 'var(--txt4)' }}>{catLabel(insumo.cat)}</div>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: isAdjust ? 'var(--brand)' : isIn ? '#16A34A' : '#DC2626', fontFamily: 'ui-monospace,SFMono-Regular,monospace' }}>
                            {isAdjust ? '=' : isIn ? '+' : '−'}{m.qty}
                          </span>
                          {insumo?.unit && <span style={{ fontSize: 10, color: 'var(--txt4)', marginLeft: 3 }}>{insumo.unit}</span>}
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

      {/* ── Modal: crear / editar insumo ── */}
      {modal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="mh">
              <h3>{form.id ? 'Editar insumo' : 'Nuevo insumo'}</h3>
              <button className="mclose" onClick={() => setModal(false)}><i className="fa fa-xmark" /></button>
            </div>
            <div className="grid2">
              {/* 1. Nombre + Categoría */}
              <div className="fg">
                <label>Nombre *</label>
                <input type="text" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Tela algodón 180gr" />
              </div>
              <div className="fg">
                <label>Categoría</label>
                <select value={form.cat} onChange={e => { setF('cat', e.target.value); setF('subcat', '') }}>
                  <option value="">Sin categoría</option>
                  {cats.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                </select>
              </div>
              {/* 2. Subcategoría — span 2 */}
              <div className="fg" style={{ gridColumn: 'span 2' }}>
                <label>Subcategoría <span style={{ fontWeight: 400, color: 'var(--txt3)', fontSize: 11 }}>(opcional)</span></label>
                <input
                  type="text"
                  list={`subcat-list-${form.cat}`}
                  value={form.subcat || ''}
                  onChange={e => setF('subcat', e.target.value)}
                  placeholder={form.cat ? 'Elegí una sugerencia o escribí libremente...' : 'Seleccioná una categoría primero'}
                  disabled={!form.cat}
                />
                {form.cat && (
                  <datalist id={`subcat-list-${form.cat}`}>
                    {(SUBCAT_SUGGESTIONS[form.cat] || []).map(s => <option key={s} value={s} />)}
                  </datalist>
                )}
              </div>
              {/* 3. Proveedor — span 2 */}
              <div className="fg" style={{ gridColumn: 'span 2' }}>
                <label>Proveedor</label>
                <select value={form.supplierId || ''} onChange={e => setF('supplierId', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Sin proveedor asignado</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* 4. Stock + Mínimo */}
              <div className="fg">
                <label>Stock actual</label>
                <input type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} onFocus={numFocus} placeholder="0" />
              </div>
              <div className="fg">
                <label>Stock mínimo (alerta)</label>
                <input type="number" value={form.minStock} onChange={e => setF('minStock', e.target.value)} onFocus={numFocus} placeholder="0" />
              </div>
              {/* 5. Costo + Unidad */}
              <div className="fg">
                <label>Costo unitario</label>
                <input type="number" value={form.cost} onChange={e => setF('cost', e.target.value)} onFocus={numFocus} placeholder="0" />
              </div>
              <div className="fg">
                <label>Unidad de medida</label>
                <select value={form.unit} onChange={e => setF('unit', e.target.value)}>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="fg">
              <label>Notas</label>
              <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Observaciones internas..." />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={save}>
                <i className="fa fa-floppy-disk" /> {form.id ? 'Guardar' : 'Crear insumo'}
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
                <select value={moveForm.type} onChange={e => setMoveForm(p => ({ ...p, type: e.target.value, purchaseCost: '' }))}>
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
                <input
                  type="number"
                  value={moveForm.purchaseCost}
                  onChange={e => setMoveForm(p => ({ ...p, purchaseCost: e.target.value }))}
                  onFocus={numFocus}
                  placeholder={`Actual: ${fmtDec(moveModal.cost || 0)}`}
                  min="0"
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
              <label>Nota / Referencia</label>
              <input type="text" value={moveForm.note} onChange={e => setMoveForm(p => ({ ...p, note: e.target.value }))} placeholder="Ej: Compra a proveedor X" />
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
