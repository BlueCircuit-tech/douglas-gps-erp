import { useState, useMemo } from 'react'
import {
  FileText, Send, ExternalLink, CheckCircle2, ShieldCheck, Clock, FileSignature, Search, Eye,
} from 'lucide-react'
import { api, clientName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, todayISO, uid, maskDoc } from '../lib/format.js'
import {
  PageHead, Card, Stat, Btn, Field, EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

const TEMPLATES = [
  'Contrato Anual PJ',
  'Contrato Mensal PF',
  'Contrato de Comodato',
  'Termo de Adesão',
]

const AUTENTIQUE_SITE = 'https://www.autentique.com.br'

// Gera a prévia textual do contrato a partir do cliente + template selecionados.
function buildPreview(client, template, plano) {
  if (!client) return 'Selecione um cliente para visualizar a prévia do contrato.'
  const nome = client.nomeFantasia || client.razaoSocial
  const doc = client.cpfCnpj ? maskDoc(client.cpfCnpj) : '—'
  const docLabel = client.tipo === 'PJ' ? 'CNPJ' : 'CPF'
  const planoNome = plano?.nome || '—'
  const cidadeUf = client.endereco ? `${client.endereco.cidade || ''}/${client.endereco.uf || ''}` : '—'

  const corpo = {
    'Contrato Anual PJ':
`Vigência: 12 (doze) meses, renovável automaticamente.
Objeto: prestação de serviços de rastreamento veicular e monitoramento.
Plano contratado: ${planoNome} — mensalidade de ${BRL(client.valorMensal)}.
Instalação: ${BRL(client.valorInstalacao)} | Monitoramento: ${BRL(client.valorMonitoramento)}.
Multa rescisória proporcional ao período restante da fidelidade.`,
    'Contrato Mensal PF':
`Vigência: mensal, sem fidelidade, renovação automática.
Objeto: prestação de serviços de rastreamento veicular.
Plano contratado: ${planoNome} — mensalidade de ${BRL(client.valorMensal)}.
Instalação: ${BRL(client.valorInstalacao)}.
Cancelamento a qualquer momento mediante aviso prévio de 30 dias.`,
    'Contrato de Comodato':
`Objeto: cessão em comodato de equipamento rastreador GPS.
O equipamento permanece de propriedade da GPS RASTREAMENTO.
O COMODATÁRIO compromete-se a zelar pela conservação do equipamento.
Em caso de perda ou dano, será cobrado o valor de reposição.
Devolução obrigatória ao término da prestação de serviços.`,
    'Termo de Adesão':
`Termo de adesão aos serviços de rastreamento da GPS RASTREAMENTO.
Plano: ${planoNome} — mensalidade de ${BRL(client.valorMensal)}.
O ADERENTE declara estar ciente das condições gerais de uso.
Autoriza o tratamento de dados conforme a LGPD.`,
  }

  return (
`CONTRATO DE PRESTAÇÃO DE SERVIÇOS — ${template.toUpperCase()}

CONTRATADA: GPS RASTREAMENTO
CONTRATANTE: ${nome}
${docLabel}: ${doc}
Endereço: ${cidadeUf}

${corpo[template] || ''}

Foro eleito: comarca de ${client.endereco?.cidade || '—'}.
Assinatura digital realizada eletronicamente via Autentique,
com validade jurídica nos termos da MP 2.200-2/2001.

____________________________________
${nome} — ${fmtDate(todayISO())}`
  )
}

export default function Contratos() {
  const { db, loading, refetch } = useCollections(['contratos', 'clients', 'planos'])
  const { user } = useAuth()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ clientId: '', template: TEMPLATES[0] })

  const contratos = db.contratos || []

  const kpis = useMemo(() => {
    let enviados = 0, assinados = 0, pendentes = 0
    contratos.forEach((c) => {
      if (c.status === 'enviado') enviados++
      else if (c.status === 'assinado') assinados++
      else pendentes++
    })
    return { enviados, assinados, pendentes, total: contratos.length }
  }, [contratos])

  const list = useMemo(() => {
    const txt = q.trim().toLowerCase()
    return contratos.filter((c) => {
      if (filter !== 'todos' && c.status !== filter) return false
      if (!txt) return true
      return `${clientName(c.clientId)} ${c.template}`.toLowerCase().includes(txt)
    })
  }, [contratos, q, filter])

  const selClient = form.clientId ? (db.clients || []).find((c) => c.id === form.clientId) : null
  const selPlano = selClient ? (db.planos || []).find((p) => p.id === selClient.planoId) : null
  const preview = useMemo(() => buildPreview(selClient, form.template, selPlano), [selClient, form.template, selPlano])

  const abrirModal = () => {
    setForm({ clientId: '', template: TEMPLATES[0] })
    setOpen(true)
  }

  const enviar = async () => {
    if (!form.clientId) { toast('Selecione um cliente', 'error'); return }
    const hoje = todayISO()
    const link = 'https://app.autentique.com.br/documentos/' + uid('doc')
    setSaving(true)
    try {
      await api.contratos.insert({
        clientId: form.clientId,
        template: form.template,
        status: 'enviado',
        criadoEm: hoje,
        assinadoEm: null,
        autentiqueLink: link,
      })
      await api.documentos.insert({
        clientId: form.clientId,
        tipo: 'Contrato',
        nome: `${form.template}.pdf`,
        data: hoje,
      })
      logAudit(user.id, 'enviar', 'contrato', `${form.template} enviado para ${clientName(form.clientId)} (Autentique)`)
      toast('Contrato enviado para assinatura via Autentique')
      setOpen(false)
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const marcarAssinado = async (c) => {
    const hoje = todayISO()
    try {
      await api.contratos.update(c.id, { status: 'assinado', assinadoEm: hoje })
      logAudit(user.id, 'assinar', 'contrato', `${c.template} assinado por ${clientName(c.clientId)}`)
      toast('Contrato marcado como assinado')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Contratos" subtitle="Geração e assinatura digital de contratos via Autentique">
        <Btn variant="primary" icon={<Send size={16} />} onClick={abrirModal}>
          Enviar Contrato
        </Btn>
      </PageHead>

      {/* Banner informativo — integração Autentique (Tarefa 34) */}
      <Card pad className="mt-8" style={{ background: 'var(--blue-bg)', borderColor: 'var(--blue)' }}>
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <div className="stat-ico" style={{ background: 'var(--blue)', color: '#fff' }}>
            <ShieldCheck size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="bold">Assinatura digital integrada com a Autentique</div>
            <div className="mut" style={{ fontSize: 13 }}>
              Os contratos são enviados para assinatura eletrônica online com validade jurídica.
              Use o botão "Abrir no Autentique" em cada contrato para acompanhar o status da assinatura.
            </div>
          </div>
          <a className="btn btn-sm" href={AUTENTIQUE_SITE} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Acessar Autentique
          </a>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-4 mt-16">
        <Stat icon={<Send size={18} />} label="Enviados (aguardando)" value={kpis.enviados} tone="blue" />
        <Stat icon={<CheckCircle2 size={18} />} label="Assinados" value={kpis.assinados} tone="green" />
        <Stat icon={<Clock size={18} />} label="Pendentes" value={kpis.pendentes} tone="amber" />
        <Stat icon={<FileText size={18} />} label="Total de contratos" value={kpis.total} tone="purple" />
      </div>

      <Card className="mt-16">
        <div className="card-head">
          <div className="search" style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} className="mut" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente ou template..." style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }} />
          </div>
          <div className="spacer" />
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'todos', label: 'Todos' },
            { value: 'pendente', label: 'Pendentes' },
            { value: 'enviado', label: 'Enviados' },
            { value: 'assinado', label: 'Assinados' },
          ]} />
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th><th>Template</th><th>Status</th><th>Criado em</th><th>Assinado em</th><th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="bold">{clientName(c.clientId)}</td>
                  <td>
                    <div className="flex gap-6"><FileSignature size={14} className="mut" /> {c.template}</div>
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="mut">{fmtDate(c.criadoEm)}</td>
                  <td className="mut">{c.assinadoEm ? fmtDate(c.assinadoEm) : '—'}</td>
                  <td>
                    <div className="flex gap-8 right" style={{ justifyContent: 'flex-end' }}>
                      {c.autentiqueLink ? (
                        <a className="btn btn-sm" href={c.autentiqueLink} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} /> Abrir no Autentique
                        </a>
                      ) : (
                        <Btn size="sm" disabled icon={<ExternalLink size={14} />}>Abrir no Autentique</Btn>
                      )}
                      {c.status !== 'assinado' && (
                        <Btn size="sm" variant="green" icon={<CheckCircle2 size={14} />} onClick={() => marcarAssinado(c)}>
                          Marcar como assinado
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <EmptyState icon={<FileText size={40} />} title="Carregando contratos..." sub="Buscando no Supabase." />
          )}
          {!loading && !list.length && (
            <EmptyState
              icon={<FileText size={40} />}
              title="Nenhum contrato encontrado"
              sub="Ajuste os filtros ou envie um novo contrato para assinatura."
            />
          )}
        </div>
      </Card>

      {/* Modal — Enviar Contrato */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Enviar Contrato para Assinatura"
        icon={<Send size={20} color="var(--brand)" />}
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn variant="primary" icon={<Send size={16} />} onClick={enviar} disabled={saving}>{saving ? 'Enviando...' : 'Enviar via Autentique'}</Btn>
          </>
        }
      >
        <div className="form-row">
          <Field label="Cliente" required>
            <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
              <option value="">Selecione o cliente</option>
              {(db.clients || []).map((c) => (
                <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
              ))}
            </select>
          </Field>
          <Field label="Template do contrato">
            <select value={form.template} onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}>
              {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <div className="divider" />
        <div className="bold soft" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Eye size={15} /> Prévia do contrato
        </div>
        <pre
          className="mono"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            padding: 16,
            fontSize: 12.5,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            margin: 0,
            maxHeight: 320,
            overflow: 'auto',
            color: 'var(--text-soft)',
          }}
        >
          {preview}
        </pre>
        <div className="mut flex gap-6" style={{ fontSize: 12, marginTop: 10, alignItems: 'center' }}>
          <ShieldCheck size={14} /> Ao enviar, o documento é registrado e fica disponível para assinatura digital online na Autentique.
        </div>
      </Modal>
    </>
  )
}
