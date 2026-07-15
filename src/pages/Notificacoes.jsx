import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, AlertTriangle, Receipt, DollarSign, Wallet, Smartphone,
  Wrench, Cake, MessageCircle, CheckCircle2, Check,
} from 'lucide-react'
import { api, clientName, userName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, daysUntil, isOverdue, todayISO, uid } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Stat, EmptyState, Segmented, useToast,
} from '../components/ui.jsx'

// Severidades → rótulo + tom do Badge/Stat.
const SEV = {
  alta:  { label: 'Alta',  tone: 'red' },
  media: { label: 'Média', tone: 'amber' },
  baixa: { label: 'Baixa', tone: 'blue' },
}
const SEV_ORDER = { alta: 0, media: 1, baixa: 2 }

const OS_TIPO = { instalacao: 'Instalação', manutencao: 'Manutenção', retirada: 'Retirada' }

// Ícone por tipo de alerta.
function alertIcon(tipo) {
  const p = { size: 18 }
  switch (tipo) {
    case 'boleto':      return <Receipt {...p} />
    case 'receber':     return <DollarSign {...p} />
    case 'pagar':       return <Wallet {...p} />
    case 'chips':       return <Smartphone {...p} />
    case 'os':          return <Wrench {...p} />
    case 'aniversario': return <Cake {...p} />
    default:            return <Bell {...p} />
  }
}

const diasAtraso = (iso) => Math.abs(daysUntil(iso) || 0)

