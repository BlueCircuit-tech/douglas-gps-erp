// ============================================================
// UI KIT — primitivas reutilizadas por todas as páginas.
// Importe daqui; classes CSS vivem em styles.css.
// ============================================================
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X, Inbox, Check } from 'lucide-react'
import { initials } from '../lib/format.js'

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="spacer" />
      <div className="flex gap-8 wrap">{children}</div>
    </div>
  )
}

export function Card({ children, className = '', pad = false, style }) {
  return <div className={`card ${pad ? 'card-pad' : ''} ${className}`} style={style}>{children}</div>
}

export function CardHead({ title, sub, icon, children }) {
  return (
    <div className="card-head">
      {icon}
      <div>
        <h3>{title}</h3>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      <div className="spacer" />
      <div className="flex gap-8">{children}</div>
    </div>
  )
}

export function Btn({ children, variant = '', size = '', icon, className = '', ...rest }) {
  const v = variant ? `btn-${variant}` : ''
  const s = size === 'sm' ? 'btn-sm' : ''
  return (
    <button className={`btn ${v} ${s} ${className}`} {...rest}>
      {icon}{children}
    </button>
  )
}

export function Badge({ tone = 'gray', children, dot = false }) {
  return <span className={`badge b-${tone}`}>{dot && <span className="dot" />}{children}</span>
}

export function Avatar({ name, sm = false }) {
  return <div className={`avatar ${sm ? 'sm' : ''}`}>{initials(name)}</div>
}

export function Stat({ icon, label, value, delta, deltaUp, tone = 'blue' }) {
  return (
    <Card pad>
      <div className="stat">
        <div className="stat-top">
          <div className="stat-ico" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>{icon}</div>
          <span className="label">{label}</span>
        </div>
        <div className="value">{value}</div>
        {delta != null && (
          <span className={`delta ${deltaUp ? 'delta-up' : 'delta-down'}`}>{delta}</span>
        )}
      </div>
    </Card>
  )
}

export function Field({ label, hint, children, required }) {
  return (
    <div className="field">
      {label && <label>{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function EmptyState({ icon, title, sub }) {
  return (
    <div className="empty-state">
      {icon || <Inbox size={40} />}
      <div className="bold" style={{ fontSize: 15, color: 'var(--text-soft)' }}>{title}</div>
      {sub && <div className="mut" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, icon, size = '', footer, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon}
          <h3>{title}</h3>
          <div className="spacer" />
          <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value }) {
  return <div className="progress"><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
}

// ---------- Toast ----------
const ToastCtx = createContext(null)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const toast = useCallback((msg, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setItems((s) => [...s, { id, msg, type }])
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {items.map((i) => (
          <div key={i.id} className={`toast ${i.type}`}><Check size={16} />{i.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx) || (() => {})

// Mapa de status → tom do Badge (reuso entre módulos)
export const STATUS_TONE = {
  ativo: 'green', inativo: 'gray', lead: 'blue',
  online: 'green', offline: 'gray', sem_sinal: 'red',
  disponivel: 'green', em_uso: 'blue', defeituoso: 'amber', cancelado: 'red',
  aberta: 'amber', em_andamento: 'blue', concluida: 'green', cancelada: 'red',
  aberto: 'amber', pago: 'green', paga: 'green', atrasado: 'red', vencido: 'red', pendente: 'amber',
  enviado: 'blue', assinado: 'green', emitida: 'green',
}
export const STATUS_LABEL = {
  em_uso: 'Em uso', em_andamento: 'Em andamento', sem_sinal: 'Sem sinal',
  disponivel: 'Disponível', concluida: 'Concluída', atrasado: 'Atrasado',
}
export function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || 'gray'
  const label = STATUS_LABEL[status] || (status ? status[0].toUpperCase() + status.slice(1) : '—')
  return <Badge tone={tone} dot>{label}</Badge>
}
