import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, TrendingUp, Coins, Target, Users, UserPlus, MessageSquare, Boxes, Send } from 'lucide-react'
import { clientsApi, userName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, pct, maskPhone, fmtDateTime, uid } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Stat, Field, Modal, EmptyState, useToast,
} from '../components/ui.jsx'
import { FUNNEL } from '../data/seed.js'
import { mensalidadeTotal } from '../lib/recorrencia.js'

const emptyLead = () => ({ nome: '', whatsapp: '', telefoneFixo: '', email: '', periodoRetorno: '', valorMensal: '', quantidadeEquipamentos: '', socioId: '' })

export default function Funil() {
  const { db, refetch } = useCollections(['clients', 'users'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyLead)
  const [conversaLead, setConversaLead] = useState(null) // id do lead com modal de conversas aberto
  const [novaConversa, setNovaConversa] = useState('')

  const vendedores = (db.users || []).filter((u) => u.role === 'vendedor')

  // Agrupa clientes por estágio do funil.
  const porStage = useMemo(() => {
    const map = {}
    FUNNEL.forEach((c) => { map[c.id] = [] })
      ; (db.clients || []).forEach((cli) => {
        const st = map[cli.stage] ? cli.stage : 'novo'
          ; (map[st] || (map[st] = [])).push(cli)
      })
    return map
  }, [db])

  // KPIs do topo (usa a mensalidade total = valor × qtd equipamentos).
  const kpis = useMemo(() => {
    const clients = db.clients || []
    const abertos = clients.filter((c) => c.stage !== 'fechado' && c.stage !== 'perdido')
    const pipeline = abertos.reduce((s, c) => s + mensalidadeTotal(c), 0)
    const fechados = clients.filter((c) => c.stage === 'fechado').length
    const total = clients.length
    const conversao = total ? (fechados / total) * 100 : 0
    const ganhoMensal = clients.filter((c) => c.stage === 'fechado').reduce((s, c) => s + mensalidadeTotal(c), 0)
    return { pipeline, fechados, total, conversao, ganhoMensal, abertos: abertos.length }
  }, [db])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // ---------- Drag & drop nativo ----------
  const onDrop = async (colId) => {
    setOverCol(null)
    const id = dragId
    setDragId(null)
    if (!id) return
    const cli = (db.clients || []).find((c) => c.id === id)
    if (!cli || cli.stage === colId) return
    const patch = { stage: colId, ...(colId === 'fechado' ? { status: 'ativo', ativo: true } : {}) }
    const stageLabel = FUNNEL.find((f) => f.id === colId)?.label || colId
    try {
      await clientsApi.update(id, patch)
      logAudit(user.id, 'mover', 'funil', `${cli.nomeFantasia || cli.razaoSocial} → ${stageLabel}`)
      toast(`Movido para ${stageLabel}`)
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const salvarLead = async () => {
    if (!form.nome.trim()) { toast('Informe o nome do lead', 'error'); return }
    const novo = {
      id: uid('c'),
      tipo: 'PF', stage: 'novo', status: 'lead', ativo: false,
      razaoSocial: form.nome.trim(), nomeFantasia: '',
      cpfCnpj: '', ie: '', email: form.email, telefoneFixo: form.telefoneFixo, whatsapp: form.whatsapp,
      telefoneFixo: '', emailFinanceiro: '', whatsappFinanceiro: '', site: '',
      endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' },
      contatos: [], historicoVendas: [], conversas: [],
      planoId: 'p_basico', socioId: form.vendedorId, vendedorId: '',
      valorMensal: Number(form.valorMensal) || 0, quantidadeEquipamentos: Number(form.quantidadeEquipamentos) || 0,
      prazoMeses: 12, valorInstalacao: 150,
      observacoes: `Período de retorno: ${form.periodoRetorno || 'Não informado'}`, criadoEm: new Date().toISOString().slice(0, 10), contratoInicio: '',
    }
    try {
      await clientsApi.insert(novo)
      logAudit(user.id, 'criar', 'lead', `Novo lead no funil: ${form.nome.trim()}`)
      toast('Lead adicionado ao funil')
      setOpen(false)
      setForm(emptyLead())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const abrirConversas = (e, cli) 
    e.stopPropagation()
    if (cli.stage !== 'fechado') { toast('Conversas disponíveis apenas após fechamento do negócio', 'error'); return }
    setConversaLead(cli.id); setNovaConversa('')
  }

  const enviarConversa = async () => {
    const cli = (db.clients || []).find((c) => c.id === conversaLead)
    if (!cli) return
    if (!novaConversa.trim()) { toast('Escreva a conversa', 'error'); return }
    const registro = { id: uid('cv'), autor: user.id, data: new Date().toISOString(), texto: novaConversa.trim() }
    try {
      await clientsApi.update(cli.id, { conversas: [...(cli.conversas || []), registro] })
      logAudit(user.id, 'conversa', 'funil', `Conversa registrada — ${cli.nomeFantasia || cli.razaoSocial}`)
      toast('Conversa registrada')
      setNovaConversa('')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const leadConversas = (db.clients || []).find((c) => c.id === conversaLead)
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
            const soma = cards.reduce((s, c) => s + mensalidadeTotal(c), 0)
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
                  {cards.map((c) => {
                    const nConversas = (c.conversas || []).length
                    return (
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
                          {BRL(mensalidadeTotal(c))}<span className="mut" style={{ fontSize: 11, fontWeight: 400 }}>/mês</span>
                        </div>
                        <div className="mut flex gap-6" style={{ fontSize: 12, marginTop: 6, alignItems: 'center' }}>
                          <Boxes size={13} /> {c.quantidadeEquipamentos ?? 0} equip.
                        </div>
                        <div className="between" style={{ marginTop: 8, alignItems: 'center' }}>
                          <div className="mut flex gap-6" style={{ fontSize: 12, alignItems: 'center' }}>
                            <Users size={13} /> {userName(c.socioId)}
                          </div>
                          {c.stage === 'fechado' && (
                            <button className="btn btn-ghost btn-sm" onClick={(e) => abrirConversas(e, c)} title="Histórico de conversas" style={{ padding: '4px 8px' }}>
                              <MessageSquare size={14} /> {nConversas}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
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

      {/* Modal: Novo Lead */}
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
          <Field label="Telefone fixo">
            <input value={form.telefoneFixo} onChange={(e) => set({ telefoneFixo: e.target.value })} placeholder={maskPhone('1133334444')} />
          </Field>
        </div>
        <Field label="E-mail">
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="email@empresa.com" />
        </Field>
        <div className="form-row">
          <Field label="Valor mensal por equipamento (R$)" hint="Opcional">
            <input type="number" step="0.01" value={form.valorMensal} onChange={(e) => set({ valorMensal: +e.target.value })} />
          </Field>
          <Field label="Quantidade de equipamentos" hint="Opcional">
            <input type="number" step="1" min="0" value={form.quantidadeEquipamentos} onChange={(e) => set({ quantidadeEquipamentos: +e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Período de retorno" hint="Ex.: quinzenal, mensal">
            <input value={form.periodoRetorno} onChange={(e) => set({ periodoRetorno: e.target.value })} placeholder="Ex.: quinzenal" />
          </Field>
          <Field label="Vendedor">
            <select value={form.socioId} onChange={(e) => set({ socioId: e.target.value })}>
              <option value="">Selecione</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>
          Mensalidade estimada: <span className="bold mono">{BRL((Number(form.valorMensal) || 0) * (Number(form.quantidadeEquipamentos) || 0))}</span>/mês.
          O lead entra no estágio <span className="bold">Novo Lead</span>.
        </div>
      </Modal>

      {/* Modal: Histórico de conversas */}
      <Modal
        open={!!conversaLead}
        onClose={() => setConversaLead(null)}
        title={`Conversas — ${leadConversas ? (leadConversas.nomeFantasia || leadConversas.razaoSocial) : ''}`}
        icon={<MessageSquare size={20} color="var(--brand)" />}
        footer={<Btn onClick={() => setConversaLead(null)}>Fechar</Btn>}
      >
        {leadConversas && (
          <>
            <div className="card-pad" style={{ padding: 0, marginBottom: 12 }}>
              {(leadConversas.conversas || []).length ? (
                <div className="timeline">
                  {(leadConversas.conversas || []).slice().sort((a, b) => new Date(b.data) - new Date(a.data)).map((cv) => (
                    <div key={cv.id} className="timeline-item">
                      <div className="flex gap-8" style={{ alignItems: 'center' }}>
                        <Badge tone="blue">{userName(cv.autor)}</Badge>
                        <span className="mut" style={{ fontSize: 12 }}>{fmtDateTime(cv.data)}</span>
                      </div>
                      <div style={{ fontSize: 13.5, marginTop: 4 }}>{cv.texto}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<MessageSquare size={36} />} title="Sem conversas" sub="Registre a primeira conversa com o cliente." />
              )}
            </div>
            <Field label="Registrar nova conversa">
              <textarea rows={3} value={novaConversa} onChange={(e) => setNovaConversa(e.target.value)} placeholder="Resumo da conversa, próximos passos..." />
            </Field>
            <Btn variant="primary" icon={<Send size={15} />} onClick={enviarConversa}>Registrar conversa</Btn>
          </>
        )}
      </Modal>
    </>
  )

