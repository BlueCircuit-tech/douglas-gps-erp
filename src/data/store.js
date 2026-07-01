// ============================================================
// STORE — estado global reativo com persistência em localStorage.
// API: useStore() devolve o db inteiro (referência estável entre
// mutações). Mutações: actions.add/patch/remove/set/log/reset.
// ============================================================
import { useSyncExternalStore } from 'react'
import { buildSeed } from './seed.js'
import { uid } from '../lib/format.js'

const KEY = 'erp_gps_db_v2'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.meta && parsed.meta.version === 2) return parsed
    }
  } catch (e) { /* ignore */ }
  const seed = buildSeed()
  persist(seed)
  return seed
}

function persist(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { /* quota */ }
}

let state = load()
const listeners = new Set()

function emit() {
  persist(state)
  listeners.forEach((l) => l())
}

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
const getSnapshot = () => state

// Hook principal — re-renderiza quando o db muda.
export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// Acesso direto (fora de componentes).
export const getDb = () => state

// ---------- Mutadores ----------
export const actions = {
  add(collection, item) {
    const withId = { id: item.id || uid(collection.slice(0, 2)), ...item }
    if (!withId.id) withId.id = uid('id')
    state = { ...state, [collection]: [withId, ...(state[collection] || [])] }
    emit()
    return withId
  },
  patch(collection, id, partial) {
    state = {
      ...state,
      [collection]: (state[collection] || []).map((x) => (x.id === id ? { ...x, ...partial } : x)),
    }
    emit()
  },
  remove(collection, id) {
    state = { ...state, [collection]: (state[collection] || []).filter((x) => x.id !== id) }
    emit()
  },
  set(collection, arr) {
    state = { ...state, [collection]: arr }
    emit()
  },
  // Registro de auditoria (Tarefa 13)
  log(userId, acao, entidade, detalhe) {
    const entry = { id: uid('lg'), userId, acao, entidade, detalhe, data: new Date().toISOString() }
    state = { ...state, auditLogs: [entry, ...(state.auditLogs || [])] }
    emit()
  },
  reset() {
    state = buildSeed()
    emit()
  },
}

// ---------- Seletores utilitários (puros) ----------
export const byId = (coll, id) => (state[coll] || []).find((x) => x.id === id)
export const userName = (id) => (byId('users', id)?.name) || '—'
export const clientName = (id) => {
  const c = byId('clients', id)
  return c ? (c.nomeFantasia || c.razaoSocial) : '—'
}
