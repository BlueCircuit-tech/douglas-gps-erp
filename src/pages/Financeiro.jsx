import { useState, useMemo } from 'react'
import {
  Plus, Wallet, Receipt, Coins, DollarSign, TrendingUp,
  Check, Trash2, Layers, Calculator,
} from 'lucide-react'
import { api, clientName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, isOverdue, todayISO, uid } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Stat, Field,
  EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

// ---------- Categorias ----------
const CAT_RECEBER = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'monitoramento', label: 'Monitoramento' },
]
const CAT_DESPESA = [
  { value: 'fornecedores', label: 'Fornecedores' },
  { value: 'telecom', label: 'Telecom' },
  { value: 'estrutura', label: 'Estrutura' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'logistica', label: 'Logística' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'administrativo', label: 'Administrativo' },
]
// Contas a pagar reaproveita o mesmo leque de classificações das despesas.
const CAT_PAGAR = CAT_DESPESA

const CAT_TONE = {
  mensalidade: 'blue', instalacao: 'purple', monitoramento: 'green',
  fornecedores: 'amber', telecom: 'blue', estrutura: 'gray', pessoal: 'purple',
  logistica: 'green', insumos: 'amber', marketing: 'red', administrativo: 'gray',
}
const catLabel = (v) => {
  const all = [...CAT_RECEBER, ...CAT_DESPESA]
  return all.find((c) => c.value === v)?.label || (v ? v[0].toUpperCase() + v.slice(1) : '—')
}

// Vencido = ainda não pago e com vencimento no passado.
const isVencido = (x) => x.status !== 'pago' && isOverdue(x.vencimento)

function StatusFin({ item }) {
  if (isVencido(item)) return <Badge tone="red" dot>Vencido</Badge>
  return <StatusBadge status={item.status} />
}

const emptyReceber = () => ({ clientId: '', descricao: '', categoria: 'mensalidade', valor: '', vencimento: todayISO() })
const emptyPagar = () => ({ descricao: '', categoria: 'fornecedores', valor: '', vencimento: todayISO() })
const emptyDespesa = () => ({ descricao: '', categoria: 'fornecedores', valor: '', data: todayISO() })

