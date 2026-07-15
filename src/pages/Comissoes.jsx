import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Plus, Check, AlertTriangle, DollarSign, CheckCircle2, Wallet, Users, Repeat } from 'lucide-react'
import { api, userName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, num, pct, fmtDate, todayISO } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Modal, Field, EmptyState, Segmented, Stat, StatusBadge, useToast,
} from '../components/ui.jsx'

const roleByTipo = (tipo) => (tipo === 'tecnico' ? 'tecnico' : 'vendedor')

const SERVICOS = [
  { value: 'instalacao', label: 'Instalação', campo: 'valorInstalacao' },
  { value: 'manutencao', label: 'Manutenção', campo: 'valorManutencao' },
  { value: 'desinstalacao', label: 'Desinstalação', campo: 'valorDesinstalacao' },
]
const servicoLabel = (v) => SERVICOS.find((s) => s.value === v)?.label || v

// Valor total de uma comissão (vendedor: fixo + recorrente; técnico: serviço + KM).
export const valorComissao = (c) => {
  if (c.tipo === 'tecnico') return (Number(c.valorServico) || 0) + (Number(c.km) || 0) * (Number(c.valorKm) || 0)
  return (Number(c.valorFixo) || 0) + (Number(c.valorRecorrente) || 0)
}

const emptyForm = (tipo) => ({
  tipo: tipo || 'vendedor',
  pessoaId: '',
  referencia: '',
  // vendedor
  valorFixo: '', percentual: '', baseRecorrente: '',
  // tecnico
  tipoServico: 'instalacao', valorServico: '', km: '', valorKm: '', kmManual: false,
})

