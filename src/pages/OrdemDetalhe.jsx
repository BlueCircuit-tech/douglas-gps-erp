import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Check, MapPin, Route, AlertTriangle, Camera, CheckCircle2, Navigation, User, Wrench,
} from 'lucide-react'
import { api, ordensApi, clientName, userName, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { fmtDate, BRL, uid } from '../lib/format.js'
import { PageHead, Card, CardHead, Btn, Field, Modal, Progress, useToast, StatusBadge } from '../components/ui.jsx'
import { OS_TIPOS } from './OrdensServico.jsx'

// Tipo da OS → serviço da comissão + campo de valor cadastrado para o técnico (Equipe).
const SERVICO_DA_OS = {
  instalacao: { tipoServico: 'instalacao', campo: 'valorInstalacao' },
  manutencao: { tipoServico: 'manutencao', campo: 'valorManutencao' },
  retirada: { tipoServico: 'desinstalacao', campo: 'valorDesinstalacao' },
}
const placaDoVeiculo = (v) => (String(v || '').toUpperCase().match(/[A-Z]{3}-?\d[A-Z0-9]\d{2}/) || [''])[0].replace('-', '')

export default function OrdemDetalhe() {
  const { id } = useParams()
  const { db, loading, refetch } = useCollections(['ordens', 'users', 'clients'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const os = (db.ordens || []).find((o) => o.id === id)
  const [kmModal, setKmModal] = useState(false)
  const [km, setKm] = useState('')
  const [rotaTracada, setRotaTracada] = useState(false)

  if (!os) {
    return (
      <PageHead title={loading ? 'Carregando...' : 'OS não encontrada'}>
        <Btn onClick={() => navigate('/os')}>Voltar</Btn>
      </PageHead>
    )
  }

  const T = OS_TIPOS[os.tipo]
  const tecnico = (db.users || []).find((u) => u.id === os.tecnicoId)
  const done = (os.checklist || []).filter((c) => c.done).length
  const total = (os.checklist || []).length
  const pct = total ? Math.round((done / total) * 100) : 0

  const toggle = async (kid) => {
    const checklist = os.checklist.map((c) => (c.id === kid ? { ...c, done: !c.done } : c))
    try {
      await ordensApi.update(os.id, { checklist })
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  const tracarRota = () => {
    // Em produção: integração com API de mapas (Tarefa 30). Aqui simulamos.
    const estimado = 8 + Math.round(((os.numero || 1000) % 7) * 3.5)
    setKm(String(estimado))
    setRotaTracada(true)
    toast(`Rota estimada: ${estimado} km`)
  }

  const concluir = async () => {
    if (done < total) { toast('Conclua todos os itens do checklist', 'error'); return }
    const kmFinal = Number(km) || os.km || 0
    const valorKm = tecnico?.valorKm || 1.2
    try {
      await ordensApi.update(os.id, { status: 'concluida', concluidaEm: new Date().toISOString().slice(0, 10), km: kmFinal })
      // Comissão do técnico: valor do serviço + KM rodados (Tarefa 33).
      const S = SERVICO_DA_OS[os.tipo] || SERVICO_DA_OS.instalacao
      await api.comissoes.insert({
        id: uid('co'), tipo: 'tecnico', pessoaId: os.tecnicoId, clientId: os.clientId,
        tipoServico: S.tipoServico, valorServico: Number(tecnico?.[S.campo]) || 0,
        placa: placaDoVeiculo(os.veiculo), equipamentoId: os.equipamentoId || null,
        km: kmFinal, valorKm, kmManual: !rotaTracada, pedagio: 0, extras: 0,
        data: new Date().toISOString().slice(0, 10), status: 'pendente',
      })
      logAudit(user.id, 'concluir', 'OS', `OS #${os.numero} concluída (${kmFinal} km)`)
      toast('OS concluída e comissão gerada')
      setKmModal(false)
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title={`OS #${os.numero} · ${T.label}`} subtitle={clientName(os.clientId)}>
        <Btn icon={<ArrowLeft size={16} />} onClick={() => navigate('/os')}>Voltar</Btn>
        {os.status !== 'concluida' && (
          <Btn variant="green" icon={<CheckCircle2 size={16} />} onClick={() => { setKm(os.km ? String(os.km) : ''); setKmModal(true) }}>Concluir OS</Btn>
        )}
      </PageHead>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="col gap-16">
          <Card>
            <CardHead title="Checklist do técnico" sub={`${done}/${total} concluídos`} icon={<Wrench size={18} />}>
              <StatusBadge status={os.status} />
            </CardHead>
            <div className="card-pad">
              <Progress value={pct} />
              <div style={{ marginTop: 14 }}>
                {(os.checklist || []).map((c) => (
                  <div key={c.id} className={`checklist-item ${c.done ? 'done' : ''}`} onClick={() => os.status !== 'concluida' && toggle(c.id)}>
                    <div className="check-box">{c.done && <Check size={14} />}</div>
                    <span className="ci-text">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Fotos do serviço" sub="Registro fotográfico" icon={<Camera size={18} />} />
            <div className="card-pad">
              <div className="upload-zone"><Camera size={28} /><div style={{ marginTop: 8 }}>Toque para adicionar fotos da instalação/manutenção</div></div>
            </div>
          </Card>
        </div>

        <div className="col gap-16">
          <Card>
            <CardHead title="Dados da OS" icon={<User size={18} />} />
            <div className="card-pad col gap-12">
              <Row label="Tipo"><span className="badge b-blue"><T.icon size={12} /> {T.label}</span></Row>
              <Row label="Cliente">{clientName(os.clientId)}</Row>
              <Row label="Técnico">{userName(os.tecnicoId)}</Row>
              <Row label="Veículo">{os.veiculo || '—'}</Row>
              <Row label="Abertura">{fmtDate(os.abertaEm)}</Row>
              {os.concluidaEm && <Row label="Conclusão">{fmtDate(os.concluidaEm)}</Row>}
              {os.km != null && <Row label="KM percorrido">{os.km} km</Row>}
            </div>
          </Card>

          <Card>
            <CardHead title="Rota e deslocamento" sub="Técnico → cliente (Tarefa 30)" icon={<Route size={18} />} />
            <div className="card-pad col gap-8">
              <div className="flex gap-8"><Navigation size={15} className="mut" /><div><div className="mut" style={{ fontSize: 12 }}>Saída do técnico</div><div>{os.enderecoTecnico || '—'}</div></div></div>
              <div className="flex gap-8"><MapPin size={15} color="var(--brand)" /><div><div className="mut" style={{ fontSize: 12 }}>Endereço do cliente</div><div>{os.endereco || '—'}</div></div></div>
              <Btn className="mt-8" icon={<Route size={15} />} onClick={tracarRota}>Traçar rota e estimar KM</Btn>
            </div>
          </Card>

          {os.observacoes && (
            <Card>
              <CardHead title="Observações" />
              <div className="card-pad soft">{os.observacoes}</div>
            </Card>
          )}
        </div>
      </div>

      <Modal open={kmModal} onClose={() => setKmModal(false)} title="Concluir OS — KM percorrido" icon={<CheckCircle2 size={20} color="var(--green)" />}
        footer={<><Btn onClick={() => setKmModal(false)}>Cancelar</Btn><Btn variant="green" onClick={concluir}>Confirmar conclusão</Btn></>}>
        <p className="soft">Informe o KM percorrido para calcular a comissão do técnico. Tente traçar a rota automaticamente; se não for possível, digite manualmente.</p>
        <Btn className="btn-block mt-8" icon={<Route size={15} />} onClick={tracarRota}>Traçar rota automaticamente</Btn>
        <Field label="KM percorrido" hint={rotaTracada ? 'Estimado pela rota.' : 'Digitado manualmente — sujeito a conferência.'}>
          <input type="number" value={km} onChange={(e) => { setKm(e.target.value); setRotaTracada(false) }} placeholder="Ex: 18" />
        </Field>
        {!rotaTracada && km && (
          <div className="card card-pad" style={{ background: 'var(--amber-bg)', borderColor: '#fde68a', display: 'flex', gap: 10 }}>
            <AlertTriangle size={18} color="var(--amber)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}><b>KM manual</b> — sem rota traçada. Será marcado para conferência, pois o valor depende do informado pelo técnico (Tarefa 33).</div>
          </div>
        )}
        <div className="divider" />
        <Row label="Comissão estimada"><b className="mono">{BRL((Number(km) || 0) * (tecnico?.valorKm || 1.2))}</b></Row>
      </Modal>
    </>
  )
}

function Row({ label, children }) {
  return (
    <div className="between">
      <span className="mut" style={{ fontSize: 13 }}>{label}</span>
      <span className="bold" style={{ fontSize: 13.5 }}>{children}</span>
    </div>
  )
}
