import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import AppShell from './components/AppShell.jsx'
import { PERMISSIONS } from './auth/permissions.js'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clientes from './pages/Clientes.jsx'
import ClienteDetalhe from './pages/ClienteDetalhe.jsx'
import Fornecedores from './pages/Fornecedores.jsx'
import FornecedorDetalhe from './pages/FornecedorDetalhe.jsx'
import Funil from './pages/Funil.jsx'
import Contratos from './pages/Contratos.jsx'
import Comissoes from './pages/Comissoes.jsx'
import OrdensServico from './pages/OrdensServico.jsx'
import OrdemDetalhe from './pages/OrdemDetalhe.jsx'
import Estoque from './pages/Estoque.jsx'
import Financeiro from './pages/Financeiro.jsx'
import Boletos from './pages/Boletos.jsx'
import Contabilidade from './pages/Contabilidade.jsx'
import Produtos from './pages/Produtos.jsx'
import Planos from './pages/Planos.jsx'
import Relatorios from './pages/Relatorios.jsx'
import Equipe from './pages/Equipe.jsx'
import Notificacoes from './pages/Notificacoes.jsx'
import Auditoria from './pages/Auditoria.jsx'
import Ajuda from './pages/Ajuda.jsx'

// Rota protegida: exige login e (opcionalmente) permissão de módulo.
function Protected({ module, children }) {
  const { user, can } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (module && !can(module)) {
    // Sem permissão → manda para o 1º módulo que o perfil acessa.
    const first = (PERMISSIONS[user.role] || ['dashboard'])[0]
    return <Navigate to={`/${first}`} replace />
  }
  return <AppShell>{children}</AppShell>
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route path="/dashboard" element={<Protected module="dashboard"><Dashboard /></Protected>} />
      <Route path="/clientes" element={<Protected module="clientes"><Clientes /></Protected>} />
      <Route path="/clientes/:id" element={<Protected module="clientes"><ClienteDetalhe /></Protected>} />
      <Route path="/fornecedores" element={<Protected module="fornecedores"><Fornecedores /></Protected>} />
      <Route path="/fornecedores/:id" element={<Protected module="fornecedores"><FornecedorDetalhe /></Protected>} />
      <Route path="/funil" element={<Protected module="funil"><Funil /></Protected>} />
      <Route path="/contratos" element={<Protected module="contratos"><Contratos /></Protected>} />
      <Route path="/comissoes" element={<Protected module="comissoes"><Comissoes /></Protected>} />
      <Route path="/os" element={<Protected module="os"><OrdensServico /></Protected>} />
      <Route path="/os/:id" element={<Protected module="os"><OrdemDetalhe /></Protected>} />
      <Route path="/estoque" element={<Protected module="estoque"><Estoque /></Protected>} />
      <Route path="/financeiro" element={<Protected module="financeiro"><Financeiro /></Protected>} />
      <Route path="/boletos" element={<Protected module="boletos"><Boletos /></Protected>} />
      <Route path="/contabilidade" element={<Protected module="contabilidade"><Contabilidade /></Protected>} />
      <Route path="/produtos" element={<Protected module="produtos"><Produtos /></Protected>} />
      <Route path="/planos" element={<Protected module="planos"><Planos /></Protected>} />
      <Route path="/relatorios" element={<Protected module="relatorios"><Relatorios /></Protected>} />
      <Route path="/equipe" element={<Protected module="equipe"><Equipe /></Protected>} />
      <Route path="/notificacoes" element={<Protected module="notificacoes"><Notificacoes /></Protected>} />
      <Route path="/auditoria" element={<Protected module="auditoria"><Auditoria /></Protected>} />
      <Route path="/ajuda" element={<Protected module="ajuda"><Ajuda /></Protected>} />

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}
