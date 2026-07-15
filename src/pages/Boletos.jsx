import { useState, useMemo } from 'react'
import {
  Receipt, Plus, Copy, Eye, Check, AlertTriangle, Wallet, Coins, FileText, ShieldCheck,
} from 'lucide-react'
import { api, clientName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL, fmtDate, todayISO } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Stat, Btn, Badge, Field, EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'

// Beneficiário fixo (mock — emissor dos boletos).
const BENEFICIARIO = 'GPS RASTREAMENTO'

// Gera uma linha digitável fake no formato de boleto bancário.
const genLinha = () => {
  const r = (n) => String(Math.floor(Math.random() * Math.pow(10, n))).padStart(n, '0')
  return `23793.${r(5)} ${r(5)}.${r(6)} ${r(5)}.${r(6)} ${r(1)} ${r(14)}`
}
// "Nosso número" curto (6 dígitos).
const genNosso = () => String(Math.floor(100000 + Math.random() * 900000))

// Converte a linha digitável em barras (simula o código de barras).
const barras = (linha) => {
  const digits = String(linha || '').replace(/\D/g, '')
  return digits.split('').map((d, i) => ({ w: 1 + (Number(d) % 4), on: i % 2 === 0 }))
}

const emptyForm = () => ({ clientId: '', valor: '', vencimento: todayISO() })

