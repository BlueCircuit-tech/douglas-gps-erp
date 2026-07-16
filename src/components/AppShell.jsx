import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Users, SquareKanban, ClipboardList, Wallet, Receipt,
  Coins, FileText, Calculator, Package, Layers, BarChart3, ShieldCheck, Bell,
  LifeBuoy, Search, LogOut, MapPin, ChevronDown, ExternalLink, Truck,
  Smartphone, Link2,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCollections } from '../hooks/useSupabase.js'
import { ROLES } from '../data/seed.js'
import { Avatar, Badge } from './ui.jsx'

// Navegação organizada por seções (Tarefas 40, 44, 45).
const NAV = [
  { section: 'Principal', items: [
    { key: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Comercial', items: [
    { key: 'clientes', to: '/clientes', label: 'Clientes', icon: Users },
    { key: 'fornecedores', to: '/fornecedores', label: 'Fornecedores', icon: Truck },
    { key: 'funil', to: '/funil', label: 'Funil de Vendas', icon: SquareKanban },
    { key: 'contratos', to: '/contratos', label: 'Contratos', icon: FileText },
    { key: 'comissoes', to: '/comissoes', label: 'Comissões', icon: Coins },
  ]},
  { section: 'Operação', items: [
    { key: 'os', to: '/os', label: 'Ordens de Serviço', icon: ClipboardList },
  ]},
  { section: 'Estoque', items: [
    { key: 'estoque', to: '/estoque/equipamentos', label: 'Equipamento', icon: Package },
    { key: 'estoque', to: '/estoque/chips', label: 'Chip', icon: Smartphone },
    { key: 'estoque', to: '/estoque/vinculos', label: 'Equipamento/Chip', icon: Link2 },
  ]},
  { section: 'Financeiro', items: [
    { key: 'financeiro', to: '/financeiro', label: 'Financeiro', icon: Wallet },
    { key: 'boletos', to: '/boletos', label: 'Boletos', icon: Receipt },
    { key: 'contabilidade', to: '/contabilidade', label: 'Contabilidade', icon: Calculator },
  ]},
  { section: 'Cadastros', items: [
    { key: 'produtos', to: '/produtos', label: 'Produtos e Serviços', icon: Package },
    { key: 'planos', to: '/planos', label: 'Planos', icon: Layers },
  ]},
  { section: 'Gestão', items: [
    { key: 'relatorios', to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { key: 'equipe', to: '/equipe', label: 'Equipe', icon: Users },
    { key: 'notificacoes', to: '/notificacoes', label: 'Notificações', icon: Bell },
    { key: 'auditoria', to: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
    { key: 'ajuda', to: '/ajuda', label: 'Central de Ajuda', icon: LifeBuoy },
  ]},
]

export default function AppShell({ children }) {
  const { user, can, logout } = useAuth()
  const { db } = useCollections(['ordens', 'notificacoes'])
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const role = ROLES[user?.role]
  const unread = (db.notificacoes || []).filter((n) => !n.lida).length
  const counts = {
    os: (db.ordens || []).filter((o) => o.status !== 'concluida' && o.status !== 'cancelada').length,
    notificacoes: unread,
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo"><MapPin size={19} /></div>
          <div>
            <b>GPS RASTREAMENTO</b>
            <span>ERP de Gestão</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((sec) => {
            const items = sec.items.filter((it) => can(it.key))
            if (!items.length) return null
            return (
              <div key={sec.section}>
                <div className="nav-section">{sec.section}</div>
                {items.map((it) => (
                  <NavLink key={it.to} to={it.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <it.icon size={18} />
                    <span>{it.label}</span>
                    {counts[it.key] > 0 && <span className="badge-count">{counts[it.key]}</span>}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user?.name} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{role?.label}</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search">
            <Search size={17} />
            <input placeholder="Buscar clientes, OS, boletos..." />
          </div>
          <div className="topbar-actions">
            <a className="btn btn-sm" href={db.meta?.homolog} target="_blank" rel="noreferrer" title="Abrir homologação">
              <ExternalLink size={15} /> Homologação
            </a>
            <NavLink to="/notificacoes" className="btn btn-ghost icon-btn" style={{ position: 'relative' }} title="Notificações">
              <Bell size={18} />
              {unread > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />}
            </NavLink>
            <div style={{ position: 'relative' }}>
              <button className="btn btn-ghost" onClick={() => setMenuOpen((v) => !v)} style={{ gap: 8 }}>
                <Avatar name={user?.name} sm />
                <span className="nowrap">{user?.name?.split(' ')[0]}</span>
                <ChevronDown size={15} />
              </button>
              {menuOpen && (
                <div className="card" style={{ position: 'absolute', right: 0, top: 44, width: 220, zIndex: 50, padding: 10 }} onMouseLeave={() => setMenuOpen(false)}>
                  <div style={{ padding: '6px 8px' }}>
                    <div className="bold">{user?.name}</div>
                    <div className="mut" style={{ fontSize: 12 }}>{user?.email}</div>
                    <div style={{ marginTop: 6 }}><Badge tone={role?.color?.replace('b-', '') || 'gray'}>{role?.label}</Badge></div>
                  </div>
                  <div className="divider" style={{ margin: '8px 0' }} />
                  <button className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { logout(); navigate('/login') }}>
                    <LogOut size={16} /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
