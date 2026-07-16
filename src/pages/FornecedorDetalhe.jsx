import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Cake, MapPin, Phone, Globe, User, Users2, FileText, Truck,
} from 'lucide-react'
import { fornecedoresApi, logAudit } from '../data/api.js'
import { useCollections } from '../hooks/useSupabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { fmtDate, maskDoc, maskPhone, fone } from '../lib/format.js'
import {
  PageHead, Card, CardHead, Btn, Badge, Avatar, EmptyState, Modal, Segmented, useToast, StatusBadge,
} from '../components/ui.jsx'
import { PessoaForm, fromPessoa } from '../components/PessoaForm.jsx'

const fmtEndereco = (e) => {
  if (!e) return '—'
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const linha2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ')
  return [linha1, linha2].filter(Boolean).join(' · ') || '—'
}

export default function FornecedorDetalhe() {
  const { id } = useParams()
  const { db, loading, refetch } = useCollections(['fornecedores'])
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const forn = (db.fornecedores || []).find((f) => f.id === id)
  const [tab, setTab] = useState('geral')
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(() => (forn ? fromPessoa(forn, 'fornecedor') : null))

  if (!forn) {
    return (
      <PageHead title={loading ? 'Carregando...' : 'Fornecedor não encontrado'} subtitle={loading ? 'Buscando no Supabase.' : 'O fornecedor solicitado não existe ou foi removido.'}>
        <Btn icon={<ArrowLeft size={16} />} onClick={() => navigate('/fornecedores')}>Voltar</Btn>
      </PageHead>
    )
  }

  const nome = forn.nomeFantasia || forn.razaoSocial
  const contatos = forn.contatos || []

  const abrirEdicao = () => { setForm(fromPessoa(forn, 'fornecedor')); setEditOpen(true) }
  const salvarEdicao = async () => {
    if (!form.razaoSocial.trim()) { toast('Informe o nome / razão social', 'error'); return }
    setSaving(true)
    try {
      await fornecedoresApi.update(forn.id, { ...form })
      logAudit(user.id, 'editar', 'fornecedor', `Editou ${form.nomeFantasia || form.razaoSocial}`)
      toast('Fornecedor atualizado com sucesso')
      setEditOpen(false)
      refetch()
    } catch (e) {
      toast('Erro: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHead title={nome} subtitle={`${forn.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'} · ${maskDoc(forn.cpfCnpj)}`}>
        <Btn icon={<ArrowLeft size={16} />} onClick={() => navigate('/fornecedores')}>Voltar</Btn>
        <Btn variant="primary" icon={<Pencil size={16} />} onClick={abrirEdicao}>Editar</Btn>
      </PageHead>

      <Card pad>
        <div className="flex gap-16 wrap" style={{ alignItems: 'center' }}>
          <Avatar name={nome} />
          <div>
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <span className="bold" style={{ fontSize: 18 }}>{nome}</span>
              <StatusBadge status={forn.ativo ? 'ativo' : 'inativo'} />
              <Badge tone={forn.tipo === 'PJ' ? 'blue' : 'purple'}>{forn.tipo}</Badge>
            </div>
            <div className="mut" style={{ fontSize: 13, marginTop: 2 }}>
              {forn.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'geral', label: 'Visão geral' },
          { value: 'contatos', label: `Contatos (${contatos.length})` },
        ]} />
      </div>

      {tab === 'geral' && (
        <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: 16 }}>
          <div className="col gap-16">
            <Card>
              <CardHead title="Dados cadastrais" icon={<User size={18} />} />
              <div className="card-pad col gap-12">
                <Row label={forn.tipo === 'PJ' ? 'Razão social' : 'Nome completo'}>{forn.razaoSocial || '—'}</Row>
                <Row label={forn.tipo === 'PJ' ? 'Nome fantasia' : 'Apelido'}>{forn.nomeFantasia || '—'}</Row>
                <Row label={forn.tipo === 'PJ' ? 'CNPJ' : 'CPF'}>{maskDoc(forn.cpfCnpj)}</Row>
                <Row label={forn.tipo === 'PJ' ? 'Inscrição estadual' : 'RG'}>{(forn.tipo === 'PJ' ? forn.ie : forn.rg) || '—'}</Row>
                <Row label="Celular / WhatsApp"><span className="flex gap-6"><Phone size={13} className="mut" />{fone(forn.celularDdd, forn.celularNum) || '—'}</span></Row>
                <Row label="Telefone fixo"><span className="flex gap-6"><Phone size={13} className="mut" />{fone(forn.telefoneFixoDdd, forn.telefoneFixoNum) || '—'}</span></Row>
                <Row label="Site"><span className="flex gap-6"><Globe size={13} className="mut" />{forn.site || '—'}</span></Row>
                <Row label="Endereço"><span className="flex gap-6" style={{ textAlign: 'right' }}><MapPin size={13} className="mut" />{fmtEndereco(forn.endereco)}</span></Row>
              </div>
            </Card>
            {forn.observacoes && (
              <Card>
                <CardHead title="Observações" icon={<FileText size={18} />} />
                <div className="card-pad soft">{forn.observacoes}</div>
              </Card>
            )}
          </div>
          <div className="col gap-16">
            <Card>
              <CardHead title="Situação" icon={<Truck size={18} />} />
              <div className="card-pad col gap-12">
                <Row label="Tipo">{forn.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</Row>
                <Row label="Situação"><StatusBadge status={forn.ativo ? 'ativo' : 'inativo'} /></Row>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'contatos' && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Contatos do fornecedor" sub={`${contatos.length} de 3`} icon={<Users2 size={18} />} />
          <div className="card-pad">
            {contatos.length ? (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {contatos.map((ct) => (
                  <Card key={ct.id} pad>
                    <div className="flex gap-10" style={{ alignItems: 'center', marginBottom: 8 }}>
                      <Avatar name={ct.nome} sm />
                      <div className="bold">{ct.nome || '—'}</div>
                    </div>
                    <div className="col gap-8">
                      <Row label="CPF">{maskDoc(ct.cpf) || '—'}</Row>
                      <Row label="RG">{ct.rg || '—'}</Row>
                      <Row label="Aniversário"><span className="flex gap-6"><Cake size={13} className="mut" />{fmtDate(ct.aniversario)}</span></Row>
                      <Row label="WhatsApp">{maskPhone(ct.whatsapp) || '—'}</Row>
                      <Row label="E-mail">{ct.email || '—'}</Row>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Users2 size={40} />} title="Nenhum contato cadastrado" sub="Edite o fornecedor para adicionar até 3 contatos." />
            )}
          </div>
        </Card>
      )}

      {form && (
        <Modal open={editOpen} onClose={() => setEditOpen(false)} size="lg" title="Editar fornecedor" icon={<Pencil size={20} color="var(--brand)" />}
          footer={<><Btn onClick={() => setEditOpen(false)}>Cancelar</Btn><Btn variant="primary" onClick={salvarEdicao} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Btn></>}>
          <PessoaForm kind="fornecedor" form={form} setForm={setForm} db={db} />
        </Modal>
      )}
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
