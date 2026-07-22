import { useState, useMemo } from 'react'
import {
  Plus, Wallet, Receipt, DollarSign, TrendingUp,
  Check, Trash2, Layers, Calculator, CalendarClock,
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
]
const CAT_TONE = {
  mensalidade: 'blue', instalacao: 'purple',
  fornecedores: 'amber', telecom: 'blue', estrutura: 'gray', pessoal: 'purple',
  logistica: 'green', insumos: 'amber', marketing: 'red', administrativo: 'gray',
}
const catLabel = (v) => {
  const all = [...CAT_RECEBER]
  return all.find((c) => c.value === v)?.label || (v ? v[0].toUpperCase() + v.slice(1) : '—')
}

// Vencido = ainda não pago e com vencimento no passado.
const isVencido = (x) => x.status !== 'pago' && isOverdue(x.vencimento)

function StatusFin({ item }) {
  if (isVencido(item)) return <Badge tone="red" dot>Vencido</Badge>
  return <StatusBadge status={item.status} />
}

const emptyReceber = () => ({ clientId: '', descricao: '', categoria: 'mensalidade', valor: '', vencimento: todayISO(), prazoMeses: '1' })
const emptyPagar = () => ({ descricao: '', fornecedorId: '', valor: '', vencimento: todayISO() })

