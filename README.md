# ERP GPS RASTREAMENTO — Douglas

Sistema de gestão (ERP) para empresa de **rastreamento veicular**, construído a partir do
protótipo enviado pelo cliente (`erp-gpsrastreio.vercel.app`) e ampliado com as demandas da
lista de tarefas da proposta.

> ⚠️ **Nome correto do sistema:** *GPS RASTREAMENTO* (Tarefa 21) — corrigido em toda a interface.

## Stack

- **Vite + React 18** (JavaScript + JSX) — mesma stack do protótipo
- **react-router-dom** — navegação (SPA)
- **recharts** — gráficos do dashboard e relatórios
- **lucide-react** — ícones
- **Persistência local** — todos os dados ficam no `localStorage` do navegador, então
  cadastros, OS, boletos etc. **persistem entre recarregamentos** e o sistema é totalmente
  navegável/demonstrável sem backend. O modelo de dados já está pronto para plugar uma API real.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção em dist/
npm run preview  # serve o build
```

### Acesso (demo multi-perfil)

Na tela de login, escolha o **perfil de acesso** (o menu e as permissões se adaptam):

| Perfil | Acessos principais |
|---|---|
| **Administrador** | Tudo |
| **Vendedor** | Dashboard, Clientes, Funil, Contratos, Comissões, Produtos, Planos |
| **Técnico** | Dashboard, Ordens de Serviço, Estoque |
| **Operacional** | Dashboard, OS, Clientes, Estoque, Contratos |
| **Contabilidade / Contador** | Dashboard, Financeiro, Boletos, Contabilidade (NF), Relatórios |

E-mail/senha são livres na demo (ex.: `douglas@gpsrastreamento.com` / `123456`).

## Mapa de Tarefas → Funcionalidades entregues

> As **45 tarefas** + 3 prioridades da proposta foram cobertas. Itens que dependem de
> **credenciais/dados do Douglas** (Asaas, Autentique, Spedy, planilha de monitoramento,
> WhatsApp oficial) foram entregues com a **interface e o fluxo prontos**, marcados como
> *"aguardando credenciais"*, para ligar a integração assim que os dados chegarem.

### Autenticação e perfis
- **1, 41** — Login multi-perfil (Admin, Vendedor, Técnico, Operacional, Contabilidade, Contador). → `Login`, `AuthContext`
- **14** — Permissões granulares por perfil (menu e rotas filtrados). → `auth/permissions.js`
- **13** — Logs e auditoria de ações. → `Auditoria`
- **21** — Renomeado para **GPS RASTREAMENTO** em todo o sistema.

### Dashboard
- **4, 42** — Dashboard executivo com KPIs em tempo real: *Contas a receber em atraso / em aberto no mês*, *Contas a pagar em atraso / em aberto no mês*, receita, clientes ativos, OS abertas, boletos pendentes + gráficos. → `Dashboard`

### Comercial / CRM
- **6** — Funil de vendas Kanban (drag & drop entre estágios). → `Funil`
- **7, 22** — Cadastro completo do cliente/lead (PF/PJ, documentos, plano de contratação, endereço, observações). → `Clientes`
- **20** — Data de aniversário do cliente (para mensagem automática) + alerta de aniversários próximos. → `Clientes`, `Notificacoes`
- **15, 25** — "Histórico de interações" renomeado para **Histórico de Documentos**; comunicações (WhatsApp/e-mail/SMS/ligação) na ficha do cliente. → `ClienteDetalhe`
- **8, 34** — Envio de contratos com assinatura digital + **link de acesso fácil ao Autentique**. → `Contratos`
- **10, 29, 31, 33** — Comissões de **valor FIXO** (não %), para vendedores **e** técnicos; técnico por KM (com rota ou KM manual sinalizado para conferência); botão para adicionar vendedores/técnicos. → `Comissoes`, `Equipe`, `OrdemDetalhe`

### Operação (Tarefa 44 — só Ordens de Serviço)
- **2, 26, 27** — OS com checklist do técnico, tipo (instalação/manutenção/retirada), técnico responsável, endereço do cliente (preenchido do cadastro) e campo de observações. → `OrdensServico`, `OrdemDetalhe`
- **32** — Tipo de serviço destacado (retirada / instalação / manutenção). → `OrdensServico`
- **30, 33** — Rota técnico → cliente para estimar KM; quando a rota não traça, **KM manual** com aviso de conferência (técnico pode informar errado). → `OrdemDetalhe`

### Estoque (Tarefa 45 — Chips + Equipamentos)
- **5** — Estoque de chips (linha, simcard/ICCID, operadora, valor). → `Estoque`
- **39** — Chip: além de "defeituoso", status **cancelado** com **data do cancelamento e nº do protocolo**. → `Estoque`
- **45** — Aba de Estoque com **chips e equipamentos**. → `Estoque`

### Financeiro
- **19, 35** — Contas a Pagar e Receber; conta a receber com **mensalidade + instalação** (e monitoramento). → `Financeiro`
- **38** — Cadastrar e **classificar despesas** por categoria. → `Financeiro`
- **11, 37** — Relatórios financeiros com gráficos, **filtro por cliente** e exportação. → `Relatorios`
- **12** — Relatórios operacionais de desempenho dos técnicos. → `Relatorios`
- **3, 28** — Emissão de boletos com **integração Asaas** (fluxo pronto; aguardando credenciais). → `Boletos`
- **23, 24** — Planos/pacotes com **valores alteráveis por input**: rastreamento (mensal) × instalação × monitoramento. → `Planos`
- **36** — Receita de monitoramento (campo dedicado por plano/cliente; importação da planilha do Douglas pendente do arquivo). → `Planos`, `Financeiro`

### Contabilidade (Tarefa 40)
- **40, 41** — Menu **Contabilidade** para gerenciar notas fiscais; perfil **Contador** com acesso. → `Contabilidade`
- **43** — Emissão de NF com integração **Spedy** (`spedy.com.br`) — fluxo pronto; aguardando credenciais. → `Contabilidade`

### Cadastros e suporte
- **17** — Cadastro de produtos e serviços. → `Produtos`
- **16** — Notificações/alertas (boletos vencidos, estoque baixo, OS atrasadas, aniversários). → `Notificacoes`
- **18** — Central de ajuda e suporte. → `Ajuda`
- **9** — Integração WhatsApp para boletos/contratos/notificações (envio registrado no histórico; API oficial pendente). → `ClienteDetalhe`, `Boletos`

## Pendências que dependem do cliente (Douglas)

1. **Asaas** — credenciais da API para emitir boletos de verdade (Tarefa 28).
2. **Autentique** — token da API/conta para gerar os documentos de assinatura (Tarefa 34).
3. **Spedy** — credenciais para emissão automática de NF-e/NFS-e (Tarefa 43).
4. **WhatsApp** — número/credenciais (API oficial ou provedor) para envio automático (Tarefa 9).
5. **Valores dos planos/pacotes** — confirmar com o Douglas (Tarefas 23) — já editáveis pela tela.
6. **Planilha de monitoramento (Excel)** — para importar a receita de monitoramento (Tarefa 36).

## Estrutura do projeto

```
src/
  main.jsx, App.jsx            # bootstrap + rotas (protegidas por perfil)
  styles.css                  # design system (tokens do protótipo)
  auth/                       # AuthContext + permissões por perfil
  data/                       # seed.js (dados mock) + store.js (estado + localStorage)
  lib/format.js               # moeda/datas/máscaras BR
  components/                 # AppShell (menu/topbar) + ui.jsx (kit de UI)
  pages/                      # uma página por módulo
```
