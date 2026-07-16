import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  Smartphone, Package, Plus, CheckCircle2, Layers, Boxes, Search, Wrench,
  Pencil, Link2, Link2Off, RotateCcw, Ban, XCircle, Upload, Download,
} from 'lucide-react'
import { api, clientName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, maskPhone, uid, fmtDate, todayISO } from '../lib/format.js'
import { lerPlanilha, baixarModelo } from '../lib/planilha.js'
import {
  PageHead, Card, Btn, Badge, Stat, Field, EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

const OPERADORAS = ['Vivo', 'Claro', 'TIM', 'Arqia']

const emptyChip = () => ({ id: null, iccid: '', linha: '', operadora: 'Vivo', valor: 25, data: todayISO() })
const emptyEquip = () => ({ id: null, modelo: '', serial: '', tipo: 'Rastreador', valor: 220, data: todayISO() })

// Filtros de status por aba (Equipamentos usa Manutenção; Chips usa Cancelado).
const EQUIP_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponivel', label: 'Disponíveis' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'manutencao', label: 'Manutenção' },
]
const CHIP_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponivel', label: 'Disponíveis' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'cancelado', label: 'Cancelado' },
]

const count = (arr, status) => arr.filter((x) => x.status === status).length

const TABS = {
  equipamentos: { title: 'Equipamento', subtitle: 'Rastreadores e iscas: disponibilidade, uso, manutenção e chip vinculado.' },
  chips: { title: 'Chip', subtitle: 'Linhas e ICCIDs: disponibilidade, uso, cancelamento e equipamento vinculado.' },
  vinculos: { title: 'Equipamento/Chip', subtitle: 'Vínculo entre equipamento e chip por cliente.' },
}

