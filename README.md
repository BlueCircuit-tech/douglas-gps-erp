# ERP GPS RASTREAMENTO — Douglas

Sistema de gestão (ERP) web para empresa de **rastreamento veicular**, construído a partir do
protótipo enviado pelo cliente (`erp-gpsrastreio.vercel.app`) e ampliado com as demandas da
lista de tarefas da proposta.

> ⚠️ **Nome correto do sistema:** *GPS RASTREAMENTO* (Tarefa 21) — corrigido em toda a interface.

O sistema é uma **SPA (Single Page Application)** que cobre o ciclo completo do negócio:
CRM/funil de vendas, cadastro de clientes, contratos com assinatura digital, ordens de serviço,
estoque de chips e equipamentos, financeiro (contas a pagar/receber, boletos), contabilidade
(notas fiscais), planos, comissões, relatórios e dashboard executivo — com **login multi-perfil**
e permissões granulares por módulo.

---

## Stack

- **Vite 5 + React 18** (JavaScript + JSX) — mesma stack do protótipo
- **react-router-dom 6** — navegação/rotas (SPA)
- **recharts** — gráficos do dashboard e relatórios
- **lucide-react** — ícones
- **puppeteer-core** — apenas para os scripts de QA (smoke/interação)
- **Persistência local** — todos os dados ficam no `localStorage` do navegador, então
  cadastros, OS, boletos etc. **persistem entre recarregamentos** e o sistema é totalmente
  navegável/demonstrável **sem backend**. O modelo de dados já está pronto para plugar uma API real.
- **Deploy:** Vercel (framework Vite)

---

## Pré-requisitos

- **Node.js 20+** (recomendado LTS)
- **npm 10+** (o projeto usa `package-lock.json` — este é o gerenciador oficial do repo)
- Para rodar os scripts de QA (`scripts/*.mjs`): um **Chrome/Chromium** instalado localmente

---

## Setup passo a passo

```bash
# 1. Instalar as dependências (npm — há package-lock.json)
npm install

# 2. (Opcional) Configurar variáveis de ambiente
#    O app roda sem .env; ele só é necessário para QA/integrações futuras.
cp .env.example .env
#    edite o .env com os valores reais (NUNCA versione o .env)

# 3. Rodar em desenvolvimento (http://localhost:5173)
npm run dev

# 4. Gerar build de produção (saída em dist/)
npm run build

# 5. Servir o build localmente para conferência (http://localhost:4173)
npm run preview
```

> **Nota sobre `.env`:** hoje o front-end **não exige nenhuma variável** para rodar (dados em
> `localStorage`). O `.env.example` documenta as variáveis dos scripts de QA (`BASE`, `CHROME`)
> e as das integrações que estão *aguardando credenciais* (Asaas, Autentique, Spedy, WhatsApp).

### Acesso (demo multi-perfil)

Na tela de login, escolha o **perfil de acesso** (o menu e as permissões se adaptam):

| Perfil | Acessos principais |
|---|---|
| **Administrador** | Tudo |
| **Vendedor** | Dashboard, Clientes, Funil, Contratos, Comissões, Produtos, Planos |
| **Técnico** | Dashboard, Ordens de Serviço, Estoque |
| **Operacional** | Dashboard, OS, Clientes, Estoque, Contratos |
| **Contabilidade** | Dashboard, Financeiro, Boletos, Contabilidade (NF), Relatórios, Contratos |
| **Contador** | Dashboard, Contabilidade (NF), Relatórios |

E-mail/senha são livres na demo (ex.: `douglas@gpsrastreamento.com` / `123456`).

---

## Scripts do `package.json`

| Script | Comando | O que faz |
|---|---|---|
| `dev` | `vite` | Sobe o servidor de desenvolvimento (HMR) em `http://localhost:5173` |
| `build` | `vite build` | Gera o build de produção otimizado em `dist/` |
| `preview` | `vite preview` | Serve o build de `dist/` localmente (`http://localhost:4173`) para conferência |

Scripts de QA (executados manualmente com `node`, **não** estão no `package.json`):

| Arquivo | Comando | O que faz |
|---|---|---|
| `scripts/smoke.mjs` | `node scripts/smoke.mjs` | Visita cada rota logado e captura erros de console/render (requer `npm run preview` no ar) |
| `scripts/interaction.mjs` | `node scripts/interaction.mjs` | Testa login multi-perfil, gating por permissão e fluxo de criação |

> Os scripts de QA usam as variáveis `BASE` (URL do preview) e `CHROME` (caminho do Chrome).

---

## Estrutura do projeto