export default function Financeiro() {
  const { db, refetch } = useCollections(['contasReceber', 'contasPagar', 'despesas', 'clients'])
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('receber')
  const [fStatus, setFStatus] = useState('todos')

  const [openR, setOpenR] = useState(false)
  const [openP, setOpenP] = useState(false)
  const [openD, setOpenD] = useState(false)
  const [formR, setFormR] = useState(emptyReceber)
  const [formP, setFormP] = useState(emptyPagar)
  const [formD, setFormD] = useState(emptyDespesa)

  const setR = (patch) => setFormR((f) => ({ ...f, ...patch }))
  const setP = (patch) => setFormP((f) => ({ ...f, ...patch }))
  const setD = (patch) => setFormD((f) => ({ ...f, ...patch }))

  // ---------- KPIs ----------
  const k = useMemo(() => {
    const cr = db.contasReceber || []
    const cp = db.contasPagar || []
    const month = todayISO().slice(0, 7)
    const aberto = (arr) => arr.filter((x) => x.status !== 'pago').reduce((s, x) => s + (x.valor || 0), 0)
    const receberAberto = aberto(cr)
    const pagarAberto = aberto(cp)
    const recebidoMes = cr
      .filter((x) => x.status === 'pago' && (x.pagoEm || '').slice(0, 7) === month)
      .reduce((s, x) => s + (x.valor || 0), 0)
    return { receberAberto, pagarAberto, saldo: receberAberto - pagarAberto, recebidoMes }
  }, [db])

  // ---------- Listas filtradas ----------
  const aplicaStatus = (arr) => {
    if (fStatus === 'todos') return arr
    if (fStatus === 'pago') return arr.filter((x) => x.status === 'pago')
    if (fStatus === 'aberto') return arr.filter((x) => x.status !== 'pago' && !isVencido(x))
    if (fStatus === 'vencido') return arr.filter(isVencido)
    return arr
  }
  const listReceber = useMemo(() => aplicaStatus(db.contasReceber || []), [db, fStatus])
  const listPagar = useMemo(() => aplicaStatus(db.contasPagar || []), [db, fStatus])
  const despesas = db.despesas || []

  // Total de despesas por categoria (Tarefa 38)
  const despesasPorCat = useMemo(() => {
    const map = {}
    despesas.forEach((d) => { map[d.categoria] = (map[d.categoria] || 0) + (d.valor || 0) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [despesas])
  const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0)

  // ---------- Ações ----------
  const marcarPago = async (coll, item) => {
    try {
      await api[coll].update(item.id, { status: 'pago', pagoEm: todayISO() })
      logAudit(user.id, 'baixar', coll === 'contasReceber' ? 'conta a receber' : 'conta a pagar', `${item.descricao} · ${BRL(item.valor)}`)
      toast('Baixa registrada com sucesso')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }
  const excluir = async (coll, item, entidade) => {
    try {
      await api[coll].remove(item.id)
      logAudit(user.id, 'excluir', entidade, item.descricao)
      toast('Lançamento removido')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const salvarReceber = async () => {
    if (!formR.clientId) { toast('Selecione o cliente', 'error'); return }
    if (!formR.descricao.trim()) { toast('Informe a descrição', 'error'); return }
    const valor = +formR.valor
    if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); return }
    try {
      await api.contasReceber.insert({
        id: uid('cr'), clientId: formR.clientId, descricao: formR.descricao.trim(),
        categoria: formR.categoria, valor, vencimento: formR.vencimento, status: 'aberto',
      })
      logAudit(user.id, 'criar', 'conta a receber', `${formR.descricao.trim()} · ${BRL(valor)}`)
      toast('Conta a receber adicionada')
      setOpenR(false)
      setFormR(emptyReceber())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const salvarPagar = async () => {
    if (!formP.descricao.trim()) { toast('Informe a descrição', 'error'); return }
    const valor = +formP.valor
    if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); return }
    try {
      await api.contasPagar.insert({
        id: uid('cp'), descricao: formP.descricao.trim(), categoria: formP.categoria,
        valor, vencimento: formP.vencimento, status: 'aberto',
      })
      logAudit(user.id, 'criar', 'conta a pagar', `${formP.descricao.trim()} · ${BRL(valor)}`)
      toast('Conta a pagar adicionada')
      setOpenP(false)
      setFormP(emptyPagar())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const salvarDespesa = async () => {
    if (!formD.descricao.trim()) { toast('Informe a descrição', 'error'); return }
    const valor = +formD.valor
    if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); return }
    try {
      await api.despesas.insert({
        id: uid('de'), descricao: formD.descricao.trim(), categoria: formD.categoria,
        valor, data: formD.data,
      })
      logAudit(user.id, 'criar', 'despesa', `${formD.descricao.trim()} · ${catLabel(formD.categoria)} · ${BRL(valor)}`)
      toast('Despesa cadastrada')
      setOpenD(false)
      setFormD(emptyDespesa())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'aberto', label: 'Em aberto' },
    { value: 'vencido', label: 'Vencidos' },
    { value: 'pago', label: 'Pagos' },
  ]

  return (
    <>
      <PageHead title="Financeiro" subtitle="Contas a receber, contas a pagar e despesas">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'receber', label: 'Contas a Receber' },
          { value: 'pagar', label: 'Contas a Pagar' },
          { value: 'despesas', label: 'Despesas' },
        ]} />
      </PageHead>

      {/* KPIs */}
      <div className="grid grid-4">
        <Stat tone="green" icon={<Wallet size={19} />} label="A receber em aberto" value={BRL(k.receberAberto)} />
        <Stat tone="red" icon={<Receipt size={19} />} label="A pagar em aberto" value={BRL(k.pagarAberto)} />
        <Stat tone={k.saldo >= 0 ? 'blue' : 'amber'} icon={<DollarSign size={19} />} label="Saldo previsto" value={BRL(k.saldo)} />
        <Stat tone="purple" icon={<TrendingUp size={19} />} label="Recebido no mês" value={BRL(k.recebidoMes)} />
      </div>

      {/* CONTAS A RECEBER */}
      {tab === 'receber' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Contas a Receber" sub={`${listReceber.length} lançamento(s)`} icon={<Wallet size={18} />}>
            <Segmented value={fStatus} onChange={setFStatus} options={statusOptions} />
            <Btn variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => { setFormR(emptyReceber()); setOpenR(true) }}>
              Adicionar
            </Btn>
          </CardHead>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cliente</th><th>Descrição</th><th>Categoria</th>
                  <th className="right">Valor</th><th>Vencimento</th><th>Status</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listReceber.map((c) => (
                  <tr key={c.id}>
                    <td className="bold">{clientName(c.clientId)}</td>
                    <td>{c.descricao}</td>
                    <td><Badge tone={CAT_TONE[c.categoria] || 'gray'}>{catLabel(c.categoria)}</Badge></td>
                    <td className="right mono bold">{BRL(c.valor)}</td>
                    <td className={isVencido(c) ? 'bold' : ''} style={isVencido(c) ? { color: 'var(--red)' } : undefined}>{fmtDate(c.vencimento)}</td>
                    <td><StatusFin item={c} /></td>
                    <td className="right nowrap">
                      {c.status !== 'pago' && (
                        <Btn variant="green" size="sm" icon={<Check size={14} />} onClick={() => marcarPago('contasReceber', c)}>Pago</Btn>
                      )}
                      <Btn variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => excluir('contasReceber', c, 'conta a receber')} aria-label="Excluir" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!listReceber.length && <EmptyState icon={<Wallet size={40} />} title="Nenhuma conta a receber" sub="Ajuste o filtro ou adicione um lançamento." />}
          </div>
        </Card>
      )}

      {/* CONTAS A PAGAR */}
      {tab === 'pagar' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Contas a Pagar" sub={`${listPagar.length} lançamento(s)`} icon={<Receipt size={18} />}>
            <Segmented value={fStatus} onChange={setFStatus} options={statusOptions} />
            <Btn variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => { setFormP(emptyPagar()); setOpenP(true) }}>
              Adicionar
            </Btn>
          </CardHead>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Descrição</th><th>Categoria</th>
                  <th className="right">Valor</th><th>Vencimento</th><th>Status</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listPagar.map((c) => (
                  <tr key={c.id}>
                    <td className="bold">{c.descricao}</td>
                    <td><Badge tone={CAT_TONE[c.categoria] || 'gray'}>{catLabel(c.categoria)}</Badge></td>
                    <td className="right mono bold">{BRL(c.valor)}</td>
                    <td className={isVencido(c) ? 'bold' : ''} style={isVencido(c) ? { color: 'var(--red)' } : undefined}>{fmtDate(c.vencimento)}</td>
                    <td><StatusFin item={c} /></td>
                    <td className="right nowrap">
                      {c.status !== 'pago' && (
                        <Btn variant="green" size="sm" icon={<Check size={14} />} onClick={() => marcarPago('contasPagar', c)}>Pago</Btn>
                      )}
                      <Btn variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => excluir('contasPagar', c, 'conta a pagar')} aria-label="Excluir" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!listPagar.length && <EmptyState icon={<Receipt size={40} />} title="Nenhuma conta a pagar" sub="Ajuste o filtro ou adicione um lançamento." />}
          </div>
        </Card>
      )}

      {/* DESPESAS */}
      {tab === 'despesas' && (
        <div className="grid" style={{ gridTemplateColumns: '1.7fr 1fr', marginTop: 16 }}>
          <Card>
            <CardHead title="Despesas" sub={`${despesas.length} lançamento(s)`} icon={<Coins size={18} />}>
              <Btn variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => { setFormD(emptyDespesa()); setOpenD(true) }}>
                Adicionar
              </Btn>
            </CardHead>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Descrição</th><th>Categoria</th><th className="right">Valor</th><th>Data</th><th className="right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {despesas.map((d) => (
                    <tr key={d.id}>
                      <td className="bold">{d.descricao}</td>
                      <td><Badge tone={CAT_TONE[d.categoria] || 'gray'}>{catLabel(d.categoria)}</Badge></td>
                      <td className="right mono bold">{BRL(d.valor)}</td>
                      <td>{fmtDate(d.data)}</td>
                      <td className="right nowrap">
                        <Btn variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => excluir('despesas', d, 'despesa')} aria-label="Excluir" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!despesas.length && <EmptyState icon={<Coins size={40} />} title="Nenhuma despesa cadastrada" sub="Cadastre e classifique as despesas da operação." />}
            </div>
          </Card>

          <Card>
            <CardHead title="Resumo por categoria" sub="Total classificado" icon={<Layers size={18} />} />
            <div style={{ padding: '6px 0' }}>
              {despesasPorCat.map(([cat, total]) => (
                <div key={cat} className="between" style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
                  <Badge tone={CAT_TONE[cat] || 'gray'}>{catLabel(cat)}</Badge>
                  <span className="mono bold">{BRL(total)}</span>
                </div>
              ))}
              {!despesasPorCat.length && <div className="mut" style={{ padding: '18px' }}>Sem despesas para resumir.</div>}
              <div className="between" style={{ padding: '14px 18px' }}>
                <span className="bold flex gap-6"><Calculator size={15} /> Total geral</span>
                <span className="mono bold" style={{ fontSize: 15 }}>{BRL(totalDespesas)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Adicionar conta a receber */}
      <Modal open={openR} onClose={() => setOpenR(false)} title="Adicionar conta a receber" icon={<Wallet size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpenR(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarReceber}>Salvar</Btn></>}>
        <Field label="Cliente" required>
          <select value={formR.clientId} onChange={(e) => setR({ clientId: e.target.value })}>
            <option value="">Selecione o cliente</option>
            {(db.clients || []).map((c) => <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>)}
          </select>
        </Field>
        <Field label="Descrição" required>
          <input value={formR.descricao} onChange={(e) => setR({ descricao: e.target.value })} placeholder="Ex.: Mensalidade Junho/2026" />
        </Field>
        <div className="form-row-3">
          <Field label="Categoria">
            <select value={formR.categoria} onChange={(e) => setR({ categoria: e.target.value })}>
              {CAT_RECEBER.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Valor (R$)" required>
            <input type="number" step="0.01" min="0" value={formR.valor} onChange={(e) => setR({ valor: e.target.value })} />
          </Field>
          <Field label="Vencimento">
            <input type="date" value={formR.vencimento} onChange={(e) => setR({ vencimento: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Modal: Adicionar conta a pagar */}
      <Modal open={openP} onClose={() => setOpenP(false)} title="Adicionar conta a pagar" icon={<Receipt size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpenP(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarPagar}>Salvar</Btn></>}>
        <Field label="Descrição" required>
          <input value={formP.descricao} onChange={(e) => setP({ descricao: e.target.value })} placeholder="Ex.: Aluguel do escritório" />
        </Field>
        <div className="form-row-3">
          <Field label="Categoria">
            <select value={formP.categoria} onChange={(e) => setP({ categoria: e.target.value })}>
              {CAT_PAGAR.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Valor (R$)" required>
            <input type="number" step="0.01" min="0" value={formP.valor} onChange={(e) => setP({ valor: e.target.value })} />
          </Field>
          <Field label="Vencimento">
            <input type="date" value={formP.vencimento} onChange={(e) => setP({ vencimento: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Modal: Adicionar despesa */}
      <Modal open={openD} onClose={() => setOpenD(false)} title="Cadastrar despesa" icon={<Coins size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpenD(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarDespesa}>Salvar</Btn></>}>
        <Field label="Descrição" required>
          <input value={formD.descricao} onChange={(e) => setD({ descricao: e.target.value })} placeholder="Ex.: Combustível - frota técnica" />
        </Field>
        <div className="form-row-3">
          <Field label="Categoria" hint="Classificação contábil (Tarefa 38)">
            <select value={formD.categoria} onChange={(e) => setD({ categoria: e.target.value })}>
              {CAT_DESPESA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Valor (R$)" required>
            <input type="number" step="0.01" min="0" value={formD.valor} onChange={(e) => setD({ valor: e.target.value })} />
          </Field>
          <Field label="Data">
            <input type="date" value={formD.data} onChange={(e) => setD({ data: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
