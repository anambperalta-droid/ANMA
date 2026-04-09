import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { fmt, MOVE_TYPES, MOVE_CLS } from '../../lib/storage'

const EMPTY = { name: '', cat: '', unit: 'unidad', cost: '', stock: 0, minStock: 0, supplierId: '', notes: '' }

export default function Insumos() {
  const { get, config, saveEntity, deleteEntity, recordStockMove } = useData()
  const toast = useToast()
  const c = config()
  const cats = c.insumoCats || []
  const units = c.units || ['unidad','kg','litro','metro','caja','pack','rollo']

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [moveModal, setMoveModal] = useState(null) // insumo for stock movement
  const [form, setForm] = useState({ ...EMPTY })
  const [moveForm, setMoveForm] = useState({ type: 'in', qty: '', note: '' })
  const [tab, setTab] = useState('list') // list | moves

  const insumos = get('insumos', [])
  const suppliers = get('suppliers', [])
  const stockMoves = get('stockMoves', [])

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const filtered = useMemo(() => {
    let f = insumos
    if (catFilter !== 'all') f = f.filter(x => x.cat === catFilter)
    if (search) {
      const s = search.toLowerCase()
      f = f.filter(x => x.name.toLowerCase().includes(s) || (x.cat || '').toLowerCase().includes(s))
    }
    return f.sort((a, b) => (b.id || 0) - (a.id || 0))
  }, [insumos, catFilter, search])

  const lowStock = insumos.filter(x => x.minStock > 0 && (x.stock || 0) <= x.minStock)
  const totalValue = insumos.reduce((s, x) => s + (x.stock || 0) * (Number(x.cost) || 0), 0)

  const openNew = () => { setForm({ ...EMPTY, cat: cats[0] || '' }); setModal(true) }
  const openEdit = (item) => { setForm({ ...item }); setModal(true) }

  const save = () => {
    if (!form.name) { toast('Ingresá un nombre', 'er'); return }
    saveEntity('insumos', { ...form, cost: Number(form.cost) || 0, stock: Number(form.stock) || 0, minStock: Number(form.minStock) || 0 })
    setModal(false)
    toast(form.id ? 'Insumo actualizado' : 'Insumo creado', 'ok')
  }

  const remove = (id) => {
    if (window.confirm('¿Eliminar este insumo?')) { deleteEntity('insumos', id); toast('Eliminado', 'in') }
  }

  const openMove = (item) => { setMoveModal(item); setMoveForm({ type: 'in', qty: '', note: '' }) }

  const saveMove = () => {
    if (!moveForm.qty || Number(moveForm.qty) <= 0) { toast('Ingresá una cantidad válida', 'er'); return }
    recordStockMove({
      type: moveForm.type,
      insumoId: moveModal.id,
      qty: Number(moveForm.qty),
      note: moveForm.note || moveModal.name,
      ref: moveModal.name,
    })
    setMoveModal(null)
    toast('Movimiento registrado', 'ok')
  }

  const insumoMoves = useMemo(() => {
    return stockMoves.filter(m => m.insumoId).sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 100)
  }, [stockMoves])

  const supplierName = (id) => { const s = suppliers.find(x => x.id === id); return s ? s.name : '—' }

  return (
    <div className="page active" style={{ animation: 'pgIn .25s ease both' }}>
      <div className="ph">
        <div className="ph-left">
          <h2>Insumos y Materias Primas</h2>
          <p>{insumos.length} insumos · Valor total en stock: {fmt(totalValue)}</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-primary btn-sm" onClick={openNew}><i className="fa fa-plus" /> Nuevo insumo</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="bento" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        <div className="bento-kpi">
          <div className="bk-label">Total insumos</div>
          <div className="bk-val">{insumos.length}</div>
        </div>
        <div className="bento-kpi">
          <div className="bk-label">Valor en stock</div>
          <div className="bk-val">{fmt(totalValue)}</div>
        </div>
        <div className="bento-kpi">
          <div className="bk-label">Stock bajo</div>
          <div className="bk-val" style={{ color: lowStock.length > 0 ? 'var(--red)' : 'var(--green)' }}>{lowStock.length}</div>
        </div>
        <div className="bento-kpi">
          <div className="bk-label">Categorías</div>
          <div className="bk-val">{cats.length}</div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ background: 'var(--red-lt)', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa fa-triangle-exclamation" />
          <span><b>{lowStock.length} insumo{lowStock.length > 1 ? 's' : ''}</b> con stock bajo o agotado: {lowStock.slice(0, 5).map(x => x.name).join(', ')}{lowStock.length > 5 ? '...' : ''}</span>
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
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-row" style={{ maxWidth: 280 }}>
              <i className="fa fa-magnifying-glass" />
              <input type="text" placeholder="Buscar insumo..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="f-inp" style={{ maxWidth: 200 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Proveedor</th>
                  <th style={{ textAlign: 'right' }}>Costo</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                  <th style={{ textAlign: 'center' }}>Mín.</th>
                  <th style={{ textAlign: 'center' }}>Unidad</th>
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
                    <tr key={item.id} style={isLow ? { background: 'var(--red-lt)' } : undefined}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td><span className="badge b-draft">{item.cat || '—'}</span></td>
                      <td style={{ fontSize: 11 }}>{supplierName(item.supplierId)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item.cost)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--txt)' }}>
                        {item.stock || 0}
                        {isLow && <i className="fa fa-triangle-exclamation" style={{ color: 'var(--red)', marginLeft: 4, fontSize: 10 }} />}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--txt3)' }}>{item.minStock || '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 11 }}>{item.unit || 'unidad'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt((item.stock || 0) * (Number(item.cost) || 0))}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="act" title="Movimiento de stock" onClick={() => openMove(item)}><i className="fa fa-arrows-rotate" /></button>
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
        </>
      )}

      {tab === 'moves' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Insumo / Producto</th>
                <th style={{ textAlign: 'center' }}>Cantidad</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {insumoMoves.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--txt3)' }}>
                  Sin movimientos registrados
                </td></tr>
              )}
              {insumoMoves.map(m => (
                <tr key={m.id}>
                  <td style={{ fontSize: 11 }}>{m.date}</td>
                  <td><span className={`badge ${MOVE_CLS[m.type] || 'b-draft'}`}>{MOVE_TYPES[m.type] || m.type}</span></td>
                  <td style={{ fontWeight: 600 }}>{m.ref || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: (m.type === 'in' || m.type === 'return') ? 'var(--green)' : 'var(--red)' }}>
                    {(m.type === 'in' || m.type === 'return') ? '+' : '-'}{m.qty}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--txt3)' }}>{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: crear/editar insumo */}
      {modal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="mh"><h3>{form.id ? 'Editar insumo' : 'Nuevo insumo'}</h3><button className="mclose" onClick={() => setModal(false)}><i className="fa fa-xmark" /></button></div>
            <div className="grid2">
              <div className="fg"><label>Nombre *</label><input type="text" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ej: Tela algodón 180gr" /></div>
              <div className="fg"><label>Categoría</label>
                <select value={form.cat} onChange={e => setF('cat', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="fg"><label>Costo unitario</label><input type="number" value={form.cost} onChange={e => setF('cost', e.target.value)} placeholder="0" /></div>
              <div className="fg"><label>Unidad de medida</label>
                <select value={form.unit} onChange={e => setF('unit', e.target.value)}>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="fg"><label>Stock actual</label><input type="number" value={form.stock} onChange={e => setF('stock', e.target.value)} placeholder="0" /></div>
              <div className="fg"><label>Stock mínimo (alerta)</label><input type="number" value={form.minStock} onChange={e => setF('minStock', e.target.value)} placeholder="0" /></div>
              <div className="fg" style={{ gridColumn: 'span 2' }}><label>Proveedor</label>
                <select value={form.supplierId || ''} onChange={e => setF('supplierId', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Sin proveedor asignado</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="fg"><label>Notas</label><textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Observaciones internas..." /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={save}><i className="fa fa-floppy-disk" /> {form.id ? 'Guardar' : 'Crear insumo'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: movimiento de stock */}
      {moveModal && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setMoveModal(null) }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="mh"><h3>Movimiento de stock</h3><button className="mclose" onClick={() => setMoveModal(null)}><i className="fa fa-xmark" /></button></div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa fa-box" style={{ color: 'var(--brand)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{moveModal.name}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Stock actual: <b>{moveModal.stock || 0}</b> {moveModal.unit || 'unidad'}</div>
              </div>
            </div>
            <div className="grid2">
              <div className="fg"><label>Tipo de movimiento</label>
                <select value={moveForm.type} onChange={e => setMoveForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="in">Ingreso (+)</option>
                  <option value="out">Egreso (-)</option>
                  <option value="adjust">Ajuste (=)</option>
                  <option value="return">Devolución (+)</option>
                </select>
              </div>
              <div className="fg"><label>Cantidad</label><input type="number" value={moveForm.qty} onChange={e => setMoveForm(p => ({ ...p, qty: e.target.value }))} placeholder="0" min="0" /></div>
            </div>
            <div className="fg"><label>Nota / Referencia</label><input type="text" value={moveForm.note} onChange={e => setMoveForm(p => ({ ...p, note: e.target.value }))} placeholder="Ej: Compra a proveedor X" /></div>
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