```
.
├── index.html                 # HTML raiz da SPA (monta #root a partir de src/main.jsx)
├── vite.config.js             # config do Vite (plugin React, porta 5173)
├── vercel.json                # config de deploy Vercel (framework Vite + SPA rewrites)
├── package.json               # dependências e scripts
├── .env.example               # nomes das variáveis (QA e integrações futuras)
├── public/                    # assets estáticos (favicon.svg)
├── scripts/                   # QA: smoke.mjs + interaction.mjs (puppeteer-core)
└── src/
    ├── main.jsx               # bootstrap do React (Router + AuthProvider)
    ├── App.jsx                # rotas protegidas por perfil
    ├── styles.css             # design system (tokens do protótipo)
    ├── auth/                  # AuthContext.jsx + permissions.js (perfis/permissões)
    ├── data/                  # seed.js (dados mock) + store.js (estado + localStorage)
    ├── lib/format.js          # helpers de moeda/datas/máscaras BR
    ├── components/            # AppShell.jsx (menu/topbar) + ui.jsx (kit de UI)
    └── pages/                 # uma página por módulo (Dashboard, Clientes, OS, ...)
```

### Módulos (rotas principais)

`/dashboard` · `/clientes` (+ `/clientes/:id`) · `/funil` · `/contratos` · `/comissoes` ·
`/os` (+ `/os/:id`) · `/estoque` · `/financeiro` · `/boletos` · `/contabilidade` · `/produtos` ·
`/planos` · `/relatorios` · `/equipe` · `/notificacoes` · `/auditoria` · `/ajuda` · `/login`

Todas as rotas (exceto `/login`) são protegidas por `Protected` e filtradas pelas permissões do perfil.

---

## Funcionalidades entregues (resumo)

As **45 tarefas** + 3 prioridades da proposta foram cobertas. Itens que dependem de
credenciais/dados do Douglas foram entregues com a **interface e o fluxo prontos**, marcados como
*"aguardando credenciais"*, para ligar a integração assim que os dados chegarem.

- **Autenticação e perfis** — login multi-perfil (Admin, Vendedor, Técnico, Operacional,
  Contabilidade, Contador), permissões granulares por módulo e log de auditoria de ações.
- **Dashboard executivo** — KPIs em tempo real (contas a receber/pagar em atraso e em aberto,
  receita, clientes ativos, OS abertas, boletos pendentes) + gráficos.
- **Comercial / CRM** — funil de vendas Kanban, cadastro completo de cliente/lead (PF/PJ),
  histórico de documentos e comunicações, contratos com assinatura digital (link Autentique),
  comissões de valor fixo para vendedores e técnicos (técnico por KM).
- **Operação** — ordens de serviço com checklist, tipo (instalação/manutenção/retirada), técnico
  responsável, endereço do cliente e estimativa de KM (rota ou KM manual sinalizado).
- **Estoque** — chips (linha, ICCID, operadora, valor, status incl. cancelado com protocolo) e
  equipamentos.
- **Financeiro** — contas a pagar/receber, classificação de despesas, boletos (Asaas), relatórios
  financeiros e operacionais com filtros e exportação.
- **Contabilidade** — gestão de notas fiscais com integração Spedy (fluxo pronto).
- **Cadastros e suporte** — produtos/serviços, planos com valores editáveis, notificações/alertas
  e central de ajuda.

### Integrações aguardando credenciais do cliente (Douglas)

| Integração | Uso | Status |
|---|---|---|
| **Asaas** | Emissão de boletos (Tarefas 3, 28) | UI/fluxo pronto — aguardando API key |
| **Autentique** | Assinatura digital de contratos (Tarefas 8, 34) | UI/fluxo pronto — aguardando token |
| **Spedy** | Emissão de NF-e/NFS-e (Tarefa 43) | UI/fluxo pronto — aguardando credenciais |
| **WhatsApp** | Envio de boletos/contratos/notificações (Tarefa 9) | UI/fluxo pronto — aguardando número/API |
| **Planilha de monitoramento (Excel)** | Importar receita de monitoramento (Tarefa 36) | Aguardando arquivo |

Quando as credenciais chegarem, preencha o `.env` (ver `.env.example`) para ligar cada integração.

---

## Deploy (Vercel)

O projeto já está configurado para deploy na **Vercel** via `vercel.json`:

- **Framework:** `vite`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Rewrites:** todas as rotas caem em `/index.html` (necessário para o roteamento SPA do
  `react-router-dom` funcionar em URLs profundas / F5).

Passos:

1. Conecte o repositório `BlueCircuit-tech/douglas-gps-erp` à Vercel.
2. A Vercel detecta o Vite automaticamente (ou usa o `vercel.json`).
3. Se/quando as integrações forem ligadas, cadastre as variáveis de ambiente no painel da Vercel
   (**Project → Settings → Environment Variables**) usando os nomes do `.env.example`. Lembre-se:
   apenas variáveis `VITE_*` ficam disponíveis no navegador; segredos de servidor não devem usar
   esse prefixo.

### CI

O repositório inclui um workflow em `.github/workflows/ci.yml` (`name: CI`, job `build`) que roda
em `push` e `pull_request` nas branches `main` e `staging`: instala com `npm ci` (Node 20, cache
npm) e executa `lint`, `build` e `test` com `--if-present` (hoje só o `build` existe e é validado).
