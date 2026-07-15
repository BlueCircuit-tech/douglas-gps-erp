import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Search, Phone, Mail } from 'lucide-react'
import { fornecedoresApi, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { maskDoc, maskPhone, uid } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Avatar, Modal, EmptyState, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'
import { PessoaForm, emptyPessoa } from '../components/PessoaForm.jsx'

export default function Fornecedores() {
  const { db, loading, refetch } = useCollections(['fornecedores'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => emptyPessoa('fornecedor'))

  const list = useMemo(() => {
    return (db.fornecedores || []).filter((c) => {
      if (filter === 'ativos' && !c.ativo) return false
      if (filter === 'inativos' && c.ativo) return false
      const txt = `${c.razaoSocial} ${c.nomeFantasia} ${c.cpfCnpj} ${c.email} ${c.categoria}`.toLowerCase()
      return txt.includes(q.toLowerCase())
    })
  }, [db, q, filter])

  const salvar = async () => {
    if (!form.razaoSocial.trim()) { toast('Informe o nome / razão social', 'error'); return }
    const novo = { ...form, id: uid('f'), criadoEm: new Date().toISOString().slice(0, 10) }
    setSaving(true)
    try {
      await fornecedoresApi.insert(novo)
      logAudit(user.id, 'criar', 'fornecedor', `Novo fornecedor: ${form.nomeFantasia || form.razaoSocial}`)
      toast('Fornecedor cadastrado com sucesso')
      setOpen(false)
      setForm(emptyPessoa('fornecedor'))
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const ativos = (db.fornecedores || []).filter((c) => c.ativo).length

  return (
    <>
      <PageHead title="Fornecedores" subtitle={`${(db.fornecedores || []).length} fornecedores · ${ativos} ativos · mesma estrutura do cadastro de clientes`}>
        <Btn variant="primary" icon={<Truck size={16} />} onClick={() => { setForm(emptyPessoa('fornecedor')); setOpen(true) }}>
          Cadastrar Fornecedor
        </Btn>
      </PageHead>

      <Card>
        <div className="card-head">
          <div className="search" style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} className="mut" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CNPJ/CPF, categoria..." style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }} />
          </div>
          <div className="spacer" />
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'todos', label: 'Todos' }, { value: 'ativos', label: 'Ativos' }, { value: 'inativos', label: 'Inativos' },
          ]} />
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fornecedor</th><th>Tipo</th><th>Contato</th><th>Categoria</th><th className="right">Prazo pagto</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/fornecedores/${c.id}`)}>
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
                  <td>{c.categoria || '—'}</td>
                  <td className="right mono">{c.prazoPagamento ? `${c.prazoPagamento} dias` : '—'}</td>
                  <td><StatusBadge status={c.ativo ? 'ativo' : 'inativo'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <EmptyState icon={<Truck size={40} />} title="Carregando fornecedores..." sub="Buscando no Supabase." />}
          {!loading && !list.length && <EmptyState icon={<Truck size={40} />} title="Nenhum fornecedor encontrado" sub="Ajuste a busca ou cadastre um novo fornecedor." />}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Cadastro de Fornecedor" icon={<Truck size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar fornecedor'}</Btn></>}>
        <PessoaForm kind="fornecedor" form={form} setForm={setForm} db={db} />
      </Modal>
    </>
  )
}
