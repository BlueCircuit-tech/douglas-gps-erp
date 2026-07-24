import { supabase } from '../lib/supabase.js'

const toSnake = (s) => s.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase())
const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

export const rowToApp = (row) => {
  if (!row) return row
  const out = {}
  for (const k of Object.keys(row)) out[toCamel(k)] = row[k]
  return out
}

const DATE_FIELDS = {
  clients: ['contratoInicio', 'criadoEm', 'dataAtivacao', 'dataCancelamento'],
  fornecedores: ['criadoEm'],
  equipamentos: ['data'],
  chips: ['data', 'dataCancelamento'],
  contatos: ['aniversario'],
  historico_vendas: ['data'],
  conversas: ['data'],
  contas_receber: ['vencimento', 'pagoEm'],
  contas_pagar: ['vencimento', 'pagoEm'],
  despesas: ['data'],
  boletos: ['vencimento', 'pagoEm'],
  comissoes: ['data'],
  ordens: ['abertaEm', 'concluidaEm'],
  contratos: ['criadoEm', 'assinadoEm'],
  documentos: ['data'],
  notas_fiscais: ['emitidaEm'],
  interacoes: ['data'],
  notificacoes: ['data'],
}

const appToRow = (obj, table) => {
  const dates = DATE_FIELDS[table] || []
  const out = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v === undefined) continue
    // datas vazias -> null
    if (dates.includes(k) && (v === '' || v == null)) { out[toSnake(k)] = null; continue }
    // FKs vazias (socioId, vendedorId, planoId, ...) -> null (evita violar FK)
    if (k.endsWith('Id') && v === '') { out[toSnake(k)] = null; continue }
    out[toSnake(k)] = v
  }
  return out
}

export const cache = {}
export const setCache = (name, arr) => { cache[name] = arr }
export const byId = (coll, id) => (cache[coll] || []).find((x) => x.id === id)
export const userName = (id) => byId('users', id)?.name || '—'
export const clientName = (id) => {
  const c = byId('clients', id)
  return c ? (c.nomeFantasia || c.razaoSocial) : '—'
}