export default function Notificacoes() {
  const { db, refetch } = useCollections(['boletos', 'contasReceber', 'contasPagar', 'chips', 'ordens', 'clients', 'users'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [lidas, setLidas] = useState(() => new Set())
  const [sevFilter, setSevFilter] = useState('todas')
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false)

  // ---------- Cálculo DINÂMICO dos alertas a partir do store ----------
  const alertas = useMemo(() => {
    const arr = []

    // 1) Boletos vencidos (status 'vencido' ou vencido por data e não pago) — ALTA
    ;(db.boletos || [])
      .filter((b) => b.status !== 'pago' && (b.status === 'vencido' || isOverdue(b.vencimento)))
      .forEach((b) => arr.push({
        id: `bol-${b.id}`, tipo: 'boleto', sev: 'alta',
        title: `Boleto vencido — ${clientName(b.clientId)}`,
        desc: `${BRL(b.valor)} · venceu em ${fmtDate(b.vencimento)} · ${diasAtraso(b.vencimento)} dia(s) em atraso`,
      }))

    // 2) Contas a receber em atraso — ALTA
    ;(db.contasReceber || [])
      .filter((c) => c.status !== 'pago' && isOverdue(c.vencimento))
      .forEach((c) => arr.push({
        id: `cr-${c.id}`, tipo: 'receber', sev: 'alta',
        title: `A receber em atraso — ${clientName(c.clientId)}`,
        desc: `${c.descricao} · ${BRL(c.valor)} · venceu em ${fmtDate(c.vencimento)}`,
      }))

    // 3) Contas a pagar em atraso — ALTA
    ;(db.contasPagar || [])
      .filter((c) => c.status !== 'pago' && isOverdue(c.vencimento))
      .forEach((c) => arr.push({
        id: `cp-${c.id}`, tipo: 'pagar', sev: 'alta',
        title: `A pagar em atraso — ${c.descricao}`,
        desc: `${BRL(c.valor)} · venceu em ${fmtDate(c.vencimento)} · ${diasAtraso(c.vencimento)} dia(s) em atraso`,
      }))

    // 4) Estoque baixo de chips (disponíveis < 4) — MÉDIA
    const chipsDisp = (db.chips || []).filter((c) => c.status === 'disponivel').length
    if (chipsDisp < 4) {
      arr.push({
        id: 'chips-low', tipo: 'chips', sev: 'media',
        title: 'Estoque baixo de chips',
        desc: `Apenas ${chipsDisp} chip(s) disponível(is) no estoque. Recomenda-se reposição (mínimo 4).`,
      })
    }

    // 5) OS atrasadas (não concluídas, abertas há mais de 3 dias) — MÉDIA
    ;(db.ordens || [])
      .filter((o) => o.status !== 'concluida' && o.status !== 'cancelada' && (daysUntil(o.abertaEm) || 0) <= -3)
      .forEach((o) => arr.push({
        id: `os-${o.id}`, tipo: 'os', sev: 'media', osId: o.id,
        title: `OS #${o.numero} atrasada — ${clientName(o.clientId)}`,
        desc: `${OS_TIPO[o.tipo] || o.tipo} · técnico ${userName(o.tecnicoId)} · aberta há ${diasAtraso(o.abertaEm)} dias`,
      }))

    // 6) Aniversários próximos (próximos 7 dias) — BAIXA / info (Tarefa 20)
    const hoje = todayISO()
    const ano = +hoje.slice(0, 4)
    ;(db.clients || []).forEach((c) => {
      if (!c.aniversario) return
      const md = String(c.aniversario).slice(5, 10) // 'MM-DD'
      let d = daysUntil(`${ano}-${md}`, hoje)
      if (d != null && d < 0) d = daysUntil(`${ano + 1}-${md}`, hoje)
      if (d == null || d < 0 || d > 7) return
      const quando = d === 0 ? 'é hoje!' : d === 1 ? 'é amanhã' : `em ${d} dias`
      arr.push({
        id: `bday-${c.id}`, tipo: 'aniversario', sev: 'baixa', clientId: c.id,
        title: `Aniversário ${quando} — ${clientName(c.id)}`,
        desc: `${md.split('-').reverse().join('/')} · envie uma mensagem automática de parabéns.`,
      })
    })

    return arr.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev])
  }, [db])

  // ---------- KPIs ----------
  const kpi = useMemo(() => ({
    total: alertas.length,
    alta: alertas.filter((a) => a.sev === 'alta').length,
    media: alertas.filter((a) => a.sev === 'media').length,
    baixa: alertas.filter((a) => a.sev === 'baixa').length,
    naoLidas: alertas.filter((a) => !lidas.has(a.id)).length,
  }), [alertas, lidas])

  // ---------- Lista filtrada ----------
  const visiveis = useMemo(() => {
    let l = alertas
    if (sevFilter !== 'todas') l = l.filter((a) => a.sev === sevFilter)
    if (apenasNaoLidas) l = l.filter((a) => !lidas.has(a.id))
    return l
  }, [alertas, sevFilter, apenasNaoLidas, lidas])

  // ---------- Ações ----------
  const marcarLida = (id) => setLidas((s) => new Set(s).add(id))

  const lerAlerta = (id) => { marcarLida(id); toast('Alerta marcado como lido') }

  const marcarTodos = () => {
    if (!kpi.naoLidas) return
    setLidas(new Set(alertas.map((a) => a.id)))
    toast('Todos os alertas marcados como lidos')
  }

  const parabenizar = async (a) => {
    try {
      await api.interacoes.insert({
        id: uid('in'), clientId: a.clientId, canal: 'whatsapp',
        descricao: 'Mensagem automática de aniversário enviada: "Parabéns! A equipe GPS Rastreamento deseja um feliz aniversário."',
        data: new Date().toISOString(),
      })
      logAudit(user.id, 'enviar', 'mensagem', `Mensagem de aniversário para ${clientName(a.clientId)}`)
      toast('Mensagem de aniversário enviada')
      marcarLida(a.id)
      refetch()
    } catch (e) {
      toast('Erro ao enviar mensagem: ' + e.message, 'error')
    }
  }

  // Botão de ação contextual por tipo.
  const renderAcao = (a) => {
    switch (a.tipo) {
      case 'boleto':
        return <Btn size="sm" icon={<Receipt size={14} />} onClick={() => navigate('/boletos')}>Ver boletos</Btn>
      case 'receber':
        return <Btn size="sm" icon={<DollarSign size={14} />} onClick={() => navigate('/financeiro')}>Ver financeiro</Btn>
      case 'pagar':
        return <Btn size="sm" icon={<Wallet size={14} />} onClick={() => navigate('/financeiro')}>Ver contas</Btn>
      case 'chips':
        return <Btn size="sm" icon={<Smartphone size={14} />} onClick={() => navigate('/estoque')}>Ver estoque</Btn>
      case 'os':
        return <Btn size="sm" icon={<Wrench size={14} />} onClick={() => navigate(`/os/${a.osId}`)}>Abrir OS</Btn>
      case 'aniversario':
        return (
          <>
            <Btn size="sm" variant="ghost" onClick={() => navigate(`/clientes/${a.clientId}`)}>Ver cliente</Btn>
            <Btn size="sm" variant="green" icon={<MessageCircle size={14} />} onClick={() => parabenizar(a)}>Enviar parabéns</Btn>
          </>
        )
      default:
        return null
    }
  }

  return (
    <>
      <PageHead title="Notificações & Alertas" subtitle={`${kpi.naoLidas} não lida(s) · alertas calculados em tempo real`}>
        <Btn icon={<CheckCircle2 size={16} />} onClick={marcarTodos} disabled={!kpi.naoLidas}>
          Marcar todos como lidos
        </Btn>
      </PageHead>

      {/* KPIs por severidade */}
      <div className="grid grid-4">
        <Stat tone="blue" icon={<Bell size={19} />} label="Total de alertas" value={kpi.total} />
        <Stat tone="red" icon={<AlertTriangle size={19} />} label="Alta prioridade" value={kpi.alta} />
        <Stat tone="amber" icon={<Wrench size={19} />} label="Média prioridade" value={kpi.media} />
        <Stat tone="green" icon={<Cake size={19} />} label="Baixa / informativos" value={kpi.baixa} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="card-head">
          <CardHead title="Central de alertas" sub={`${visiveis.length} exibido(s)`} icon={<Bell size={18} />} />
          <div className="spacer" />
          <Btn
            size="sm"
            variant={apenasNaoLidas ? 'primary' : 'ghost'}
            icon={<Check size={14} />}
            onClick={() => setApenasNaoLidas((v) => !v)}
          >
            Apenas não lidas
          </Btn>
          <Segmented
            value={sevFilter}
            onChange={setSevFilter}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'alta', label: 'Alta' },
              { value: 'media', label: 'Média' },
              { value: 'baixa', label: 'Baixa' },
            ]}
          />
        </div>

        <div style={{ padding: '4px 0' }}>
          {visiveis.map((a) => {
            const sev = SEV[a.sev]
            const lida = lidas.has(a.id)
            return (
              <div
                key={a.id}
                className="between"
                style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', opacity: lida ? 0.5 : 1 }}
              >
                <div className="flex gap-12" style={{ alignItems: 'center', minWidth: 0 }}>
                  <div className="stat-ico" style={{ background: `var(--${sev.tone}-bg)`, color: `var(--${sev.tone})`, flexShrink: 0 }}>
                    {alertIcon(a.tipo)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="flex gap-8" style={{ alignItems: 'center' }}>
                      <span className="bold" style={{ fontSize: 13.5 }}>{a.title}</span>
                      <Badge tone={sev.tone} dot>{sev.label}</Badge>
                      {lida && <span className="mut" style={{ fontSize: 11.5 }}>· lido</span>}
                    </div>
                    <div className="mut" style={{ fontSize: 12.5, marginTop: 2 }}>{a.desc}</div>
                  </div>
                </div>
                <div className="flex gap-8" style={{ flexShrink: 0 }}>
                  {renderAcao(a)}
                  {!lida && (
                    <Btn size="sm" variant="ghost" icon={<Check size={14} />} onClick={() => lerAlerta(a.id)}>
                      Marcar lida
                    </Btn>
                  )}
                </div>
              </div>
            )
          })}

          {!visiveis.length && (
            <EmptyState
              icon={<CheckCircle2 size={40} />}
              title={alertas.length ? 'Nenhum alerta com esse filtro' : 'Tudo em dia!'}
              sub={alertas.length ? 'Ajuste os filtros para ver outros alertas.' : 'Nenhum alerta pendente no momento.'}
            />
          )}
        </div>
      </Card>
    </>
  )
}
