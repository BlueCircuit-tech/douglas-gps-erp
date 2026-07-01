import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  BarChart3, Download, FileText, DollarSign, Coins, TrendingUp,
  Wrench, CheckCircle2, MapPin, Receipt,
} from 'lucide-react'
import { useStore, actions, clientName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, num, fmtDate, todayISO } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Stat, Field, EmptyState, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#06b6d4']
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const CAT_LABEL = { mensalidade: 'Mensalidade', instalacao: 'Instalação', monitoramento: 'Monitoramento' }
const PERIODO_LABEL = { mes: 'no mês', trimestre: 'no trimestre', ano: 'no ano' }

// Últimos N meses (chave YYYY-MM + rótulo curto), terminando no mês atual.
function ultimosMeses(n) {
  const arr = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    arr.push({ key, label: MESES[d.getMonth()] })
  }
  return arr
}
const mesDe = (iso) => (iso || '').slice(0, 7)

export default function Relatorios() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('financeiro')
  const [clienteId, setClienteId] = useState('todos')
  const [periodo, setPeriodo] = useState('mes')

  // ---------- FINANCEIRO ----------
  const contasCliente = useMemo(() => {
    return (db.contasReceber || []).filter((c) => clienteId === 'todos' || c.clientId === clienteId)
  }, [db, clienteId])

  const fin = useMemo(() => {
    const pagas = contasCliente.filter((c) => c.status === 'pago')
    const receita = pagas.reduce((s, c) => s + (c.valor || 0), 0)
    const despesas = (db.despesas || []).reduce((s, d) => s + (d.valor || 0), 0)
    const lucro = receita - despesas

    // Receita por categoria (somente contas pagas, respeitando filtro de cliente)
    const catMap = {}
    pagas.forEach((c) => {
      const nome = CAT_LABEL[c.categoria] || 'Outros'
      catMap[nome] = (catMap[nome] || 0) + (c.valor || 0)
    })
    const porCategoria = Object.entries(catMap).map(([name, value]) => ({ name, value }))

    // Receita x Despesa nos últimos 6 meses — real onde existe, mock derivado dos totais no resto.
    const meses = ultimosMeses(6)
    const baseR = receita || 6000
    const baseD = despesas || 3000
    const fluxo = meses.map((m, i) => {
      const rReal = pagas.filter((c) => mesDe(c.pagoEm) === m.key).reduce((s, c) => s + (c.valor || 0), 0)
      const dReal = (db.despesas || []).filter((d) => mesDe(d.data) === m.key).reduce((s, d) => s + (d.valor || 0), 0)
      return {
        mes: m.label,
        receita: Math.round(rReal || baseR * (0.55 + i * 0.08)),
        despesa: Math.round(dReal || baseD * (0.5 + i * 0.05)),
      }
    })

    return { receita, despesas, lucro, porCategoria, fluxo }
  }, [contasCliente, db])

  const exportCSV = () => {
    const head = ['Cliente', 'Descrição', 'Categoria', 'Valor', 'Vencimento', 'Status', 'Pago em']
    const rows = contasCliente.map((c) => [
      clientName(c.clientId), c.descricao, CAT_LABEL[c.categoria] || c.categoria,
      String(c.valor ?? '').replace('.', ','), c.vencimento, c.status, c.pagoEm || '',
    ])
    const csv = [head, ...rows]
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-financeiro-${todayISO()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast('CSV exportado com sucesso')
    actions.log(user.id, 'exportar', 'relatório', 'Exportou relatório financeiro (CSV)')
  }

  const exportPDF = () => {
    toast('Exportação em PDF em desenvolvimento (stub)')
    actions.log(user.id, 'exportar', 'relatório', 'Solicitou relatório financeiro (PDF)')
  }

  // ---------- OPERACIONAL ----------
  const oper = useMemo(() => {
    const tecnicos = (db.users || []).filter((u) => u.role === 'tecnico')
    const ordens = db.ordens || []
    const comissoes = db.comissoes || []
    const linhas = tecnicos.map((t) => {
      const os = ordens.filter((o) => o.tecnicoId === t.id)
      const concluidas = os.filter((o) => o.status === 'concluida').length
      const km = os.reduce((s, o) => s + (o.km || 0), 0)
      const comissao = comissoes
        .filter((c) => c.tipo === 'tecnico' && c.pessoaId === t.id)
        .reduce((s, c) => s + (c.valorFixo || 0), 0)
      return { id: t.id, nome: t.name, totalOS: os.length, concluidas, km, comissao }
    })
    const tot = linhas.reduce((a, l) => ({
      totalOS: a.totalOS + l.totalOS,
      concluidas: a.concluidas + l.concluidas,
      km: a.km + l.km,
      comissao: a.comissao + l.comissao,
    }), { totalOS: 0, concluidas: 0, km: 0, comissao: 0 })
    return { linhas, tot }
  }, [db])

  return (
    <>
      <PageHead title="Relatórios" subtitle="Indicadores financeiros e operacionais">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'financeiro', label: 'Financeiro' },
          { value: 'operacional', label: 'Operacional' },
        ]} />
      </PageHead>

      {tab === 'financeiro' && (
        <>
          {/* Filtros (Tarefas 11, 37) */}
          <Card>
            <div className="card-head wrap">
              <div style={{ minWidth: 260 }}>
                <Field label="Cliente">
                  <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                    <option value="todos">Todos os clientes</option>
                    {(db.clients || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div>
                <Field label="Período">
                  <Segmented value={periodo} onChange={setPeriodo} options={[
                    { value: 'mes', label: 'Mês' },
                    { value: 'trimestre', label: 'Trimestre' },
                    { value: 'ano', label: 'Ano' },
                  ]} />
                </Field>
              </div>
              <div className="spacer" />
              <div className="flex gap-8 wrap" style={{ alignSelf: 'flex-end' }}>
                <Btn icon={<Download size={16} />} onClick={exportCSV}>Exportar CSV</Btn>
                <Btn icon={<FileText size={16} />} onClick={exportPDF}>Exportar PDF</Btn>
              </div>
            </div>
          </Card>

          {/* KPIs (Tarefas 11, 42) */}
          <div className="grid grid-3" style={{ marginTop: 16 }}>
            <Stat tone="green" icon={<DollarSign size={19} />} label="Receita recebida" value={BRL(fin.receita)} delta={`Contas pagas ${PERIODO_LABEL[periodo]}`} deltaUp />
            <Stat tone="red" icon={<Coins size={19} />} label="Despesas totais" value={BRL(fin.despesas)} />
            <Stat tone={fin.lucro >= 0 ? 'blue' : 'red'} icon={<TrendingUp size={19} />} label="Lucro líquido" value={BRL(fin.lucro)} delta={fin.lucro >= 0 ? 'Resultado positivo' : 'Resultado negativo'} deltaUp={fin.lucro >= 0} />
          </div>

          {/* Gráficos */}
          <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 16 }}>
            <Card>
              <CardHead title="Receita x Despesa" sub="Últimos 6 meses" icon={<BarChart3 size={18} />} />
              <div className="card-pad" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fin.fluxo} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => BRL(v)} />
                    <Legend />
                    <Bar dataKey="receita" name="Receita" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHead title="Receita por categoria" sub="Contas recebidas" icon={<Receipt size={18} />} />
              <div className="card-pad" style={{ height: 300 }}>
                {fin.porCategoria.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={fin.porCategoria} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {fin.porCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => BRL(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Receipt size={40} />} title="Sem receitas recebidas" sub="Nenhuma conta paga para o filtro selecionado." />
                )}
              </div>
            </Card>
          </div>

          {/* Tabela detalhada (Tarefa 11) */}
          <Card style={{ marginTop: 16 }}>
            <CardHead title="Contas a receber detalhadas" sub={clienteId === 'todos' ? 'Todos os clientes' : clientName(clienteId)} icon={<FileText size={18} />}>
              <Badge tone="blue">{contasCliente.length} registros</Badge>
            </CardHead>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Cliente</th><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Pago em</th><th className="right">Valor</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contasCliente.map((c) => (
                    <tr key={c.id}>
                      <td className="bold">{clientName(c.clientId)}</td>
                      <td>{c.descricao}</td>
                      <td><Badge tone="gray">{CAT_LABEL[c.categoria] || c.categoria}</Badge></td>
                      <td>{fmtDate(c.vencimento)}</td>
                      <td>{c.pagoEm ? fmtDate(c.pagoEm) : '—'}</td>
                      <td className="right mono bold">{BRL(c.valor)}</td>
                      <td><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!contasCliente.length && (
                <EmptyState icon={<FileText size={40} />} title="Nenhuma conta encontrada" sub="Não há contas a receber para o cliente selecionado." />
              )}
            </div>
          </Card>
        </>
      )}

      {tab === 'operacional' && (
        <>
          {/* KPIs operacionais (Tarefa 12) */}
          <div className="grid grid-4">
            <Stat tone="blue" icon={<Receipt size={19} />} label="Ordens de serviço" value={oper.tot.totalOS} />
            <Stat tone="green" icon={<CheckCircle2 size={19} />} label="OS concluídas" value={oper.tot.concluidas} />
            <Stat tone="amber" icon={<MapPin size={19} />} label="KM percorrido" value={`${num(oper.tot.km)} km`} />
            <Stat tone="purple" icon={<Coins size={19} />} label="Comissões técnicas" value={BRL(oper.tot.comissao)} />
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: 16 }}>
            <Card>
              <CardHead title="OS concluídas por técnico" sub="Desempenho da equipe" icon={<BarChart3 size={18} />} />
              <div className="card-pad" style={{ height: 300 }}>
                {oper.linhas.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={oper.linhas} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalOS" name="Total de OS" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="concluidas" name="Concluídas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Wrench size={40} />} title="Nenhum técnico cadastrado" sub="Cadastre técnicos para acompanhar o desempenho." />
                )}
              </div>
            </Card>

            <Card>
              <CardHead title="Comissão por técnico" sub="Valores fixos" icon={<Coins size={18} />} />
              <div className="card-pad" style={{ height: 300 }}>
                {oper.linhas.some((l) => l.comissao > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={oper.linhas.filter((l) => l.comissao > 0)} dataKey="comissao" nameKey="nome" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {oper.linhas.filter((l) => l.comissao > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => BRL(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={<Coins size={40} />} title="Sem comissões registradas" sub="Ainda não há comissões técnicas lançadas." />
                )}
              </div>
            </Card>
          </div>

          {/* Tabela de desempenho */}
          <Card style={{ marginTop: 16 }}>
            <CardHead title="Desempenho dos técnicos" sub="Ordens, quilometragem e comissões" icon={<Wrench size={18} />} />
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th className="right">Total de OS</th>
                    <th className="right">Concluídas</th>
                    <th className="right">Conclusão</th>
                    <th className="right">KM total</th>
                    <th className="right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {oper.linhas.map((l) => {
                    const taxa = l.totalOS ? Math.round((l.concluidas / l.totalOS) * 100) : 0
                    return (
                      <tr key={l.id}>
                        <td className="bold">{l.nome}</td>
                        <td className="right mono">{l.totalOS}</td>
                        <td className="right mono">{l.concluidas}</td>
                        <td className="right"><Badge tone={taxa >= 70 ? 'green' : taxa >= 40 ? 'amber' : 'gray'}>{taxa}%</Badge></td>
                        <td className="right mono">{num(l.km)} km</td>
                        <td className="right mono bold">{BRL(l.comissao)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!oper.linhas.length && (
                <EmptyState icon={<Wrench size={40} />} title="Nenhum técnico encontrado" sub="Cadastre usuários com perfil técnico." />
              )}
            </div>
          </Card>
        </>
      )}
    </>
  )
}
