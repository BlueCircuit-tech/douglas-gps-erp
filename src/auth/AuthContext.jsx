import { createContext, useContext, useState, useCallback } from 'react'
import { can as canFn } from './permissions.js'
import { getDb, actions } from '../data/store.js'

const AuthCtx = createContext(null)
const SESSION_KEY = 'erp_gps_session'

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession)

  const login = useCallback((u) => {
    setUser(u)
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)) } catch (e) {}
    actions.log(u.id, 'login', 'sessão', `Login como ${u.role}`)
  }, [])

  // Login por perfil escolhido na tela: pega o 1º usuário daquele perfil.
  const loginAs = useCallback((role) => {
    const db = getDb()
    const u = (db.users || []).find((x) => x.role === role && x.active) ||
      { id: 'u_demo', name: 'Usuário Demo', role, email: 'demo@gpsrastreamento.com' }
    setUser(u)
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)) } catch (e) {}
    actions.log(u.id, 'login', 'sessão', `Login como ${role}`)
  }, [])

  const logout = useCallback(() => {
    if (user) actions.log(user.id, 'logout', 'sessão', 'Saiu do sistema')
    setUser(null)
    try { localStorage.removeItem(SESSION_KEY) } catch (e) {}
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
