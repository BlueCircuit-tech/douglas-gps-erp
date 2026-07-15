// ============================================================
// RECORRÊNCIA FINANCEIRA
// Regra de negócio:
//  - A mensalidade do cliente = valor por equipamento × quantidade de equipamentos.
//    O valor é negociado (aberto) e a quantidade também.
//  - O contrato tem um prazo (12, 24, 36 ou 48 meses) e é RECORRENTE: cada mês
//    do prazo vira uma parcela em "Contas a Receber".
//  - Ao adicionar/cancelar equipamentos, muda o valor/quantidade/mensalidade das
//    parcelas do PRÓXIMO mês em diante (o mês corrente e as pagas não mudam).
// ============================================================
import { uid } from './format.js'

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const p2 = (x) => String(x).padStart(2, '0')

// Mensalidade total = valor unitário × quantidade de equipamentos.
export const mensalidadeTotal = (c) =>
  (Number(c?.valorMensal) || 0) * (Number(c?.quantidadeEquipamentos) || 0)

// Soma meses a um par (ano, mês 0-based) e devolve {y, m} com m 0-based.
const addMonths = (year, month0, add) => {
  const total = month0 + add
  const y = year + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12
  return { y, m }
}

// Primeiro dia do mês seguinte ao de referência (YYYY-MM-01) — usado como corte.
export function primeiroDiaProximoMes(ref = new Date()) {
  const { y, m } = addMonths(ref.getFullYear(), ref.getMonth(), 1)
  return `${y}-${p2(m + 1)}-01`
}

// Gera as parcelas de mensalidade recorrente de um cliente.
//  offset 0 → começa no mês corrente; offset 1 → começa no próximo mês.
export function gerarParcelas(client, { diaVenc = 10, offset = 0, ref = new Date() } = {}) {
  const total = mensalidadeTotal(client)
  const prazo = Number(client.prazoMeses) || 0
  if (!prazo || total <= 0) return []
  const y0 = ref.getFullYear()
  const m0 = ref.getMonth()
  const parcelas = []
  for (let k = 0; k < prazo; k++) {
    const { y, m } = addMonths(y0, m0, k + offset)
    parcelas.push({
      id: uid('cr'),
      clientId: client.id,
      descricao: `Mensalidade ${MESES[m]}/${y} — parcela ${k + 1}/${prazo}`,
      categoria: 'mensalidade',
      valor: total,
      quantidade: Number(client.quantidadeEquipamentos) || 0,
      valorUnit: Number(client.valorMensal) || 0,
      parcela: k + 1,
      totalParcelas: prazo,
      recorrenteDe: client.id,
      vencimento: `${y}-${p2(m + 1)}-${p2(diaVenc)}`,
      status: 'aberto',
    })
  }
  return parcelas
}

// Cria um evento de histórico de venda/cancelamento para o cliente.
export function eventoHistorico(tipo, { quantidade, valorUnit, prazoMeses, descricao, data }) {
  const qtd = Number(quantidade) || 0
  const unit = Number(valorUnit) || 0
  return {
    id: uid('hv'),
    tipo, // 'venda' | 'cancelamento'
    data: data || new Date().toISOString().slice(0, 10),
    quantidade: qtd,
    valorUnit: unit,
    valorMensal: unit * qtd,
    prazoMeses: prazoMeses ? Number(prazoMeses) : null,
    descricao: descricao || '',
  }
}
