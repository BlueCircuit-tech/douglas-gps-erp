import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Plus, Check, AlertTriangle, DollarSign, CheckCircle2, Wallet, Users } from 'lucide-react'
import { useStore, actions, userName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, num, fmtDate, todayISO } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Modal, Field, EmptyState, Segmented, Stat, StatusBadge, useToast,
} from '../components/ui.jsx'

const roleByTipo = (tipo) => (tipo === 'tecnico' ? 'tecnico' : 'vendedor')

const emptyForm = (tipo) => ({
  tipo: tipo || 'vendedor',
  pessoaId: '',
  referencia: '',
  valorFixo: '',
  km: '',
  kmManual: false,
})

export default function Comissoes() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [tipo, setTipo] = useState('vendedor') // segmento ativo: vendedor | tecnico
  const [pessoaFilter, setPessoaFilter] = useState('todas')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const isTecnico = tipo === 'tecnico'

  // Pessoas do papel correspondente ao segmento atual (para o filtro)
  const pessoasDoTipo = useMemo(
    () => (db.users || []).filter((u) => u.role === roleByTipo(tipo)),
    [db, tipo],
  )

  // Comissões do segmento (Tarefa 29 — valores FIXOS em R$, nunca percentual)
  const doTipo = useMemo(
    () => (db.comissoes || []).filter((c) => c.tipo === tipo),
    [db, tipo],
  )

  // Lista exibida (aplica filtro por pessoa) — mais recentes primeiro
  const lista = useMemo(() => {
    return doTipo
      .filter((c) => pessoaFilter === 'todas' || c.pessoaId === pessoaFilter)
      .slice()
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
  }, [doTipo, pessoaFilter])

  // KPIs do segmento (Tarefa 10)
  const kpis = useMemo(() => {
    const pendente = doTipo.filter((c) => c.status === 'pendente').reduce((s, c) => s + (c.valorFixo || 0), 0)
    const pago = doTipo.filter((c) => c.status === 'paga').reduce((s, c) => s + (c.valorFixo || 0), 0)
    return { pendente, pago, total: doTipo.length }
  }, [doTipo])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const abrirModal = () => {
    setForm(emptyForm(tipo))
    setOpen(true)
  }

  const onTipoModal = (v) => {
    // troca de tipo no modal zera a pessoa (papéis diferentes)
    setForm((f) => ({ ...f, tipo: v, pessoaId: '' }))
  }

  const salvar = () => {
    if (!form.pessoaId) { toast('Selecione a pessoa', 'error'); return }
    if (!form.referencia.trim()) { toast('Informe a referência', 'error'); return }
    const valor = Number(form.valorFixo)
    if (!valor || valor <= 0) { toast('Informe um valor fixo válido', 'error'); return }

    const nova = {
      tipo: form.tipo,
      pessoaId: form.pessoaId,
      referencia: form.referencia.trim(),
      valorFixo: valor, // valor FIXO em R$ (Tarefa 29)
      data: todayISO(),
      status: 'pendente',
    }
    if (form.tipo === 'tecnico') {
      nova.km = form.km === '' ? null : Number(form.km)
      nova.kmManual = !!form.kmManual && nova.km != null
    }

    actions.add('comissoes', nova)
    actions.log(user.id, 'criar', 'comissão', `Comissão (${form.tipo}) de ${userName(form.pessoaId)} — ${BRL(valor)}`)
    toast('Comissão adicionada')
    setOpen(false)
    setForm(emptyForm(tipo))
    // alinha o segmento ao tipo recém-criado para o usuário ver o lançamento
    setTipo(form.tipo)
    setPessoaFilter('todas')
  }

  const marcarPaga = (c) => {
    actions.patch('comissoes', c.id, { status: 'paga' })
    actions.log(user.id, 'pagar', 'comissão', `Comissão de ${userName(c.pessoaId)} marcada como paga — ${BRL(c.valorFixo)}`)
    toast('Comissão marcada como paga')
  }

  // Modal: pessoas do papel correspondente ao tipo escolhido no formulário
  const pessoasModal = (db.users || []).filter((u) => u.role === roleByTipo(form.tipo))

  return (
    <>
      <PageHead title="Comissões" subtitle="Valores fixos por venda e por OS · vendedores e técnicos">
        <Btn icon={<Users size={16} />} onClick={() => navigate('/equipe')}>
          Gerenciar vendedores e técnicos
        </Btn>
        <Btn variant="primary" icon={<Plus size={16} />} onClick={abrirModal}>
          Adicionar comissão
        </Btn>
      </PageHead>

      {/* KPIs do segmento atual (Tarefa 10) */}
      <div className="grid grid-3">
        <Stat tone="amber" icon={<Wallet size={19} />} label="Total pendente" value={BRL(kpis.pendente)} />
        <Stat tone="green" icon={<CheckCircle2 size={19} />} label="Total pago" value={BRL(kpis.pago)} />
        <Stat tone="blue" icon={<Coins size={19} />} label="Nº de comissões" value={num(kpis.total)} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="card-head">
          <Segmented
            value={tipo}
            onChange={(v) => { setTipo(v); setPessoaFilter('todas') }}
            options={[{ value: 'vendedor', label: 'Vendedores' }, { value: 'tecnico', label: 'Técnicos' }]}
          />
          <div className="spacer" />
          <Field label="">
            <select value={pessoaFilter} onChange={(e) => setPessoaFilter(e.target.value)} style={{ minWidth: 200 }}>
              <option value="todas">Todas as pessoas</option>
              {pessoasDoTipo.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{isTecnico ? 'Técnico' : 'Vendedor'}</th>
                <th>Referência</th>
                {isTecnico && <th>KM</th>}
                <th className="right">Valor fixo</th>
                <th>Data</th>
                <th>Status</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="bold">{userName(c.pessoaId)}</td>
                  <td>{c.referencia}</td>
                  {isTecnico && (
                    <td>
                      {c.km != null ? (
                        <div className="flex gap-6 nowrap">
                          <span className="mono">{num(c.km)} km</span>
                          {c.kmManual && (
                            <span className="flex gap-6 nowrap" style={{ color: 'var(--amber)', fontSize: 12 }} title="KM informado manualmente — conferir">
                              <AlertTriangle size={14} /> KM manual — conferir
                            </span>
                          )}
                        </div>
                      ) : <span className="mut">—</span>}
                    </td>
                  )}
                  <td className="right mono bold">{BRL(c.valorFixo)}</td>
                  <td>{fmtDate(c.data)}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="right">
                    {c.status === 'pendente' ? (
                      <Btn size="sm" variant="green" icon={<Check size={14} />} onClick={() => marcarPaga(c)}>
                        Marcar como paga
                      </Btn>
                    ) : (
                      <Badge tone="green" dot>Paga</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lista.length && (
            <EmptyState
              icon={<Coins size={40} />}
              title={`Nenhuma comissão de ${isTecnico ? 'técnico' : 'vendedor'}`}
              sub="Adicione uma comissão ou ajuste o filtro por pessoa."
            />
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Adicionar comissão"
        icon={<Coins size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvar}>Salvar comissão</Btn></>}
      >
        <Field label="Tipo de comissão">
          <Segmented
            value={form.tipo}
            onChange={onTipoModal}
            options={[{ value: 'vendedor', label: 'Vendedor' }, { value: 'tecnico', label: 'Técnico' }]}
          />
        </Field>

        <div className="form-row">
          <Field label="Pessoa" required hint="Cadastre novos na tela Equipe (Tarefa 31)">
            <select value={form.pessoaId} onChange={(e) => set({ pessoaId: e.target.value })}>
              <option value="">Selecione</option>
              {pessoasModal.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Valor fixo (R$)" required hint="Valor fixo — não é percentual (Tarefa 29)">
            <input type="number" step="0.01" min="0" value={form.valorFixo} onChange={(e) => set({ valorFixo: e.target.value })} placeholder="0,00" />
          </Field>
        </div>

        <Field label="Referência" required hint="Ex.: Venda - Cliente X / OS #1002 - Instalação">
          <input value={form.referencia} onChange={(e) => set({ referencia: e.target.value })} placeholder="Origem da comissão" />
        </Field>

        {form.tipo === 'tecnico' && (
          <div className="form-row">
            <Field label="KM rodados" hint="Deslocamento até o cliente (Tarefa 33)">
              <input type="number" step="1" min="0" value={form.km} onChange={(e) => set({ km: e.target.value })} placeholder="0" />
            </Field>
            <Field label="">
              <label className="flex gap-8" style={{ alignItems: 'center', cursor: 'pointer', marginTop: 26 }}>
                <input type="checkbox" checked={form.kmManual} onChange={(e) => set({ kmManual: e.target.checked })} style={{ width: 'auto' }} />
                <span className="flex gap-6" style={{ color: 'var(--amber)' }}><AlertTriangle size={15} /> KM informado manualmente</span>
              </label>
            </Field>
          </div>
        )}

        <div className="divider" />
        <div className="flex gap-8 mut" style={{ fontSize: 13, alignItems: 'center' }}>
          <DollarSign size={15} />
          Para adicionar vendedores e técnicos, acesse a tela{' '}
          <a onClick={() => navigate('/equipe')} style={{ cursor: 'pointer', color: 'var(--brand)', fontWeight: 600 }}>Equipe</a>.
        </div>
      </Modal>
    </>
  )
}
