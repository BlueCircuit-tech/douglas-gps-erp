// ============================================================
// CONFIG / CONSTANTES do ERP GPS RASTREAMENTO.
// Os DADOS vêm do Supabase (ver src/data/api.js). Este arquivo
// mantém apenas constantes de configuração (perfis de acesso e
// estágios do funil de vendas).
// ============================================================

// Perfis de acesso (Tarefas 1, 14, 40, 41)
export const ROLES = {
  admin: { label: 'Administrador', color: 'b-purple' },
  vendedor: { label: 'Vendedor', color: 'b-blue' },
  tecnico: { label: 'Técnico', color: 'b-amber' },
  operacional: { label: 'Operacional', color: 'b-green' },
  contabilidade: { label: 'Contabilidade', color: 'b-gray' },
  contador: { label: 'Contador', color: 'b-gray' },
}

// Estágios do funil de vendas (Kanban — Tarefa 6)
export const FUNNEL = [
  { id: 'novo', label: 'Novo Lead', color: '#64748b' },
  { id: 'contato', label: 'Contato', color: '#2563eb' },
  { id: 'proposta', label: 'Proposta', color: '#7c3aed' },
  { id: 'negociacao', label: 'Negociação', color: '#d97706' },
  { id: 'fechado', label: 'Fechado', color: '#16a34a' },
  { id: 'perdido', label: 'Perdido', color: '#dc2626' },
]

// Metadados da empresa (usados na UI).
export const META = { empresa: 'GPS RASTREAMENTO', homolog: 'https://erp-gpsrastreio.vercel.app' }