export function resource(table, coll) {
  return {
    table,
    async list({ order, filter } = {}) {
      let q = supabase.from(table).select('*')
      if (filter) for (const [col, val] of Object.entries(filter)) q = q.eq(toSnake(col), val)
      if (order) q = q.order(toSnake(order.column), { ascending: order.ascending ?? true })
      const { data, error } = await q
      if (error) throw error
      const mapped = (data || []).map(rowToApp)
      if (coll) setCache(coll, mapped)
      return mapped
    },
    async insert(obj) {
      const { data, error } = await supabase.from(table).insert(appToRow(obj, table)).select().single()
      if (error) throw error
      return rowToApp(data)
    },
    async insertMany(rows) {
      if (!rows?.length) return []
      const { data, error } = await supabase.from(table).insert(rows.map((r) => appToRow(r, table))).select()
      if (error) throw error
      return (data || []).map(rowToApp)
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(appToRow(patch, table)).eq('id', id).select().single()
      if (error) throw error
      return rowToApp(data)
    },
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const COLLECTION_TABLE = {
  users: 'users', planos: 'planos', produtos: 'produtos',
  clients: 'clients', fornecedores: 'fornecedores', vehicles: 'vehicles',
  chips: 'chips', equipamentos: 'equipamentos', ordens: 'ordens',
  contasReceber: 'contas_receber', contasPagar: 'contas_pagar', despesas: 'despesas',
  boletos: 'boletos', comissoes: 'comissoes', contratos: 'contratos',
  documentos: 'documentos', notasFiscais: 'notas_fiscais', interacoes: 'interacoes',
  notificacoes: 'notificacoes', auditLogs: 'audit_logs',
}

export const api = Object.fromEntries(
  Object.entries(COLLECTION_TABLE).map(([coll, table]) => [coll, resource(table, coll)]),
)

// ============================================================
// Mapeadores relacionais — clients / fornecedores (contatos,
// endereço, histórico, conversas em tabelas separadas).
// ============================================================
const emptyEndereco = () => ({ cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' })

// Agrupa filhos por owner_id.
const groupBy = (rows, key) => {
  const m = {}
  for (const r of rows) (m[r[key]] || (m[r[key]] = [])).push(r)
  return m
}

async function fetchPessoas(table, coll, ownerType) {
  const [{ data: base, error: e1 }, { data: ends }, { data: cts }] = await Promise.all([
    supabase.from(table).select('*'),
    supabase.from('enderecos').select('*').eq('owner_type', ownerType),
    supabase.from('contatos').select('*').eq('owner_type', ownerType).order('ordem', { ascending: true }),
  ])
  if (e1) throw e1
  const endByOwner = {}
  for (const e of ends || []) endByOwner[e.owner_id] = e
  const ctByOwner = groupBy(cts || [], 'owner_id')

  let histByClient = {}
  let convByClient = {}
  if (coll === 'clients') {
    const [{ data: hist }, { data: conv }] = await Promise.all([
      supabase.from('historico_vendas').select('*'),
      supabase.from('conversas').select('*'),
    ])
    histByClient = groupBy(hist || [], 'client_id')
    convByClient = groupBy(conv || [], 'client_id')
  }

  const mapContato = (r) => ({ id: r.id, nome: r.nome, cpf: r.cpf, rg: r.rg, aniversario: r.aniversario, whatsapp: r.whatsapp, email: r.email })
  const list = (base || []).map((row) => {
    const o = rowToApp(row)
    const e = endByOwner[row.id]
    o.endereco = e ? { cep: e.cep, logradouro: e.logradouro, numero: e.numero, bairro: e.bairro, cidade: e.cidade, uf: e.uf } : emptyEndereco()
    o.contatos = (ctByOwner[row.id] || []).map(mapContato)
    if (coll === 'clients') {
      o.historicoVendas = (histByClient[row.id] || []).map((h) => ({ id: h.id, tipo: h.tipo, data: h.data, quantidade: h.quantidade, valorUnit: h.valor_unit, valorMensal: h.valor_mensal, prazoMeses: h.prazo_meses, descricao: h.descricao }))
      o.conversas = (convByClient[row.id] || []).map((c) => ({ id: c.id, autor: c.autor_id, data: c.data, texto: c.texto }))
    }
    return o
  })
  setCache(coll, list)
  return list
}

// Separa os campos "planos" (colunas) dos aninhados.
const stripNested = (obj) => {
  const { endereco, contatos, historicoVendas, conversas, ...flat } = obj
  return { flat, endereco, contatos, historicoVendas, conversas }
}

async function saveEndereco(ownerType, ownerId, endereco) {
  if (!endereco) return
  const row = { owner_type: ownerType, owner_id: ownerId, ...endereco }
  await supabase.from('enderecos').upsert(row, { onConflict: 'owner_type,owner_id' })
}

async function replaceContatos(ownerType, ownerId, contatos) {
  await supabase.from('contatos').delete().eq('owner_type', ownerType).eq('owner_id', ownerId)
  if (contatos?.length) {
    const rows = contatos.map((c, i) => ({
      owner_type: ownerType, owner_id: ownerId, ordem: i,
      nome: c.nome || '', cpf: c.cpf || '', rg: c.rg || '',
      aniversario: c.aniversario || null, whatsapp: c.whatsapp || '', email: c.email || '',
    }))
    await supabase.from('contatos').insert(rows)
  }
}

function pessoaApi(table, coll, ownerType) {
  return {
    async list() { return fetchPessoas(table, coll, ownerType) },
    async insert(obj) {
      const { flat, endereco, contatos, historicoVendas, conversas } = stripNested(obj)
      const { data, error } = await supabase.from(table).insert(appToRow(flat, table)).select().single()
      if (error) throw error
      const id = data.id
      await Promise.all([
        saveEndereco(ownerType, id, endereco),
        replaceContatos(ownerType, id, contatos),
      ])
      if (coll === 'clients' && historicoVendas?.length) {
        await supabase.from('historico_vendas').insert(historicoVendas.map((h) => ({
          client_id: id, tipo: h.tipo, data: h.data || null, quantidade: h.quantidade,
          valor_unit: h.valorUnit, valor_mensal: h.valorMensal, prazo_meses: h.prazoMeses, descricao: h.descricao,
        })))
      }
      return { ...rowToApp(data), endereco: endereco || emptyEndereco(), contatos: contatos || [], historicoVendas: historicoVendas || [], conversas: conversas || [] }
    },
    async update(id, patch) {
      const { flat, endereco, contatos, historicoVendas, conversas } = stripNested(patch)
      if (Object.keys(flat).length) {
        const { error } = await supabase.from(table).update(appToRow(flat, table)).eq('id', id)
        if (error) throw error
      }
      if (endereco) await saveEndereco(ownerType, id, endereco)
      if (contatos) await replaceContatos(ownerType, id, contatos)
      if (coll === 'clients' && historicoVendas) {
        await supabase.from('historico_vendas').delete().eq('client_id', id)
        if (historicoVendas.length) {
          await supabase.from('historico_vendas').insert(historicoVendas.map((h) => ({
            client_id: id, tipo: h.tipo, data: h.data || null, quantidade: h.quantidade,
            valor_unit: h.valorUnit, valor_mensal: h.valorMensal, prazo_meses: h.prazoMeses, descricao: h.descricao,
          })))
        }
      }
      if (coll === 'clients' && conversas) {
        await supabase.from('conversas').delete().eq('client_id', id)
        if (conversas.length) {
          await supabase.from('conversas').insert(conversas.map((c) => ({
            client_id: id, autor_id: c.autor || null, data: c.data || null, texto: c.texto,
          })))
        }
      }
    },
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const clientsApi = pessoaApi('clients', 'clients', 'client')
export const fornecedoresApi = pessoaApi('fornecedores', 'fornecedores', 'fornecedor')

export const ordensApi = {
  async list() {
    const [{ data: base, error }, { data: items }] = await Promise.all([
      supabase.from('ordens').select('*').order('numero', { ascending: false }),
      supabase.from('ordem_checklist').select('*').order('ordem', { ascending: true }),
    ])
    if (error) throw error
    const byOrdem = groupBy(items || [], 'ordem_id')
    const list = (base || []).map((row) => {
      const o = rowToApp(row)
      o.checklist = (byOrdem[row.id] || []).map((k) => ({ id: k.id, label: k.label, done: k.done }))
      return o
    })
    setCache('ordens', list)
    return list
  },
  async insert(obj) {
    const { checklist, ...flat } = obj
    const { data, error } = await supabase.from('ordens').insert(appToRow(flat, 'ordens')).select().single()
    if (error) throw error
    if (checklist?.length) {
      await supabase.from('ordem_checklist').insert(checklist.map((k, i) => ({ ordem_id: data.id, label: k.label, done: !!k.done, ordem: i })))
    }
    return { ...rowToApp(data), checklist: checklist || [] }
  },
  async update(id, patch) {
    const { checklist, ...flat } = patch
    if (Object.keys(flat).length) {
      const { error } = await supabase.from('ordens').update(appToRow(flat, 'ordens')).eq('id', id)
      if (error) throw error
    }
    if (checklist) {
      await supabase.from('ordem_checklist').delete().eq('ordem_id', id)
      if (checklist.length) {
        await supabase.from('ordem_checklist').insert(checklist.map((k, i) => ({ ordem_id: id, label: k.label, done: !!k.done, ordem: i })))
      }
    }
  },
  async remove(id) {
    const { error } = await supabase.from('ordens').delete().eq('id', id)
    if (error) throw error
  },
}

// Recorrência financeira no Supabase (gera/reajusta parcelas).
// Devolve o evento de histórico (venda/cancelamento) ou null.
import { gerarParcelas, mensalidadeTotal, primeiroDiaProximoMes, eventoHistorico } from '../lib/recorrencia.js'

export async function syncRecorrencia(prev, next) {
  const total = mensalidadeTotal(next)
  if (!next.ativo || !next.prazoMeses || total <= 0) return null

  const corte = primeiroDiaProximoMes()
  const { data: futuras, error } = await supabase.from('contas_receber').select('*')
    .eq('recorrente_de', next.id).eq('categoria', 'mensalidade').neq('status', 'pago').gte('vencimento', corte)
  if (error) throw error

  const prevQtd = Number(prev?.quantidadeEquipamentos) || 0
  const nextQtd = Number(next.quantidadeEquipamentos) || 0
  const eraAtivo = !!prev?.ativo
  const temParcelas = (futuras || []).length > 0

  if (!eraAtivo || !temParcelas) {
    await api.contasReceber.insertMany(gerarParcelas(next, { offset: 1 }))
    return eventoHistorico('venda', {
      quantidade: nextQtd, valorUnit: next.valorMensal, prazoMeses: next.prazoMeses,
      descricao: `Contrato ativado — ${nextQtd} equipamento(s), ${next.prazoMeses} meses`,
    })
  }

  // Já ativo → reajusta as parcelas futuras.
  await Promise.all((futuras || []).map((f) =>
    supabase.from('contas_receber').update({ valor: total, quantidade: nextQtd, valor_unit: Number(next.valorMensal) || 0 }).eq('id', f.id),
  ))

  if (nextQtd !== prevQtd) {
    const delta = Math.abs(nextQtd - prevQtd)
    const tipo = nextQtd > prevQtd ? 'venda' : 'cancelamento'
    return eventoHistorico(tipo, {
      quantidade: delta, valorUnit: next.valorMensal, prazoMeses: next.prazoMeses,
      descricao: `${tipo === 'venda' ? 'Adição' : 'Cancelamento'} de ${delta} equipamento(s) — ajuste a partir do próximo mês`,
    })
  }
  if (Number(prev.valorMensal) !== Number(next.valorMensal)) {
    return eventoHistorico('venda', {
      quantidade: nextQtd, valorUnit: next.valorMensal, prazoMeses: next.prazoMeses,
      descricao: `Reajuste de valor por equipamento`,
    })
  }
  return null
}

export async function logAudit(userId, acao, entidade, detalhe) {
  const { error } = await supabase.from('audit_logs').insert({ user_id: userId, acao, entidade, detalhe })
  if (error) console.warn('[audit] falha ao registrar:', error.message)
}
