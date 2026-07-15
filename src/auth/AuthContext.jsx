import { createContext, useContext, useState, useCallback } from 'react'
import { can as canFn } from './permissions.js'
import { api, logAudit } from '../data/api.js'

const AuthCtx = createContext(null)
const SESSION_KEY = 'erp_gps_session'

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

function saveSession(u) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)) } catch (e) { /* ignore */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession)

  const login = useCallback((u) => {
    setUser(u)
    saveSession(u)
    logAudit(u.id, 'login', 'sessão', `Login como ${u.role}`)
  }, [])

  const loginAs = useCallback(async (role, email) => {
    let u
    try {
      const users = await api.users.list({ filter: { role } })
      u = (users || []).find((x) => x.active) || (users || [])[0]
    } catch (e) {
      console.warn('[auth] falha ao buscar usuários:', e.message)
    }
    if (!u) {
      u = { id: 'u_demo', name: 'Usuário Demo', role, email: email || 'demo@gpsrastreamento.com' }
    }
    setUser(u)
    saveSession(u)
    logAudit(u.id, 'login', 'sessão', `Login como ${role}`)
    return u
  }, [])

  const logout = useCallback(() => {
    if (user) logAudit(user.id, 'logout', 'sessão', 'Saiu do sistema')
    setUser(null)
    try { localStorage.removeItem(SESSION_KEY) } catch (e) { /* ignore */ }
  }, [user])

  const can = useCallback((key) => (user ? canFn(user.role, key) : false), [user])

  return (
    <AuthCtx.Provider value={{ user, login, loginAs, logout, can }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
