import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Plus, Check, AlertTriangle, DollarSign, CheckCircle2, Wallet, Users, Repeat } from 'lucide-react'
import { api, userName, clientName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, num, pct, fmtDate, todayISO, uid } from '../lib/format.js'
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

// Vendedor: o valor fixo é por equipamento — o total da venda é fixo × quantidade.
// Comissões antigas não têm quantidade; nesse caso vale 1 (o fixo já era o total).
export const totalFixo = (c) => (Number(c.valorFixo) || 0) * (Number(c.quantidadeEquipamentos) || 1)

// Valor total de uma comissão.
// Vendedor: (fixo × qtd) + recorrente · Técnico: serviço + KM + pedágio + extras.
export const valorComissao = (c) => {
  if (c.tipo === 'tecnico') {
    return (Number(c.valorServico) || 0)
      + (Number(c.km) || 0) * (Number(c.valorKm) || 0)
      + (Number(c.pedagio) || 0)
      + (Number(c.extras) || 0)
  }
  return totalFixo(c) + (Number(c.valorRecorrente) || 0)
}

const emptyForm = (tipo) => ({
  tipo: tipo || 'vendedor',
  pessoaId: '',
  clientId: '',
  // vendedor
  quantidadeEquipamentos: '1', valorFixo: '', percentual: '', baseRecorrente: '', obs: '',
  // tecnico
  tipoServico: 'instalacao', valorServico: '', placa: '', equipamentoId: '',
  km: '', valorKm: '', kmManual: false, pedagio: '', extras: '',
})

