import { useState, useMemo } from 'react'
import {
  Layers, Plus, Trash2, Check, Coins, DollarSign, Wrench, ShieldCheck, Users,
} from 'lucide-react'
import { api, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { BRL } from '../lib/format.js'
import {
  PageHead, Card, Btn, Stat, Field, EmptyState, Modal, useToast,
} from '../components/ui.jsx'

const emptyForm = () => ({
  nome: '', descricao: '',
  valorMensal: 0, valorInstalacao: 0, valorMonitoramento: 0,
})

// ------- Card editável de um plano (estado local por plano) -------
function PlanoCard({ plano, onLog, onSaved }) {
  const toast = useToast()
  const [vals, setVals] = useState({
    valorMensal: plano.valorMensal ?? 0,
    valorInstalacao: plano.valorInstalacao ?? 0,
    valorMonitoramento: plano.valorMonitoramento ?? 0,
  })

  const dirty =
    Number(vals.valorMensal) !== Number(plano.valorMensal ?? 0) ||
    Number(vals.valorInstalacao) !== Number(plano.valorInstalacao ?? 0) ||
    Number(vals.valorMonitoramento) !== Number(plano.valorMonitoramento ?? 0)

  const set = (patch) => setVals((v) => ({ ...v, ...patch }))

  const salvar = async () => {
    const partial = {
      valorMensal: +vals.valorMensal || 0,
      valorInstalacao: +vals.valorInstalacao || 0,
      valorMonitoramento: +vals.valorMonitoramento || 0,
    }
    try {
      await api.planos.update(plano.id, partial)
      onLog(`Valores atualizados: ${plano.nome} (mensal ${BRL(partial.valorMensal)})`)
      toast('Valores do plano salvos com sucesso')
      onSaved()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const restaurar = () => set({
    valorMensal: plano.valorMensal ?? 0,
    valorInstalacao: plano.valorInstalacao ?? 0,
    valorMonitoramento: plano.valorMonitoramento ?? 0,
  })

  const excluir = async () => {
    if (!window.confirm(`Excluir o plano "${plano.nome}"?`)) return
    try {
      await api.planos.remove(plano.id)
      onLog(`Plano excluído: ${plano.nome}`)
      toast('Plano excluído')
      onSaved()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const total = (+vals.valorMensal || 0) + (+vals.valorMonitoramento || 0)

  return (
    <Card pad>
      <div className="card-head" style={{ paddingTop: 0 }}>
        <div className="stat-ico" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
          <Layers size={18} />
        </div>
        <div>
          <h3>{plano.nome}</h3>
          <div className="card-sub">{plano.descricao || 'Sem descrição'}</div>
        </div>
        <div className="spacer" />
        <Btn variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={excluir} title="Excluir plano">
          Excluir
        </Btn>
      </div>

      <div className="form-row-3 mt-8">
        <Field label="Valor mensal (rastreamento)" hint={`Atual: ${BRL(plano.valorMensal)}`}>
          <input
            type="number" step="0.01" min="0"
            value={vals.valorMensal}
            onChange={(e) => set({ valorMensal: e.target.value })}
          />
        </Field>
        <Field label="Valor instalação" hint={`Atual: ${BRL(plano.valorInstalacao)}`}>
          <input
            type="number" step="0.01" min="0"
            value={vals.valorInstalacao}
            onChange={(e) => set({ valorInstalacao: e.target.value })}
          />
        </Field>
        <Field label="Valor monitoramento" hint={`Atual: ${BRL(plano.valorMonitoramento)}`}>
          <input
            type="number" step="0.01" min="0"
            value={vals.valorMonitoramento}
            onChange={(e) => set({ valorMonitoramento: e.target.value })}
          />
        </Field>
      </div>

      <div className="divider" />

      <div className="between flex wrap gap-12">
        <div className="flex gap-16 wrap mut" style={{ fontSize: 12.5 }}>
          <span className="flex gap-6"><DollarSign size={14} /> Rastreamento <b className="mono soft">{BRL(vals.valorMensal)}</b>/mês</span>
          <span className="flex gap-6"><Wrench size={14} /> Instalação <b className="mono soft">{BRL(vals.valorInstalacao)}</b></span>
          <span className="flex gap-6"><ShieldCheck size={14} /> Monitoramento <b className="mono soft">{BRL(vals.valorMonitoramento)}</b>/mês</span>
        </div>
        <div className="right">
          <div className="mut" style={{ fontSize: 11 }}>Recorrência mensal</div>
          <div className="bold mono">{BRL(total)}</div>
        </div>
      </div>

      <div className="flex gap-8 mt-16">
        <Btn variant="primary" icon={<Check size={16} />} onClick={salvar} disabled={!dirty}>
          Salvar
        </Btn>
        <Btn variant="ghost" onClick={restaurar} disabled={!dirty}>
          Restaurar
        </Btn>
        {dirty && <span className="badge b-amber" style={{ alignSelf: 'center' }}>Alterações não salvas</span>}
      </div>
    </Card>
  )
}

export default function Planos() {
  const { db, refetch } = useCollections(['planos', 'clients'])
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const planos = db.planos || []

  const log = (detalhe) => logAudit(user.id, 'editar', 'plano', detalhe)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const kpis = useMemo(() => {
    const n = planos.length
    const mediaMensal = n ? planos.reduce((s, p) => s + (+p.valorMensal || 0), 0) / n : 0
    const comMonit = planos.filter((p) => (+p.valorMonitoramento || 0) > 0).length
    const assinantes = (db.clients || []).filter((c) => c.status === 'ativo').length
    return { n, mediaMensal, comMonit, assinantes }
  }, [planos, db.clients])

  const salvar = async () => {
    if (!form.nome.trim()) { toast('Informe o nome do plano', 'error'); return }
    const novo = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      valorMensal: +form.valorMensal || 0,
      valorInstalacao: +form.valorInstalacao || 0,
      valorMonitoramento: +form.valorMonitoramento || 0,
    }
    try {
      await api.planos.insert(novo)
      log(`Novo plano criado: ${novo.nome}`)
      toast('Plano criado com sucesso')
      setOpen(false)
      setForm(emptyForm())
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  return (
    <>
      <PageHead
        title="Planos de mensalidade"
        subtitle="Configure os valores de rastreamento, instalação e monitoramento de cada plano"
      >
        <Btn variant="primary" icon={<Plus size={16} />} onClick={() => { setForm(emptyForm()); setOpen(true) }}>
          Novo plano
        </Btn>
      </PageHead>

      <div className="grid grid-4">
        <Stat icon={<Layers size={18} />} label="Planos cadastrados" value={kpis.n} tone="blue" />
        <Stat icon={<Coins size={18} />} label="Ticket médio mensal" value={BRL(kpis.mediaMensal)} tone="green" />
        <Stat icon={<ShieldCheck size={18} />} label="Com monitoramento" value={kpis.comMonit} tone="purple" />
        <Stat icon={<Users size={18} />} label="Clientes ativos" value={kpis.assinantes} tone="amber" />
      </div>

      {planos.length ? (
        <div className="grid grid-2 mt-16">
          {planos.map((p) => (
            <PlanoCard key={p.id} plano={p} onLog={log} onSaved={refetch} />
          ))}
        </div>
      ) : (
        <Card className="mt-16">
          <EmptyState
            icon={<Layers size={40} />}
            title="Nenhum plano cadastrado"
            sub="Crie um plano de mensalidade para começar."
          />
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo plano"
        icon={<Layers size={20} color="var(--brand)" />}
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={salvar}>Salvar plano</Btn>
          </>
        }
      >
        <Field label="Nome do plano" required>
          <input value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Rastreamento Premium" />
        </Field>
        <Field label="Descrição">
          <textarea value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="O que está incluso no plano" />
        </Field>
        <div className="divider" />
        <div className="bold soft" style={{ marginBottom: 10 }}>Valores do plano</div>
        <div className="form-row-3">
          <Field label="Valor mensal (rastreamento)">
            <input type="number" step="0.01" min="0" value={form.valorMensal} onChange={(e) => set({ valorMensal: e.target.value })} />
          </Field>
          <Field label="Valor instalação">
            <input type="number" step="0.01" min="0" value={form.valorInstalacao} onChange={(e) => set({ valorInstalacao: e.target.value })} />
          </Field>
          <Field label="Valor monitoramento">
            <input type="number" step="0.01" min="0" value={form.valorMonitoramento} onChange={(e) => set({ valorMonitoramento: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
