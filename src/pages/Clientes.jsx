import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, Users, Phone, Mail } from 'lucide-react'
import { api, clientsApi, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, maskDoc, fone, uid } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Avatar, Modal, EmptyState, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'
import { PessoaForm, emptyPessoa } from '../components/PessoaForm.jsx'
import { gerarParcelas, mensalidadeTotal, eventoHistorico } from '../lib/recorrencia.js'

export default function Clientes() {
  const { db, loading, refetch } = useCollections(['clients', 'users', 'planos'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => emptyPessoa('cliente'))

  const list = useMemo(() => {
    return (db.clients || []).filter((c) => {
      if (filter === 'ativos' && !c.ativo) return false
      if (filter === 'inativos' && c.ativo) return false
      if (filter === 'leads' && c.status !== 'lead') return false
      const txt = `${c.razaoSocial} ${c.nomeFantasia} ${c.cpfCnpj} ${c.email}`.toLowerCase()
      return txt.includes(q.toLowerCase())
    })
  }, [db, q, filter])

  const salvar = async () => {
    if (!form.razaoSocial.trim()) { toast('Informe o nome / razão social', 'error'); return }
    const novo = {
      ...form,
      id: uid('c'),
      criadoEm: new Date().toISOString().slice(0, 10),
      contratoInicio: form.ativo ? new Date().toISOString().slice(0, 10) : '',
      historicoVendas: [],
      conversas: [],
    }
    // Recorrência: se já entra ativo com prazo e equipamentos, gera as parcelas.
    let parcelas = null
    if (novo.ativo && novo.prazoMeses && mensalidadeTotal(novo) > 0) {
      parcelas = gerarParcelas(novo, { offset: 0 })
      novo.historicoVendas = [eventoHistorico('venda', {
        quantidade: novo.quantidadeEquipamentos, valorUnit: novo.valorMensal, prazoMeses: novo.prazoMeses,
        descricao: `Venda inicial — ${novo.quantidadeEquipamentos} equipamento(s), ${novo.prazoMeses} meses`,
      })]
    }
    setSaving(true)
    try {
      await clientsApi.insert(novo)
      if (parcelas) await api.contasReceber.insertMany(parcelas)
      logAudit(user.id, 'criar', 'cliente', `Novo cadastro: ${form.nomeFantasia || form.razaoSocial}`)
      toast('Cliente cadastrado com sucesso')
      setOpen(false)
      setForm(emptyPessoa('cliente'))
      refetch()
    } catch (e) {
      toast('Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const ativos = (db.clients || []).filter((c) => c.ativo).length
  const leads = (db.clients || []).filter((c) => c.status === 'lead').length

  return (
    <>
      <PageHead title="Clientes" subtitle={`${ativos} ativos · ${leads} leads · cadastro completo com contatos e histórico`}>
        <Btn variant="primary" icon={<UserPlus size={16} />} onClick={() => { setForm(emptyPessoa('cliente')); setOpen(true) }}>
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
            { value: 'todos', label: 'Todos' }, { value: 'ativos', label: 'Ativos' },
            { value: 'inativos', label: 'Inativos' }, { value: 'leads', label: 'Leads' },
          ]} />
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th><th>Tipo</th><th>Contato</th><th className="right">Equip.</th><th className="right">Mensalidade</th><th>Vendedor</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
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
                      <div className="flex gap-6 mut" style={{ fontSize: 12.5 }}><Phone size={13} /> {fone(c.celularDdd, c.celularNum)}</div>
                      <div className="flex gap-6 mut" style={{ fontSize: 12.5 }}><Mail size={13} /> {c.emailFinanceiro}</div>
                    </td>
                    <td className="right mono">{c.quantidadeEquipamentos ?? 0}</td>
                    <td className="right mono bold">{BRL(mensalidadeTotal(c))}</td>
                    <td>{vend?.name || '—'}</td>
                    <td><StatusBadge status={c.ativo ? 'ativo' : (c.status === 'lead' ? 'lead' : 'inativo')} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {loading && <EmptyState icon={<Users size={40} />} title="Carregando clientes..." sub="Buscando no Supabase." />}
          {!loading && !list.length && <EmptyState icon={<Users size={40} />} title="Nenhum cliente encontrado" sub="Ajuste a busca ou cadastre um novo cliente." />}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Cadastro de Cliente" icon={<UserPlus size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar cliente'}</Btn></>}>
        <PessoaForm kind="cliente" form={form} setForm={setForm} db={db} />
      </Modal>
    </>
  )
}
