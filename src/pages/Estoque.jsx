import { useState, useMemo } from 'react'
import {
  Smartphone, Package, Plus, CheckCircle2, Layers, Boxes, Search, Wrench,
  Pencil, Link2, Link2Off, RotateCcw,
} from 'lucide-react'
import { api, clientName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, maskPhone, uid } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Stat, Field, EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

const OPERADORAS = ['Vivo', 'Claro', 'TIM', 'Arqia']

const emptyChip = () => ({ id: null, iccid: '', linha: '', operadora: 'Vivo', valor: 25 })
const emptyEquip = () => ({ id: null, modelo: '', serial: '', tipo: 'Rastreador', valor: 220 })

// Status ativos (sem defeituoso/cancelado — pedido do cliente).
const STATUS_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponivel', label: 'Disponíveis' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'manutencao', label: 'Manutenção' },
]

const count = (arr, status) => arr.filter((x) => x.status === status).length

export default function Estoque() {
  const { db, refetch } = useCollections(['equipamentos', 'chips', 'clients'])
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('equipamentos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [q, setQ] = useState('')

  const [chipOpen, setChipOpen] = useState(false)
  const [chipForm, setChipForm] = useState(emptyChip)

  const [equipOpen, setEquipOpen] = useState(false)
  const [equipForm, setEquipForm] = useState(emptyEquip)

  // Vínculo chip ↔ equipamento. { kind: 'chip'|'equip', item }
  const [vinculo, setVinculo] = useState(null)

  const chips = db.chips || []
  const equipamentos = db.equipamentos || []

  const filtered = useMemo(() => {
    const base = tab === 'chips' ? chips : equipamentos
    const term = q.trim().toLowerCase()
    return base.filter((x) => {
      if (statusFilter !== 'todos' && x.status !== statusFilter) return false
      if (!term) return true
      const txt = tab === 'chips'
        ? `${x.iccid} ${x.linha} ${x.operadora}`.toLowerCase()
        : `${x.modelo} ${x.serial} ${x.tipo}`.toLowerCase()
      return txt.includes(term) || clientName(x.clientId).toLowerCase().includes(term)
    })
  }, [tab, chips, equipamentos, statusFilter, q])

  const kpiList = tab === 'chips' ? chips : equipamentos

  // ---------- Manutenção / voltar para disponível ----------
  const alternarManutencao = async (coll, item) => {
    const emManutencao = item.status === 'manutencao'
    const novoStatus = emManutencao ? (item.clientId ? 'em_uso' : 'disponivel') : 'manutencao'
    try {
      await api[coll].update(item.id, { status: novoStatus })
      const ent = coll === 'chips' ? 'chip' : 'equipamento'
      logAudit(user.id, 'editar', ent, `${emManutencao ? 'Retorno de manutenção' : 'Enviado para manutenção'}: ${item.iccid || item.serial}`)
      toast(emManutencao ? 'Item retornou da manutenção' : 'Item enviado para manutenção')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  // ---------- Editar ----------
  const editarChip = (c) => { setChipForm({ id: c.id, iccid: c.iccid, linha: c.linha, operadora: c.operadora, valor: c.valor }); setChipOpen(true) }
  const editarEquip = (e) => { setEquipForm({ id: e.id, modelo: e.modelo, serial: e.serial, tipo: e.tipo, valor: e.valor }); setEquipOpen(true) }

  const salvarChip = async () => {
    if (!chipForm.iccid.trim()) { toast('Informe o ICCID', 'error'); return }
    try {
      if (chipForm.id) {
        await api.chips.update(chipForm.id, { iccid: chipForm.iccid.trim(), linha: chipForm.linha.trim(), operadora: chipForm.operadora, valor: +chipForm.valor || 0 })
        logAudit(user.id, 'editar', 'chip', `Chip ${chipForm.iccid.trim()} editado`)
        toast('Chip atualizado')
      } else {
        await api.chips.insert({ id: uid('ch'), iccid: chipForm.iccid.trim(), linha: chipForm.linha.trim(), operadora: chipForm.operadora, valor: +chipForm.valor || 0, status: 'disponivel', clientId: null, equipamentoId: null })
        logAudit(user.id, 'criar', 'chip', `Novo chip ${chipForm.iccid.trim()} (${chipForm.operadora})`)
        toast('Chip adicionado ao estoque')
      }
      setChipOpen(false)
      setChipForm(emptyChip())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const salvarEquip = async () => {
    if (!equipForm.modelo.trim()) { toast('Informe o modelo', 'error'); return }
    if (!equipForm.serial.trim()) { toast('Informe o nº de série', 'error'); return }
    try {
      if (equipForm.id) {
        await api.equipamentos.update(equipForm.id, { modelo: equipForm.modelo.trim(), serial: equipForm.serial.trim(), tipo: equipForm.tipo.trim() || 'Rastreador', valor: +equipForm.valor || 0 })
        logAudit(user.id, 'editar', 'equipamento', `Equipamento ${equipForm.serial.trim()} editado`)
        toast('Equipamento atualizado')
      } else {
        await api.equipamentos.insert({ id: uid('eq'), modelo: equipForm.modelo.trim(), serial: equipForm.serial.trim(), tipo: equipForm.tipo.trim() || 'Rastreador', valor: +equipForm.valor || 0, status: 'disponivel', clientId: null, chipId: null })
        logAudit(user.id, 'criar', 'equipamento', `Novo equipamento ${equipForm.serial.trim()} (${equipForm.modelo.trim()})`)
        toast('Equipamento adicionado ao estoque')
      }
      setEquipOpen(false)
      setEquipForm(emptyEquip())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  // ---------- Vinculação ----------
  const chipById = (id) => chips.find((c) => c.id === id)
  const equipById = (id) => equipamentos.find((e) => e.id === id)

  // Alvos disponíveis para o modal de vínculo.
  const alvosVinculo = useMemo(() => {
    if (!vinculo) return []
    if (vinculo.kind === 'chip') return equipamentos.filter((e) => e.status !== 'manutencao' && !e.chipId)
    return chips.filter((c) => c.status !== 'manutencao' && !c.equipamentoId)
  }, [vinculo, equipamentos, chips])

  const confirmarVinculo = async (alvo) => {
    if (!vinculo) return
    const chip = vinculo.kind === 'chip' ? vinculo.item : alvo
    const equip = vinculo.kind === 'chip' ? alvo : vinculo.item
    const clientId = equip.clientId || chip.clientId || null
    const status = clientId ? 'em_uso' : 'disponivel'
    try {
      await api.chips.update(chip.id, { equipamentoId: equip.id, clientId, status })
      await api.equipamentos.update(equip.id, { chipId: chip.id, clientId, status })
      logAudit(user.id, 'vincular', 'estoque', `Chip ${chip.iccid} ↔ Equipamento ${equip.serial}`)
      toast('Chip vinculado ao equipamento')
      setVinculo(null)
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const desvincular = async (equip) => {
    const chip = chipById(equip.chipId)
    try {
      if (chip) await api.chips.update(chip.id, { equipamentoId: null, status: chip.status === 'em_uso' ? 'disponivel' : chip.status, clientId: null })
      await api.equipamentos.update(equip.id, { chipId: null })
      logAudit(user.id, 'desvincular', 'estoque', `Equipamento ${equip.serial} desvinculado do chip`)
      toast('Chip desvinculado')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const setChip = (patch) => setChipForm((f) => ({ ...f, ...patch }))
  const setEquip = (patch) => setEquipForm((f) => ({ ...f, ...patch }))

  return (
    <>
      <PageHead title="Estoque" subtitle="Controle de equipamentos e chips: disponibilidade, uso, manutenção e vinculação.">
        {tab === 'chips' ? (
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setChipForm(emptyChip()); setChipOpen(true) }}>
            Adicionar chip
          </Btn>
        ) : (
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setEquipForm(emptyEquip()); setEquipOpen(true) }}>
            Adicionar equipamento
          </Btn>
        )}
      </PageHead>

      <div className="flex between wrap gap-12" style={{ marginBottom: 16 }}>
        <Segmented value={tab} onChange={(v) => { setTab(v); setStatusFilter('todos') }} options={[
          { value: 'equipamentos', label: 'Equipamentos' },
          { value: 'chips', label: 'Chips' },
        ]} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat icon={<Boxes size={18} />} tone="purple" label="Total" value={kpiList.length} />
        <Stat icon={<CheckCircle2 size={18} />} tone="green" label="Disponíveis" value={count(kpiList, 'disponivel')} />
        <Stat icon={<Layers size={18} />} tone="blue" label="Em uso" value={count(kpiList, 'em_uso')} />
        <Stat icon={<Wrench size={18} />} tone="amber" label="Manutenção" value={count(kpiList, 'manutencao')} />
      </div>

      <Card>
        <div className="card-head">
          <div className="search" style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} className="mut" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === 'chips' ? 'Buscar ICCID, linha, operadora...' : 'Buscar modelo, série, tipo...'}
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
            />
          </div>
          <div className="spacer" />
          <Segmented value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
        </div>

        <div className="table-wrap">
          {tab === 'chips' ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>ICCID</th><th>Linha</th><th>Operadora</th><th className="right">Valor</th>
                  <th>Equipamento</th><th>Cliente</th><th>Status</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const eq = equipById(c.equipamentoId)
                  return (
                    <tr key={c.id}>
                      <td className="mono">{c.iccid}</td>
                      <td className="mono">{maskPhone(c.linha)}</td>
                      <td><Badge tone="gray">{c.operadora}</Badge></td>
                      <td className="right mono">{BRL(c.valor)}</td>
                      <td className="mono">{eq ? eq.serial : <span className="mut">—</span>}</td>
                      <td>{clientName(c.clientId)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="right nowrap">
                        <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                          <Btn size="sm" icon={<Pencil size={13} />} onClick={() => editarChip(c)}>Editar</Btn>
                          {eq ? (
                            <Btn size="sm" icon={<Link2Off size={13} />} onClick={() => desvincular(eq)}>Desvincular</Btn>
                          ) : (
                            c.status !== 'manutencao' && <Btn size="sm" variant="primary" icon={<Link2 size={13} />} onClick={() => setVinculo({ kind: 'chip', item: c })}>Vincular</Btn>
                          )}
                          <Btn size="sm" icon={c.status === 'manutencao' ? <RotateCcw size={13} /> : <Wrench size={13} />} onClick={() => alternarManutencao('chips', c)}>
                            {c.status === 'manutencao' ? 'Disponível' : 'Manutenção'}
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Modelo</th><th>Nº de série</th><th>Tipo</th><th className="right">Valor</th>
                  <th>Chip vinculado</th><th>Cliente</th><th>Status</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const chip = chipById(e.chipId)
                  return (
                    <tr key={e.id}>
                      <td className="bold">{e.modelo}</td>
                      <td className="mono">{e.serial}</td>
                      <td><Badge tone="blue">{e.tipo}</Badge></td>
                      <td className="right mono">{BRL(e.valor)}</td>
                      <td className="mono">{chip ? `${chip.operadora} · ${maskPhone(chip.linha)}` : <span className="mut">— sem chip —</span>}</td>
                      <td>{clientName(e.clientId)}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td className="right nowrap">
                        <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                          <Btn size="sm" icon={<Pencil size={13} />} onClick={() => editarEquip(e)}>Editar</Btn>
                          {chip ? (
                            <Btn size="sm" icon={<Link2Off size={13} />} onClick={() => desvincular(e)}>Desvincular</Btn>
                          ) : (
                            e.status !== 'manutencao' && <Btn size="sm" variant="primary" icon={<Link2 size={13} />} onClick={() => setVinculo({ kind: 'equip', item: e })}>Vincular chip</Btn>
                          )}
                          <Btn size="sm" icon={e.status === 'manutencao' ? <RotateCcw size={13} /> : <Wrench size={13} />} onClick={() => alternarManutencao('equipamentos', e)}>
                            {e.status === 'manutencao' ? 'Disponível' : 'Manutenção'}
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {!filtered.length && (
            <EmptyState
              icon={tab === 'chips' ? <Smartphone size={40} /> : <Boxes size={40} />}
              title={`Nenhum ${tab === 'chips' ? 'chip' : 'equipamento'} encontrado`}
              sub="Ajuste os filtros ou cadastre um novo item no estoque."
            />
          )}
        </div>
      </Card>

      {/* ---- Modal: adicionar / editar chip ---- */}
      <Modal
        open={chipOpen}
        onClose={() => setChipOpen(false)}
        title={chipForm.id ? 'Editar chip' : 'Adicionar chip ao estoque'}
        icon={<Smartphone size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setChipOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarChip}>{chipForm.id ? 'Salvar alterações' : 'Salvar chip'}</Btn></>}
      >
        <Field label="ICCID" required hint="Número impresso no chip (20 dígitos)">
          <input value={chipForm.iccid} onChange={(e) => setChip({ iccid: e.target.value })} placeholder="8955010012345678901" />
        </Field>
        <div className="form-row">
          <Field label="Linha">
            <input value={chipForm.linha} onChange={(e) => setChip({ linha: e.target.value })} placeholder="Somente números" />
          </Field>
          <Field label="Operadora">
            <select value={chipForm.operadora} onChange={(e) => setChip({ operadora: e.target.value })}>
              {OPERADORAS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Valor (R$)">
          <input type="number" step="0.01" value={chipForm.valor} onChange={(e) => setChip({ valor: e.target.value })} />
        </Field>
        {!chipForm.id && <div className="mut" style={{ fontSize: 12.5, marginTop: 4 }}>O chip entra no estoque com status <b>Disponível</b>.</div>}
      </Modal>

      {/* ---- Modal: adicionar / editar equipamento ---- */}
      <Modal
        open={equipOpen}
        onClose={() => setEquipOpen(false)}
        title={equipForm.id ? 'Editar equipamento' : 'Adicionar equipamento ao estoque'}
        icon={<Package size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setEquipOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarEquip}>{equipForm.id ? 'Salvar alterações' : 'Salvar equipamento'}</Btn></>}
      >
        <div className="form-row">
          <Field label="Modelo" required>
            <input value={equipForm.modelo} onChange={(e) => setEquip({ modelo: e.target.value })} placeholder="GT06N" />
          </Field>
          <Field label="Nº de série" required>
            <input value={equipForm.serial} onChange={(e) => setEquip({ serial: e.target.value })} placeholder="GT06N-000106" />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Tipo">
            <input value={equipForm.tipo} onChange={(e) => setEquip({ tipo: e.target.value })} placeholder="Rastreador / Isca" />
          </Field>
          <Field label="Valor (R$)">
            <input type="number" step="0.01" value={equipForm.valor} onChange={(e) => setEquip({ valor: e.target.value })} />
          </Field>
        </div>
        {!equipForm.id && <div className="mut" style={{ fontSize: 12.5, marginTop: 4 }}>O equipamento entra no estoque com status <b>Disponível</b>.</div>}
      </Modal>

      {/* ---- Modal: vincular chip ↔ equipamento ---- */}
      <Modal
        open={!!vinculo}
        onClose={() => setVinculo(null)}
        title={vinculo?.kind === 'chip' ? 'Vincular chip a um equipamento' : 'Vincular chip ao equipamento'}
        icon={<Link2 size={20} color="var(--brand)" />}
        footer={<Btn onClick={() => setVinculo(null)}>Fechar</Btn>}
      >
        {vinculo && (
          <>
            <div className="soft" style={{ marginBottom: 12 }}>
              {vinculo.kind === 'chip'
                ? <>Selecione o <b>equipamento disponível</b> para o chip <b className="mono">{vinculo.item.iccid}</b> ({vinculo.item.operadora}).</>
                : <>Selecione o <b>chip disponível</b> para o equipamento <b className="mono">{vinculo.item.serial}</b> ({vinculo.item.modelo}).</>}
            </div>
            <div className="table-wrap" style={{ maxHeight: 320, overflow: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {vinculo.kind === 'chip'
                      ? <><th>Modelo</th><th>Nº de série</th><th>Tipo</th><th className="right">Ação</th></>
                      : <><th>ICCID</th><th>Linha</th><th>Operadora</th><th className="right">Ação</th></>}
                  </tr>
                </thead>
                <tbody>
                  {alvosVinculo.map((alvo) => (
                    <tr key={alvo.id}>
                      {vinculo.kind === 'chip' ? (
                        <>
                          <td className="bold">{alvo.modelo}</td>
                          <td className="mono">{alvo.serial}</td>
                          <td><Badge tone="blue">{alvo.tipo}</Badge></td>
                        </>
                      ) : (
                        <>
                          <td className="mono">{alvo.iccid}</td>
                          <td className="mono">{maskPhone(alvo.linha)}</td>
                          <td><Badge tone="gray">{alvo.operadora}</Badge></td>
                        </>
                      )}
                      <td className="right">
                        <Btn size="sm" variant="primary" icon={<Link2 size={13} />} onClick={() => confirmarVinculo(alvo)}>Vincular</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!alvosVinculo.length && (
                <EmptyState icon={<Boxes size={36} />} title="Nada disponível para vincular" sub={vinculo.kind === 'chip' ? 'Não há equipamentos disponíveis sem chip.' : 'Não há chips disponíveis sem equipamento.'} />
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
