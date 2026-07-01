import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, Users, Phone, Mail, Cake, MapPin, Filter } from 'lucide-react'
import { useStore, actions } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, maskDoc, maskPhone, uid } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Avatar, Modal, Field, EmptyState, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'
import { FUNNEL } from '../data/seed.js'

const emptyForm = () => ({
  tipo: 'PJ', stage: 'novo', status: 'lead',
  razaoSocial: '', nomeFantasia: '', cpfCnpj: '', ie: '',
  email: '', whatsapp: '', aniversario: '',
  endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' },
  planoId: 'p_basico', vendedorId: '', valorMensal: 79.9, valorInstalacao: 150, valorMonitoramento: 0,
  observacoes: '',
})

export default function Clientes() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const vendedores = (db.users || []).filter((u) => u.role === 'vendedor')

  const list = useMemo(() => {
    return (db.clients || []).filter((c) => {
      if (filter === 'ativos' && c.status !== 'ativo') return false
      if (filter === 'leads' && c.status !== 'lead') return false
      const txt = `${c.razaoSocial} ${c.nomeFantasia} ${c.cpfCnpj} ${c.email}`.toLowerCase()
      return txt.includes(q.toLowerCase())
    })
  }, [db, q, filter])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setEnd = (patch) => setForm((f) => ({ ...f, endereco: { ...f.endereco, ...patch } }))

  const onPlano = (planoId) => {
    const p = (db.planos || []).find((x) => x.id === planoId)
    set({ planoId, valorMensal: p?.valorMensal ?? form.valorMensal, valorInstalacao: p?.valorInstalacao ?? form.valorInstalacao, valorMonitoramento: p?.valorMonitoramento ?? 0 })
  }

  const salvar = () => {
    if (!form.razaoSocial.trim()) { toast('Informe o nome / razão social', 'error'); return }
    const novo = { ...form, id: uid('c'), criadoEm: new Date().toISOString().slice(0, 10) }
    actions.add('clients', novo)
    actions.log(user.id, 'criar', 'cliente', `Novo cadastro: ${form.nomeFantasia || form.razaoSocial}`)
    toast('Cliente cadastrado com sucesso')
    setOpen(false)
    setForm(emptyForm())
  }

  const ativos = (db.clients || []).filter((c) => c.status === 'ativo').length
  const leads = (db.clients || []).filter((c) => c.status === 'lead').length

  return (
    <>
      <PageHead title="Clientes" subtitle={`${ativos} ativos · ${leads} leads · cadastro completo com histórico`}>
        <Btn variant="primary" icon={<UserPlus size={16} />} onClick={() => { setForm(emptyForm()); setOpen(true) }}>
          Cadastrar Cliente
        </Btn>
      </PageHead>

      <Card>
        <div className="card-head">
          <div className="search" style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} className="mut" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CNPJ/CPF, e-mail..." style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }} />
          </div>
          <div className="spacer" />
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'todos', label: 'Todos' }, { value: 'ativos', label: 'Ativos' }, { value: 'leads', label: 'Leads' },
          ]} />
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th><th>Tipo</th><th>Contato</th><th>Plano</th><th>Mensal</th><th>Vendedor</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const plano = (db.planos || []).find((p) => p.id === c.planoId)
                const vend = (db.users || []).find((u) => u.id === c.vendedorId)
                return (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td>
                      <div className="flex gap-12">
                        <Avatar name={c.nomeFantasia || c.razaoSocial} />
                        <div>
                          <div className="bold">{c.nomeFantasia || c.razaoSocial}</div>
                          <div className="mut" style={{ fontSize: 12 }}>{maskDoc(c.cpfCnpj)}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={c.tipo === 'PJ' ? 'blue' : 'purple'}>{c.tipo}</Badge></td>
                    <td>
                      <div className="flex gap-6 mut" style={{ fontSize: 12.5 }}><Phone size={13} /> {maskPhone(c.whatsapp)}</div>
                      <div className="flex gap-6 mut" style={{ fontSize: 12.5 }}><Mail size={13} /> {c.email}</div>
                    </td>
                    <td>{plano?.nome || '—'}</td>
                    <td className="mono bold">{BRL(c.valorMensal)}</td>
                    <td>{vend?.name || '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!list.length && <EmptyState icon={<Users size={40} />} title="Nenhum cliente encontrado" sub="Ajuste a busca ou cadastre um novo cliente." />}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Cadastro de Cliente" icon={<UserPlus size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvar}>Salvar cliente</Btn></>}>
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
          <Field label="Data de aniversário" hint="Para mensagens automáticas (Tarefa 20)">
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
        <div className="bold soft" style={{ marginBottom: 10 }}>Plano de contratação (Tarefa 22)</div>
        <div className="form-row">
          <Field label="Plano">
            <select value={form.planoId} onChange={(e) => onPlano(e.target.value)}>
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
          <Field label="Valor mensal (R$)" hint="Alterável (Tarefa 23)"><input type="number" step="0.01" value={form.valorMensal} onChange={(e) => set({ valorMensal: +e.target.value })} /></Field>
          <Field label="Valor instalação (R$)" hint="Tarefa 24"><input type="number" step="0.01" value={form.valorInstalacao} onChange={(e) => set({ valorInstalacao: +e.target.value })} /></Field>
          <Field label="Valor monitoramento (R$)" hint="Tarefa 24"><input type="number" step="0.01" value={form.valorMonitoramento} onChange={(e) => set({ valorMonitoramento: +e.target.value })} /></Field>
        </div>
        <Field label="Observações">
          <textarea value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Anotações sobre o cliente, frota, etc." />
        </Field>
      </Modal>
    </>
  )
}
