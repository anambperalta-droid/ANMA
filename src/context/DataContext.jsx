import { createContext, useContext, useState, useCallback } from 'react'
import { db, dbW, cfg, wCfg, ensureDefaults } from '../lib/storage'

const Ctx = createContext()

export function DataProvider({ children }) {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  ensureDefaults()

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
      bData.id = Date.now()
      bData.num = `${c.budgetPrefix || 'AN'}-${String(num).padStart(4, '0')}`
      bData.date = new Date().toISOString().slice(0, 10)
      bud.push(bData)
      wCfg({ nextNum: num + 1 })
    }
    dbW('budgets', bud)
    refresh()
    return bData
  }, [refresh])

  const deleteBudget = useCallback((id) => {
    dbW('budgets', db('budgets', []).filter((b) => b.id !== id))
    refresh()
  }, [refresh])

  const updateBudgetStatus = useCallback((id, status) => {
    const bud = db('budgets', [])
    const i = bud.findIndex((b) => b.id === id)
    if (i > -1) { bud[i].status = status; dbW('budgets', bud) }
    refresh()
  }, [refresh])

  /* ── CRUD genérico ── */
  const saveEntity = useCallback((key, item) => {
    const list = db(key, [])
    if (item.id) {
      const i = list.findIndex((x) => x.id === item.id)
      if (i > -1) list[i] = { ...list[i], ...item }
    } else {
      item.id = Date.now()
      list.push(item)
    }
    dbW(key, list)
    refresh()
    return item
  }, [refresh])

  const deleteEntity = useCallback((key, id) => {
    dbW(key, db(key, []).filter((x) => x.id !== id))
    refresh()
  }, [refresh])

  /* ── Stock: movimientos de inventario ── */
  const recordStockMove = useCallback((move) => {
    // Save the movement record
    const moves = db('stockMoves', [])
    if (!move.id) move.id = Date.now()
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
          insumos[idx].stock = (insumos[idx].stock || 0) + qty
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
    items.forEach(item => {
      if (item.productId) {
        recordStockMove({
          type: 'sale',
          productId: item.productId,
          qty: item.qty,
          ref: `Venta`,
          note: item.name,
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
