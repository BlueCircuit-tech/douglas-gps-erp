import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  DollarSign, AlertTriangle, TrendingUp, TrendingDown, Wallet, Users,
  ClipboardList, Receipt, ArrowUpRight, UserPlus, FileText, Boxes, Calendar,
} from 'lucide-react'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDateTime, isOverdue, daysUntil } from '../lib/format.js'
import { PageHead, Card, CardHead, Stat, Badge, Avatar } from '../components/ui.jsx'
import { ROLES } from '../data/seed.js'
import { mensalidadeTotal } from '../lib/recorrencia.js'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#06b6d4']

export default function Dashboard() {
  const { db } = useCollections(['contasReceber', 'contasPagar', 'clients', 'ordens', 'boletos', 'planos', 'auditLogs', 'users'])
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [dataInicial, setDataInicial] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
  })
  const [dataFinal, setDataFinal] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]
  })

  const k = useMemo(() => {
    const cr = (db.contasReceber || []).filter((c) => c.status !== 'pago')
    const cp = (db.contasPagar || []).filter((c) => c.status !== 'pago')
    
    // Filtro para verificar se a data está dentro do período selecionado
    const inRange = (iso) => {
      if (!iso) return false;
      const dateStr = iso.slice(0, 10); // Pega apenas o YYYY-MM-DD
      return dateStr >= dataInicial && dateStr <= dataFinal;
    }

    const receberAtraso = cr.filter((c) => isOverdue(c.vencimento)).reduce((s, c) => s + c.valor, 0)
    const receberAbertoPeriodo = cr.filter((c) => !isOverdue(c.vencimento) && inRange(c.vencimento)).reduce((s, c) => s + c.valor, 0)
    const pagarAtraso = cp.filter((c) => isOverdue(c.vencimento)).reduce((s, c) => s + c.valor, 0)
    const pagarAbertoPeriodo = cp.filter((c) => !isOverdue(c.vencimento) && inRange(c.vencimento)).reduce((s, c) => s + c.valor, 0)

    const receitaPeriodo = (db.contasReceber || []).filter((c) => c.status === 'pago' && inRange(c.pagoEm)).reduce((s, c) => s + c.valor, 0)
    const clientesAtivos = (db.clients || []).filter((c) => c.status === 'ativo').length
    const osAbertas = (db.ordens || []).filter((o) => o.status !== 'concluida' && o.status !== 'cancelada').length
    const boletosPend = (db.boletos || []).filter((b) => b.status !== 'pago').length

    return { 
      receberAtraso, receberAbertoPeriodo, pagarAtraso, pagarAbertoPeriodo, 
      receitaPeriodo, clientesAtivos, osAbertas, boletosPend 
    }
  }, [db, dataInicial, dataFinal]) 

  // Receita x Despesa (mock mantido para o gráfico de linha)
  const fluxo = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']
    const base = k.receitaPeriodo || 12000
    return meses.map((m, i) => ({
      mes: m,
      receita: Math.round(base * (0.7 + i * 0.06)),
      despesa: Math.round(base * (0.45 + i * 0.03)),
    }))
  }, [k.receitaPeriodo])

  const porPlano = useMemo(() => {
    const map = {}
    ;(db.clients || []).filter((c) => c.ativo).forEach((c) => {
      const p = (db.planos || []).find((p) => p.id === c.planoId)
      const nome = p?.nome || 'Outro'
      map[nome] = (map[nome] || 0) + mensalidadeTotal(c)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [db])

  const recentes = (db.auditLogs || []).slice(0, 6)
  const venceProximos = useMemo(() =>
    (db.contasReceber || [])
      .filter((c) => c.status !== 'pago')
      .map((c) => ({ ...c, dias: daysUntil(c.vencimento) }))
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5),
  [db])

  const atalhos = [
    { label: 'Novo cliente', icon: UserPlus, to: '/clientes', mod: 'clientes' },
    { label: 'Nova OS', icon: ClipboardList, to: '/os', mod: 'os' },
    { label: 'Emitir boleto', icon: Receipt, to: '/boletos', mod: 'boletos' },
    { label: 'Novo contrato', icon: FileText, to: '/contratos', mod: 'contratos' },
  ]

  return (
    <>
      <PageHead
        title={`Olá, ${user?.name?.split(' ')[0]} 👋`}
        subtitle={`Visão geral · ${ROLES[user?.role]?.label}`}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--mut)' }}>Período:</span>
          <input 
            type="date" 
            className="input" 
            style={{ padding: '6px', fontSize: '13px' }}
            value={dataInicial} 
            onChange={(e) => setDataInicial(e.target.value)} 
          />
          <span style={{ fontSize: '13px', color: 'var(--mut)' }}>até</span>
          <input 
            type="date" 
            className="input" 
            style={{ padding: '6px', fontSize: '13px' }}
            value={dataFinal} 
            onChange={(e) => setDataFinal(e.target.value)} 
          />
        </div>
      </PageHead>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat tone="red" icon={<AlertTriangle size={19} />} label="A receber em atraso" value={BRL(k.receberAtraso)} />
        <Stat tone="amber" icon={<Wallet size={19} />} label="A receber no período" value={BRL(k.receberAbertoPeriodo)} />
        <Stat tone="red" icon={<TrendingDown size={19} />} label="A pagar em atraso" value={BRL(k.pagarAtraso)} />
        <Stat tone="blue" icon={<DollarSign size={19} />} label="A pagar no período" value={BRL(k.pagarAbertoPeriodo)} />
      </div>

      <div className="grid grid-4">
        <Stat tone="green" icon={<Users size={19} />} label="Clientes ativos" value={k.clientesAtivos} />
        <Stat tone="amber" icon={<ClipboardList size={19} />} label="OS em aberto" value={k.osAbertas} />
        <Stat tone="purple" icon={<Receipt size={19} />} label="Boletos pendentes" value={k.boletosPend} />
        <Stat tone="blue" icon={<DollarSign size={19} />} label="Receita no período" value={BRL(k.receitaPeriodo)} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 16 }}>
        <Card>
          <CardHead title="Receita x Despesa" sub="Últimos 6 meses" />
          <div className="card-pad" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fluxo} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} /><stop offset="95%" stopColor="#dc2626" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => BRL(v)} />
                <Legend />
                <Area type="monotone" dataKey="receita" name="Receita" stroke="#16a34a" fill="url(#gR)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#dc2626" fill="url(#gD)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead title="Receita por plano" sub="Mensalidades ativas" />
          <div className="card-pad" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porPlano} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
                  {porPlano.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => BRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 16 }}>
        <Card>
          <CardHead title="Próximos vencimentos" sub="Contas a receber" icon={<Wallet size={18} />} />
          <div style={{ padding: '4px 0' }}>
            {venceProximos.map((c) => {
              const cli = (db.clients || []).find((x) => x.id === c.clientId)
              return (
                <div key={c.id} className="between" style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div className="bold" style={{ fontSize: 13 }}>{cli?.nomeFantasia || cli?.razaoSocial}</div>
                    <div className="mut" style={{ fontSize: 12 }}>{c.descricao}</div>
                  </div>
                  <div className="right">
                    <div className="bold mono">{BRL(c.valor)}</div>
                    <Badge tone={c.dias < 0 ? 'red' : c.dias <= 5 ? 'amber' : 'gray'}>
                      {c.dias < 0 ? `${Math.abs(c.dias)}d atrasado` : c.dias === 0 ? 'Hoje' : `${c.dias}d`}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHead title="Atividades recentes" sub="Auditoria" icon={<ClipboardList size={18} />} />
          <div style={{ padding: '14px 18px' }}>
            <div className="timeline">
              {recentes.map((a) => {
                const u = (db.users || []).find((x) => x.id === a.userId)
                return (
                  <div key={a.id} className="timeline-item">
                    <div className="bold" style={{ fontSize: 13 }}>{a.detalhe}</div>
                    <div className="mut" style={{ fontSize: 12 }}>{u?.name || 'Sistema'} · {fmtDateTime(a.data)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Atalhos rápidos" icon={<ArrowUpRight size={18} />} />
          <div className="card-pad grid grid-2">
            {atalhos.map((a) => (
              <button key={a.label} className="btn" style={{ flexDirection: 'column', height: 90, gap: 8 }} onClick={() => navigate(a.to)}>
                <a.icon size={22} color="var(--brand)" />
                <span style={{ fontSize: 12.5 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}