export default function Financeiro() {
  const { db, refetch } = useCollections(['contasReceber', 'contasPagar', 'fornecedores', 'clients'])
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('receber')
  const [fStatus, setFStatus] = useState('todos')

  const [openR, setOpenR] = useState(false)
  const [openP, setOpenP] = useState(false)
  const [formR, setFormR] = useState(emptyReceber)
  const [formP, setFormP] = useState(emptyPagar)

  const setR = (patch) => setFormR((f) => ({ ...f, ...patch }))
  const setP = (patch) => setFormP((f) => ({ ...f, ...patch }))

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

  // Totais por categoria nas contas a receber
  const totaisReceberCat = useMemo(() => {
    const map = {}
    ;(db.contasReceber || []).forEach((c) => {
      const cat = c.categoria || 'outros'
      map[cat] = (map[cat] || 0) + (c.valor || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [db.contasReceber])
  const totalReceberGeral = useMemo(() => (db.contasReceber || []).reduce((s, c) => s + (c.valor || 0), 0), [db.contasReceber])

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
    const prazo = Number(formR.prazoMeses) || 1
    try {
      if (prazo > 1) {
        const valorParcela = +(valor / prazo).toFixed(2)
        const diff = +(valor - valorParcela * prazo).toFixed(2)
        const rows = []
        for (let i = 0; i < prazo; i++) {
          const d = new Date(formR.vencimento || todayISO())
          d.setMonth(d.getMonth() + i)
          const venc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`
          rows.push({
            id: uid('cr'),
            clientId: formR.clientId,
            descricao: `${formR.descricao.trim()} — parcela ${i + 1}/${prazo}`,
            categoria: formR.categoria,
            valor: i === 0 ? +(valorParcela + diff).toFixed(2) : valorParcela,
            vencimento: venc,
            status: 'aberto',
          })
        }
        await api.contasReceber.insertMany(rows)
        logAudit(user.id, 'criar', 'conta a receber', `${formR.descricao.trim()} · ${prazo}x ${BRL(valorParcela)}`)
        toast(`${prazo} parcelas geradas com sucesso`)
      } else {
        await api.contasReceber.insert({
          id: uid('cr'), clientId: formR.clientId, descricao: formR.descricao.trim(),
          categoria: formR.categoria, valor, vencimento: formR.vencimento, status: 'aberto',
        })
        logAudit(user.id, 'criar', 'conta a receber', `${formR.descricao.trim()} · ${BRL(valor)}`)
        toast('Conta a receber adicionada')
      }
      setOpenR(false)
      setFormR(emptyReceber())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const salvarPagar = async () => {
    if (!formP.fornecedorId) { toast('Informe o fornecedor', 'error'); return }
    if (!formP.descricao.trim()) { toast('Informe a descrição', 'error'); return }
    const valor = +formP.valor
    if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); return }
    try {
      await api.contasPagar.insert({
        id: uid('cp'), descricao: formP.descricao.trim(), fornecedorId: formP.fornecedorId,
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

  const excluirPagar = async (item) => {
    try {
      await api.contasPagar.remove(item.id)
      logAudit(user.id, 'excluir', 'conta a pagar', item.descricao)
      toast('Lançamento removido')
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
      <PageHead title="Financeiro" subtitle="Contas a receber, contas a pagar e resumo por categoria">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'receber', label: 'Contas a Receber' },
          { value: 'pagar', label: 'Contas a Pagar' },
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12, marginTop: 16 }}>
        <Card>
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
        <Card>
          <CardHead title="Resumo por categoria" sub="Total classificado" icon={<Layers size={18} />} />
          <div style={{ padding: '6px 0' }}>
            {totaisReceberCat.map(([cat, total]) => (
              <div key={cat} className="between" style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
                <Badge tone={CAT_TONE[cat] || 'gray'}>{catLabel(cat)}</Badge>
                <span className="mono bold">{BRL(total)}</span>
              </div>
            ))}
            {!totaisReceberCat.length && <div className="mut" style={{ padding: '18px' }}>Sem lançamentos.</div>}
            <div className="between" style={{ padding: '14px 18px' }}>
              <span className="bold flex gap-6"><Calculator size={15} /> Total geral</span>
              <span className="mono bold" style={{ fontSize: 15 }}>{BRL(totalReceberGeral)}</span>
            </div>
          </div>
        </Card>
        </div>
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
                  <th>Descrição</th><th>Fornecedor</th>
                  <th className="right">Valor</th><th>Vencimento</th><th>Status</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listPagar.map((c) => {
                  const forn = (db.fornecedores || []).find((f) => f.id === c.fornecedorId)
                  return (
                    <tr key={c.id}>
                      <td className="bold">{c.descricao}</td>
                      <td>{forn?.nomeFantasia || forn?.razaoSocial || '—'}</td>
                      <td className="right mono bold">{BRL(c.valor)}</td>
                      <td className={isVencido(c) ? 'bold' : ''} style={isVencido(c) ? { color: 'var(--red)' } : undefined}>{fmtDate(c.vencimento)}</td>
                      <td><StatusFin item={c} /></td>
                      <td className="right nowrap">
                        {c.status !== 'pago' && (
                          <Btn variant="green" size="sm" icon={<Check size={14} />} onClick={() => marcarPago('contasPagar', c)}>Pago</Btn>
                        )}
                        <Btn variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => excluirPagar(c)} aria-label="Excluir" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!listPagar.length && <EmptyState icon={<Receipt size={40} />} title="Nenhuma conta a pagar" sub="Ajuste o filtro ou adicione um lançamento." />}
          </div>
        </Card>
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
        <Field label="Prazo (meses)" hint="Gera N parcelas mensais — use para mensalidades ou instalações parceladas">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min="1" max="48" value={formR.prazoMeses} onChange={(e) => setR({ prazoMeses: e.target.value })} style={{ width: 80 }} />
            <CalendarClock size={15} className="mut" />
          </div>
        </Field>
      </Modal>

      {/* Modal: Adicionar conta a pagar */}
      <Modal open={openP} onClose={() => setOpenP(false)} title="Adicionar conta a pagar" icon={<Receipt size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpenP(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarPagar}>Salvar</Btn></>}>
        <Field label="Descrição" required>
          <input value={formP.descricao} onChange={(e) => setP({ descricao: e.target.value })} placeholder="Ex.: Aluguel do escritório" />
        </Field>
        <Field label="Fornecedor">
          <select value={formP.fornecedorId} onChange={(e) => setP({ fornecedorId: e.target.value })}>
            <option value="">Selecione o fornecedor</option>
            {(db.fornecedores || []).map((f) => <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>)}
          </select>
        </Field>
        <div className="form-row-3">
          <Field label="Valor (R$)" required>
            <input type="number" step="0.01" min="0" value={formP.valor} onChange={(e) => setP({ valor: e.target.value })} />
          </Field>
          <Field label="Vencimento">
            <input type="date" value={formP.vencimento} onChange={(e) => setP({ vencimento: e.target.value })} />
          </Field>
        </div>
      </Modal>

    </>
  )
}