export default function Comissoes() {
  const { db, refetch } = useCollections(['comissoes', 'users', 'clients', 'equipamentos'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [tipo, setTipo] = useState('vendedor')
  const [pessoaFilter, setPessoaFilter] = useState('todas')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const isTecnico = tipo === 'tecnico'
  const isAmb = tipo === 'ambos'

  const pessoasDoTipo = useMemo(
    () => (db.users || []).filter((u) => isAmb || u.role === roleByTipo(tipo)),
    [db, tipo, isAmb],
  )
  const doTipo = useMemo(
    () => (db.comissoes || []).filter((c) => isAmb || c.tipo === tipo),
    [db, isAmb],
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

  const clientes = db.clients || []
  const equipamentos = db.equipamentos || []
  const equipSerial = (id) => equipamentos.find((e) => e.id === id)?.serial || '—'

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

  // Prévia dos totais no modal.
  const previaFixo = (Number(form.valorFixo) || 0) * (Number(form.quantidadeEquipamentos) || 0)
  const previa = form.tipo === 'tecnico'
    ? (Number(form.valorServico) || 0) + (Number(form.km) || 0) * (Number(form.valorKm) || 0)
      + (Number(form.pedagio) || 0) + (Number(form.extras) || 0)
    : previaFixo + (Number(form.baseRecorrente) || 0) * (Number(form.percentual) || 0) / 100

  const salvar = async () => {
    if (!form.pessoaId) { toast('Selecione a pessoa', 'error'); return }
    if (!form.clientId) { toast('Selecione o cliente', 'error'); return }

    const nova = {
      id: uid('co'),
      tipo: form.tipo,
      pessoaId: form.pessoaId,
      clientId: form.clientId,
      data: todayISO(),
      status: 'pendente',
    }

    if (form.tipo === 'vendedor') {
      const fixo = Number(form.valorFixo) || 0
      const qtd = Number(form.quantidadeEquipamentos) || 0
      const percentual = Number(form.percentual) || 0
      const base = Number(form.baseRecorrente) || 0
      if (fixo <= 0 && percentual <= 0) { toast('Informe o valor fixo e/ou o percentual recorrente', 'error'); return }
      if (fixo > 0 && qtd <= 0) { toast('Informe a quantidade de equipamentos', 'error'); return }
      // Comissão só recorrente (sem fixo) não tem quantidade — grava 1 para não zerar o total.
      nova.quantidadeEquipamentos = qtd || 1
      nova.valorFixo = fixo
      nova.percentual = percentual
      nova.baseRecorrente = base
      nova.valorRecorrente = +(base * percentual / 100).toFixed(2)
      nova.obs = form.obs.trim()
    } else {
      const servico = Number(form.valorServico) || 0
      const km = form.km === '' ? null : Number(form.km)
      const valorKm = Number(form.valorKm) || 0
      const pedagio = Number(form.pedagio) || 0
      const extras = Number(form.extras) || 0
      if (servico <= 0 && !km && pedagio <= 0 && extras <= 0) {
        toast('Informe o valor do serviço, os KM, o pedágio ou os extras', 'error'); return
      }
      nova.tipoServico = form.tipoServico
      nova.valorServico = servico
      nova.placa = form.placa.trim().toUpperCase()
      nova.equipamentoId = form.equipamentoId || null
      nova.km = km
      nova.valorKm = valorKm
      nova.kmManual = !!form.kmManual && km != null
      nova.pedagio = pedagio
      nova.extras = extras
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
      <PageHead title="Comissões" subtitle="Vendedores: fixo por equipamento + recorrente · Técnicos: serviço + KM + pedágio + extras">
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
            options={[{ value: 'vendedor', label: 'Vendedores' }, { value: 'tecnico', label: 'Técnicos' }, { value: 'ambos', label: 'Ambos' }]}
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
              {isAmb ? (
                <tr>
                  <th>Tipo</th><th>Pessoa</th><th>Cliente</th><th>Serviço</th>
                  <th className="right">Qtd. equip.</th><th className="right">Fixo (un.)</th><th className="right">Valor total</th>
                  <th className="right">% recorr.</th><th className="right">Recorrente</th>
                  <th>Placa</th><th>KM</th><th>Serviço</th><th className="right">Pedágio</th><th className="right">Extras</th>
                  <th className="right">Total</th><th>Data</th><th>Status</th><th className="right">Ações</th>
                </tr>
              ) : isTecnico ? (
                <tr>
                  <th>Pessoa</th><th>Cliente</th><th>Serviço</th><th>Placa</th><th>Nº equipamento</th><th>KM</th>
                  <th className="right">Serviço</th><th className="right">KM (R$)</th><th className="right">Pedágio</th>
                  <th className="right">Extras</th><th className="right">Total</th>
                  <th>Data</th><th>Status</th><th className="right">Ações</th>
                </tr>
              ) : (
                <tr>
                  <th>Pessoa</th><th>Cliente</th><th className="right">Qtd. equip.</th><th className="right">Fixo (un.)</th>
                  <th className="right">Valor total</th><th className="right">% recorr.</th><th className="right">Recorrente</th>
                  <th className="right">Total</th><th>OBS</th>
                  <th>Data</th><th>Status</th><th className="right">Ações</th>
                </tr>
              )}
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  {isAmb ? (
                    <>
                      <td><Badge tone={c.tipo === 'tecnico' ? 'purple' : 'blue'}>{c.tipo}</Badge></td>
                      <td className="bold">{userName(c.pessoaId)}</td>
                      <td>{clientName(c.clientId)}</td>
                      <td>{c.tipo === 'tecnico' ? <><Badge tone="gray">{servicoLabel(c.tipoServico)}</Badge><br /><span className="mono mut">{c.equipamentoId ? equipSerial(c.equipamentoId) : '—'}</span></> : '—'}</td>
                      <td className="right mono">{num(c.quantidadeEquipamentos || (c.tipo === 'vendedor' ? 1 : 0))}</td>
                      <td className="right mono">{c.tipo === 'vendedor' ? BRL(c.valorFixo) : '—'}</td>
                      <td className="right mono">{c.tipo === 'vendedor' ? BRL(totalFixo(c)) : '—'}</td>
                      <td className="right mono">{c.tipo === 'vendedor' ? (c.percentual ? pct(c.percentual) : '—') : '—'}</td>
                      <td className="right mono">{c.tipo === 'vendedor' ? <><span className="flex gap-6 nowrap" style={{ justifyContent: 'flex-end' }}>{c.valorRecorrente ? <Repeat size={12} className="mut" /> : null}{BRL(c.valorRecorrente)}</span></> : '—'}</td>
                      <td className="mono">{c.placa || <span className="mut">—</span>}</td>
                      <td>{c.km != null ? <><span className="mono">{num(c.km)} km</span>{c.kmManual && <span className="flex gap-6 nowrap" style={{ color: 'var(--amber)', fontSize: 12 }} title="KM informado manualmente"><AlertTriangle size={14} /></span>}</> : <span className="mut">—</span>}</td>
                      <td className="right mono">{c.tipo === 'tecnico' ? BRL(c.valorServico) : '—'}</td>
                      <td className="right mono">{c.tipo === 'tecnico' ? BRL((Number(c.km) || 0) * (Number(c.valorKm) || 0)) : '—'}</td>
                      <td className="right mono">{c.tipo === 'tecnico' ? BRL(c.pedagio) : '—'}</td>
                      <td className="right mono">{c.tipo === 'tecnico' ? BRL(c.extras) : '—'}</td>
                      <td className="right mono bold">{BRL(valorComissao(c))}</td>
                    </>
                  ) : isTecnico ? (
                    <>
                      <td className="bold">{userName(c.pessoaId)}</td>
                      <td>{clientName(c.clientId)}</td>
                      <td><Badge tone="gray">{servicoLabel(c.tipoServico)}</Badge></td>
                      <td className="mono">{c.placa || <span className="mut">—</span>}</td>
                      <td className="mono">{c.equipamentoId ? equipSerial(c.equipamentoId) : <span className="mut">—</span>}</td>
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
                      <td className="right mono">{BRL(c.pedagio)}</td>
                      <td className="right mono">{BRL(c.extras)}</td>
                      <td className="right mono bold">{BRL(valorComissao(c))}</td>
                    </>
                  ) : (
                    <>
                      <td className="bold">{userName(c.pessoaId)}</td>
                      <td>{clientName(c.clientId)}</td>
                      <td className="right mono">{num(c.quantidadeEquipamentos || 1)}</td>
                      <td className="right mono">{BRL(c.valorFixo)}</td>
                      <td className="right mono">{BRL(totalFixo(c))}</td>
                      <td className="right mono">{c.percentual ? pct(c.percentual) : '—'}</td>
                      <td className="right mono">
                        <span className="flex gap-6 nowrap" style={{ justifyContent: 'flex-end' }}>
                          {c.valorRecorrente ? <Repeat size={12} className="mut" /> : null}{BRL(c.valorRecorrente)}
                        </span>
                      </td>
                      <td className="right mono bold">{BRL(valorComissao(c))}</td>
                      <td className="mut" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.obs || ''}>
                        {c.obs || '—'}
                      </td>
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
              title={`Nenhuma comissão${isAmb ? '' : ` de ${isTecnico ? 'técnico' : 'vendedor'}`}`}
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
          <Field label="Cliente" required hint="Cliente que originou a comissão">
            <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
              <option value="">Selecione</option>
              {clientes.map((c) => {
                const qtd = c.quantidadeEquipamentos || 0
                return <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}{qtd ? ` (${qtd} equip.)` : ''}</option>
              })}
            </select>
          </Field>
        </div>

        {form.tipo === 'vendedor' ? (
          <>
            <div className="form-row-3">
              <Field label="Qtd. de equipamentos" required hint="Equipamentos vendidos">
                <input type="number" step="1" min="1" value={form.quantidadeEquipamentos} onChange={(e) => set({ quantidadeEquipamentos: e.target.value })} placeholder="1" />
              </Field>
              <Field label="Valor fixo (R$)" hint="Por equipamento">
                <input type="number" step="0.01" min="0" value={form.valorFixo} onChange={(e) => set({ valorFixo: e.target.value })} placeholder="50,00" />
              </Field>
              <Field label="Valor total (R$)" hint="Fixo × quantidade">
                <input value={BRL(previaFixo)} readOnly tabIndex={-1} style={{ background: 'var(--surface-2)' }} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Percentual recorrente (%)" hint="Sobre a mensalidade">
                <input type="number" step="0.1" min="0" value={form.percentual} onChange={(e) => set({ percentual: e.target.value })} placeholder="5" />
              </Field>
              <Field label="Base recorrente (R$)" hint="Mensalidade do cliente">
                <input type="number" step="0.01" min="0" value={form.baseRecorrente} onChange={(e) => set({ baseRecorrente: e.target.value })} placeholder="0,00" />
              </Field>
            </div>
            <Field label="OBS." hint="Gasto com o cliente, combinados, particularidades">
              <textarea rows={3} value={form.obs} onChange={(e) => set({ obs: e.target.value })} placeholder="Ex.: almoço com o cliente R$ 80,00" />
            </Field>
            <div className="flex gap-8 soft" style={{ fontSize: 13, alignItems: 'center' }}>
              <Repeat size={15} />
              Comissão do vendedor = <b>valor total</b> + <b>{pct(Number(form.percentual) || 0)}</b> recorrente sobre a mensalidade.
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
            <div className="form-row">
              <Field label="Placa" hint="Veículo atendido">
                <input value={form.placa} onChange={(e) => set({ placa: e.target.value.toUpperCase() })} placeholder="ABC1D23" maxLength={8} />
              </Field>
              <Field label="Nº do equipamento" hint="Nº de série cadastrado no estoque">
                <select value={form.equipamentoId} onChange={(e) => set({ equipamentoId: e.target.value })}>
                  <option value="">Selecione</option>
                  {equipamentos.map((e) => <option key={e.id} value={e.id}>{e.serial} · {e.modelo}</option>)}
                </select>
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
            <div className="form-row">
              <Field label="Pedágio (R$)" hint="Total gasto no deslocamento">
                <input type="number" step="0.01" min="0" value={form.pedagio} onChange={(e) => set({ pedagio: e.target.value })} placeholder="0,00" />
              </Field>
              <Field label="Valores extras (R$)" hint="Alimentação, materiais, outros">
                <input type="number" step="0.01" min="0" value={form.extras} onChange={(e) => set({ extras: e.target.value })} placeholder="0,00" />
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