export default function Boletos() {
  const { db, refetch } = useCollections(['boletos', 'clients'])
  const { user } = useAuth()
  const toast = useToast()

  const [filtro, setFiltro] = useState('todos')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [ver, setVer] = useState(null) // boleto selecionado para prévia

  const boletos = db.boletos || []

  const k = useMemo(() => {
    const emitidos = boletos.length
    const pendentes = boletos.filter((b) => b.status === 'pendente').length
    const vencidos = boletos.filter((b) => b.status === 'vencido').length
    const recebido = boletos.filter((b) => b.status === 'pago').reduce((s, b) => s + (b.valor || 0), 0)
    return { emitidos, pendentes, vencidos, recebido }
  }, [boletos])

  const lista = useMemo(() => {
    return boletos.filter((b) => filtro === 'todos' || b.status === filtro)
  }, [boletos, filtro])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const emitir = async () => {
    if (!form.clientId) { toast('Selecione o cliente', 'error'); return }
    const valor = Number(form.valor)
    if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); return }
    if (!form.vencimento) { toast('Informe o vencimento', 'error'); return }
    const novo = {
      clientId: form.clientId,
      valor,
      vencimento: form.vencimento,
      status: 'pendente',
      gateway: 'asaas',
      linhaDigitavel: genLinha(),
      nossoNumero: genNosso(),
    }
    try {
      await api.boletos.insert(novo)
      logAudit(user.id, 'emitir', 'boleto', `Boleto ${BRL(valor)} para ${clientName(form.clientId)}`)
      toast('Boleto emitido (simulação Asaas)')
      setOpen(false)
      setForm(emptyForm())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const marcarPago = async (b) => {
    try {
      await api.boletos.update(b.id, { status: 'pago', pagoEm: todayISO() })
      logAudit(user.id, 'baixar', 'boleto', `Boleto ${b.nossoNumero} de ${clientName(b.clientId)} marcado como pago`)
      toast('Boleto baixado como pago')
      if (ver && ver.id === b.id) setVer({ ...b, status: 'pago', pagoEm: todayISO() })
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const copiar = async (linha) => {
    try {
      await navigator.clipboard.writeText(linha)
      toast('Linha digitável copiada')
    } catch (e) {
      toast('Não foi possível copiar', 'error')
    }
  }

  return (
    <>
      <PageHead title="Boletos" subtitle="Emissão e cobrança via gateway Asaas">
        <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setForm(emptyForm()); setOpen(true) }}>
          Emitir Boleto
        </Btn>
      </PageHead>

      {/* Banner de integração Asaas (Tarefa 28) */}
      <Card pad style={{ marginBottom: 16, borderLeft: '4px solid var(--amber)' }}>
        <div className="between wrap gap-12">
          <div className="flex gap-12" style={{ alignItems: 'flex-start' }}>
            <div className="stat-ico" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="bold" style={{ fontSize: 15 }}>Integração com Asaas</div>
              <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>
                Assim que a chave de API for configurada, o boleto é emitido automaticamente no Asaas
                (linha digitável e código de barras reais, baixa automática na compensação).
              </div>
            </div>
          </div>
          <Badge tone="amber" dot>Aguardando credenciais do Douglas</Badge>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-4">
        <Stat tone="blue" icon={<Receipt size={19} />} label="Boletos emitidos" value={k.emitidos} />
        <Stat tone="amber" icon={<Wallet size={19} />} label="Pendentes" value={k.pendentes} />
        <Stat tone="red" icon={<AlertTriangle size={19} />} label="Vencidos" value={k.vencidos} />
        <Stat tone="green" icon={<Coins size={19} />} label="Total recebido" value={BRL(k.recebido)} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="card-head">
          <CardHead title="Cobranças" sub={`${lista.length} boleto(s)`} icon={<Receipt size={18} />} />
          <div className="spacer" />
          <Segmented value={filtro} onChange={setFiltro} options={[
            { value: 'todos', label: 'Todos' },
            { value: 'pendente', label: 'Pendentes' },
            { value: 'pago', label: 'Pagos' },
            { value: 'vencido', label: 'Vencidos' },
          ]} />
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th><th>Nosso número</th><th>Valor</th><th>Vencimento</th><th>Gateway</th><th>Status</th><th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.id}>
                  <td className="bold">{clientName(b.clientId)}</td>
                  <td className="mono mut">{b.nossoNumero}</td>
                  <td className="mono bold">{BRL(b.valor)}</td>
                  <td>{fmtDate(b.vencimento)}</td>
                  <td><Badge tone="purple">Asaas</Badge></td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="right">
                    <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                      <Btn size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setVer(b)}>Ver</Btn>
                      <Btn size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => copiar(b.linhaDigitavel)}>Copiar</Btn>
                      {b.status !== 'pago' && (
                        <Btn size="sm" variant="green" icon={<Check size={14} />} onClick={() => marcarPago(b)}>Marcar pago</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lista.length && (
            <EmptyState icon={<Receipt size={40} />} title="Nenhum boleto encontrado" sub="Ajuste o filtro ou emita um novo boleto." />
          )}
        </div>
      </Card>

      {/* Modal: emitir boleto */}
      <Modal open={open} onClose={() => setOpen(false)} title="Emitir Boleto" icon={<Receipt size={20} color="var(--brand)" />}
        footer={<><Btn onClick={() => setOpen(false)}>Cancelar</Btn><Btn variant="primary" icon={<Plus size={16} />} onClick={emitir}>Emitir boleto</Btn></>}>
        <Field label="Cliente / pagador" required>
          <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
            <option value="">Selecione o cliente</option>
            {(db.clients || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Valor (R$)" required>
            <input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => set({ valor: e.target.value })} placeholder="0,00" />
          </Field>
          <Field label="Vencimento" required>
            <input type="date" value={form.vencimento} onChange={(e) => set({ vencimento: e.target.value })} />
          </Field>
        </div>
        <div className="mut" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} /> Gateway: Asaas · linha digitável e nosso número serão gerados na emissão.
        </div>
      </Modal>

      {/* Modal: prévia do boleto */}
      <Modal open={!!ver} onClose={() => setVer(null)} size="lg" title="Prévia do boleto" icon={<FileText size={20} color="var(--brand)" />}
        footer={ver && (
          <>
            <Btn icon={<Copy size={16} />} onClick={() => copiar(ver.linhaDigitavel)}>Copiar linha digitável</Btn>
            {ver.status !== 'pago' && (
              <Btn variant="green" icon={<Check size={16} />} onClick={() => marcarPago(ver)}>Marcar pago</Btn>
            )}
          </>
        )}>
        {ver && (
          <div className="col gap-16">
            <div className="between">
              <div>
                <div className="bold" style={{ fontSize: 16 }}>{BENEFICIARIO}</div>
                <div className="mut" style={{ fontSize: 12 }}>Beneficiário · Gateway Asaas</div>
              </div>
              <StatusBadge status={ver.status} />
            </div>

            <div className="divider" />

            <div className="grid grid-2">
              <div>
                <div className="mut" style={{ fontSize: 12 }}>Pagador</div>
                <div className="bold">{clientName(ver.clientId)}</div>
              </div>
              <div>
                <div className="mut" style={{ fontSize: 12 }}>Nosso número</div>
                <div className="bold mono">{ver.nossoNumero}</div>
              </div>
              <div>
                <div className="mut" style={{ fontSize: 12 }}>Valor do documento</div>
                <div className="bold mono" style={{ fontSize: 18 }}>{BRL(ver.valor)}</div>
              </div>
              <div>
                <div className="mut" style={{ fontSize: 12 }}>Vencimento</div>
                <div className="bold">{fmtDate(ver.vencimento)}</div>
              </div>
            </div>

            <div className="divider" />

            <div>
              <div className="mut" style={{ fontSize: 12, marginBottom: 6 }}>Linha digitável</div>
              <div className="mono bold" style={{ fontSize: 14, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, wordBreak: 'break-all' }}>
                {ver.linhaDigitavel}
              </div>
            </div>

            {/* Código de barras simulado */}
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 1, height: 60, padding: '0 2px', background: '#fff', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              {barras(ver.linhaDigitavel).map((b, i) => (
                <div key={i} style={{ width: b.w, background: b.on ? '#0f172a' : 'transparent' }} />
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
