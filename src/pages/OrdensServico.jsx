import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Wrench, Download, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useStore, actions, clientName, userName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { fmtDate, uid } from '../lib/format.js'
import { PageHead, Card, Btn, Badge, Modal, Field, Segmented, EmptyState, useToast, StatusBadge } from '../components/ui.jsx'

// Tipos de OS (Tarefas 26, 32)
export const OS_TIPOS = {
  instalacao: { label: 'Instalação', icon: Wrench, tone: 'blue' },
  manutencao: { label: 'Manutenção', icon: Wrench, tone: 'amber' },
  retirada:   { label: 'Retirada', icon: ArrowUpFromLine, tone: 'red' },
}

const checklistFor = (tipo) => {
  if (tipo === 'instalacao') return [
    { id: uid('k'), label: 'Verificar equipamento e acessórios', done: false },
    { id: uid('k'), label: 'Instalar rastreador no veículo', done: false },
    { id: uid('k'), label: 'Conectar chip e testar sinal', done: false },
    { id: uid('k'), label: 'Testar comunicação com a central', done: false },
    { id: uid('k'), label: 'Registrar fotos da instalação', done: false },
    { id: uid('k'), label: 'Coletar assinatura do cliente', done: false },
  ]
  if (tipo === 'retirada') return [
    { id: uid('k'), label: 'Localizar e remover rastreador', done: false },
    { id: uid('k'), label: 'Conferir integridade do equipamento', done: false },
    { id: uid('k'), label: 'Dar baixa no estoque', done: false },
  ]
  return [
    { id: uid('k'), label: 'Diagnosticar o problema', done: false },
    { id: uid('k'), label: 'Executar reparo / substituição', done: false },
    { id: uid('k'), label: 'Testar comunicação com a central', done: false },
  ]
}

const emptyForm = () => ({ clientId: '', tecnicoId: '', tipo: 'instalacao', veiculo: '', endereco: '', enderecoTecnico: '', observacoes: '' })

export default function OrdensServico() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('todas')
  const [form, setForm] = useState(emptyForm)

  const tecnicos = (db.users || []).filter((u) => u.role === 'tecnico')
  const list = useMemo(() => (db.ordens || []).filter((o) => {
    if (filter === 'abertas') return o.status === 'aberta' || o.status === 'em_andamento'
    if (filter === 'concluidas') return o.status === 'concluida'
    return true
  }), [db, filter])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // Preenche endereço automático com o do cliente (Tarefa 26)
  const onCliente = (clientId) => {
    const c = (db.clients || []).find((x) => x.id === clientId)
    const e = c?.endereco
    const addr = e ? `${e.logradouro}, ${e.numero} - ${e.bairro}, ${e.cidade}/${e.uf}` : ''
    set({ clientId, endereco: addr })
  }

  const salvar = () => {
    if (!form.clientId || !form.tecnicoId) { toast('Selecione cliente e técnico', 'error'); return }
    const numero = 1000 + (db.ordens || []).length + 1
    const os = {
      ...form, id: uid('os'), numero, status: 'aberta', km: null, equipamentoId: null,
      checklist: checklistFor(form.tipo), abertaEm: new Date().toISOString().slice(0, 10), concluidaEm: null,
    }
    actions.add('ordens', os)
    actions.log(user.id, 'criar', 'OS', `OS #${numero} - ${OS_TIPOS[form.tipo].label} para ${clientName(form.clientId)}`)
    toast('Ordem de serviço criada')
    setOpen(false); setForm(emptyForm())
  }

  const abertas = (db.ordens || []).filter((o) => o.status === 'aberta' || o.status === 'em_andamento').length

  return (
    <>
      <PageHead title="Ordens de Serviço" subtitle={`${abertas} em aberto · instalação, manutenção e retirada`}>
        <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setForm(emptyForm()); setOpen(true) }}>Criar Ordem de Serviço</Btn>
      </PageHead>

      <Card>
        <div className="card-head">
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'todas', label: 'Todas' }, { value: 'abertas', label: 'Em aberto' }, { value: 'concluidas', label: 'Concluídas' },
          ]} />
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>OS</th><th>Cliente</th><th>Tipo</th><th>Técnico</th><th>Veículo</th><th>Abertura</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((o) => {
                const T = OS_TIPOS[o.tipo]
                return (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/os/${o.id}`)}>
                    <td className="bold mono">#{o.numero}</td>
                    <td>{clientName(o.clientId)}</td>
                    <td><Badge tone={T.tone}><T.icon size={12} /> {T.label}</Badge></td>
                    <td>{userName(o.tecnicoId)}</td>
                    <td className="mut">{o.veiculo || '—'}</td>
                    <td>{fmtDate(o.abertaEm)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!list.length && <EmptyState icon={<ClipboardList size={40} />} title="Nenhuma OS" sub="Crie a primeira ordem de serviço." />}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Criar Ordem de Serviço" icon={<ClipboardList size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvar}>Criar OS</Btn></>}>
        <Field label="Tipo de serviço (Tarefa 32)">
          <div className="seg" style={{ width: '100%' }}>
            {Object.entries(OS_TIPOS).map(([k, t]) => (
              <button key={k} className={form.tipo === k ? 'active' : ''} style={{ flex: 1 }} onClick={() => set({ tipo: k })}>
                <t.icon size={14} style={{ marginRight: 6 }} />{t.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="form-row">
          <Field label="Cliente" required>
            <select value={form.clientId} onChange={(e) => onCliente(e.target.value)}>
              <option value="">Selecione o cliente</option>
              {(db.clients || []).map((c) => <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>)}
            </select>
          </Field>
          <Field label="Técnico responsável" required hint="Quem irá atender o cliente (Tarefa 26)">
            <select value={form.tecnicoId} onChange={(e) => set({ tecnicoId: e.target.value })}>
              <option value="">Selecione o técnico</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Veículo / Placa">
          <input value={form.veiculo} onChange={(e) => set({ veiculo: e.target.value })} placeholder="Ex: Fiat Toro - ABC1D23" />
        </Field>
        <Field label="Endereço do cliente (atendimento)" hint="Preenchido automaticamente com o cadastro (Tarefa 26)">
          <input value={form.endereco} onChange={(e) => set({ endereco: e.target.value })} placeholder="Endereço onde o serviço será realizado" />
        </Field>
        <Field label="Endereço de saída do técnico" hint="Usado para estimar a rota e o KM (Tarefas 30, 33)">
          <input value={form.enderecoTecnico} onChange={(e) => set({ enderecoTecnico: e.target.value })} placeholder="Ponto de partida do técnico" />
        </Field>
        <Field label="Observações (Tarefa 27)">
          <textarea value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Detalhes do atendimento, particularidades, etc." />
        </Field>
      </Modal>
    </>
  )
}
