import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Cake, MapPin, Phone, Mail, FileText, Download, Plus,
  MessageCircle, Smartphone, Wallet, User, ClipboardList, DollarSign, Wrench,
  AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { useStore, actions, byId, userName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, fmtDateTime, maskDoc, maskPhone, uid } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Avatar, Stat, Field, EmptyState, Modal,
  Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

// Canais de comunicação (Tarefas 9, 15)
const CANAIS = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, tone: 'green' },
  email:    { label: 'E-mail',   icon: Mail,          tone: 'blue' },
  sms:      { label: 'SMS',      icon: Smartphone,    tone: 'purple' },
  ligacao:  { label: 'Ligação',  icon: Phone,         tone: 'amber' },
}

const OS_TIPO_LABEL = { instalacao: 'Instalação', manutencao: 'Manutenção', retirada: 'Retirada' }
const TIPOS_DOC = ['Contrato', 'Boleto', 'OS', 'Nota Fiscal', 'Comprovante', 'Outro']

const fmtEndereco = (e) => {
  if (!e) return '—'
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const linha2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ')
  const linhas = [linha1, linha2].filter(Boolean).join(' · ')
  return linhas || '—'
}

// Dias até o próximo aniversário (para mensagem automática — Tarefa 20)
const proxAniversario = (iso) => {
  if (!iso) return null
  const [, mm, dd] = String(iso).slice(0, 10).split('-')
  if (!mm || !dd) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  let alvo = new Date(hoje.getFullYear(), +mm - 1, +dd)
  if (alvo < hoje) alvo = new Date(hoje.getFullYear() + 1, +mm - 1, +dd)
  return Math.round((alvo - hoje) / 86400000)
}

const fromClient = (c) => ({
  tipo: c.tipo || 'PJ', status: c.status || 'lead',
  razaoSocial: c.razaoSocial || '', nomeFantasia: c.nomeFantasia || '',
  cpfCnpj: c.cpfCnpj || '', ie: c.ie || '',
  email: c.email || '', whatsapp: c.whatsapp || '', aniversario: c.aniversario || '',
  endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', ...(c.endereco || {}) },
  planoId: c.planoId || '', vendedorId: c.vendedorId || '',
  valorMensal: c.valorMensal ?? 0, valorInstalacao: c.valorInstalacao ?? 0, valorMonitoramento: c.valorMonitoramento ?? 0,
  observacoes: c.observacoes || '',
})

