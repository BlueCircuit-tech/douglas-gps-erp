// ============================================================
// SEED — dados iniciais (mock) do ERP GPS RASTREAMENTO.
// Tudo deriva daqui; o store persiste no localStorage.
// Datas relativas a "hoje" são geradas em runtime (seed()).
// ============================================================
import { uid } from '../lib/format.js'

// Perfis de acesso (Tarefas 1, 14, 40, 41)
export const ROLES = {
  admin:         { label: 'Administrador',  color: 'b-purple' },
  vendedor:      { label: 'Vendedor',       color: 'b-blue' },
  tecnico:       { label: 'Técnico',        color: 'b-amber' },
  operacional:   { label: 'Operacional',    color: 'b-green' },
  contabilidade: { label: 'Contabilidade',  color: 'b-gray' },
  contador:      { label: 'Contador',       color: 'b-gray' },
}

// Estágios do funil de vendas (Kanban — Tarefa 6)
export const FUNNEL = [
  { id: 'novo',       label: 'Novo Lead',  color: '#64748b' },
  { id: 'contato',    label: 'Contato',    color: '#2563eb' },
  { id: 'proposta',   label: 'Proposta',   color: '#7c3aed' },
  { id: 'negociacao', label: 'Negociação', color: '#d97706' },
  { id: 'fechado',    label: 'Fechado',    color: '#16a34a' },
  { id: 'perdido',    label: 'Perdido',    color: '#dc2626' },
]

const dayOffset = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const isoNow = (minsAgo = 0) => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - minsAgo)
  return d.toISOString()
}

