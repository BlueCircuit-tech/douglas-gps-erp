// Formatação BR (moeda, data, documentos)

export const BRL = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const num = (n) => (Number(n) || 0).toLocaleString('pt-BR')

export const pct = (n) => `${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

// Datas chegam como ISO 'YYYY-MM-DD' — formata sem fuso para não "voltar um dia".
export const fmtDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (isNaN(dt)) return fmtDate(iso)
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Dias até o vencimento (negativo = atrasado). Compara só a parte de data.
export const daysUntil = (iso, today) => {
  if (!iso) return null
  const ref = today ? new Date(today + 'T00:00:00') : startOfToday()
  const target = new Date(String(iso).slice(0, 10) + 'T00:00:00')
  return Math.round((target - ref) / 86400000)
}

export const isOverdue = (iso, today) => {
  const d = daysUntil(iso, today)
  return d !== null && d < 0
}

// Hoje fixo do "sistema" — em protótipo evita depender de Date.now em testes.
// Usa a data real do navegador no app.
export function startOfToday() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}
export const todayISO = () => {
  const n = startOfToday()
  const p = (x) => String(x).padStart(2, '0')
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((s) => s[0] || '').join('').toUpperCase()

export const maskDoc = (v = '') => {
  const d = String(v).replace(/\D/g, '')
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) => `${a}.${b}.${c}${e ? '-' + e : ''}`)
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, e, f) => `${a}.${b}.${c}/${e}${f ? '-' + f : ''}`)
}

export const maskPhone = (v = '') => {
  const d = String(v).replace(/\D/g, '')
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`