export default function ClienteDetalhe() {
  const { id } = useParams()
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const cliente = byId('clients', id)
  const [tab, setTab] = useState('geral')

  // Modais
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(() => (cliente ? fromClient(cliente) : null))
  const [docOpen, setDocOpen] = useState(false)
  const [docForm, setDocForm] = useState({ tipo: 'Contrato', nome: '' })
  const [waOpen, setWaOpen] = useState(false)
  const [waMsg, setWaMsg] = useState('')

  // Coleções filtradas pelo cliente
  const docs = useMemo(
    () => (db.documentos || []).filter((d) => d.clientId === id).sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))),
    [db, id],
  )
  const ordens = useMemo(
    () => (db.ordens || []).filter((o) => o.clientId === id).sort((a, b) => String(b.abertaEm || '').localeCompare(String(a.abertaEm || ''))),
    [db, id],
  )
  const contas = useMemo(
    () => (db.contasReceber || []).filter((c) => c.clientId === id).sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || ''))),
    [db, id],
  )
  const interacoes = useMemo(
    () => (db.interacoes || []).filter((i) => i.clientId === id).sort((a, b) => new Date(b.data) - new Date(a.data)),
    [db, id],
  )

  if (!cliente) {
    return (
      <PageHead title="Cliente não encontrado" subtitle="O cliente solicitado não existe ou foi removido.">
        <Btn icon={<ArrowLeft size={16} />} onClick={() => navigate('/clientes')}>Voltar</Btn>
      </PageHead>
    )
  }

  const nome = cliente.nomeFantasia || cliente.razaoSocial
  const plano = byId('planos', cliente.planoId)
  const vendedores = (db.users || []).filter((u) => u.role === 'vendedor')

  const totalAberto = contas.filter((c) => c.status !== 'pago').reduce((s, c) => s + (c.valor || 0), 0)
  const totalAtrasado = contas.filter((c) => c.status === 'atrasado').reduce((s, c) => s + (c.valor || 0), 0)
  const totalPago = contas.filter((c) => c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0)

  const diasAniv = proxAniversario(cliente.aniversario)

  // ---------- Form helpers (edição) ----------
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setEnd = (patch) => setForm((f) => ({ ...f, endereco: { ...f.endereco, ...patch } }))
  const onPlano = (planoId) => {
    const p = byId('planos', planoId)
    set({
      planoId,
      valorMensal: p?.valorMensal ?? form.valorMensal,
      valorInstalacao: p?.valorInstalacao ?? form.valorInstalacao,
      valorMonitoramento: p?.valorMonitoramento ?? 0,
    })
  }

  const abrirEdicao = () => { setForm(fromClient(cliente)); setEditOpen(true) }

  const salvarEdicao = () => {
    if (!form.razaoSocial.trim()) { toast('Informe o nome / razão social', 'error'); return }
    actions.patch('clients', cliente.id, { ...form })
    actions.log(user.id, 'editar', 'cliente', `Editou ${form.nomeFantasia || form.razaoSocial}`)
    toast('Cliente atualizado com sucesso')
    setEditOpen(false)
  }

  const adicionarDoc = () => {
    if (!docForm.nome.trim()) { toast('Informe o nome do documento', 'error'); return }
    actions.add('documentos', {
      id: uid('doc'), clientId: cliente.id, tipo: docForm.tipo,
      nome: docForm.nome.trim(), data: new Date().toISOString().slice(0, 10),
    })
    actions.log(user.id, 'adicionar', 'documento', `${docForm.tipo}: ${docForm.nome.trim()} (${nome})`)
    toast('Documento adicionado')
    setDocOpen(false)
    setDocForm({ tipo: 'Contrato', nome: '' })
  }

  const baixarDoc = (d) => toast(`Baixando ${d.nome}...`)

  const enviarWhats = () => {
    if (!waMsg.trim()) { toast('Escreva a mensagem', 'error'); return }
    actions.add('interacoes', {
      id: uid('in'), clientId: cliente.id, canal: 'whatsapp',
      descricao: waMsg.trim(), data: new Date().toISOString(),
    })
    actions.log(user.id, 'comunicar', 'cliente', `WhatsApp para ${nome}`)
    toast('Mensagem registrada e enviada')
    setWaOpen(false)
    setWaMsg('')
  }

  return (
    <>
      <PageHead
        title={nome}
        subtitle={`${cliente.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'} · ${maskDoc(cliente.cpfCnpj)}`}
      >
        <Btn icon={<ArrowLeft size={16} />} onClick={() => navigate('/clientes')}>Voltar</Btn>
        <Btn variant="primary" icon={<Pencil size={16} />} onClick={abrirEdicao}>Editar</Btn>
      </PageHead>

      {/* Cartão de cabeçalho do cliente */}
      <Card pad>
        <div className="flex gap-16 wrap" style={{ alignItems: 'center' }}>
          <Avatar name={nome} />
          <div>
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <span className="bold" style={{ fontSize: 18 }}>{nome}</span>
              <StatusBadge status={cliente.status} />
              <Badge tone={cliente.tipo === 'PJ' ? 'blue' : 'purple'}>{cliente.tipo}</Badge>
            </div>
            <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>
              {plano?.nome || 'Sem plano'} · Vendedor: {userName(cliente.vendedorId)} · Cliente desde {fmtDate(cliente.criadoEm)}
            </div>
          </div>
          <div className="spacer" />
          <div className="right">
            <div className="mut" style={{ fontSize: 12 }}>Mensalidade</div>
            <div className="bold mono" style={{ fontSize: 20 }}>{BRL(cliente.valorMensal)}</div>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'geral', label: 'Visão geral' },
            { value: 'documentos', label: 'Histórico de Documentos' },
            { value: 'ordens', label: 'Ordens de Serviço' },
            { value: 'financeiro', label: 'Financeiro' },
            { value: 'comunicacoes', label: 'Comunicações' },
          ]}
        />
      </div>

      {/* ---------------- VISÃO GERAL ---------------- */}
      {tab === 'geral' && (
        <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: 16 }}>
          <div className="col gap-16">
            <Card>
              <CardHead title="Dados cadastrais" icon={<User size={18} />} />
              <div className="card-pad col gap-12">
                <Row label={cliente.tipo === 'PJ' ? 'Razão social' : 'Nome completo'}>{cliente.razaoSocial || '—'}</Row>
                <Row label={cliente.tipo === 'PJ' ? 'Nome fantasia' : 'Apelido'}>{cliente.nomeFantasia || '—'}</Row>
                <Row label={cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF'}>{maskDoc(cliente.cpfCnpj)}</Row>
                <Row label="Inscrição estadual">{cliente.ie || '—'}</Row>
                <Row label="WhatsApp"><span className="flex gap-6"><Phone size={13} className="mut" />{maskPhone(cliente.whatsapp)}</span></Row>
                <Row label="E-mail"><span className="flex gap-6"><Mail size={13} className="mut" />{cliente.email || '—'}</span></Row>
                <Row label="Endereço"><span className="flex gap-6" style={{ textAlign: 'right' }}><MapPin size={13} className="mut" />{fmtEndereco(cliente.endereco)}</span></Row>
                <Row label="CEP">{cliente.endereco?.cep || '—'}</Row>
              </div>
            </Card>

            {cliente.observacoes && (
              <Card>
                <CardHead title="Observações" icon={<FileText size={18} />} />
                <div className="card-pad soft">{cliente.observacoes}</div>
              </Card>
            )}
          </div>

          <div className="col gap-16">
            {/* Destaque: aniversário (Tarefa 20) */}
            <Card pad style={{ background: 'var(--purple-bg)', borderColor: '#e9d5ff' }}>
              <div className="flex gap-12" style={{ alignItems: 'center' }}>
                <div className="stat-ico" style={{ background: 'var(--purple)', color: '#fff' }}><Cake size={20} /></div>
                <div>
                  <div className="mut" style={{ fontSize: 12 }}>Data de aniversário</div>
                  <div className="bold" style={{ fontSize: 16 }}>{fmtDate(cliente.aniversario)}</div>
                </div>
              </div>
              <div className="mut" style={{ fontSize: 12.5, marginTop: 10 }}>
                {diasAniv == null
                  ? 'Sem data cadastrada para mensagem automática.'
                  : diasAniv === 0
                    ? '🎉 É hoje! Mensagem de felicitação será enviada automaticamente.'
                    : `Faltam ${diasAniv} dia(s) — mensagem automática programada (Tarefa 20).`}
              </div>
            </Card>

            <Card>
              <CardHead title="Plano e valores" icon={<Wallet size={18} />} />
              <div className="card-pad col gap-12">
                <Row label="Plano">{plano?.nome || '—'}</Row>
                <Row label="Mensalidade"><b className="mono">{BRL(cliente.valorMensal)}</b></Row>
                <Row label="Instalação"><b className="mono">{BRL(cliente.valorInstalacao)}</b></Row>
                <Row label="Monitoramento"><b className="mono">{BRL(cliente.valorMonitoramento)}</b></Row>
                <div className="divider" />
                <Row label="Vendedor responsável">{userName(cliente.vendedorId)}</Row>
                <Row label="Situação"><StatusBadge status={cliente.status} /></Row>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ---------------- HISTÓRICO DE DOCUMENTOS (Tarefa 25) ---------------- */}
      {tab === 'documentos' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Histórico de documentos" sub={`${docs.length} documento(s)`} icon={<FileText size={18} />}>
            <Btn variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setDocOpen(true)}>Adicionar documento</Btn>
          </CardHead>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Tipo</th><th>Nome</th><th>Data</th><th className="right">Ações</th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td><Badge tone="gray">{d.tipo}</Badge></td>
                    <td className="bold">{d.nome}</td>
                    <td>{fmtDate(d.data)}</td>
                    <td className="right">
                      <Btn size="sm" icon={<Download size={14} />} onClick={() => baixarDoc(d)}>Baixar</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!docs.length && <EmptyState icon={<FileText size={40} />} title="Nenhum documento" sub="Adicione contratos, boletos e comprovantes deste cliente." />}
          </div>
        </Card>
      )}

      {/* ---------------- ORDENS DE SERVIÇO ---------------- */}
      {tab === 'ordens' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Ordens de serviço" sub={`${ordens.length} OS`} icon={<Wrench size={18} />} />
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Número</th><th>Tipo</th><th>Status</th><th>Abertura</th></tr>
              </thead>
              <tbody>
                {ordens.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/os/${o.id}`)}>
                    <td className="bold mono">#{o.numero}</td>
                    <td>{OS_TIPO_LABEL[o.tipo] || o.tipo}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{fmtDate(o.abertaEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ordens.length && <EmptyState icon={<ClipboardList size={40} />} title="Nenhuma ordem de serviço" sub="Este cliente ainda não possui OS registradas." />}
          </div>
        </Card>
      )}

      {/* ---------------- FINANCEIRO ---------------- */}
      {tab === 'financeiro' && (
        <>
          <div className="grid grid-3" style={{ marginTop: 16 }}>
            <Stat tone="amber" icon={<Wallet size={19} />} label="Total em aberto" value={BRL(totalAberto)} />
            <Stat tone="red" icon={<AlertTriangle size={19} />} label="Em atraso" value={BRL(totalAtrasado)} />
            <Stat tone="green" icon={<CheckCircle2 size={19} />} label="Já recebido" value={BRL(totalPago)} />
          </div>

          <Card style={{ marginTop: 16 }}>
            <CardHead title="Contas a receber" sub={`${contas.length} lançamento(s)`} icon={<DollarSign size={18} />} />
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Descrição</th><th>Categoria</th><th className="right">Valor</th><th>Vencimento</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {contas.map((c) => (
                    <tr key={c.id}>
                      <td className="bold">{c.descricao}</td>
                      <td><span className="mut">{c.categoria}</span></td>
                      <td className="right mono bold">{BRL(c.valor)}</td>
                      <td>{fmtDate(c.vencimento)}</td>
                      <td><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!contas.length && <EmptyState icon={<Wallet size={40} />} title="Sem lançamentos financeiros" sub="Não há contas a receber para este cliente." />}
            </div>
          </Card>
        </>
      )}

      {/* ---------------- COMUNICAÇÕES (Tarefas 9, 15) ---------------- */}
      {tab === 'comunicacoes' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Histórico de comunicações" sub={`${interacoes.length} interação(ões)`} icon={<MessageCircle size={18} />}>
            <Btn variant="green" size="sm" icon={<MessageCircle size={15} />} onClick={() => setWaOpen(true)}>Enviar WhatsApp</Btn>
          </CardHead>
          <div className="card-pad">
            {interacoes.length ? (
              <div className="timeline">
                {interacoes.map((i) => {
                  const c = CANAIS[i.canal] || { label: i.canal, icon: MessageCircle, tone: 'gray' }
                  const Ico = c.icon
                  return (
                    <div key={i.id} className="timeline-item">
                      <div className="flex gap-8" style={{ alignItems: 'center' }}>
                        <Badge tone={c.tone}><Ico size={12} /> {c.label}</Badge>
                        <span className="mut" style={{ fontSize: 12 }}>{fmtDateTime(i.data)}</span>
                      </div>
                      <div style={{ fontSize: 13.5, marginTop: 4 }}>{i.descricao}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState icon={<MessageCircle size={40} />} title="Nenhuma comunicação" sub="Envie um WhatsApp para iniciar o histórico." />
            )}
          </div>
        </Card>
      )}

      {/* ---------------- MODAL: Editar cliente ---------------- */}
      {form && (
        <Modal
          open={editOpen} onClose={() => setEditOpen(false)} size="lg"
          title="Editar cliente" icon={<Pencil size={20} color="var(--brand)" />}
          footer={<><Btn onClick={() => setEditOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarEdicao}>Salvar alterações</Btn></>}
        >
          <Field label="Tipo de pessoa">
            <Segmented value={form.tipo} onChange={(v) => set({ tipo: v })} options={[
              { value: 'PJ', label: 'Pessoa Jurídica (PJ)' }, { value: 'PF', label: 'Pessoa Física (PF)' },
            ]} />
          </Field>
          <div className="form-row">
            <Field label={form.tipo === 'PJ' ? 'Razão social' : 'Nome completo'} required>
              <input value={form.razaoSocial} onChange={(e) => set({ razaoSocial: e.target.value })} />
            </Field>
            <Field label={form.tipo === 'PJ' ? 'Nome fantasia' : 'Apelido'}>
              <input value={form.nomeFantasia} onChange={(e) => set({ nomeFantasia: e.target.value })} />
            </Field>
          </div>
          <div className="form-row-3">
            <Field label={form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}>
              <input value={form.cpfCnpj} onChange={(e) => set({ cpfCnpj: e.target.value })} placeholder="Somente números" />
            </Field>
            <Field label="Inscrição estadual">
              <input value={form.ie} onChange={(e) => set({ ie: e.target.value })} />
            </Field>
            <Field label="Data de aniversário" hint="Mensagens automáticas (Tarefa 20)">
              <input type="date" value={form.aniversario} onChange={(e) => set({ aniversario: e.target.value })} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Telefone / WhatsApp"><input value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
          </div>

          <div className="divider" />
          <div className="bold soft" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={15} /> Endereço</div>
          <div className="form-row-3">
            <Field label="CEP"><input value={form.endereco.cep} onChange={(e) => setEnd({ cep: e.target.value })} /></Field>
            <Field label="Logradouro"><input value={form.endereco.logradouro} onChange={(e) => setEnd({ logradouro: e.target.value })} /></Field>
            <Field label="Número"><input value={form.endereco.numero} onChange={(e) => setEnd({ numero: e.target.value })} /></Field>
          </div>
          <div className="form-row-3">
            <Field label="Bairro"><input value={form.endereco.bairro} onChange={(e) => setEnd({ bairro: e.target.value })} /></Field>
            <Field label="Cidade"><input value={form.endereco.cidade} onChange={(e) => setEnd({ cidade: e.target.value })} /></Field>
            <Field label="UF"><input maxLength={2} value={form.endereco.uf} onChange={(e) => setEnd({ uf: e.target.value.toUpperCase() })} /></Field>
          </div>

          <div className="divider" />
          <div className="form-row">
            <Field label="Plano">
              <select value={form.planoId} onChange={(e) => onPlano(e.target.value)}>
                <option value="">Selecione</option>
                {(db.planos || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Field>
            <Field label="Vendedor responsável">
              <select value={form.vendedorId} onChange={(e) => set({ vendedorId: e.target.value })}>
                <option value="">Selecione</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row-3">
            <Field label="Valor mensal (R$)"><input type="number" step="0.01" value={form.valorMensal} onChange={(e) => set({ valorMensal: +e.target.value })} /></Field>
            <Field label="Valor instalação (R$)"><input type="number" step="0.01" value={form.valorInstalacao} onChange={(e) => set({ valorInstalacao: +e.target.value })} /></Field>
            <Field label="Valor monitoramento (R$)"><input type="number" step="0.01" value={form.valorMonitoramento} onChange={(e) => set({ valorMonitoramento: +e.target.value })} /></Field>
          </div>
          <div className="form-row">
            <Field label="Situação">
              <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="lead">Lead</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Anotações sobre o cliente, frota, etc." />
          </Field>
        </Modal>
      )}

      {/* ---------------- MODAL: Adicionar documento ---------------- */}
      <Modal
        open={docOpen} onClose={() => setDocOpen(false)}
        title="Adicionar documento" icon={<FileText size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setDocOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={adicionarDoc}>Salvar documento</Btn></>}
      >
        <Field label="Tipo de documento">
          <select value={docForm.tipo} onChange={(e) => setDocForm((f) => ({ ...f, tipo: e.target.value }))}>
            {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Nome do arquivo" required>
          <input value={docForm.nome} onChange={(e) => setDocForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Contrato Anual PJ.pdf" />
        </Field>
        <div className="upload-zone"><FileText size={26} /><div style={{ marginTop: 8 }}>Arraste o arquivo ou toque para selecionar</div></div>
      </Modal>

      {/* ---------------- MODAL: Enviar WhatsApp ---------------- */}
      <Modal
        open={waOpen} onClose={() => setWaOpen(false)}
        title="Enviar WhatsApp" icon={<MessageCircle size={20} color="var(--green)" />}
        footer={<><Btn onClick={() => setWaOpen(false)}>Cancelar</Btn><Btn variant="green" icon={<MessageCircle size={15} />} onClick={enviarWhats}>Enviar mensagem</Btn></>}
      >
        <div className="flex gap-8" style={{ marginBottom: 10, alignItems: 'center' }}>
          <Phone size={15} className="mut" />
          <span className="bold">{maskPhone(cliente.whatsapp) || 'Sem número'}</span>
          <span className="mut">· {nome}</span>
        </div>
        <Field label="Mensagem" hint="A mensagem ficará registrada no histórico de comunicações.">
          <textarea rows={4} value={waMsg} onChange={(e) => setWaMsg(e.target.value)} placeholder="Digite a mensagem para o cliente..." />
        </Field>
      </Modal>
    </>
  )
}

function Row({ label, children }) {
  return (
    <div className="between">
      <span className="mut" style={{ fontSize: 13 }}>{label}</span>
      <span className="bold" style={{ fontSize: 13.5 }}>{children}</span>
    </div>
  )
}