export default function Comissoes() {
  const { db, refetch } = useCollections(['comissoes', 'users'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [tipo, setTipo] = useState('vendedor')
  const [pessoaFilter, setPessoaFilter] = useState('todas')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const isTecnico = tipo === 'tecnico'

  const pessoasDoTipo = useMemo(
    () => (db.users || []).filter((u) => u.role === roleByTipo(tipo)),
    [db, tipo],
  )
  const doTipo = useMemo(
    () => (db.comissoes || []).filter((c) => c.tipo === tipo),
    [db, tipo],
  )
  const lista = useMemo(() => {
    return doTipo
      .filter((c) => pessoaFilter === 'todas' || c.pessoaId === pessoaFilter)
      .slice()
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
  }, [doTipo, pessoaFilter])

  const kpis = useMemo(() => {
    const pendente = doTipo.filter((c) => c.status === 'pendente').reduce((s, c) => s + valorComissao(c), 0)
    const pago = doTipo.filter((c) => c.status === 'paga').reduce((s, c) => s + valorComissao(c), 0)
    return { pendente, pago, total: doTipo.length }
  }, [doTipo])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const pessoasModal = (db.users || []).filter((u) => u.role === roleByTipo(form.tipo))
  const pessoaSel = (db.users || []).find((u) => u.id === form.pessoaId)

  const abrirModal = () => { setForm(emptyForm(tipo)); setOpen(true) }

  const onTipoModal = (v) => setForm(() => emptyForm(v))

  // Ao escolher a pessoa, pré-preenche os valores padrão cadastrados na Equipe.
  const onPessoa = (pessoaId) => {
    const u = (db.users || []).find((x) => x.id === pessoaId)
    if (form.tipo === 'vendedor') {
      set({ pessoaId, valorFixo: u?.comissaoFixa ?? form.valorFixo, percentual: u?.comissaoRecorrentePct ?? form.percentual })
    } else {
      const campo = SERVICOS.find((s) => s.value === form.tipoServico)?.campo
      set({ pessoaId, valorServico: (u && campo && u[campo] != null) ? u[campo] : form.valorServico, valorKm: u?.valorKm ?? form.valorKm })
    }
  }

  const onServico = (tipoServico) => {
    const campo = SERVICOS.find((s) => s.value === tipoServico)?.campo
    const u = pessoaSel
    set({ tipoServico, valorServico: (u && campo && u[campo] != null) ? u[campo] : form.valorServico })
  }

  // Prévia do total no modal.
  const previa = form.tipo === 'tecnico'
    ? (Number(form.valorServico) || 0) + (Number(form.km) || 0) * (Number(form.valorKm) || 0)
    : (Number(form.valorFixo) || 0) + (Number(form.baseRecorrente) || 0) * (Number(form.percentual) || 0) / 100

  const salvar = async () => {
    if (!form.pessoaId) { toast('Selecione a pessoa', 'error'); return }
    if (!form.referencia.trim()) { toast('Informe a referência', 'error'); return }

    const nova = {
      tipo: form.tipo,
      pessoaId: form.pessoaId,
      referencia: form.referencia.trim(),
      data: todayISO(),
      status: 'pendente',
    }

    if (form.tipo === 'vendedor') {
      const fixo = Number(form.valorFixo) || 0
      const percentual = Number(form.percentual) || 0
      const base = Number(form.baseRecorrente) || 0
      if (fixo <= 0 && percentual <= 0) { toast('Informe o valor fixo e/ou o percentual recorrente', 'error'); return }
      nova.valorFixo = fixo
      nova.percentual = percentual
      nova.baseRecorrente = base
      nova.valorRecorrente = +(base * percentual / 100).toFixed(2)
    } else {
      const servico = Number(form.valorServico) || 0
      const km = form.km === '' ? null : Number(form.km)
      const valorKm = Number(form.valorKm) || 0
      if (servico <= 0 && !km) { toast('Informe o valor do serviço e/ou os KM', 'error'); return }
      nova.tipoServico = form.tipoServico
      nova.valorServico = servico
      nova.km = km
      nova.valorKm = valorKm
      nova.kmManual = !!form.kmManual && km != null
    }

    try {
      await api.comissoes.insert(nova)
      logAudit(user.id, 'criar', 'comissão', `Comissão (${form.tipo}) de ${userName(form.pessoaId)} — ${BRL(valorComissao(nova))}`)
      toast('Comissão adicionada')
      setOpen(false)
      setForm(emptyForm(tipo))
      setTipo(form.tipo)
      setPessoaFilter('todas')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const marcarPaga = async (c) => {
    try {
      await api.comissoes.update(c.id, { status: 'paga' })
      logAudit(user.id, 'pagar', 'comissão', `Comissão de ${userName(c.pessoaId)} marcada como paga — ${BRL(valorComissao(c))}`)
      toast('Comissão marcada como paga')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Comissões" subtitle="Vendedores: fixo + variável recorrente · Técnicos: serviço + KM">
        <Btn icon={<Users size={16} />} onClick={() => navigate('/equipe')}>
          Gerenciar vendedores e técnicos
        </Btn>
        <Btn variant="primary" icon={<Plus size={16} />} onClick={abrirModal}>
          Adicionar comissão
        </Btn>
      </PageHead>

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
              {isTecnico ? (
                <tr>
                  <th>Técnico</th><th>Referência</th><th>Serviço</th><th>KM</th>
                  <th className="right">Serviço</th><th className="right">KM (R$)</th><th className="right">Total</th>
                  <th>Data</th><th>Status</th><th className="right">Ações</th>
                </tr>
              ) : (
                <tr>
                  <th>Vendedor</th><th>Referência</th><th className="right">Fixo</th>
                  <th className="right">% recorr.</th><th className="right">Recorrente</th><th className="right">Total</th>
                  <th>Data</th><th>Status</th><th className="right">Ações</th>
                </tr>
              )}
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="bold">{userName(c.pessoaId)}</td>
                  <td>{c.referencia}</td>
                  {isTecnico ? (
                    <>
                      <td><Badge tone="gray">{servicoLabel(c.tipoServico)}</Badge></td>
                      <td>
                        {c.km != null ? (
                          <div className="flex gap-6 nowrap">
                            <span className="mono">{num(c.km)} km</span>
                            {c.kmManual && (
                              <span className="flex gap-6 nowrap" style={{ color: 'var(--amber)', fontSize: 12 }} title="KM informado manualmente — conferir">
                                <AlertTriangle size={14} />
                              </span>
                            )}
                          </div>
                        ) : <span className="mut">—</span>}
                      </td>
                      <td className="right mono">{BRL(c.valorServico)}</td>
                      <td className="right mono">{BRL((Number(c.km) || 0) * (Number(c.valorKm) || 0))}</td>
                      <td className="right mono bold">{BRL(valorComissao(c))}</td>
                    </>
                  ) : (
                    <>
                      <td className="right mono">{BRL(c.valorFixo)}</td>
                      <td className="right mono">{c.percentual ? pct(c.percentual) : '—'}</td>
                      <td className="right mono">
                        <span className="flex gap-6 nowrap" style={{ justifyContent: 'flex-end' }}>
                          {c.valorRecorrente ? <Repeat size={12} className="mut" /> : null}{BRL(c.valorRecorrente)}
                        </span>
                      </td>
                      <td className="right mono bold">{BRL(valorComissao(c))}</td>
                    </>
                  )}
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
            <select value={form.pessoaId} onChange={(e) => onPessoa(e.target.value)}>
              <option value="">Selecione</option>
              {pessoasModal.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Referência" required hint="Ex.: Venda - Cliente X / OS #1002">
            <input value={form.referencia} onChange={(e) => set({ referencia: e.target.value })} placeholder="Origem da comissão" />
          </Field>
        </div>

        {form.tipo === 'vendedor' ? (
          <>
            <div className="form-row-3">
              <Field label="Valor fixo (R$)" hint="Por venda">
                <input type="number" step="0.01" min="0" value={form.valorFixo} onChange={(e) => set({ valorFixo: e.target.value })} placeholder="50,00" />
              </Field>
              <Field label="Percentual recorrente (%)" hint="Sobre a mensalidade">
                <input type="number" step="0.1" min="0" value={form.percentual} onChange={(e) => set({ percentual: e.target.value })} placeholder="5" />
              </Field>
              <Field label="Base recorrente (R$)" hint="Mensalidade do cliente">
                <input type="number" step="0.01" min="0" value={form.baseRecorrente} onChange={(e) => set({ baseRecorrente: e.target.value })} placeholder="0,00" />
              </Field>
            </div>
            <div className="flex gap-8 soft" style={{ fontSize: 13, alignItems: 'center' }}>
              <Repeat size={15} />
              Comissão do vendedor = <b>valor fixo</b> + <b>{pct(Number(form.percentual) || 0)}</b> recorrente sobre a mensalidade.
            </div>
          </>
        ) : (
          <>
            <div className="form-row">
              <Field label="Tipo de serviço">
                <select value={form.tipoServico} onChange={(e) => onServico(e.target.value)}>
                  {SERVICOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Valor do serviço (R$)" hint="Instalação / manutenção / desinstalação">
                <input type="number" step="0.01" min="0" value={form.valorServico} onChange={(e) => set({ valorServico: e.target.value })} placeholder="0,00" />
              </Field>
            </div>
            <div className="form-row-3">
              <Field label="KM rodados" hint="Deslocamento até o cliente (Tarefa 33)">
                <input type="number" step="1" min="0" value={form.km} onChange={(e) => set({ km: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Valor por KM (R$)">
                <input type="number" step="0.01" min="0" value={form.valorKm} onChange={(e) => set({ valorKm: e.target.value })} placeholder="1,20" />
              </Field>
              <Field label="">
                <label className="flex gap-8" style={{ alignItems: 'center', cursor: 'pointer', marginTop: 26 }}>
                  <input type="checkbox" checked={form.kmManual} onChange={(e) => set({ kmManual: e.target.checked })} style={{ width: 'auto' }} />
                  <span className="flex gap-6" style={{ color: 'var(--amber)' }}><AlertTriangle size={15} /> KM manual</span>
                </label>
              </Field>
            </div>
          </>
        )}

        <div className="divider" />
        <div className="flex between" style={{ alignItems: 'center' }}>
          <span className="flex gap-8 soft" style={{ fontSize: 13, alignItems: 'center' }}>
            <DollarSign size={15} /> Total estimado da comissão
          </span>
          <span className="bold mono" style={{ fontSize: 18 }}>{BRL(previa)}</span>
        </div>
      </Modal>
    </>
  )
}
