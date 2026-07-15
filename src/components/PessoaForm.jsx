import { MapPin, Users2, Plus, Trash2 } from 'lucide-react'
import { Field, Segmented, Btn } from './ui.jsx'
import { uid } from '../lib/format.js'

const PRAZOS = [12, 24, 36, 48]

export const novoContato = () => ({ id: uid('cti'), nome: '', cpf: '', rg: '', aniversario: '', whatsapp: '', email: '' })

// Formulário vazio. kind: 'cliente' | 'fornecedor'
export const emptyPessoa = (kind = 'cliente') => ({
  tipo: 'PJ', status: kind === 'cliente' ? 'lead' : 'ativo', ativo: kind !== 'cliente',
  razaoSocial: '', nomeFantasia: '', cpfCnpj: '', ie: '',
  email: '', whatsapp: '', telefoneFixo: '', emailFinanceiro: '', whatsappFinanceiro: '', site: '',
  endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' },
  contatos: [],
  observacoes: '',
  ...(kind === 'cliente'
    ? {
        stage: 'novo', planoId: 'p_basico', vendedorId: '',
        valorMensal: 79.9, valorInstalacao: 150, quantidadeEquipamentos: 1, prazoMeses: 12,
        historicoVendas: [], conversas: [],
      }
    : { categoria: 'Equipamentos', prazoPagamento: 30 }),
})

// Normaliza um registro existente para edição no formulário.
export const fromPessoa = (c, kind = 'cliente') => ({
  tipo: c.tipo || 'PJ', status: c.status || (kind === 'cliente' ? 'lead' : 'ativo'), ativo: !!c.ativo,
  razaoSocial: c.razaoSocial || '', nomeFantasia: c.nomeFantasia || '',
  cpfCnpj: c.cpfCnpj || '', ie: c.ie || '',
  email: c.email || '', whatsapp: c.whatsapp || '',
  telefoneFixo: c.telefoneFixo || '', emailFinanceiro: c.emailFinanceiro || '',
  whatsappFinanceiro: c.whatsappFinanceiro || '', site: c.site || '',
  endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', ...(c.endereco || {}) },
  contatos: (c.contatos || []).map((ct) => ({ ...novoContato(), ...ct })),
  observacoes: c.observacoes || '',
  ...(kind === 'cliente'
    ? {
        planoId: c.planoId || '', vendedorId: c.vendedorId || '',
        valorMensal: c.valorMensal ?? 0, valorInstalacao: c.valorInstalacao ?? 0,
        quantidadeEquipamentos: c.quantidadeEquipamentos ?? 0, prazoMeses: c.prazoMeses ?? 12,
      }
    : { categoria: c.categoria || 'Equipamentos', prazoPagamento: c.prazoPagamento ?? 30 }),
})

