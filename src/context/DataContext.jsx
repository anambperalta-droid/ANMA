import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { db, dbW, cfg, wCfg, ensureDefaults } from '../lib/storage'
import { logAudit } from '../lib/audit'

const Ctx = createContext()

// Monotonic unique-ID generator — never collides, even within the same millisecond
let __idSeed = Date.now()
const nextId = () => { __idSeed += 1; return __idSeed }

export function DataProvider({ children }) {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  ensureDefaults()

  useEffect(() => {
    const h = () => refresh()
    window.addEventListener('anma:synced', h)
    return () => window.removeEventListener('anma:synced', h)
  }, [refresh])

  // Synchronous ID migration — runs before first render so selections/deletes never hit duplicate/missing IDs
  useState(() => {
    ;['suppliers', 'products', 'clients', 'insumos', 'budgets'].forEach(key => {
      const list = db(key, [])
      const seen = new Set()
      let changed = false
      const fixed = list.map(item => {
        if (!item.id || seen.has(item.id)) {
          item = { ...item, id: nextId() }
          changed = true
        }
        seen.add(item.id)
        return item
      })
      if (changed) dbW(key, fixed)
    })
    ;['suppliers', 'products', 'clients', 'insumos', 'budgets'].forEach(key => {
      db(key, []).forEach(it => { if (typeof it.id === 'number' && it.id >= __idSeed) __idSeed = it.id + 1 })
    })
    return true
  })

  const get = useCallback((key, fallback = []) => db(key, fallback), [tick])
  const set = useCallback((key, val) => { dbW(key, val); refresh() }, [refresh])

  const config = useCallback(() => cfg(), [tick])
  const updateConfig = useCallback((patch) => { wCfg(patch); refresh() }, [refresh])

  /* ── Pedido / Venta (ex-budget) ── */
  const saveBudget = useCallback((bData) => {
    const bud = db('budgets', [])
    const c = cfg()
    if (bData.id) {
      const i = bud.findIndex((b) => b.id === bData.id)
      if (i > -1) bud[i] = { ...bud[i], ...bData }
    } else {
      const num = c.nextNum || 1
      bData.id = nextId()
      bData.num = `${c.budgetPrefix || 'AN'}-${String(num).padStart(4, '0')}`
      bData.date = new Date().toISOString().slice(0, 10)
      bud.push(bData)
      wCfg({ nextNum: num + 1 })
    }
    dbW('budgets', bud)
    refresh()
    logAudit(bData.id ? 'update' : 'create', 'budget', bData.id, { num: bData.num, total: bData.total })
    return bData
  }, [refresh])

  const deleteBudget = useCallback((id) => {
    const existing = db('budgets', []).find(b => b.id === id)
    dbW('budgets', db('budgets', []).filter((b) => b.id !== id))
    refresh()
    logAudit('delete', 'budget', id, existing ? { num: existing.num, total: existing.total } : null)
  }, [refresh])

  const updateBudgetStatus = useCallback((id, status) => {
    const bud = db('budgets', [])
    const i = bud.findIndex((b) => b.id === id)
    if (i > -1) { bud[i].status = status; dbW('budgets', bud) }
    refresh()
    logAudit('status_change', 'budget', id, { status })
  }, [refresh])

  /* ── CRUD genérico ── */
  const saveEntity = useCallback((key, item) => {
    const list = db(key, [])
    const wasExisting = item.id && list.some(x => x.id === item.id)
    if (item.id) {
      const i = list.findIndex((x) => x.id === item.id)
      if (i > -1) {
        list[i] = { ...list[i], ...item }
      } else {
        list.push(item)
      }
    } else {
      item.id = nextId()
      list.push(item)
    }
    dbW(key, list)
    refresh()
    logAudit(wasExisting ? 'update' : 'create', key, item.id, { name: item.name || item.title || null })
    return item
  }, [refresh])

  const deleteEntity = useCallback((key, id) => {
    const existing = db(key, []).find(x => x.id === id)
    dbW(key, db(key, []).filter((x) => x.id !== id))
    refresh()
    logAudit('delete', key, id, existing ? { name: existing.name || existing.title || null } : null)
  }, [refresh])

  /* ── Stock: movimientos de inventario ── */
  const recordStockMove = useCallback((move) => {
    // Save the movement record
    const moves = db('stockMoves', [])
    if (!move.id) move.id = Date.now() + Math.floor(Math.random() * 99991)
    move.date = move.date || new Date().toISOString().slice(0, 10)
    moves.push(move)
    dbW('stockMoves', moves)

    // Update insumo stock
    if (move.insumoId) {
      const insumos = db('insumos', [])
      const idx = insumos.findIndex(x => x.id === move.insumoId)
      if (idx > -1) {
        const qty = Number(move.qty) || 0
        if (move.type === 'in' || move.type === 'return') {
          const currentStock = insumos[idx].stock || 0
          const currentCost = Number(insumos[idx].cost) || 0
          const purchaseCost = Number(move.purchaseCost)
          if (!isNaN(purchaseCost) && purchaseCost > 0 && currentStock + qty > 0) {
            insumos[idx].cost = ((currentStock * currentCost) + (qty * purchaseCost)) / (currentStock + qty)
          }
          insumos[idx].stock = currentStock + qty
        } else if (move.type === 'out' || move.type === 'sale') {
          insumos[idx].stock = Math.max(0, (insumos[idx].stock || 0) - qty)
        } else if (move.type === 'adjust') {
          insumos[idx].stock = qty // set absolute value
        }
        insumos[idx].lastMove = move.date
        dbW('insumos', insumos)
      }
    }

    // Update product stock if productId provided
    if (move.productId) {
      const products = db('products', [])
      const idx = products.findIndex(x => x.id === move.productId)
      if (idx > -1) {
        const qty = Number(move.qty) || 0
        if (move.type === 'in' || move.type === 'return') {
          products[idx].stock = (products[idx].stock || 0) + qty
        } else if (move.type === 'out' || move.type === 'sale') {
          products[idx].stock = Math.max(0, (products[idx].stock || 0) - qty)
        } else if (move.type === 'adjust') {
          products[idx].stock = qty
        }
        products[idx].lastMove = move.date
        dbW('products', products)
      }
    }

    refresh()
    return move
  }, [refresh])

  /* ── Deducir stock al confirmar pedido ── */
  const deductStockForOrder = useCallback((items) => {
    // Read product catalog once to resolve insumo associations
    const allProducts = db('products', [])
    items.forEach(item => {
      if (!item.productId) return
      // 1. Deduct product stock
      recordStockMove({
        type: 'sale',
        productId: item.productId,
        qty: item.qty,
        ref: 'Venta',
        note: item.name,
      })
      // 2. Silently deduct associated insumo stocks (hidden from client)
      const prod = allProducts.find(p => p.id === item.productId)
      if (prod?.insumos?.length) {
        prod.insumos.forEach(ins => {
          if (!ins.insumoId || !ins.qtyNeeded) return
          recordStockMove({
            type: 'sale',
            insumoId: ins.insumoId,
            qty: Number(item.qty) * Number(ins.qtyNeeded),
            ref: 'Venta (insumo)',
            note: item.name,
          })
        })
      }
    })
  }, [recordStockMove])

  return (
    <Ctx.Provider value={{
      get, set, config, updateConfig, refresh, tick,
      saveBudget, deleteBudget, updateBudgetStatus,
      saveEntity, deleteEntity,
      recordStockMove, deductStockForOrder,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useData = () => useContext(Ctx)
