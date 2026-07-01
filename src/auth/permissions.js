// Permissões granulares por perfil (Tarefas 1, 14, 41).
// Cada módulo do sistema é uma "chave". O menu e as rotas
// consultam can(role, key).

export const MODULES = {
  dashboard:    { label: 'Dashboard' },
  clientes:     { label: 'Clientes' },
  funil:        { label: 'Funil de Vendas' },
  os:           { label: 'Ordens de Serviço' },
  estoque:      { label: 'Estoque' },
  financeiro:   { label: 'Financeiro' },
  boletos:      { label: 'Boletos' },
  comissoes:    { label: 'Comissões' },
  contratos:    { label: 'Contratos' },
  contabilidade:{ label: 'Contabilidade' },
  produtos:     { label: 'Produtos e Serviços' },
  planos:       { label: 'Planos' },
  relatorios:   { label: 'Relatórios' },
  equipe:       { label: 'Equipe' },
  notificacoes: { label: 'Notificações' },
  auditoria:    { label: 'Auditoria' },
  ajuda:        { label: 'Central de Ajuda' },
}

const ALL = Object.keys(MODULES)

export const PERMISSIONS = {
  admin: ALL,
  vendedor: ['dashboard', 'clientes', 'funil', 'contratos', 'comissoes', 'produtos', 'planos', 'notificacoes', 'ajuda'],
  tecnico: ['dashboard', 'os', 'estoque', 'notificacoes', 'ajuda'],
  operacional: ['dashboard', 'os', 'clientes', 'estoque', 'contratos', 'notificacoes', 'ajuda'],
  contabilidade: ['dashboard', 'financeiro', 'boletos', 'contabilidade', 'relatorios', 'contratos', 'notificacoes', 'ajuda'],
  contador: ['dashboard', 'contabilidade', 'relatorios', 'ajuda'],
}

export const can = (role, key) => (PERMISSIONS[role] || []).includes(key)
