import { supabase } from './supabase'
import { db, dbW, setWriteHook } from './storage'

const SITE_KEY = 'anma-pro'
const DATA_KEYS = ['budgets', 'clients', 'suppliers', 'products', 'insumos', 'stockMoves', 'cfg']

function collectData() {
  const out = {}
  DATA_KEYS.forEach(k => { out[k] = db(k, k === 'cfg' ? {} : []) })
  return out
}

let _uid = null         // current auth user id
let _wsId = null        // workspace id (owner's user id) — resolved from memberships
let _role = null        // role in that workspace: 'owner' | 'operator' | 'viewer'
let _timer = null

/** Resolve the workspace the user belongs to.
 *  Rule: first active membership wins. Owners have their own workspace (workspace_id = user.id).
 *  Operators inherit the owner's workspace_id. */
async function resolveWorkspace(userId) {
  if (!userId) return { wsId: null, role: null }
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select('workspace_id, role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('[sync] membership resolve error', error.message)
      // Fallback: treat as own owner (legacy path, pre-Phase2 SQL migration).
      return { wsId: userId, role: 'owner' }
    }
    if (!data) {
      // No membership row — legacy user. Fallback to self-workspace.
      return { wsId: userId, role: 'owner' }
    }
    return { wsId: data.workspace_id, role: data.role }
  } catch (e) {
    console.warn('[sync] membership resolve failed', e?.message)
    return { wsId: userId, role: 'owner' }
  }
}

async function doPush() {
  if (!_uid || !_wsId) return
  // Viewers do not push.
  if (_role === 'viewer') return
  try {
    await supabase.from('anma_user_data').upsert({
      user_id: _wsId,              // workspace-scoped row (owner's id)
      site_key: SITE_KEY,
      data: collectData(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,site_key' })
  } catch (e) { console.warn('[sync] push failed', e?.message) }
}

export function initSync(userId) {
  _uid = userId
  if (!userId) {
    _wsId = null
    _role = null
    setWriteHook(null)
    return
  }
  // Resolve workspace async, then enable the write hook.
  resolveWorkspace(userId).then(({ wsId, role }) => {
    _wsId = wsId
    _role = role
    setWriteHook(() => { clearTimeout(_timer); _timer = setTimeout(doPush, 1500) })
  })
}

export async function pullFromCloud(userId) {
  if (!userId) return false
  try {
    const { wsId, role } = await resolveWorkspace(userId)
    _wsId = wsId
    _role = role
    if (!wsId) return false

    const { data, error } = await supabase
      .from('anma_user_data')
      .select('data')
      .eq('user_id', wsId)
      .eq('site_key', SITE_KEY)
      .single()
    if (error || !data?.data) return false
    DATA_KEYS.forEach(k => { if (data.data[k] !== undefined) dbW(k, data.data[k]) })
    window.dispatchEvent(new CustomEvent('anma:synced'))
    return true
  } catch (e) { console.warn('[sync] pull failed', e?.message); return false }
}

/** Expose current workspace context (read-only) for other modules (audit log, UI). */
export function getSyncContext() {
  return { userId: _uid, workspaceId: _wsId, role: _role }
}
