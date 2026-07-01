import { useState, useMemo } from 'react'
import { Smartphone, Package, Plus, AlertTriangle, CheckCircle2, Layers, Boxes, Search, Ban } from 'lucide-react'
import { useStore, actions, clientName } from '../data/store.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, maskPhone, fmtDate, uid, todayISO } from '../lib/format.js'
import {
  PageHead, Card, Btn, Badge, Stat, Field, EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

const OPERADORAS = ['Vivo', 'Claro', 'TIM', 'Arqia']

const emptyChip = () => ({ iccid: '', linha: '', operadora: 'Vivo', valor: 25 })
const emptyEquip = () => ({ modelo: '', serial: '', tipo: 'Rastreador', valor: 220 })
const emptyCancel = () => ({ dataCancelamento: todayISO(), protocolo: '' })

const STATUS_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponivel', label: 'Disponíveis' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'defeituoso', label: 'Defeituosos' },
  { value: 'cancelado', label: 'Cancelados' },
]

const count = (arr, status) => arr.filter((x) => x.status === status).length

export default function Estoque() {
  const db = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('chips')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [q, setQ] = useState('')

  const [chipOpen, setChipOpen] = useState(false)
  const [chipForm, setChipForm] = useState(emptyChip)

  const [equipOpen, setEquipOpen] = useState(false)
  const [equipForm, setEquipForm] = useState(emptyEquip)

  const [cancelTarget, setCancelTarget] = useState(null) // chip a cancelar
  const [cancelForm, setCancelForm] = useState(emptyCancel)

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

  // ---------- Ações ----------
  const marcarDefeituoso = (coll, item) => {
    actions.patch(coll, item.id, { status: 'defeituoso' })
    const ent = coll === 'chips' ? 'chip' : 'equipamento'
    actions.log(user.id, 'editar', ent, `Marcado defeituoso: ${item.iccid || item.serial}`)
    toast('Item marcado como defeituoso')
  }

  const abrirCancelChip = (chip) => {
    setCancelForm(emptyCancel())
    setCancelTarget(chip)
  }

  const confirmarCancelChip = () => {
    if (!cancelForm.protocolo.trim()) { toast('Informe o nº do protocolo', 'error'); return }
    if (!cancelForm.dataCancelamento) { toast('Informe a data do cancelamento', 'error'); return }
    actions.patch('chips', cancelTarget.id, {
      status: 'cancelado',
      dataCancelamento: cancelForm.dataCancelamento,
      protocolo: cancelForm.protocolo.trim(),
      clientId: null,
    })
    actions.log(user.id, 'cancelar', 'chip', `Chip ${cancelTarget.iccid} cancelado · protocolo ${cancelForm.protocolo.trim()}`)
    toast('Chip cancelado com sucesso')
    setCancelTarget(null)
  }

  const cancelarEquip = (item) => {
    actions.patch('equipamentos', item.id, { status: 'cancelado', clientId: null })
    actions.log(user.id, 'cancelar', 'equipamento', `Equipamento ${item.serial} cancelado`)
    toast('Equipamento cancelado')
  }

  const salvarChip = () => {
    if (!chipForm.iccid.trim()) { toast('Informe o ICCID', 'error'); return }
    actions.add('chips', {
      id: uid('ch'),
      iccid: chipForm.iccid.trim(),
      linha: chipForm.linha.trim(),
      operadora: chipForm.operadora,
      valor: +chipForm.valor || 0,
      status: 'disponivel',
      clientId: null,
    })
    actions.log(user.id, 'criar', 'chip', `Novo chip ${chipForm.iccid.trim()} (${chipForm.operadora})`)
    toast('Chip adicionado ao estoque')
    setChipOpen(false)
    setChipForm(emptyChip())
  }

  const salvarEquip = () => {
    if (!equipForm.modelo.trim()) { toast('Informe o modelo', 'error'); return }
    if (!equipForm.serial.trim()) { toast('Informe o nº de série', 'error'); return }
    actions.add('equipamentos', {
      id: uid('eq'),
      modelo: equipForm.modelo.trim(),
      serial: equipForm.serial.trim(),
      tipo: equipForm.tipo.trim() || 'Rastreador',
      valor: +equipForm.valor || 0,
      status: 'disponivel',
      clientId: null,
    })
    actions.log(user.id, 'criar', 'equipamento', `Novo equipamento ${equipForm.serial.trim()} (${equipForm.modelo.trim()})`)
    toast('Equipamento adicionado ao estoque')
    setEquipOpen(false)
    setEquipForm(emptyEquip())
  }

  const setChip = (patch) => setChipForm((f) => ({ ...f, ...patch }))
  const setEquip = (patch) => setEquipForm((f) => ({ ...f, ...patch }))
  const setCancel = (patch) => setCancelForm((f) => ({ ...f, ...patch }))

  return (
    <>
      <PageHead title="Estoque" subtitle="Controle de chips e equipamentos: disponibilidade, uso, defeitos e cancelamentos.">
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
          { value: 'chips', label: 'Chips' },
          { value: 'equipamentos', label: 'Equipamentos' },
        ]} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat icon={<CheckCircle2 size={18} />} tone="green" label="Disponíveis" value={count(kpiList, 'disponivel')} />
        <Stat icon={<Layers size={18} />} tone="blue" label="Em uso" value={count(kpiList, 'em_uso')} />
        <Stat icon={<AlertTriangle size={18} />} tone="amber" label="Defeituosos" value={count(kpiList, 'defeituoso')} />
        <Stat icon={<Ban size={18} />} tone="red" label="Cancelados" value={count(kpiList, 'cancelado')} />
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
                  <th>Cliente</th><th>Status</th><th>Cancelamento</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.iccid}</td>
                    <td className="mono">{maskPhone(c.linha)}</td>
                    <td><Badge tone="gray">{c.operadora}</Badge></td>
                    <td className="right mono">{BRL(c.valor)}</td>
                    <td>{clientName(c.clientId)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      {c.status === 'cancelado' ? (
                        <div style={{ fontSize: 12.5 }}>
                          <div className="bold mono">{c.protocolo || '—'}</div>
                          <div className="mut">{fmtDate(c.dataCancelamento)}</div>
                        </div>
                      ) : <span className="mut">—</span>}
                    </td>
                    <td className="right nowrap">
                      <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                        {c.status !== 'defeituoso' && c.status !== 'cancelado' && (
                          <Btn size="sm" icon={<AlertTriangle size={13} />} onClick={() => marcarDefeituoso('chips', c)}>Defeituoso</Btn>
                        )}
                        {c.status !== 'cancelado' && (
                          <Btn size="sm" variant="danger" icon={<Ban size={13} />} onClick={() => abrirCancelChip(c)}>Cancelar</Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Modelo</th><th>Nº de série</th><th>Tipo</th><th className="right">Valor</th>
                  <th>Cliente</th><th>Status</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="bold">{e.modelo}</td>
                    <td className="mono">{e.serial}</td>
                    <td><Badge tone="blue">{e.tipo}</Badge></td>
                    <td className="right mono">{BRL(e.valor)}</td>
                    <td>{clientName(e.clientId)}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="right nowrap">
                      <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                        {e.status !== 'defeituoso' && e.status !== 'cancelado' && (
                          <Btn size="sm" icon={<AlertTriangle size={13} />} onClick={() => marcarDefeituoso('equipamentos', e)}>Defeituoso</Btn>
                        )}
                        {e.status !== 'cancelado' && (
                          <Btn size="sm" variant="danger" icon={<Ban size={13} />} onClick={() => cancelarEquip(e)}>Cancelar</Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* ---- Modal: adicionar chip ---- */}
      <Modal
        open={chipOpen}
        onClose={() => setChipOpen(false)}
        title="Adicionar chip ao estoque"
        icon={<Smartphone size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setChipOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarChip}>Salvar chip</Btn></>}
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
        <div className="mut" style={{ fontSize: 12.5, marginTop: 4 }}>O chip entra no estoque com status <b>Disponível</b>.</div>
      </Modal>

      {/* ---- Modal: adicionar equipamento ---- */}
      <Modal
        open={equipOpen}
        onClose={() => setEquipOpen(false)}
        title="Adicionar equipamento ao estoque"
        icon={<Package size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setEquipOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarEquip}>Salvar equipamento</Btn></>}
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
        <div className="mut" style={{ fontSize: 12.5, marginTop: 4 }}>O equipamento entra no estoque com status <b>Disponível</b>.</div>
      </Modal>

      {/* ---- Modal: cancelar chip (Tarefa 39) ---- */}
      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancelar chip"
        icon={<Ban size={20} color="var(--red)" />}
        footer={<><Btn onClick={() => setCancelTarget(null)}>Voltar</Btn><Btn variant="danger" onClick={confirmarCancelChip}>Confirmar cancelamento</Btn></>}
      >
        {cancelTarget && (
          <>
            <div className="soft" style={{ marginBottom: 12 }}>
              Cancelando o chip <b className="mono">{cancelTarget.iccid}</b>
              {' '}({cancelTarget.operadora} · {maskPhone(cancelTarget.linha)}).
            </div>
            <div className="form-row">
              <Field label="Data do cancelamento" required>
                <input type="date" value={cancelForm.dataCancelamento} onChange={(e) => setCancel({ dataCancelamento: e.target.value })} />
              </Field>
              <Field label="Nº do protocolo" required hint="Protocolo junto à operadora">
                <input value={cancelForm.protocolo} onChange={(e) => setCancel({ protocolo: e.target.value })} placeholder="PROT-2026-0042" />
              </Field>
            </div>
            <div className="flex gap-6 mut" style={{ fontSize: 12.5, alignItems: 'center' }}>
              <AlertTriangle size={14} /> O chip ficará com status <b>Cancelado</b> e será desvinculado do cliente.
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
