import { useState, useMemo } from 'react'
import { Package, Layers, Plus, Pencil, Trash2, Search, Boxes, Wrench, DollarSign, Coins } from 'lucide-react'
import { api, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, uid } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Stat, Modal, Field, EmptyState, Segmented, useToast,
} from '../components/ui.jsx'

const emptyForm = () => ({ nome: '', tipo: 'produto', valor: 0, descricao: '' })

export default function Produtos() {
  const { db, refetch } = useCollections(['produtos'])
  const { user } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const itens = db.produtos || []

  const list = useMemo(() => {
    return itens.filter((p) => {
      if (filter !== 'todos' && p.tipo !== filter) return false
      const txt = `${p.nome} ${p.descricao}`.toLowerCase()
      return txt.includes(q.toLowerCase())
    })
  }, [itens, q, filter])

  const nProdutos = itens.filter((p) => p.tipo === 'produto').length
  const nServicos = itens.filter((p) => p.tipo === 'servico').length
  const ticketMedio = itens.length
    ? itens.reduce((s, p) => s + (Number(p.valor) || 0), 0) / itens.length
    : 0

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const abrirNovo = () => { setEditId(null); setForm(emptyForm()); setOpen(true) }
  const abrirEdicao = (p) => {
    setEditId(p.id)
    setForm({ nome: p.nome, tipo: p.tipo, valor: p.valor, descricao: p.descricao })
    setOpen(true)
  }

  const salvar = async () => {
    if (!form.nome.trim()) { toast('Informe o nome do item', 'error'); return }
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      valor: Number(form.valor) || 0,
      descricao: form.descricao.trim(),
    }
    try {
      if (editId) {
        await api.produtos.update(editId, payload)
        logAudit(user.id, 'editar', 'produto', `Item atualizado: ${payload.nome}`)
        toast('Item atualizado com sucesso')
      } else {
        await api.produtos.insert({ ...payload, id: uid('pr') })
        logAudit(user.id, 'criar', 'produto', `Novo item: ${payload.nome}`)
        toast('Item cadastrado com sucesso')
      }
      setOpen(false)
      setEditId(null)
      setForm(emptyForm())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const excluir = async (p) => {
    try {
      await api.produtos.remove(p.id)
      logAudit(user.id, 'excluir', 'produto', `Item removido: ${p.nome}`)
      toast('Item excluído')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const tipoBadge = (tipo) =>
    tipo === 'produto'
      ? <Badge tone="blue">Produto</Badge>
      : <Badge tone="purple">Serviço</Badge>

  return (
    <>
      <PageHead title="Produtos e Serviços" subtitle={`${nProdutos} produtos · ${nServicos} serviços · catálogo de itens comercializáveis`}>
        <Btn variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Novo item</Btn>
      </PageHead>

      <div className="grid grid-3">
        <Stat icon={<Boxes size={18} />} label="Produtos" value={nProdutos} tone="blue" />
        <Stat icon={<Wrench size={18} />} label="Serviços" value={nServicos} tone="purple" />
        <Stat icon={<Coins size={18} />} label="Ticket médio" value={BRL(ticketMedio)} tone="green" />
      </div>

      <Card className="mt-16">
        <div className="card-head">
          <div className="search" style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} className="mut" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item por nome ou descrição..." style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }} />
          </div>
          <div className="spacer" />
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'todos', label: 'Todos' },
            { value: 'produto', label: 'Produtos' },
            { value: 'servico', label: 'Serviços' },
          ]} />
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th><th>Tipo</th><th>Descrição</th><th className="right">Valor</th><th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex gap-12">
                      <div className="stat-ico" style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.tipo === 'produto' ? 'var(--blue-bg)' : 'var(--purple-bg)', color: p.tipo === 'produto' ? 'var(--blue)' : 'var(--purple)' }}>
                        {p.tipo === 'produto' ? <Package size={18} /> : <Layers size={18} />}
                      </div>
                      <div className="bold">{p.nome}</div>
                    </div>
                  </td>
                  <td>{tipoBadge(p.tipo)}</td>
                  <td className="mut" style={{ maxWidth: 360 }}>{p.descricao || '—'}</td>
                  <td className="right mono bold">{BRL(p.valor)}</td>
                  <td className="right nowrap">
                    <Btn size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => abrirEdicao(p)}>Editar</Btn>
                    <Btn size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => excluir(p)}>Excluir</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && (
            <EmptyState
              icon={<Package size={40} />}
              title="Nenhum item encontrado"
              sub="Ajuste a busca/filtro ou cadastre um novo produto ou serviço."
            />
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Editar item' : 'Novo item'}
        icon={<DollarSign size={20} color="var(--brand)" />}
        footer={<>
          <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={salvar}>{editId ? 'Salvar alterações' : 'Cadastrar item'}</Btn>
        </>}
      >
        <Field label="Nome" required>
          <input value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Rastreador GPS GT06N" />
        </Field>
        <div className="form-row">
          <Field label="Tipo">
            <Segmented value={form.tipo} onChange={(v) => set({ tipo: v })} options={[
              { value: 'produto', label: 'Produto' },
              { value: 'servico', label: 'Serviço' },
            ]} />
          </Field>
          <Field label="Valor (R$)" required>
            <input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => set({ valor: e.target.value })} />
          </Field>
        </div>
        <Field label="Descrição">
          <textarea value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Detalhes do produto ou serviço." />
        </Field>
      </Modal>
    </>
  )
}
