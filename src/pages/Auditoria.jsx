import { useState, useMemo } from 'react'
import {
  ShieldCheck, Search, Download, Activity, Users, CalendarCheck,
  Filter, LogIn, LogOut, Plus, Pencil, CheckCircle2, Gift, Trash2, Bell,
} from 'lucide-react'
import { useStore, actions, userName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { fmtDateTime, todayISO } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Avatar, Stat, Field, EmptyState, useToast,
} from '../components/ui.jsx'

// Mapa de ação -> tom do Badge + rótulo pt-BR + ícone.
const ACAO = {
  login:    { tone: 'green',  label: 'Login',       Icon: LogIn },
  logout:   { tone: 'gray',   label: 'Logout',      Icon: LogOut },
  criar:    { tone: 'blue',   label: 'Criação',     Icon: Plus },
  editar:   { tone: 'amber',  label: 'Edição',      Icon: Pencil },
  concluir: { tone: 'green',  label: 'Conclusão',   Icon: CheckCircle2 },
  bonus:    { tone: 'purple', label: 'Bônus',       Icon: Gift },
  remover:  { tone: 'red',    label: 'Remoção',     Icon: Trash2 },
  exportar: { tone: 'blue',   label: 'Exportação',  Icon: Download },
}
const acaoInfo = (a) =>
  ACAO[a] || { tone: 'gray', label: a ? a[0].toUpperCase() + a.slice(1) : '—', Icon: Activity }

// Tipos de evento rastreados pelo sistema (para o painel informativo).
const RASTREADOS = [
  { acao: 'login',    txt: 'Entrada de usuário no sistema' },
  { acao: 'logout',   txt: 'Saída / encerramento de sessão' },
  { acao: 'criar',    txt: 'Cadastro de clientes, OS, contas e demais registros' },
  { acao: 'editar',   txt: 'Alteração de dados existentes' },
  { acao: 'concluir', txt: 'Conclusão de ordens de serviço e baixas' },
  { acao: 'bonus',    txt: 'Concessão de bônus / cortesias a clientes' },
  { acao: 'remover',  txt: 'Exclusão de registros' },
]

export default function Auditoria() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [fUser, setFUser] = useState('todos')
  const [fAcao, setFAcao] = useState('todos')

  const logs = db.auditLogs || []

  // Usuários e ações distintos presentes nos logs (para os selects).
  const usuariosPresentes = useMemo(() => {
    const ids = [...new Set(logs.map((l) => l.userId).filter(Boolean))]
    return ids.map((id) => ({ id, nome: userName(id) })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [logs])

  const acoesPresentes = useMemo(
    () => [...new Set(logs.map((l) => l.acao).filter(Boolean))],
    [logs],
  )

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase()
    return logs.filter((l) => {
      if (fUser !== 'todos' && l.userId !== fUser) return false
      if (fAcao !== 'todos' && l.acao !== fAcao) return false
      if (termo) {
        const txt = `${l.detalhe || ''} ${l.entidade || ''} ${userName(l.userId)}`.toLowerCase()
        if (!txt.includes(termo)) return false
      }
      return true
    })
  }, [logs, q, fUser, fAcao])

  // KPIs
  const total = logs.length
  const hoje = useMemo(
    () => logs.filter((l) => String(l.data || '').slice(0, 10) === todayISO()).length,
    [logs],
  )
  const usuariosAtivos = usuariosPresentes.length

  const temFiltro = q || fUser !== 'todos' || fAcao !== 'todos'
  const limpar = () => { setQ(''); setFUser('todos'); setFAcao('todos') }

  const exportarCSV = () => {
    if (!filtrados.length) { toast('Nenhum evento para exportar', 'error'); return }
    const head = ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Detalhe']
    const linhas = filtrados.map((l) => [
      fmtDateTime(l.data), userName(l.userId), acaoInfo(l.acao).label, l.entidade || '', l.detalhe || '',
    ])
    const csv = [head, ...linhas]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    actions.log(user.id, 'exportar', 'auditoria', `Exportou relatório de auditoria (${filtrados.length} eventos)`)
    toast('Relatório exportado com sucesso')
  }

  return (
    <>
      <PageHead
        title="Auditoria & Logs"
        subtitle="Trilha completa de tudo o que acontece no sistema — login, cadastros, edições, conclusões e bônus"
      >
        <Btn icon={<Download size={16} />} onClick={exportarCSV}>Exportar CSV</Btn>
      </PageHead>

      {/* KPIs */}
      <div className="grid grid-3">
        <Stat tone="blue" icon={<Activity size={19} />} label="Total de eventos" value={total} />
        <Stat tone="green" icon={<CalendarCheck size={19} />} label="Eventos hoje" value={hoje} />
        <Stat tone="purple" icon={<Users size={19} />} label="Usuários ativos" value={usuariosAtivos} />
      </div>

      {/* Filtros + tabela */}
      <Card className="mt-16">
        <div className="card-head">
          <div
            className="search"
            style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Search size={16} className="mut" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar no detalhe, entidade ou usuário..."
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
            />
          </div>
          <div className="spacer" />
          <div className="flex gap-8 wrap" style={{ alignItems: 'flex-end' }}>
            <Field label="Usuário">
              <select value={fUser} onChange={(e) => setFUser(e.target.value)}>
                <option value="todos">Todos os usuários</option>
                {usuariosPresentes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </Field>
            <Field label="Ação">
              <select value={fAcao} onChange={(e) => setFAcao(e.target.value)}>
                <option value="todos">Todas as ações</option>
                {acoesPresentes.map((a) => <option key={a} value={a}>{acaoInfo(a).label}</option>)}
              </select>
            </Field>
            {temFiltro && (
              <Btn size="sm" variant="ghost" icon={<Filter size={14} />} onClick={limpar}>Limpar</Btn>
            )}
          </div>
        </div>

        <div className="card-pad" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="mut" style={{ fontSize: 12.5 }}>
            {filtrados.length} de {total} evento(s) · mais recentes primeiro
          </div>
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 170 }}>Data / Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => {
                const { tone, label, Icon } = acaoInfo(l.acao)
                return (
                  <tr key={l.id}>
                    <td className="mut nowrap" style={{ fontSize: 12.5 }}>{fmtDateTime(l.data)}</td>
                    <td>
                      <div className="flex gap-8">
                        <Avatar name={userName(l.userId)} sm />
                        <span className="bold" style={{ fontSize: 13 }}>{userName(l.userId)}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={tone}><Icon size={12} /> {label}</Badge>
                    </td>
                    <td className="soft" style={{ textTransform: 'capitalize' }}>{l.entidade || '—'}</td>
                    <td>{l.detalhe || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!filtrados.length && (
            <EmptyState
              icon={<ShieldCheck size={40} />}
              title="Nenhum evento encontrado"
              sub={temFiltro ? 'Ajuste os filtros para ver mais registros.' : 'As ações dos usuários aparecerão aqui automaticamente.'}
            />
          )}
        </div>
      </Card>

      {/* Painel: o que é registrado */}
      <Card className="mt-16">
        <CardHead
          title="O que o sistema registra"
          sub="Cada operação relevante gera um log imutável com usuário, data e detalhe"
          icon={<Bell size={18} />}
        />
        <div className="card-pad grid grid-2">
          {RASTREADOS.map((r) => {
            const { tone, label, Icon } = acaoInfo(r.acao)
            return (
              <div key={r.acao} className="flex gap-8" style={{ alignItems: 'center', padding: '6px 0' }}>
                <Badge tone={tone}><Icon size={12} /> {label}</Badge>
                <span className="mut" style={{ fontSize: 13 }}>{r.txt}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}
