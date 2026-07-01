import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, TrendingUp, Coins, Target, Users, UserPlus } from 'lucide-react'
import { useStore, actions, userName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, pct, maskPhone, uid } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Stat, Field, Modal, EmptyState, useToast,
} from '../components/ui.jsx'
import { FUNNEL } from '../data/seed.js'

const emptyLead = () => ({ nome: '', whatsapp: '', valorMensal: 79.9, vendedorId: '' })

export default function Funil() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyLead)

  const vendedores = (db.users || []).filter((u) => u.role === 'vendedor')

  // Agrupa clientes por estágio do funil.
  const porStage = useMemo(() => {
    const map = {}
    FUNNEL.forEach((c) => { map[c.id] = [] })
    ;(db.clients || []).forEach((cli) => {
      const st = map[cli.stage] ? cli.stage : 'novo'
      ;(map[st] || (map[st] = [])).push(cli)
    })
    return map
  }, [db])

  // KPIs do topo.
  const kpis = useMemo(() => {
    const clients = db.clients || []
    const abertos = clients.filter((c) => c.stage !== 'fechado' && c.stage !== 'perdido')
    const pipeline = abertos.reduce((s, c) => s + (Number(c.valorMensal) || 0), 0)
    const fechados = clients.filter((c) => c.stage === 'fechado').length
    const total = clients.length
    const conversao = total ? (fechados / total) * 100 : 0
    const ganhoMensal = clients
      .filter((c) => c.stage === 'fechado')
      .reduce((s, c) => s + (Number(c.valorMensal) || 0), 0)
    return { pipeline, fechados, total, conversao, ganhoMensal, abertos: abertos.length }
  }, [db])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // ---------- Drag & drop nativo ----------
  const onDrop = (colId) => {
    setOverCol(null)
    const id = dragId
    setDragId(null)
    if (!id) return
    const cli = (db.clients || []).find((c) => c.id === id)
    if (!cli || cli.stage === colId) return
    const patch = { stage: colId, ...(colId === 'fechado' ? { status: 'ativo' } : {}) }
    actions.patch('clients', id, patch)
    const stageLabel = FUNNEL.find((f) => f.id === colId)?.label || colId
    actions.log(user.id, 'mover', 'funil', `${cli.nomeFantasia || cli.razaoSocial} → ${stageLabel}`)
    toast(`Movido para ${stageLabel}`)
  }

  const salvarLead = () => {
    if (!form.nome.trim()) { toast('Informe o nome do lead', 'error'); return }
    const novo = {
      id: uid('c'),
      tipo: 'PF', stage: 'novo', status: 'lead',
      razaoSocial: form.nome.trim(), nomeFantasia: '',
      cpfCnpj: '', ie: '', email: '', whatsapp: form.whatsapp,
      aniversario: '',
      endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' },
      planoId: 'p_basico', vendedorId: form.vendedorId,
      valorMensal: Number(form.valorMensal) || 0, valorInstalacao: 150, valorMonitoramento: 0,
      observacoes: '', criadoEm: new Date().toISOString().slice(0, 10),
    }
    actions.add('clients', novo)
    actions.log(user.id, 'criar', 'lead', `Novo lead no funil: ${form.nome.trim()}`)
    toast('Lead adicionado ao funil')
    setOpen(false)
    setForm(emptyLead())
  }

  const semClientes = !(db.clients || []).length

  return (
    <>
      <PageHead title="Funil de Vendas" subtitle="Arraste os cards entre os estágios para atualizar o pipeline">
        <Btn variant="primary" icon={<UserPlus size={16} />} onClick={() => { setForm(emptyLead()); setOpen(true) }}>
          Novo Lead
        </Btn>
      </PageHead>

      <div className="grid grid-4">
        <Stat tone="blue" icon={<Coins size={19} />} label="Pipeline em aberto" value={BRL(kpis.pipeline)} delta={`${kpis.abertos} oportunidades`} />
        <Stat tone="green" icon={<TrendingUp size={19} />} label="Taxa de conversão" value={pct(kpis.conversao)} delta={`${kpis.fechados} de ${kpis.total} ganhos`} deltaUp />
        <Stat tone="purple" icon={<Target size={19} />} label="Negócios fechados" value={kpis.fechados} />
        <Stat tone="amber" icon={<Coins size={19} />} label="Receita mensal ganha" value={BRL(kpis.ganhoMensal)} />
      </div>

      {semClientes ? (
        <Card pad style={{ marginTop: 16 }}>
          <EmptyState icon={<Users size={40} />} title="Nenhum lead no funil" sub="Clique em 'Novo Lead' para começar a montar seu pipeline." />
        </Card>
      ) : (
        <div className="kanban" style={{ marginTop: 16 }}>
          {FUNNEL.map((col) => {
            const cards = porStage[col.id] || []
            const soma = cards.reduce((s, c) => s + (Number(c.valorMensal) || 0), 0)
            return (
              <div
                key={col.id}
                className="kanban-col"
                onDragOver={(e) => { e.preventDefault(); if (overCol !== col.id) setOverCol(col.id) }}
                onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                onDrop={() => onDrop(col.id)}
                style={overCol === col.id ? { outline: `2px dashed ${col.color}`, outlineOffset: -2 } : undefined}
              >
                <div className="kanban-col-head">
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: col.color, flexShrink: 0 }} />
                  <span>{col.label}</span>
                  <div className="spacer" />
                  <Badge tone="gray">{cards.length}</Badge>
                </div>
                <div className="mut" style={{ padding: '6px 15px 0', fontSize: 12 }}>
                  Total: <span className="bold mono">{BRL(soma)}</span>/mês
                </div>
                <div className="kanban-col-body">
                  {cards.map((c) => (
                    <div
                      key={c.id}
                      className={`kanban-card ${dragId === c.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onClick={() => navigate(`/clientes/${c.id}`)}
                    >
                      <div className="between" style={{ alignItems: 'flex-start', gap: 8 }}>
                        <div className="bold" style={{ fontSize: 13.5 }}>{c.nomeFantasia || c.razaoSocial}</div>
                        <Badge tone={c.tipo === 'PJ' ? 'blue' : 'purple'}>{c.tipo}</Badge>
                      </div>
                      <div className="mono bold" style={{ fontSize: 15, marginTop: 6, color: 'var(--green)' }}>
                        {BRL(c.valorMensal)}<span className="mut" style={{ fontSize: 11, fontWeight: 400 }}>/mês</span>
                      </div>
                      <div className="mut flex gap-6" style={{ fontSize: 12, marginTop: 8, alignItems: 'center' }}>
                        <Users size={13} /> {userName(c.vendedorId)}
                      </div>
                    </div>
                  ))}
                  {!cards.length && (
                    <div className="mut center" style={{ fontSize: 12, padding: '18px 4px' }}>
                      Solte um card aqui
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo Lead"
        icon={<Plus size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarLead}>Adicionar ao funil</Btn></>}
      >
        <Field label="Nome / Razão social" required>
          <input value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Nome do contato ou empresa" />
        </Field>
        <div className="form-row">
          <Field label="WhatsApp">
            <input value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder={maskPhone('11999990000')} />
          </Field>
          <Field label="Valor mensal estimado (R$)">
            <input type="number" step="0.01" value={form.valorMensal} onChange={(e) => set({ valorMensal: +e.target.value })} />
          </Field>
        </div>
        <Field label="Vendedor responsável">
          <select value={form.vendedorId} onChange={(e) => set({ vendedorId: e.target.value })}>
            <option value="">Selecione</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>
          O lead entra no estágio <span className="bold">Novo Lead</span> com status <span className="bold">lead</span>.
        </div>
      </Modal>
    </>
  )
}