export function buildSeed() {
  // ---------- Usuários / equipe ----------
  const users = [
    { id: 'u_douglas', name: 'Douglas Ferreira', email: 'douglas@gpsrastreamento.com', role: 'admin', active: true },
    { id: 'u_ana',     name: 'Ana Souza',        email: 'ana@gpsrastreamento.com',     role: 'vendedor', active: true, comissaoFixa: 80 },
    { id: 'u_bruno',   name: 'Bruno Alves',      email: 'bruno@gpsrastreamento.com',   role: 'vendedor', active: true, comissaoFixa: 80 },
    { id: 'u_carlos',  name: 'Carlos Dias',      email: 'carlos@gpsrastreamento.com',  role: 'tecnico', active: true, valorKm: 1.20 },
    { id: 'u_marcos',  name: 'Marcos Lima',      email: 'marcos@gpsrastreamento.com',  role: 'tecnico', active: true, valorKm: 1.20 },
    { id: 'u_patricia',name: 'Patrícia Reis',    email: 'patricia@gpsrastreamento.com',role: 'operacional', active: true },
    { id: 'u_jose',    name: 'José Carlos',      email: 'jose@gpsrastreamento.com',    role: 'contabilidade', active: true },
    { id: 'u_helena',  name: 'Helena Costa',     email: 'contador@gpsrastreamento.com',role: 'contador', active: true },
  ]

  // ---------- Planos (Tarefas 23, 24) — valores alteráveis por input ----------
  const planos = [
    { id: 'p_basico',   nome: 'Rastreamento Básico',  valorMensal: 79.90,  valorInstalacao: 150, valorMonitoramento: 0,     descricao: 'Localização em tempo real, app mobile.' },
    { id: 'p_plus',     nome: 'Rastreamento Plus',    valorMensal: 99.90,  valorInstalacao: 150, valorMonitoramento: 0,     descricao: 'Básico + bloqueio remoto e cerca virtual.' },
    { id: 'p_monit',    nome: 'Monitoramento 24h',    valorMensal: 149.90, valorInstalacao: 200, valorMonitoramento: 49.90, descricao: 'Plus + central de monitoramento 24h.' },
    { id: 'p_frota',    nome: 'Gestão de Frota',      valorMensal: 119.90, valorInstalacao: 180, valorMonitoramento: 30,    descricao: 'Relatórios de frota, telemetria e roteirização.' },
  ]

  // ---------- Produtos e serviços (Tarefa 17) ----------
  const produtos = [
    { id: 'pr_rastreador', nome: 'Rastreador GPS GT06N', tipo: 'produto', valor: 220, descricao: 'Equipamento de rastreamento veicular.' },
    { id: 'pr_isca',       nome: 'Rastreador Isca (Backup)', tipo: 'produto', valor: 180, descricao: 'Rastreador secundário oculto.' },
    { id: 'pr_instalacao', nome: 'Instalação de rastreador', tipo: 'servico', valor: 150, descricao: 'Mão de obra de instalação.' },
    { id: 'pr_manutencao', nome: 'Manutenção / revisão',     tipo: 'servico', valor: 90,  descricao: 'Revisão e reparo de equipamento.' },
    { id: 'pr_remocao',    nome: 'Remoção de equipamento',   tipo: 'servico', valor: 70,  descricao: 'Retirada do rastreador.' },
    { id: 'pr_chip',       nome: 'Chip M2M',                 tipo: 'produto', valor: 25,  descricao: 'SIM card de dados M2M.' },
  ]

  // ---------- Clientes / Leads (Tarefas 7, 20, 22) ----------
  const mkAddr = (logradouro, numero, bairro, cidade, uf, cep) => ({ logradouro, numero, bairro, cidade, uf, cep })
  const clients = [
    {
      id: 'c_veloz', tipo: 'PJ', stage: 'fechado', status: 'ativo',
      razaoSocial: 'Transportadora Veloz Ltda', nomeFantasia: 'Transportadora Veloz',
      cpfCnpj: '12345678000190', ie: '110.042.490.114',
      email: 'contato@veloz.com.br', whatsapp: '11987654321', aniversario: '1998-03-12',
      endereco: mkAddr('Rua das Indústrias', '450', 'Distrito Industrial', 'São Paulo', 'SP', '04001000'),
      planoId: 'p_frota', vendedorId: 'u_ana', valorMensal: 119.90, valorInstalacao: 180, valorMonitoramento: 30,
      observacoes: 'Frota com 12 veículos. Contrato anual PJ.', criadoEm: dayOffset(-220),
    },
    {
      id: 'c_frota', tipo: 'PJ', stage: 'fechado', status: 'ativo',
      razaoSocial: 'Frota Brasil Logística S/A', nomeFantasia: 'Frota Brasil',
      cpfCnpj: '98765432000110', ie: '112.000.111.222',
      email: 'adm@frotabrasil.com.br', whatsapp: '11991234567', aniversario: '2005-07-01',
      endereco: mkAddr('Av. dos Transportes', '1200', 'Centro', 'Guarulhos', 'SP', '07010000'),
      planoId: 'p_monit', vendedorId: 'u_bruno', valorMensal: 149.90, valorInstalacao: 200, valorMonitoramento: 49.90,
      observacoes: 'Monitoramento 24h. Cliente fidelidade.', criadoEm: dayOffset(-180),
    },
    {
      id: 'c_andrade', tipo: 'PJ', stage: 'fechado', status: 'ativo',
      razaoSocial: 'Construtora Andrade Ltda', nomeFantasia: 'Construtora Andrade',
      cpfCnpj: '45678912000133', ie: '113.555.666.777',
      email: 'financeiro@andrade.com.br', whatsapp: '21988887777', aniversario: '2010-11-20',
      endereco: mkAddr('Rua Projetada', '88', 'Barra', 'Rio de Janeiro', 'RJ', '22640100'),
      planoId: 'p_plus', vendedorId: 'u_ana', valorMensal: 99.90, valorInstalacao: 150, valorMonitoramento: 0,
      observacoes: '', criadoEm: dayOffset(-95),
    },
    {
      id: 'c_joao', tipo: 'PF', stage: 'fechado', status: 'ativo',
      razaoSocial: 'João da Silva', nomeFantasia: '',
      cpfCnpj: '12345678909', ie: '',
      email: 'joao.silva@email.com', whatsapp: '11999990000', aniversario: '1985-06-30',
      endereco: mkAddr('Rua das Flores', '15', 'Jardim', 'Osasco', 'SP', '06010000'),
      planoId: 'p_basico', vendedorId: 'u_bruno', valorMensal: 79.90, valorInstalacao: 150, valorMonitoramento: 0,
      observacoes: 'Veículo particular.', criadoEm: dayOffset(-60),
    },
    {
      id: 'c_maria', tipo: 'PF', stage: 'negociacao', status: 'lead',
      razaoSocial: 'Maria Oliveira', nomeFantasia: '',
      cpfCnpj: '98765432100', ie: '',
      email: 'maria.o@email.com', whatsapp: '11988880000', aniversario: '1990-09-15',
      endereco: mkAddr('Av. Brasil', '900', 'Centro', 'Porto Alegre', 'RS', '90010000'),
      planoId: 'p_plus', vendedorId: 'u_ana', valorMensal: 99.90, valorInstalacao: 150, valorMonitoramento: 0,
      observacoes: 'Pediu proposta para 2 veículos.', criadoEm: dayOffset(-12),
    },
    {
      id: 'c_sul', tipo: 'PJ', stage: 'proposta', status: 'lead',
      razaoSocial: 'Distribuidora Sul S/A', nomeFantasia: 'Distribuidora Sul',
      cpfCnpj: '33222111000144', ie: '114.999.000.111',
      email: 'compras@distsul.com.br', whatsapp: '51997776666', aniversario: '2001-02-08',
      endereco: mkAddr('Rod. BR-116', 'km 12', 'Industrial', 'Porto Alegre', 'RS', '90200000'),
      planoId: 'p_frota', vendedorId: 'u_bruno', valorMensal: 119.90, valorInstalacao: 180, valorMonitoramento: 30,
      observacoes: 'Avaliando 8 veículos.', criadoEm: dayOffset(-8),
    },
    {
      id: 'c_expressa', tipo: 'PJ', stage: 'contato', status: 'lead',
      razaoSocial: 'Expressa Cargas Ltda', nomeFantasia: 'Expressa Cargas',
      cpfCnpj: '22111000000155', ie: '',
      email: 'contato@expressacargas.com', whatsapp: '85994443333', aniversario: '2015-05-22',
      endereco: mkAddr('Av. Leste', '300', 'Centro', 'Fortaleza', 'CE', '60010000'),
      planoId: 'p_basico', vendedorId: 'u_ana', valorMensal: 79.90, valorInstalacao: 150, valorMonitoramento: 0,
      observacoes: '', criadoEm: dayOffset(-4),
    },
    {
      id: 'c_loja', tipo: 'PF', stage: 'novo', status: 'lead',
      razaoSocial: 'José Carlos (Loja do Zé)', nomeFantasia: 'Loja do Zé',
      cpfCnpj: '11122233344', ie: '',
      email: 'ze@lojadoze.com', whatsapp: '11955554444', aniversario: '1978-12-03',
      endereco: mkAddr('Rua do Comércio', '77', 'Centro', 'São Paulo', 'SP', '01010000'),
      planoId: 'p_basico', vendedorId: 'u_bruno', valorMensal: 79.90, valorInstalacao: 150, valorMonitoramento: 0,
      observacoes: 'Entrou pelo site.', criadoEm: dayOffset(-1),
    },
  ]

  // ---------- Veículos / rastreadores por cliente ----------
  const vehicles = [
    { id: uid('v'), clientId: 'c_veloz', placa: 'ABC1D23', modelo: 'Scania R450', chipId: 'ch_1', status: 'online' },
    { id: uid('v'), clientId: 'c_veloz', placa: 'DEF4G56', modelo: 'Volvo FH', chipId: 'ch_2', status: 'online' },
    { id: uid('v'), clientId: 'c_frota', placa: 'GHI7J89', modelo: 'Mercedes Actros', chipId: 'ch_3', status: 'offline' },
    { id: uid('v'), clientId: 'c_andrade', placa: 'JKL0M12', modelo: 'Fiat Toro', chipId: 'ch_4', status: 'online' },
    { id: uid('v'), clientId: 'c_joao', placa: 'MNO3P45', modelo: 'Honda Civic', chipId: 'ch_5', status: 'online' },
  ]

  // ---------- Estoque de chips (Tarefas 5, 39) ----------
  const operadoras = ['Vivo', 'Claro', 'TIM', 'Arqia']
  const chips = [
    { id: 'ch_1', iccid: '8955010012345678901', linha: '11988880001', operadora: 'Vivo', valor: 25, status: 'em_uso', clientId: 'c_veloz' },
    { id: 'ch_2', iccid: '8955010012345678902', linha: '11988880002', operadora: 'Claro', valor: 25, status: 'em_uso', clientId: 'c_veloz' },
    { id: 'ch_3', iccid: '8955010012345678903', linha: '11988880003', operadora: 'TIM', valor: 22, status: 'em_uso', clientId: 'c_frota' },
    { id: 'ch_4', iccid: '8955010012345678904', linha: '11988880004', operadora: 'Vivo', valor: 25, status: 'em_uso', clientId: 'c_andrade' },
    { id: 'ch_5', iccid: '8955010012345678905', linha: '11988880005', operadora: 'Arqia', valor: 28, status: 'em_uso', clientId: 'c_joao' },
    { id: 'ch_6', iccid: '8955010012345678906', linha: '11988880006', operadora: 'Vivo', valor: 25, status: 'disponivel', clientId: null },
    { id: 'ch_7', iccid: '8955010012345678907', linha: '11988880007', operadora: 'Claro', valor: 25, status: 'disponivel', clientId: null },
    { id: 'ch_8', iccid: '8955010012345678908', linha: '11988880008', operadora: 'TIM', valor: 22, status: 'disponivel', clientId: null },
    { id: 'ch_9', iccid: '8955010012345678909', linha: '11988880009', operadora: 'Vivo', valor: 25, status: 'defeituoso', clientId: null },
    { id: 'ch_10', iccid: '8955010012345678910', linha: '11988880010', operadora: 'Claro', valor: 25, status: 'cancelado', clientId: null, dataCancelamento: dayOffset(-15), protocolo: 'PROT-2026-0042' },
  ]

  // ---------- Estoque de equipamentos (Tarefa 45) ----------
  const equipamentos = [
    { id: uid('eq'), modelo: 'GT06N', serial: 'GT06N-000101', tipo: 'Rastreador', valor: 220, status: 'em_uso', clientId: 'c_veloz' },
    { id: uid('eq'), modelo: 'GT06N', serial: 'GT06N-000102', tipo: 'Rastreador', valor: 220, status: 'em_uso', clientId: 'c_frota' },
    { id: uid('eq'), modelo: 'JM-VL01', serial: 'VL01-000201', tipo: 'Rastreador', valor: 240, status: 'em_uso', clientId: 'c_andrade' },
    { id: uid('eq'), modelo: 'GT06N', serial: 'GT06N-000103', tipo: 'Rastreador', valor: 220, status: 'disponivel', clientId: null },
    { id: uid('eq'), modelo: 'GT06N', serial: 'GT06N-000104', tipo: 'Rastreador', valor: 220, status: 'disponivel', clientId: null },
    { id: uid('eq'), modelo: 'Isca TK', serial: 'TK-000301', tipo: 'Isca', valor: 180, status: 'disponivel', clientId: null },
    { id: uid('eq'), modelo: 'GT06N', serial: 'GT06N-000105', tipo: 'Rastreador', valor: 220, status: 'defeituoso', clientId: null },
  ]

  // ---------- Ordens de Serviço (Tarefas 2, 26, 27, 30, 32, 33) ----------
  const checklistInstalacao = (done) => [
    { id: 'k1', label: 'Verificar equipamento e acessórios', done: done >= 1 },
    { id: 'k2', label: 'Instalar rastreador no veículo', done: done >= 2 },
    { id: 'k3', label: 'Conectar chip e testar sinal', done: done >= 3 },
    { id: 'k4', label: 'Testar comunicação com a central', done: done >= 4 },
    { id: 'k5', label: 'Registrar fotos da instalação', done: done >= 5 },
    { id: 'k6', label: 'Coletar assinatura do cliente', done: done >= 6 },
  ]
  const ordens = [
    {
      id: 'os_1001', numero: 1001, clientId: 'c_andrade', tecnicoId: 'u_carlos', tipo: 'instalacao',
      status: 'em_andamento', veiculo: 'Fiat Toro - JKL0M12', equipamentoId: null,
      endereco: 'Rua Projetada, 88 - Barra, Rio de Janeiro/RJ',
      enderecoTecnico: 'Rua A, 100 - Centro, Rio de Janeiro/RJ',
      observacoes: 'Cliente solicitou instalação oculta.', km: null,
      checklist: checklistInstalacao(3), abertaEm: dayOffset(-2), concluidaEm: null,
    },
    {
      id: 'os_1002', numero: 1002, clientId: 'c_joao', tecnicoId: 'u_marcos', tipo: 'instalacao',
      status: 'concluida', veiculo: 'Honda Civic - MNO3P45', equipamentoId: null,
      endereco: 'Rua das Flores, 15 - Jardim, Osasco/SP',
      enderecoTecnico: 'Av. Central, 50 - Osasco/SP',
      observacoes: '', km: 18,
      checklist: checklistInstalacao(6), abertaEm: dayOffset(-9), concluidaEm: dayOffset(-9),
    },
    {
      id: 'os_1003', numero: 1003, clientId: 'c_veloz', tecnicoId: 'u_carlos', tipo: 'manutencao',
      status: 'aberta', veiculo: 'Scania R450 - ABC1D23', equipamentoId: null,
      endereco: 'Rua das Indústrias, 450 - Distrito Industrial, São Paulo/SP',
      enderecoTecnico: 'Rua B, 200 - São Paulo/SP',
      observacoes: 'Rastreador sem comunicação há 2 dias.', km: null,
      checklist: [
        { id: 'm1', label: 'Diagnosticar falha de comunicação', done: false },
        { id: 'm2', label: 'Substituir chip se necessário', done: false },
        { id: 'm3', label: 'Testar comunicação com a central', done: false },
      ],
      abertaEm: dayOffset(-1), concluidaEm: null,
    },
    {
      id: 'os_1004', numero: 1004, clientId: 'c_frota', tecnicoId: 'u_marcos', tipo: 'retirada',
      status: 'aberta', veiculo: 'Mercedes Actros - GHI7J89', equipamentoId: null,
      endereco: 'Av. dos Transportes, 1200 - Centro, Guarulhos/SP',
      enderecoTecnico: 'Rua C, 300 - Guarulhos/SP',
      observacoes: 'Veículo vendido, retirar equipamento.', km: null,
      checklist: [
        { id: 'r1', label: 'Localizar e remover rastreador', done: false },
        { id: 'r2', label: 'Conferir integridade do equipamento', done: false },
        { id: 'r3', label: 'Dar baixa no estoque', done: false },
      ],
      abertaEm: dayOffset(0), concluidaEm: null,
    },
  ]

  // ---------- Financeiro: Contas a Receber (Tarefas 19, 35, 42) ----------
  // Cada cliente ativo: mensalidade + (instalação, quando recente)
  const contasReceber = [
    { id: uid('cr'), clientId: 'c_veloz', descricao: 'Mensalidade Junho/2026', categoria: 'mensalidade', valor: 119.90, vencimento: dayOffset(-3), status: 'atrasado' },
    { id: uid('cr'), clientId: 'c_veloz', descricao: 'Monitoramento Junho/2026', categoria: 'monitoramento', valor: 30, vencimento: dayOffset(-3), status: 'atrasado' },
    { id: uid('cr'), clientId: 'c_frota', descricao: 'Mensalidade Junho/2026', categoria: 'mensalidade', valor: 149.90, vencimento: dayOffset(8), status: 'aberto' },
    { id: uid('cr'), clientId: 'c_frota', descricao: 'Monitoramento Junho/2026', categoria: 'monitoramento', valor: 49.90, vencimento: dayOffset(8), status: 'aberto' },
    { id: uid('cr'), clientId: 'c_andrade', descricao: 'Mensalidade Junho/2026', categoria: 'mensalidade', valor: 99.90, vencimento: dayOffset(12), status: 'aberto' },
    { id: uid('cr'), clientId: 'c_andrade', descricao: 'Instalação (rastreador)', categoria: 'instalacao', valor: 150, vencimento: dayOffset(5), status: 'aberto' },
    { id: uid('cr'), clientId: 'c_joao', descricao: 'Mensalidade Junho/2026', categoria: 'mensalidade', valor: 79.90, vencimento: dayOffset(-10), status: 'pago', pagoEm: dayOffset(-10) },
    { id: uid('cr'), clientId: 'c_joao', descricao: 'Instalação (rastreador)', categoria: 'instalacao', valor: 150, vencimento: dayOffset(-9), status: 'pago', pagoEm: dayOffset(-9) },
    { id: uid('cr'), clientId: 'c_veloz', descricao: 'Mensalidade Maio/2026', categoria: 'mensalidade', valor: 119.90, vencimento: dayOffset(-33), status: 'pago', pagoEm: dayOffset(-30) },
  ]

  // ---------- Financeiro: Contas a Pagar (Tarefa 42) ----------
  const contasPagar = [
    { id: uid('cp'), descricao: 'Fornecedor rastreadores - lote 50un', categoria: 'fornecedores', valor: 11000, vencimento: dayOffset(-2), status: 'atrasado' },
    { id: uid('cp'), descricao: 'Operadora M2M (chips) - junho', categoria: 'telecom', valor: 480, vencimento: dayOffset(6), status: 'aberto' },
    { id: uid('cp'), descricao: 'Aluguel do escritório', categoria: 'estrutura', valor: 3200, vencimento: dayOffset(4), status: 'aberto' },
    { id: uid('cp'), descricao: 'Folha - técnicos', categoria: 'pessoal', valor: 8400, vencimento: dayOffset(9), status: 'aberto' },
    { id: uid('cp'), descricao: 'Energia elétrica', categoria: 'estrutura', valor: 540, vencimento: dayOffset(-12), status: 'pago', pagoEm: dayOffset(-12) },
  ]

  // ---------- Despesas (Tarefa 38) ----------
  const despesas = [
    { id: uid('de'), descricao: 'Combustível - frota técnica', categoria: 'logistica', valor: 620, data: dayOffset(-5) },
    { id: uid('de'), descricao: 'Material de instalação', categoria: 'insumos', valor: 340, data: dayOffset(-8) },
    { id: uid('de'), descricao: 'Marketing digital', categoria: 'marketing', valor: 900, data: dayOffset(-15) },
    { id: uid('de'), descricao: 'Software / licenças', categoria: 'administrativo', valor: 280, data: dayOffset(-20) },
  ]

  // ---------- Boletos (Tarefas 3, 28 — Asaas) ----------
  const boletos = [
    { id: uid('bo'), clientId: 'c_veloz', valor: 149.90, vencimento: dayOffset(-3), status: 'vencido', gateway: 'asaas', linhaDigitavel: '23793.38128 60082.000123 45000.678901 1 98760000014990', nossoNumero: '000123' },
    { id: uid('bo'), clientId: 'c_frota', valor: 199.80, vencimento: dayOffset(8), status: 'pendente', gateway: 'asaas', linhaDigitavel: '23793.38128 60082.000124 45000.678902 2 98760000019980', nossoNumero: '000124' },
    { id: uid('bo'), clientId: 'c_joao', valor: 79.90, vencimento: dayOffset(-10), status: 'pago', gateway: 'asaas', linhaDigitavel: '23793.38128 60082.000125 45000.678903 3 98760000007990', nossoNumero: '000125', pagoEm: dayOffset(-10) },
  ]

  // ---------- Comissões (Tarefas 10, 29, 31, 33) — valores FIXOS ----------
  const comissoes = [
    { id: uid('co'), tipo: 'vendedor', pessoaId: 'u_ana', referencia: 'Venda - Construtora Andrade', valorFixo: 80, data: dayOffset(-95), status: 'paga' },
    { id: uid('co'), tipo: 'vendedor', pessoaId: 'u_bruno', referencia: 'Venda - João da Silva', valorFixo: 80, data: dayOffset(-60), status: 'paga' },
    { id: uid('co'), tipo: 'vendedor', pessoaId: 'u_ana', referencia: 'Venda - Transportadora Veloz', valorFixo: 80, data: dayOffset(-220), status: 'paga' },
    { id: uid('co'), tipo: 'tecnico', pessoaId: 'u_marcos', referencia: 'OS #1002 - Instalação João', valorFixo: 21.60, km: 18, data: dayOffset(-9), status: 'pendente' },
    { id: uid('co'), tipo: 'tecnico', pessoaId: 'u_carlos', referencia: 'OS #1001 - Instalação Andrade', valorFixo: 0, km: null, data: dayOffset(-2), status: 'pendente' },
  ]

  // ---------- Contratos (Tarefas 8, 34 — Autentique) ----------
  const contratos = [
    { id: uid('ct'), clientId: 'c_veloz', template: 'Contrato Anual PJ', status: 'assinado', criadoEm: dayOffset(-220), assinadoEm: dayOffset(-218), autentiqueLink: 'https://app.autentique.com.br/documentos/exemplo-veloz' },
    { id: uid('ct'), clientId: 'c_joao', template: 'Contrato Mensal PF', status: 'assinado', criadoEm: dayOffset(-60), assinadoEm: dayOffset(-59), autentiqueLink: 'https://app.autentique.com.br/documentos/exemplo-joao' },
    { id: uid('ct'), clientId: 'c_maria', template: 'Contrato Mensal PF', status: 'enviado', criadoEm: dayOffset(-3), assinadoEm: null, autentiqueLink: 'https://app.autentique.com.br/documentos/exemplo-maria' },
    { id: uid('ct'), clientId: 'c_andrade', template: 'Contrato de Comodato', status: 'pendente', criadoEm: dayOffset(-1), assinadoEm: null, autentiqueLink: '' },
  ]

  // ---------- Histórico de Documentos (Tarefa 25 — antes "interações") ----------
  const documentos = [
    { id: uid('doc'), clientId: 'c_veloz', tipo: 'Contrato', nome: 'Contrato Anual PJ.pdf', data: dayOffset(-218) },
    { id: uid('doc'), clientId: 'c_veloz', tipo: 'Boleto', nome: 'Boleto Maio.pdf', data: dayOffset(-33) },
    { id: uid('doc'), clientId: 'c_joao', tipo: 'Contrato', nome: 'Contrato Mensal PF.pdf', data: dayOffset(-59) },
    { id: uid('doc'), clientId: 'c_andrade', tipo: 'OS', nome: 'OS #1001.pdf', data: dayOffset(-2) },
  ]

  // ---------- Notas Fiscais (Tarefas 40, 43 — Spedy) ----------
  const notasFiscais = [
    { id: uid('nf'), clientId: 'c_veloz', numero: '000000128', tipo: 'NFS-e', valor: 149.90, status: 'emitida', emitidaEm: dayOffset(-3), spedyId: 'spedy_128' },
    { id: uid('nf'), clientId: 'c_joao', numero: '000000127', tipo: 'NFS-e', valor: 79.90, status: 'emitida', emitidaEm: dayOffset(-10), spedyId: 'spedy_127' },
    { id: uid('nf'), clientId: 'c_frota', numero: '', tipo: 'NFS-e', valor: 199.80, status: 'pendente', emitidaEm: null, spedyId: '' },
  ]

  // ---------- Histórico de comunicações (Tarefas 9, 15) ----------
  const interacoes = [
    { id: uid('in'), clientId: 'c_veloz', canal: 'whatsapp', descricao: 'Enviado boleto da mensalidade de junho.', data: isoNow(60) },
    { id: uid('in'), clientId: 'c_maria', canal: 'whatsapp', descricao: 'Enviada proposta comercial (Plano Plus).', data: isoNow(180) },
    { id: uid('in'), clientId: 'c_andrade', canal: 'email', descricao: 'Confirmação de agendamento da instalação.', data: isoNow(600) },
    { id: uid('in'), clientId: 'c_sul', canal: 'ligacao', descricao: 'Ligação de follow-up sobre proposta.', data: isoNow(1440) },
  ]

  // ---------- Notificações / alertas (Tarefa 16) ----------
  const notificacoes = []

  // ---------- Auditoria (Tarefa 13) ----------
  const auditLogs = [
    { id: uid('lg'), userId: 'u_douglas', acao: 'login', entidade: 'sessão', detalhe: 'Acesso ao sistema', data: isoNow(5) },
    { id: uid('lg'), userId: 'u_ana', acao: 'criar', entidade: 'lead', detalhe: 'Novo lead: Loja do Zé', data: isoNow(120) },
    { id: uid('lg'), userId: 'u_douglas', acao: 'bonus', entidade: 'cliente', detalhe: 'Concedidas 5h de bônus', data: isoNow(300) },
  ]

  return {
    meta: { version: 2, empresa: 'GPS RASTREAMENTO', homolog: 'https://erp-gpsrastreio.vercel.app' },
    users, planos, produtos, clients, vehicles, chips, equipamentos, ordens,
    contasReceber, contasPagar, despesas, boletos, comissoes, contratos,
    documentos, notasFiscais, interacoes, notificacoes, auditLogs,
  }
}
