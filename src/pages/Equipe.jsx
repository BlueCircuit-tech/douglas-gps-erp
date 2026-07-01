import { useState, useMemo } from 'react'
import {
  Users, UserPlus, ShieldCheck, Wrench, Calculator, TrendingUp,
  Receipt, Package, Search, Pencil, Power,
} from 'lucide-react'
import { useStore, actions } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, uid } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Avatar, Stat, Field,
  EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'
import { ROLES } from '../data/seed.js'
import { PERMISSIONS, MODULES } from '../auth/permissions.js'

// Ícone por perfil (apoia os KPIs por papel)
const ROLE_ICON = {
  admin: ShieldCheck,
  vendedor: TrendingUp,
  tecnico: Wrench,
  operacional: Package,
  contabilidade: Calculator,
  contador: Receipt,
}

// Tom do Badge a partir da cor do perfil (ROLES[role].color = 'b-xxx' → 'xxx')
const roleTone = (role) => (ROLES[role]?.color || 'b-gray').replace('b-', '')

const emptyForm = () => ({ name: '', email: '', role: 'vendedor', comissaoFixa: 80, valorKm: 1.20 })

export default function Equipe() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const users = db.users || []

  // KPIs por contagem de papel
  const counts = useMemo(() => {
    const c = {}
    Object.keys(ROLES).forEach((r) => { c[r] = 0 })
    users.forEach((u) => { c[u.role] = (c[u.role] || 0) + 1 })
    return c
  }, [users])

  const total = users.length
  const ativos = users.filter((u) => u.active).length

  const list = useMemo(() => {
    return users.filter((u) => {
      if (filter !== 'todos' && u.role !== filter) return false
      const txt = `${u.name} ${u.email} ${ROLES[u.role]?.label || ''}`.toLowerCase()
      return txt.includes(q.toLowerCase())
    })
  }, [users, q, filter])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const abrirNovo = (role = 'vendedor') => {
    setEditId(null)
    setForm({ ...emptyForm(), role })
    setOpen(true)
  }
  const abrirEdicao = (u) => {
    setEditId(u.id)
    setForm({
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'vendedor',
      comissaoFixa: u.comissaoFixa ?? 80,
      valorKm: u.valorKm ?? 1.20,
    })
    setOpen(true)
  }

  const salvar = () => {
    if (!form.name.trim()) { toast('Informe o nome do membro', 'error'); return }
    const payload = { name: form.name.trim(), email: form.email.trim(), role: form.role }
    if (form.role === 'vendedor') payload.comissaoFixa = Number(form.comissaoFixa) || 0
    if (form.role === 'tecnico') payload.valorKm = Number(form.valorKm) || 0

    if (editId) {
      actions.patch('users', editId, payload)
      actions.log(user.id, 'editar', 'equipe', `Membro atualizado: ${payload.name} (${ROLES[payload.role]?.label})`)
      toast('Membro atualizado com sucesso')
    } else {
      actions.add('users', { id: uid('u'), active: true, ...payload })
      actions.log(user.id, 'criar', 'equipe', `Novo membro: ${payload.name} (${ROLES[payload.role]?.label})`)
      toast('Membro adicionado com sucesso')
    }
    setOpen(false)
    setEditId(null)
    setForm(emptyForm())
  }

  const toggleAtivo = (u) => {
    if (u.id === user.id && u.active) {
      toast('Você não pode desativar o próprio acesso', 'error')
      return
    }
    actions.patch('users', u.id, { active: !u.active })
    actions.log(user.id, u.active ? 'desativar' : 'ativar', 'equipe', `${u.active ? 'Desativou' : 'Ativou'} ${u.name}`)
    toast(u.active ? 'Membro desativado' : 'Membro ativado')
  }

  // Coluna de remuneração específica por papel
  const remun = (u) => {
    if (u.role === 'vendedor') {
      return (
        <div>
          <span className="mono bold">{BRL(u.comissaoFixa || 0)}</span>
          <div className="mut" style={{ fontSize: 11 }}>comissão fixa / venda</div>
        </div>
      )
    }
    if (u.role === 'tecnico') {
      return (
        <div>
          <span className="mono bold">{BRL(u.valorKm || 0)}</span>
          <div className="mut" style={{ fontSize: 11 }}>valor por km rodado</div>
        </div>
      )
    }
    return <span className="mut">—</span>
  }

  // Módulos que o perfil selecionado no formulário poderá acessar (Tarefa 14)
  const modulosDoPerfil = (PERMISSIONS[form.role] || []).map((k) => MODULES[k]?.label).filter(Boolean)

  const segOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'vendedor', label: 'Vendedores' },
    { value: 'tecnico', label: 'Técnicos' },
    { value: 'operacional', label: 'Operacional' },
    { value: 'contabilidade', label: 'Contabilidade' },
    { value: 'contador', label: 'Contador' },
    { value: 'admin', label: 'Admin' },
  ]

  return (
    <>
      <PageHead
        title="Equipe"
        subtitle={`${total} membros · ${ativos} ativos · ${counts.vendedor} vendedores · ${counts.tecnico} técnicos`}
      >
        <Btn variant="ghost" icon={<TrendingUp size={16} />} onClick={() => abrirNovo('vendedor')}>Vendedor</Btn>
        <Btn variant="ghost" icon={<Wrench size={16} />} onClick={() => abrirNovo('tecnico')}>Técnico</Btn>
        <Btn variant="primary" icon={<UserPlus size={16} />} onClick={() => abrirNovo()}>Adicionar membro</Btn>
      </PageHead>

      {/* KPIs por contagem de papel */}
      <div className="grid grid-3">
        {Object.keys(ROLES).map((role) => {
          const Ico = ROLE_ICON[role] || Users
          return (
            <Stat
              key={role}
              tone={roleTone(role)}
              icon={<Ico size={18} />}
              label={ROLES[role].label}
              value={counts[role] || 0}
            />
          )
        })}
      </div>

      <Card className="mt-16">
        <div className="card-head">
          <div className="search" style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} className="mut" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou perfil..." style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }} />
          </div>
          <div className="spacer" />
          <Segmented value={filter} onChange={setFilter} options={segOptions} />
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Membro</th><th>E-mail</th><th>Perfil</th><th>Comissão / km</th><th>Status</th><th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex gap-12">
                      <Avatar name={u.name} />
                      <div>
                        <div className="bold">
                          {u.name}
                          {u.id === user.id && <Badge tone="blue">você</Badge>}
                        </div>
                        <div className="mut" style={{ fontSize: 12 }}>{ROLES[u.role]?.label || u.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mut">{u.email || '—'}</td>
                  <td><Badge tone={roleTone(u.role)}>{ROLES[u.role]?.label || u.role}</Badge></td>
                  <td>{remun(u)}</td>
                  <td><StatusBadge status={u.active ? 'ativo' : 'inativo'} /></td>
                  <td className="right nowrap">
                    <Btn size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => abrirEdicao(u)}>Editar</Btn>
                    <Btn
                      size="sm"
                      variant={u.active ? 'danger' : 'green'}
                      icon={<Power size={14} />}
                      onClick={() => toggleAtivo(u)}
                    >
                      {u.active ? 'Desativar' : 'Ativar'}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && (
            <EmptyState
              icon={<Users size={40} />}
              title="Nenhum membro encontrado"
              sub="Ajuste a busca/filtro ou adicione um novo membro à equipe."
            />
          )}
        </div>
      </Card>

      {/* Permissões granulares por perfil (Tarefa 14) */}
      <Card className="mt-16">
        <CardHead
          title="Permissões por perfil"
          sub="Cada papel acessa módulos diferentes do sistema (Tarefa 14)"
          icon={<ShieldCheck size={18} color="var(--brand)" />}
        />
        <div className="card-pad col gap-12">
          {Object.keys(ROLES).map((role) => (
            <div
              key={role}
              className="flex gap-12 wrap"
              style={{ alignItems: 'flex-start', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ minWidth: 150 }}>
                <Badge tone={roleTone(role)}>{ROLES[role].label}</Badge>
              </div>
              <div className="flex wrap gap-8">
                {(PERMISSIONS[role] || []).map((key) => (
                  <span key={key} className="pill">{MODULES[key]?.label || key}</span>
                ))}
              </div>
            </div>
          ))}
          <div className="mut" style={{ fontSize: 12.5 }}>
            O menu lateral e as rotas consultam estas permissões: cada perfil enxerga apenas os módulos liberados.
          </div>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Editar membro' : 'Adicionar membro'}
        icon={<UserPlus size={20} color="var(--brand)" />}
        footer={<>
          <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={salvar}>{editId ? 'Salvar alterações' : 'Adicionar membro'}</Btn>
        </>}
      >
        <div className="form-row">
          <Field label="Nome completo" required>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Ana Souza" />
          </Field>
          <Field label="E-mail">
            <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="nome@gpsrastreamento.com" />
          </Field>
        </div>

        <Field label="Perfil de acesso" hint="Define os módulos liberados (Tarefas 14, 41)">
          <select value={form.role} onChange={(e) => set({ role: e.target.value })}>
            {Object.entries(ROLES).map(([key, r]) => (
              <option key={key} value={key}>{r.label}</option>
            ))}
          </select>
        </Field>

        {form.role === 'vendedor' && (
          <Field label="Comissão fixa por venda (R$)" hint="Valor fixo pago por venda fechada (Tarefa 31)">
            <input type="number" step="0.01" min="0" value={form.comissaoFixa} onChange={(e) => set({ comissaoFixa: e.target.value })} />
          </Field>
        )}
        {form.role === 'tecnico' && (
          <Field label="Valor por km rodado (R$)" hint="Usado no cálculo de comissão por deslocamento (Tarefa 31)">
            <input type="number" step="0.01" min="0" value={form.valorKm} onChange={(e) => set({ valorKm: e.target.value })} />
          </Field>
        )}

        <div className="divider" />
        <div className="bold soft" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={15} /> Este perfil acessará
        </div>
        <div className="flex wrap gap-8">
          {modulosDoPerfil.length
            ? modulosDoPerfil.map((m) => <span key={m} className="pill">{m}</span>)
            : <span className="mut">Nenhum módulo liberado.</span>}
        </div>
      </Modal>
    </>
  )
}