export function PessoaForm({ kind = 'cliente', form, setForm, db }) {
  const isCliente = kind === 'cliente'
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setEnd = (patch) => setForm((f) => ({ ...f, endereco: { ...f.endereco, ...patch } }))

  const contatos = form.contatos || []
  const addContato = () => { if (contatos.length >= 3) return; set({ contatos: [...contatos, novoContato()] }) }
  const patchContato = (id, p) => set({ contatos: contatos.map((c) => (c.id === id ? { ...c, ...p } : c)) })
  const rmContato = (id) => set({ contatos: contatos.filter((c) => c.id !== id) })

  const onPlano = (planoId) => {
    const p = (db.planos || []).find((x) => x.id === planoId)
    set({ planoId, valorMensal: p?.valorMensal ?? form.valorMensal, valorInstalacao: p?.valorInstalacao ?? form.valorInstalacao })
  }
  const vendedores = (db.users || []).filter((u) => u.role === 'vendedor')
  const total = (Number(form.valorMensal) || 0) * (Number(form.quantidadeEquipamentos) || 0)

  return (
    <>
      <Field label="Tipo de pessoa">
        <Segmented value={form.tipo} onChange={(v) => set({ tipo: v })} options={[
          { value: 'PJ', label: 'Pessoa Jurídica (PJ)' }, { value: 'PF', label: 'Pessoa Física (PF)' },
        ]} />
      </Field>
      <div className="form-row">
        <Field label={form.tipo === 'PJ' ? 'Razão social' : 'Nome completo'} required>
          <input value={form.razaoSocial} onChange={(e) => set({ razaoSocial: e.target.value })} />
        </Field>
        <Field label={form.tipo === 'PJ' ? 'Nome fantasia' : 'Apelido'}>
          <input value={form.nomeFantasia} onChange={(e) => set({ nomeFantasia: e.target.value })} />
        </Field>
      </div>
      <div className="form-row">
        <Field label={form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}>
          <input value={form.cpfCnpj} onChange={(e) => set({ cpfCnpj: e.target.value })} placeholder="Somente números" />
        </Field>
        <Field label="Inscrição estadual">
          <input value={form.ie} onChange={(e) => set({ ie: e.target.value })} />
        </Field>
      </div>

      {/* Contatos principais + financeiros */}
      <div className="divider" />
      <div className="bold soft" style={{ marginBottom: 10 }}>Contato e dados financeiros</div>
      <div className="form-row">
        <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="WhatsApp"><input value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="(11) 90000-0000" /></Field>
      </div>
      <div className="form-row-3">
        <Field label="Telefone fixo (com DDD)"><input value={form.telefoneFixo} onChange={(e) => set({ telefoneFixo: e.target.value })} placeholder="(11) 3000-0000" /></Field>
        <Field label="E-mail financeiro"><input type="email" value={form.emailFinanceiro} onChange={(e) => set({ emailFinanceiro: e.target.value })} /></Field>
        <Field label="WhatsApp financeiro"><input value={form.whatsappFinanceiro} onChange={(e) => set({ whatsappFinanceiro: e.target.value })} /></Field>
      </div>
      <Field label="Site da empresa"><input value={form.site} onChange={(e) => set({ site: e.target.value })} placeholder="www.empresa.com.br" /></Field>

      {/* Endereço */}
      <div className="divider" />
      <div className="bold soft" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={15} /> Endereço</div>
      <div className="form-row-3">
        <Field label="CEP"><input value={form.endereco.cep} onChange={(e) => setEnd({ cep: e.target.value })} /></Field>
        <Field label="Logradouro"><input value={form.endereco.logradouro} onChange={(e) => setEnd({ logradouro: e.target.value })} /></Field>
        <Field label="Número"><input value={form.endereco.numero} onChange={(e) => setEnd({ numero: e.target.value })} /></Field>
      </div>
      <div className="form-row-3">
        <Field label="Bairro"><input value={form.endereco.bairro} onChange={(e) => setEnd({ bairro: e.target.value })} /></Field>
        <Field label="Cidade"><input value={form.endereco.cidade} onChange={(e) => setEnd({ cidade: e.target.value })} /></Field>
        <Field label="UF"><input maxLength={2} value={form.endereco.uf} onChange={(e) => setEnd({ uf: e.target.value.toUpperCase() })} /></Field>
      </div>

      {/* Contatos (até 3) */}
      <div className="divider" />
      <div className="flex between" style={{ marginBottom: 10, alignItems: 'center' }}>
        <div className="bold soft flex gap-6" style={{ alignItems: 'center' }}><Users2 size={15} /> Contatos ({contatos.length}/3)</div>
        <Btn size="sm" icon={<Plus size={14} />} onClick={addContato} disabled={contatos.length >= 3}>Adicionar contato</Btn>
      </div>
      {contatos.length === 0 && <div className="mut" style={{ fontSize: 12.5, marginBottom: 8 }}>Nenhum contato cadastrado. Adicione até 3 contatos (Nome, CPF, RG, Aniversário, WhatsApp e e-mail).</div>}
      {contatos.map((ct, i) => (
        <div key={ct.id} className="card" style={{ padding: 12, marginBottom: 10, background: 'var(--surface-2)' }}>
          <div className="flex between" style={{ alignItems: 'center', marginBottom: 8 }}>
            <span className="bold" style={{ fontSize: 13 }}>Contato {i + 1}</span>
            <Btn size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => rmContato(ct.id)}>Remover</Btn>
          </div>
          <div className="form-row-3">
            <Field label="Nome"><input value={ct.nome} onChange={(e) => patchContato(ct.id, { nome: e.target.value })} /></Field>
            <Field label="CPF"><input value={ct.cpf} onChange={(e) => patchContato(ct.id, { cpf: e.target.value })} placeholder="Somente números" /></Field>
            <Field label="RG"><input value={ct.rg} onChange={(e) => patchContato(ct.id, { rg: e.target.value })} /></Field>
          </div>
          <div className="form-row-3">
            <Field label="Data de aniversário"><input type="date" value={ct.aniversario} onChange={(e) => patchContato(ct.id, { aniversario: e.target.value })} /></Field>
            <Field label="WhatsApp"><input value={ct.whatsapp} onChange={(e) => patchContato(ct.id, { whatsapp: e.target.value })} /></Field>
            <Field label="E-mail"><input type="email" value={ct.email} onChange={(e) => patchContato(ct.id, { email: e.target.value })} /></Field>
          </div>
        </div>
      ))}

      {isCliente ? (
        <>
          {/* Plano de contratação */}
          <div className="divider" />
          <div className="bold soft" style={{ marginBottom: 10 }}>Plano de contratação</div>
          <div className="form-row">
            <Field label="Plano">
              <select value={form.planoId} onChange={(e) => onPlano(e.target.value)}>
                <option value="">Selecione</option>
                {(db.planos || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Field>
            <Field label="Vendedor responsável">
              <select value={form.vendedorId} onChange={(e) => set({ vendedorId: e.target.value })}>
                <option value="">Selecione</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row-3">
            <Field label="Valor mensal por equipamento (R$)" hint="Valor negociado por equipamento">
              <input type="number" step="0.01" value={form.valorMensal} onChange={(e) => set({ valorMensal: +e.target.value })} />
            </Field>
            <Field label="Quantidade de equipamentos" required>
              <input type="number" step="1" min="0" value={form.quantidadeEquipamentos} onChange={(e) => set({ quantidadeEquipamentos: +e.target.value })} />
            </Field>
            <Field label="Prazo do contrato (meses)" hint="Gera a recorrência no financeiro">
              <select value={form.prazoMeses} onChange={(e) => set({ prazoMeses: +e.target.value })}>
                {PRAZOS.map((p) => <option key={p} value={p}>{p} meses</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Valor de instalação (R$)"><input type="number" step="0.01" value={form.valorInstalacao} onChange={(e) => set({ valorInstalacao: +e.target.value })} /></Field>
            <Field label="Mensalidade total (calculada)">
              <input value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)} disabled />
            </Field>
          </div>
        </>
      ) : (
        <>
          {/* Condições do fornecedor */}
          <div className="divider" />
          <div className="bold soft" style={{ marginBottom: 10 }}>Condições de fornecimento</div>
          <div className="form-row">
            <Field label="Categoria de fornecimento">
              <select value={form.categoria} onChange={(e) => set({ categoria: e.target.value })}>
                {['Equipamentos', 'Chips / Telecom', 'Insumos / Instalação', 'Serviços', 'Outros'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Prazo de pagamento (dias)">
              <input type="number" step="1" min="0" value={form.prazoPagamento} onChange={(e) => set({ prazoPagamento: +e.target.value })} />
            </Field>
          </div>
        </>
      )}

      {/* Situação (ativo/inativo) */}
      <div className="divider" />
      <div className="form-row">
        <Field label="Situação do cadastro">
          <Segmented value={form.ativo ? 'ativo' : 'inativo'} onChange={(v) => set({ ativo: v === 'ativo', status: v === 'ativo' ? 'ativo' : (isCliente && form.status === 'lead' ? 'lead' : 'inativo') })} options={[
            { value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' },
          ]} />
        </Field>
      </div>
      <Field label="Observações">
        <textarea value={form.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Anotações gerais." />
      </Field>
    </>
  )
}