export default function Estoque() {
  const { db, refetch } = useCollections(['equipamentos', 'chips', 'clients'])
  const { user } = useAuth()
  const toast = useToast()
  const { tab } = useParams()

  const [statusFilter, setStatusFilter] = useState('todos')
  const [q, setQ] = useState('')

  // Trocar de aba pelo menu zera busca e filtro.
  useEffect(() => { setStatusFilter('todos'); setQ('') }, [tab])

  const [chipOpen, setChipOpen] = useState(false)
  const [chipForm, setChipForm] = useState(emptyChip)

  const [equipOpen, setEquipOpen] = useState(false)
  const [equipForm, setEquipForm] = useState(emptyEquip)

  // Cancelamento de chip. { chip, dataCancelamento, protocolo }
  const [cancelForm, setCancelForm] = useState(null)

  // Vínculo chip ↔ equipamento. { kind: 'chip'|'equip', item }
  const [vinculo, setVinculo] = useState(null)

  const equipFileRef = useRef(null)
  const chipFileRef = useRef(null)

  const chips = db.chips || []
  const equipamentos = db.equipamentos || []

  const isChips = tab === 'chips'

  const filtered = useMemo(() => {
    const base = isChips ? chips : equipamentos
    const term = q.trim().toLowerCase()
    return base.filter((x) => {
      if (statusFilter !== 'todos' && x.status !== statusFilter) return false
      if (!term) return true
      const txt = isChips
        ? `${x.iccid} ${x.linha} ${x.operadora}`.toLowerCase()
        : `${x.modelo} ${x.serial} ${x.tipo}`.toLowerCase()
      return txt.includes(term) || clientName(x.clientId).toLowerCase().includes(term)
    })
  }, [isChips, chips, equipamentos, statusFilter, q])

  // Aba combinada Equipamento/Chip — lista todos os equipamentos (com busca).
  const vinculosList = useMemo(() => {
    const term = q.trim().toLowerCase()
    return equipamentos.filter((e) => {
      if (!term) return true
      const chip = chips.find((c) => c.id === e.chipId)
      const txt = `${e.modelo} ${e.serial} ${chip ? chip.iccid + ' ' + chip.operadora : ''}`.toLowerCase()
      return txt.includes(term) || clientName(e.clientId).toLowerCase().includes(term)
    })
  }, [equipamentos, chips, q])

  const kpiList = isChips ? chips : equipamentos
  const statusFilters = isChips ? CHIP_FILTERS : EQUIP_FILTERS

  // ---------- Manutenção (apenas equipamentos) ----------
  const alternarManutencao = async (item) => {
    const emManutencao = item.status === 'manutencao'
    const novoStatus = emManutencao ? (item.clientId ? 'em_uso' : 'disponivel') : 'manutencao'
    try {
      await api.equipamentos.update(item.id, { status: novoStatus })
      logAudit(user.id, 'editar', 'equipamento', `${emManutencao ? 'Retorno de manutenção' : 'Enviado para manutenção'}: ${item.serial}`)
      toast(emManutencao ? 'Item retornou da manutenção' : 'Item enviado para manutenção')
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  // ---------- Cancelamento de chip ----------
  const abrirCancelamento = (chip) => setCancelForm({ chip, dataCancelamento: todayISO(), protocolo: '' })

  const confirmarCancelamento = async () => {
    if (!cancelForm) return
    if (!cancelForm.protocolo.trim()) { toast('Informe o nº de protocolo', 'error'); return }
    const { chip, dataCancelamento, protocolo } = cancelForm
    try {
      await api.chips.update(chip.id, { status: 'cancelado', dataCancelamento, protocolo: protocolo.trim(), equipamentoId: null, clientId: null })
      if (chip.equipamentoId) await api.equipamentos.update(chip.equipamentoId, { chipId: null })
      logAudit(user.id, 'editar', 'chip', `Chip ${chip.iccid} cancelado (protocolo ${protocolo.trim()})`)
      toast('Chip cancelado')
      setCancelForm(null)
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  // ---------- Editar ----------
  const editarChip = (c) => { setChipForm({ id: c.id, iccid: c.iccid, linha: c.linha, operadora: c.operadora, valor: c.valor, data: c.data || todayISO() }); setChipOpen(true) }
  const editarEquip = (e) => { setEquipForm({ id: e.id, modelo: e.modelo, serial: e.serial, tipo: e.tipo, valor: e.valor, data: e.data || todayISO() }); setEquipOpen(true) }

  const salvarChip = async () => {
    if (!chipForm.iccid.trim()) { toast('Informe o ICCID', 'error'); return }
    try {
      if (chipForm.id) {
        await api.chips.update(chipForm.id, { iccid: chipForm.iccid.trim(), linha: chipForm.linha.trim(), operadora: chipForm.operadora, valor: +chipForm.valor || 0, data: chipForm.data })
        logAudit(user.id, 'editar', 'chip', `Chip ${chipForm.iccid.trim()} editado`)
        toast('Chip atualizado')
      } else {
        await api.chips.insert({ id: uid('ch'), iccid: chipForm.iccid.trim(), linha: chipForm.linha.trim(), operadora: chipForm.operadora, valor: +chipForm.valor || 0, data: chipForm.data, status: 'disponivel', clientId: null, equipamentoId: null })
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
        await api.equipamentos.update(equipForm.id, { modelo: equipForm.modelo.trim(), serial: equipForm.serial.trim(), tipo: equipForm.tipo.trim() || 'Rastreador', valor: +equipForm.valor || 0, data: equipForm.data })
        logAudit(user.id, 'editar', 'equipamento', `Equipamento ${equipForm.serial.trim()} editado`)
        toast('Equipamento atualizado')
      } else {
        await api.equipamentos.insert({ id: uid('eq'), modelo: equipForm.modelo.trim(), serial: equipForm.serial.trim(), tipo: equipForm.tipo.trim() || 'Rastreador', valor: +equipForm.valor || 0, data: equipForm.data, status: 'disponivel', clientId: null, chipId: null })
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

  // ---------- Importação / modelo de planilha ----------
  const baixarModeloEquip = () => baixarModelo('modelo-equipamentos.xlsx', ['Modelo', 'Serial', 'Tipo', 'Valor', 'Data'], { Modelo: 'GT06N', Serial: 'GT06N-000999', Tipo: 'Rastreador', Valor: 220, Data: todayISO() })
  const baixarModeloChip = () => baixarModelo('modelo-chips.xlsx', ['ICCID', 'Linha', 'Operadora', 'Valor', 'Data'], { ICCID: '8955010012345670000', Linha: '11988880000', Operadora: 'Vivo', Valor: 25, Data: todayISO() })

  const importarEquip = async (ev) => {
    const file = ev.target.files?.[0]
    if (!file) return
    try {
      const rows = await lerPlanilha(file)
      const lista = rows
        .filter((row) => row.Modelo && row.Serial)
        .map((row) => ({ id: uid('eq'), modelo: String(row.Modelo).trim(), serial: String(row.Serial).trim(), tipo: row.Tipo || 'Rastreador', valor: Number(row.Valor) || 0, data: row.Data || todayISO(), status: 'disponivel', clientId: null, chipId: null }))
      if (!lista.length) { toast('Nenhuma linha válida na planilha', 'error'); return }
      await api.equipamentos.insertMany(lista)
      logAudit(user.id, 'criar', 'equipamento', `Importação de ${lista.length} equipamento(s) via planilha`)
      toast(`${lista.length} item(ns) importado(s)`)
      refetch()
    } catch (e) {
      toast('Erro ao importar: ' + e.message, 'error')
    } finally {
      if (equipFileRef.current) equipFileRef.current.value = ''
    }
  }

  const importarChip = async (ev) => {
    const file = ev.target.files?.[0]
    if (!file) return
    try {
      const rows = await lerPlanilha(file)
      const lista = rows
        .filter((row) => row.ICCID)
        .map((row) => ({ id: uid('ch'), iccid: String(row.ICCID).trim(), linha: String(row.Linha || '').trim(), operadora: row.Operadora || 'Vivo', valor: Number(row.Valor) || 0, data: row.Data || todayISO(), status: 'disponivel', clientId: null, equipamentoId: null }))
      if (!lista.length) { toast('Nenhuma linha válida na planilha', 'error'); return }
      await api.chips.insertMany(lista)
      logAudit(user.id, 'criar', 'chip', `Importação de ${lista.length} chip(s) via planilha`)
      toast(`${lista.length} item(ns) importado(s)`)
      refetch()
    } catch (e) {
      toast('Erro ao importar: ' + e.message, 'error')
    } finally {
      if (chipFileRef.current) chipFileRef.current.value = ''
    }
  }

  // ---------- Vinculação ----------
  const chipById = (id) => chips.find((c) => c.id === id)
  const equipById = (id) => equipamentos.find((e) => e.id === id)

  // Alvos disponíveis para o modal de vínculo.
  const alvosVinculo = useMemo(() => {
    if (!vinculo) return []
    if (vinculo.kind === 'chip') return equipamentos.filter((e) => e.status !== 'manutencao' && !e.chipId)
    return chips.filter((c) => c.status !== 'manutencao' && c.status !== 'cancelado' && !c.equipamentoId)
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

  // Depois dos hooks: aba inválida na URL volta para a primeira.
  if (!TABS[tab]) return <Navigate to="/estoque/equipamentos" replace />

  return (
    <>
      <PageHead title={TABS[tab].title} subtitle={TABS[tab].subtitle}>
        {tab === 'equipamentos' && (
          <>
            <Btn icon={<Download size={16} />} onClick={baixarModeloEquip}>Baixar modelo</Btn>
            <Btn icon={<Upload size={16} />} onClick={() => equipFileRef.current?.click()}>Importar planilha</Btn>
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setEquipForm(emptyEquip()); setEquipOpen(true) }}>
              Adicionar equipamento
            </Btn>
          </>
        )}
        {tab === 'chips' && (
          <>
            <Btn icon={<Download size={16} />} onClick={baixarModeloChip}>Baixar modelo</Btn>
            <Btn icon={<Upload size={16} />} onClick={() => chipFileRef.current?.click()}>Importar planilha</Btn>
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setChipForm(emptyChip()); setChipOpen(true) }}>
              Adicionar chip
            </Btn>
          </>
        )}
      </PageHead>

      {/* inputs de importação (ocultos) */}
      <input ref={equipFileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importarEquip} />
      <input ref={chipFileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importarChip} />

      {tab !== 'vinculos' && (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat icon={<Boxes size={18} />} tone="purple" label="Total" value={kpiList.length} />
          <Stat icon={<CheckCircle2 size={18} />} tone="green" label="Disponíveis" value={count(kpiList, 'disponivel')} />
          <Stat icon={<Layers size={18} />} tone="blue" label="Em uso" value={count(kpiList, 'em_uso')} />
          {isChips
            ? <Stat icon={<XCircle size={18} />} tone="red" label="Cancelado" value={count(kpiList, 'cancelado')} />
            : <Stat icon={<Wrench size={18} />} tone="amber" label="Manutenção" value={count(kpiList, 'manutencao')} />}
        </div>
      )}

      <Card>
        <div className="card-head">
          <div className="search" style={{ maxWidth: 320, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} className="mut" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isChips ? 'Buscar ICCID, linha, operadora...' : 'Buscar modelo, série, tipo...'}
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
            />
          </div>
          <div className="spacer" />
          {tab !== 'vinculos' && <Segmented value={statusFilter} onChange={setStatusFilter} options={statusFilters} />}
        </div>

        <div className="table-wrap">
          {tab === 'chips' && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>ICCID</th><th>Linha</th><th>Operadora</th><th className="right">Valor</th><th>Data</th>
                  <th>Equipamento</th><th>Cliente</th><th>Status</th><th>Cancelamento</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const eq = equipById(c.equipamentoId)
                  const cancelado = c.status === 'cancelado'
                  return (
                    <tr key={c.id}>
                      <td className="mono">{c.iccid}</td>
                      <td className="mono">{maskPhone(c.linha)}</td>
                      <td><Badge tone="gray">{c.operadora}</Badge></td>
                      <td className="right mono">{BRL(c.valor)}</td>
                      <td>{fmtDate(c.data)}</td>
                      <td className="mono">{eq ? eq.serial : <span className="mut">—</span>}</td>
                      <td>{clientName(c.clientId)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        {cancelado
                          ? <span><b>{c.protocolo || '—'}</b> · {fmtDate(c.dataCancelamento)}</span>
                          : <span className="mut">—</span>}
                      </td>
                      <td className="right nowrap">
                        <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                          <Btn size="sm" icon={<Pencil size={13} />} onClick={() => editarChip(c)}>Editar</Btn>
                          {eq ? (
                            <Btn size="sm" icon={<Link2Off size={13} />} onClick={() => desvincular(eq)}>Desvincular</Btn>
                          ) : (
                            !cancelado && <Btn size="sm" variant="primary" icon={<Link2 size={13} />} onClick={() => setVinculo({ kind: 'chip', item: c })}>Vincular</Btn>
                          )}
                          {!cancelado && (
                            <Btn size="sm" variant="danger" icon={<Ban size={13} />} onClick={() => abrirCancelamento(c)}>Cancelar</Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {tab === 'equipamentos' && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Modelo</th><th>Nº de série</th><th>Tipo</th><th className="right">Valor</th><th>Data</th>
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
                      <td>{fmtDate(e.data)}</td>
                      <td className="mono">{chip ? chip.iccid : <span className="mut">— sem chip —</span>}</td>
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
                          <Btn size="sm" icon={e.status === 'manutencao' ? <RotateCcw size={13} /> : <Wrench size={13} />} onClick={() => alternarManutencao(e)}>
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

          {tab === 'vinculos' && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Equipamento</th><th>Modelo</th><th>Chip (ICCID)</th><th>Operadora</th>
                  <th>Cliente</th><th>Status</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vinculosList.map((e) => {
                  const chip = chipById(e.chipId)
                  return (
                    <tr key={e.id}>
                      <td className="mono">{e.serial}</td>
                      <td className="bold">{e.modelo}</td>
                      <td className="mono">{chip ? chip.iccid : <span className="mut">— sem chip —</span>}</td>
                      <td>{chip ? <Badge tone="gray">{chip.operadora}</Badge> : <span className="mut">—</span>}</td>
                      <td>{clientName(e.clientId)}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td className="right nowrap">
                        <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                          {chip ? (
                            <Btn size="sm" icon={<Link2Off size={13} />} onClick={() => desvincular(e)}>Desvincular</Btn>
                          ) : (
                            e.status !== 'manutencao' && <Btn size="sm" variant="primary" icon={<Link2 size={13} />} onClick={() => setVinculo({ kind: 'equip', item: e })}>Vincular</Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {((tab !== 'vinculos' && !filtered.length) || (tab === 'vinculos' && !vinculosList.length)) && (
            <EmptyState
              icon={isChips ? <Smartphone size={40} /> : <Boxes size={40} />}
              title={`Nenhum ${isChips ? 'chip' : 'equipamento'} encontrado`}
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
        <div className="form-row">
          <Field label="Valor (R$)">
            <input type="number" step="0.01" value={chipForm.valor} onChange={(e) => setChip({ valor: e.target.value })} />
          </Field>
          <Field label="Data de cadastro">
            <input type="date" value={chipForm.data} onChange={(e) => setChip({ data: e.target.value })} />
          </Field>
        </div>
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
        <Field label="Data de cadastro">
          <input type="date" value={equipForm.data} onChange={(e) => setEquip({ data: e.target.value })} />
        </Field>
        {!equipForm.id && <div className="mut" style={{ fontSize: 12.5, marginTop: 4 }}>O equipamento entra no estoque com status <b>Disponível</b>.</div>}
      </Modal>

      {/* ---- Modal: cancelar chip ---- */}
      <Modal
        open={!!cancelForm}
        onClose={() => setCancelForm(null)}
        title="Cancelar chip"
        icon={<Ban size={20} color="var(--red)" />}
        footer={<><Btn onClick={() => setCancelForm(null)}>Fechar</Btn><Btn variant="danger" onClick={confirmarCancelamento}>Confirmar cancelamento</Btn></>}
      >
        {cancelForm && (
          <>
            <div className="soft" style={{ marginBottom: 12 }}>
              Cancelando o chip <b className="mono">{cancelForm.chip.iccid}</b> ({cancelForm.chip.operadora}). Esta ação libera o equipamento vinculado, se houver.
            </div>
            <div className="form-row">
              <Field label="Data do cancelamento">
                <input type="date" value={cancelForm.dataCancelamento} onChange={(e) => setCancelForm((f) => ({ ...f, dataCancelamento: e.target.value }))} />
              </Field>
              <Field label="Nº de protocolo" required>
                <input value={cancelForm.protocolo} onChange={(e) => setCancelForm((f) => ({ ...f, protocolo: e.target.value }))} placeholder="Protocolo da operadora" />
              </Field>
            </div>
          </>
        )}
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
