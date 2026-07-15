import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Cake, MapPin, Phone, Mail, FileText, Download, Plus,
  MessageCircle, Smartphone, Wallet, User, ClipboardList, DollarSign, Wrench,
  AlertTriangle, CheckCircle2, Users2, Globe, History, Boxes, TrendingUp, TrendingDown,
} from 'lucide-react'
import { api, clientsApi, syncRecorrencia, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, fmtDateTime, maskDoc, maskPhone, uid } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Avatar, Stat, Field, EmptyState, Modal,
  Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'
import { PessoaForm, fromPessoa } from '../components/PessoaForm.jsx'
import { mensalidadeTotal } from '../lib/recorrencia.js'

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

export default function ClienteDetalhe() {
  const { id } = useParams()
  const { db, loading, refetch } = useCollections(['clients', 'planos', 'users', 'documentos', 'ordens', 'contasReceber', 'interacoes', 'equipamentos', 'chips'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const cliente = (db.clients || []).find((c) => c.id === id)
  const userName = (uid2) => (db.users || []).find((u) => u.id === uid2)?.name || '—'
  const [tab, setTab] = useState('geral')
  const [saving, setSaving] = useState(false)

  // Modais
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(() => (cliente ? fromPessoa(cliente, 'cliente') : null))
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
  const equipamentos = useMemo(
    () => (db.equipamentos || []).filter((e) => e.clientId === id),
    [db, id],
  )

  if (!cliente) {
    return (
      <PageHead title={loading ? 'Carregando...' : 'Cliente não encontrado'} subtitle={loading ? 'Buscando no Supabase.' : 'O cliente solicitado não existe ou foi removido.'}>
        <Btn icon={<ArrowLeft size={16} />} onClick={() => navigate('/clientes')}>Voltar</Btn>
      </PageHead>
    )
  }

  const nome = cliente.nomeFantasia || cliente.razaoSocial
  const plano = (db.planos || []).find((p) => p.id === cliente.planoId)
  const contatos = cliente.contatos || []
  const historico = cliente.historicoVendas || []
  const mensalidade = mensalidadeTotal(cliente)

  const parcelasFuturas = contas.filter((c) => c.categoria === 'mensalidade' && c.status !== 'pago')
  const totalAberto = contas.filter((c) => c.status !== 'pago').reduce((s, c) => s + (c.valor || 0), 0)
  const totalAtrasado = contas.filter((c) => c.status === 'atrasado').reduce((s, c) => s + (c.valor || 0), 0)
  const totalPago = contas.filter((c) => c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0)

  const abrirEdicao = () => { setForm(fromPessoa(cliente, 'cliente')); setEditOpen(true) }

  const salvarEdicao = async () => {
    if (!form.razaoSocial.trim()) { toast('Informe o nome / razão social', 'error'); return }
    const next = { ...cliente, ...form }
    if (next.ativo && !next.contratoInicio) next.contratoInicio = new Date().toISOString().slice(0, 10)
    setSaving(true)
    try {
      // Sincroniza a recorrência financeira (gera/reajusta parcelas + evento de histórico).
      const evento = await syncRecorrencia(cliente, next)
      if (evento) next.historicoVendas = [evento, ...(cliente.historicoVendas || [])]
      await clientsApi.update(cliente.id, next)
      logAudit(user.id, 'editar', 'cliente', `Editou ${form.nomeFantasia || form.razaoSocial}`)
      toast('Cliente atualizado com sucesso')
      setEditOpen(false)
      refetch()
    } catch (e) {
      toast('Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const adicionarDoc = async () => {
    if (!docForm.nome.trim()) { toast('Informe o nome do documento', 'error'); return }
    try {
      await api.documentos.insert({
        id: uid('doc'), clientId: cliente.id, tipo: docForm.tipo,
        nome: docForm.nome.trim(), data: new Date().toISOString().slice(0, 10),
      })
      logAudit(user.id, 'adicionar', 'documento', `${docForm.tipo}: ${docForm.nome.trim()} (${nome})`)
      toast('Documento adicionado')
      setDocOpen(false)
      setDocForm({ tipo: 'Contrato', nome: '' })
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const baixarDoc = (d) => toast(`Baixando ${d.nome}...`)

  const enviarWhats = async () => {
    if (!waMsg.trim()) { toast('Escreva a mensagem', 'error'); return }
    try {
      await api.interacoes.insert({
        id: uid('in'), clientId: cliente.id, canal: 'whatsapp',
        descricao: waMsg.trim(), data: new Date().toISOString(),
      })
      logAudit(user.id, 'comunicar', 'cliente', `WhatsApp para ${nome}`)
      toast('Mensagem registrada e enviada')
      setWaOpen(false)
      setWaMsg('')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
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
              <StatusBadge status={cliente.ativo ? 'ativo' : (cliente.status === 'lead' ? 'lead' : 'inativo')} />
              <Badge tone={cliente.tipo === 'PJ' ? 'blue' : 'purple'}>{cliente.tipo}</Badge>
            </div>
            <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>
              {plano?.nome || 'Sem plano'} · Vendedor: {userName(cliente.vendedorId)} · Cliente desde {fmtDate(cliente.criadoEm)}
            </div>
          </div>
          <div className="spacer" />
          <div className="right">
            <div className="mut" style={{ fontSize: 12 }}>Mensalidade ({cliente.quantidadeEquipamentos ?? 0} equip.)</div>
            <div className="bold mono" style={{ fontSize: 20 }}>{BRL(mensalidade)}</div>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'geral', label: 'Visão geral' },
            { value: 'contatos', label: `Contatos (${contatos.length})` },
            { value: 'historico', label: 'Histórico de vendas' },
            { value: 'documentos', label: 'Documentos' },
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
                <Row label="Telefone fixo"><span className="flex gap-6"><Phone size={13} className="mut" />{maskPhone(cliente.telefoneFixo) || '—'}</span></Row>
                <Row label="E-mail"><span className="flex gap-6"><Mail size={13} className="mut" />{cliente.email || '—'}</span></Row>
                <Row label="Site"><span className="flex gap-6"><Globe size={13} className="mut" />{cliente.site || '—'}</span></Row>
                <Row label="Endereço"><span className="flex gap-6" style={{ textAlign: 'right' }}><MapPin size={13} className="mut" />{fmtEndereco(cliente.endereco)}</span></Row>
                <Row label="CEP">{cliente.endereco?.cep || '—'}</Row>
              </div>
            </Card>

            <Card>
              <CardHead title="Financeiro do cliente" icon={<Mail size={18} />} />
              <div className="card-pad col gap-12">
                <Row label="E-mail financeiro">{cliente.emailFinanceiro || '—'}</Row>
                <Row label="WhatsApp financeiro">{maskPhone(cliente.whatsappFinanceiro) || '—'}</Row>
              </div>
            </Card>

            <Card>
              <CardHead title="Equipamentos vinculados" sub={`${equipamentos.length} equipamento(s)`} icon={<Boxes size={18} />}>
                <Btn size="sm" icon={<Boxes size={14} />} onClick={() => navigate('/estoque')}>Ver no estoque</Btn>
              </CardHead>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Modelo</th><th>Nº de série</th><th>Chip</th><th>Status</th></tr></thead>
                  <tbody>
                    {equipamentos.map((e) => {
                      const chip = (db.chips || []).find((c) => c.id === e.chipId)
                      return (
                        <tr key={e.id}>
                          <td className="bold">{e.modelo}</td>
                          <td className="mono">{e.serial}</td>
                          <td className="mono">{chip ? `${chip.operadora} · ${maskPhone(chip.linha)}` : '—'}</td>
                          <td><StatusBadge status={e.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {!equipamentos.length && <EmptyState icon={<Boxes size={36} />} title="Nenhum equipamento vinculado" sub="Vincule equipamentos na tela de Estoque." />}
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
            <Card>
              <CardHead title="Plano e valores" icon={<Wallet size={18} />} />
              <div className="card-pad col gap-12">
                <Row label="Plano">{plano?.nome || '—'}</Row>
                <Row label="Valor por equipamento"><b className="mono">{BRL(cliente.valorMensal)}</b></Row>
                <Row label="Quantidade de equipamentos"><b className="mono">{cliente.quantidadeEquipamentos ?? 0}</b></Row>
                <Row label="Mensalidade total"><b className="mono">{BRL(mensalidade)}</b></Row>
                <Row label="Instalação"><b className="mono">{BRL(cliente.valorInstalacao)}</b></Row>
                <div className="divider" />
                <Row label="Prazo do contrato">{cliente.prazoMeses ? `${cliente.prazoMeses} meses` : '—'}</Row>
                <Row label="Parcelas em aberto"><b className="mono">{parcelasFuturas.length}</b></Row>
                <Row label="Vendedor responsável">{userName(cliente.vendedorId)}</Row>
                <Row label="Situação"><StatusBadge status={cliente.ativo ? 'ativo' : (cliente.status === 'lead' ? 'lead' : 'inativo')} /></Row>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ---------------- CONTATOS ---------------- */}
      {tab === 'contatos' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Contatos do cliente" sub={`${contatos.length} de 3`} icon={<Users2 size={18} />} />
          <div className="card-pad">
            {contatos.length ? (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {contatos.map((ct) => {
                  const dias = proxAniversario(ct.aniversario)
                  return (
                    <Card key={ct.id} pad>
                      <div className="flex gap-10" style={{ alignItems: 'center', marginBottom: 8 }}>
                        <Avatar name={ct.nome} sm />
                        <div className="bold">{ct.nome || '—'}</div>
                      </div>
                      <div className="col gap-8">
                        <Row label="CPF">{maskDoc(ct.cpf) || '—'}</Row>
                        <Row label="RG">{ct.rg || '—'}</Row>
                        <Row label="Aniversário"><span className="flex gap-6"><Cake size={13} className="mut" />{fmtDate(ct.aniversario)}</span></Row>
                        <Row label="WhatsApp">{maskPhone(ct.whatsapp) || '—'}</Row>
                        <Row label="E-mail">{ct.email || '—'}</Row>
                      </div>
                      {dias != null && (
                        <div className="mut" style={{ fontSize: 12, marginTop: 8 }}>
                          {dias === 0 ? '🎉 Aniversário é hoje!' : `Faltam ${dias} dia(s) para o aniversário.`}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            ) : (
              <EmptyState icon={<Users2 size={40} />} title="Nenhum contato cadastrado" sub="Edite o cliente para adicionar até 3 contatos." />
            )}
          </div>
        </Card>
      )}

      {/* ---------------- HISTÓRICO DE VENDAS ---------------- */}
      {tab === 'historico' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Histórico de vendas e cancelamentos" sub={`${historico.length} evento(s)`} icon={<History size={18} />} />
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Data</th><th>Tipo</th><th className="right">Equip.</th><th className="right">Valor unit.</th><th className="right">Mensalidade</th><th>Descrição</th></tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id}>
                    <td>{fmtDate(h.data)}</td>
                    <td>
                      {h.tipo === 'cancelamento'
                        ? <Badge tone="red"><TrendingDown size={12} /> Cancelamento</Badge>
                        : <Badge tone="green"><TrendingUp size={12} /> Venda</Badge>}
                    </td>
                    <td className="right mono">{h.quantidade}</td>
                    <td className="right mono">{BRL(h.valorUnit)}</td>
                    <td className="right mono bold">{BRL(h.valorMensal)}</td>
                    <td className="mut">{h.descricao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!historico.length && <EmptyState icon={<History size={40} />} title="Sem histórico de vendas" sub="Vendas e cancelamentos de equipamentos aparecerão aqui." />}
          </div>
        </Card>
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
            <CardHead title="Contas a receber" sub={`${contas.length} lançamento(s) · ${parcelasFuturas.length} parcela(s) de mensalidade em aberto`} icon={<DollarSign size={18} />} />
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
          footer={<><Btn onClick={() => setEditOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarEdicao} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Btn></>}
        >
          <PessoaForm kind="cliente" form={form} setForm={setForm} db={db} />
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
