import { useState, useMemo } from 'react'
import {
  Calculator, FileText, Plus, Download, ShieldCheck, Receipt,
  DollarSign, CheckCircle2, AlertTriangle, Check,
} from 'lucide-react'
import { useStore, actions, clientName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, uid, todayISO } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Stat, Field, EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

const emptyForm = () => ({ clientId: '', tipo: 'NFS-e', valor: 0 })

// Próximo número sequencial (mantém o padrão 000000000 do seed).
const proximoNumero = (notas) => {
  const nums = (notas || [])
    .map((n) => parseInt(n.numero, 10))
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return String(max + 1).padStart(9, '0')
}

export default function Contabilidade() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [statusFilter, setStatusFilter] = useState('todos')
  const [tipoFilter, setTipoFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  // Contador acessa o módulo apenas para consulta (Tarefa 41).
  const somenteLeitura = user?.role === 'contador'

  const notas = db.notasFiscais || []
  const thisMonth = new Date().toISOString().slice(0, 7)

  const kpis = useMemo(() => {
    const emitidas = notas.filter((n) => n.status === 'emitida').length
    const pendentes = notas.filter((n) => n.status === 'pendente').length
    const totalMes = notas
      .filter((n) => n.status === 'emitida' && (n.emitidaEm || '').slice(0, 7) === thisMonth)
      .reduce((s, n) => s + (Number(n.valor) || 0), 0)
    return { emitidas, pendentes, totalMes }
  }, [notas, thisMonth])

  const lista = useMemo(() => {
    return notas.filter((n) => {
      if (statusFilter !== 'todos' && n.status !== statusFilter) return false
      if (tipoFilter !== 'todos' && n.tipo !== tipoFilter) return false
      return true
    })
  }, [notas, statusFilter, tipoFilter])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const salvar = () => {
    if (!form.clientId) { toast('Selecione o cliente', 'error'); return }
    const valor = Number(form.valor) || 0
    if (valor <= 0) { toast('Informe um valor válido', 'error'); return }
    const nova = {
      id: uid('nf'),
      clientId: form.clientId,
      numero: '',
      tipo: form.tipo,
      valor,
      status: 'pendente',
      emitidaEm: null,
      spedyId: '',
    }
    actions.add('notasFiscais', nova)
    actions.log(user.id, 'criar', 'nota fiscal', `Nova ${form.tipo} pendente para ${clientName(form.clientId)} (${BRL(valor)})`)
    toast('Nota fiscal criada (pendente)')
    setOpen(false)
    setForm(emptyForm())
  }

  const emitir = (nf) => {
    const numero = proximoNumero(notas)
    actions.patch('notasFiscais', nf.id, {
      status: 'emitida',
      numero,
      emitidaEm: todayISO(),
      spedyId: uid('spedy'),
    })
    actions.log(user.id, 'emitir', 'nota fiscal', `${nf.tipo} nº ${numero} emitida para ${clientName(nf.clientId)} (${BRL(nf.valor)})`)
    toast(`Nota ${numero} emitida via Spedy`)
  }

  const baixar = (nf) => {
    // Stub — download de XML/PDF dependerá da integração com a Spedy (Tarefa 43).
    toast('Download de XML/PDF disponível após a integração com a Spedy')
  }

  return (
    <>
      <PageHead title="Contabilidade · Notas Fiscais" subtitle="Emissão e gestão de NFS-e / NF-e dos clientes">
        {!somenteLeitura && (
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setForm(emptyForm()); setOpen(true) }}>
            Nova NF
          </Btn>
        )}
      </PageHead>

      {/* Banner de integração com a Spedy (Tarefa 43) */}
      <Card pad style={{ marginBottom: 16, borderLeft: '3px solid var(--amber)' }}>
        <div className="flex gap-12 wrap" style={{ alignItems: 'center' }}>
          <div className="stat-ico" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
            <ShieldCheck size={20} />
          </div>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div className="bold soft">Integração automática com a Spedy</div>
            <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>
              Emissão automática de notas fiscais via{' '}
              <a href="https://spedy.com.br" target="_blank" rel="noreferrer" className="bold">spedy.com.br</a>.
              Os botões de emissão simulam o fluxo enquanto a conexão real não está ativa.
            </div>
          </div>
          <div className="spacer" />
          <Badge tone="amber" dot>Aguardando credenciais</Badge>
        </div>
      </Card>

      {/* Aviso discreto sobre o perfil Contador (Tarefa 41) */}
      <div className="mut flex gap-6" style={{ fontSize: 12.5, marginBottom: 16, alignItems: 'center' }}>
        <Calculator size={14} />
        {somenteLeitura
          ? 'Você está conectado como Contador — acesso somente leitura às notas fiscais.'
          : 'Módulo acessível aos perfis Contabilidade e Contador (o contador visualiza as notas em modo consulta).'}
      </div>

      {/* KPIs */}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Stat icon={<CheckCircle2 size={18} />} tone="green" label="NF emitidas" value={kpis.emitidas} />
        <Stat icon={<AlertTriangle size={18} />} tone="amber" label="NF pendentes" value={kpis.pendentes} />
        <Stat icon={<DollarSign size={18} />} tone="blue" label="Emitido no mês" value={BRL(kpis.totalMes)} />
      </div>

      <Card>
        <div className="card-head">
          <Receipt size={18} className="mut" />
          <div><h3>Notas fiscais</h3></div>
          <div className="spacer" />
          <div className="flex gap-8 wrap" style={{ alignItems: 'center' }}>
            <Segmented value={statusFilter} onChange={setStatusFilter} options={[
              { value: 'todos', label: 'Todas' },
              { value: 'emitida', label: 'Emitidas' },
              { value: 'pendente', label: 'Pendentes' },
            ]} />
            <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} style={{ maxWidth: 140 }}>
              <option value="todos">Todos os tipos</option>
              <option value="NFS-e">NFS-e</option>
              <option value="NF-e">NF-e</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th><th>Número</th><th>Tipo</th><th>Valor</th>
                <th>Status</th><th>Emissão</th><th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((nf) => (
                <tr key={nf.id}>
                  <td className="bold">{clientName(nf.clientId)}</td>
                  <td className="mono">{nf.numero || '—'}</td>
                  <td><Badge tone={nf.tipo === 'NF-e' ? 'purple' : 'blue'}>{nf.tipo}</Badge></td>
                  <td className="mono bold">{BRL(nf.valor)}</td>
                  <td><StatusBadge status={nf.status} /></td>
                  <td className="mut">{fmtDate(nf.emitidaEm)}</td>
                  <td className="right">
                    <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                      {nf.status === 'pendente'
                        ? (
                          <Btn variant="primary" size="sm" icon={<Check size={14} />}
                            disabled={somenteLeitura} onClick={() => emitir(nf)}>
                            Emitir NF
                          </Btn>
                        )
                        : (
                          <Btn variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => baixar(nf)}>
                            XML/PDF
                          </Btn>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lista.length && (
            <EmptyState icon={<FileText size={40} />} title="Nenhuma nota fiscal encontrada"
              sub="Ajuste os filtros ou crie uma nova nota fiscal." />
          )}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova Nota Fiscal"
        icon={<FileText size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvar}>Criar nota</Btn></>}>
        <Field label="Cliente" required>
          <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
            <option value="">Selecione o cliente</option>
            {(db.clients || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Tipo de nota">
            <Segmented value={form.tipo} onChange={(v) => set({ tipo: v })} options={[
              { value: 'NFS-e', label: 'NFS-e (serviço)' },
              { value: 'NF-e', label: 'NF-e (produto)' },
            ]} />
          </Field>
          <Field label="Valor (R$)" required>
            <input type="number" step="0.01" min="0" value={form.valor}
              onChange={(e) => set({ valor: +e.target.value })} />
          </Field>
        </div>
        <div className="mut" style={{ fontSize: 12.5 }}>
          A nota é criada como <b>pendente</b>. Use “Emitir NF” na lista para gerar o número via Spedy.
        </div>
      </Modal>
    </>
  )
}
