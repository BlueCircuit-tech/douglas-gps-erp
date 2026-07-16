import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  LifeBuoy, Search, ChevronDown,
  Users, TrendingUp, Wrench, Boxes, Wallet, Receipt, Calculator, FileText,
  Coins, BarChart3, MessageCircle, Mail, Phone,
} from 'lucide-react'
import { PageHead, Card, CardHead, Badge, EmptyState } from '../components/ui.jsx'

// ---------- Atalhos para os principais módulos ----------
const ATALHOS = [
  { to: '/clientes', label: 'Clientes', tone: 'blue', icon: Users, desc: 'Cadastro, histórico e dados de contato dos clientes e leads.' },
  { to: '/funil', label: 'Funil de Vendas', tone: 'purple', icon: TrendingUp, desc: 'Acompanhe leads pelo Kanban até o fechamento.' },
  { to: '/os', label: 'Ordens de Serviço', tone: 'amber', icon: Wrench, desc: 'Instalações, manutenções e retiradas com checklist.' },
  { to: '/estoque/equipamentos', label: 'Estoque', tone: 'green', icon: Boxes, desc: 'Chips e equipamentos disponíveis, em uso ou em defeito.' },
  { to: '/financeiro', label: 'Financeiro', tone: 'blue', icon: Wallet, desc: 'Contas a receber, a pagar e controle de despesas.' },
  { to: '/boletos', label: 'Boletos', tone: 'red', icon: Receipt, desc: 'Emissão e baixa de boletos via gateway de cobrança.' },
  { to: '/contabilidade', label: 'Contabilidade', tone: 'gray', icon: Calculator, desc: 'Notas fiscais (NFS-e) e fechamento contábil.' },
  { to: '/contratos', label: 'Contratos', tone: 'purple', icon: FileText, desc: 'Geração e assinatura digital de contratos.' },
  { to: '/comissoes', label: 'Comissões', tone: 'green', icon: Coins, desc: 'Comissões de vendedores e técnicos por referência.' },
  { to: '/relatorios', label: 'Relatórios', tone: 'blue', icon: BarChart3, desc: 'Indicadores e análises gerenciais do negócio.' },
]

// ---------- Perguntas frequentes ----------
const FAQ = [
  {
    id: 'f1', cat: 'Clientes',
    q: 'Como cadastro um novo cliente ou lead?',
    a: 'Acesse o módulo Clientes e clique em "Cadastrar Cliente". Preencha os dados de pessoa (PJ ou PF), contato, endereço e o plano de contratação. Leads também podem nascer pelo Funil de Vendas e ser convertidos em clientes ativos ao avançar para o estágio "Fechado".',
  },
  {
    id: 'f2', cat: 'Ordens de Serviço',
    q: 'Como abrir e concluir uma Ordem de Serviço?',
    a: 'No módulo Ordens de Serviço, crie a OS escolhendo o cliente, o técnico responsável e o tipo (instalação, manutenção ou retirada). Conforme o serviço avança, marque os itens do checklist; ao concluir todos, registre o KM rodado para que a comissão do técnico seja calculada automaticamente.',
  },
  {
    id: 'f3', cat: 'Boletos',
    q: 'Como emitir um boleto e dar baixa no pagamento?',
    a: 'Em Boletos, gere a cobrança vinculada ao cliente informando valor e vencimento — a linha digitável e o nosso número são preenchidos pelo gateway. Quando o pagamento for confirmado, use a ação de baixa para marcar o boleto como pago; a conta a receber correspondente é atualizada.',
  },
  {
    id: 'f4', cat: 'Notas Fiscais',
    q: 'Como emito a Nota Fiscal de Serviço (NFS-e)?',
    a: 'No módulo Contabilidade, localize a nota com status "Pendente" e emita a NFS-e. Após a emissão o número fiscal e a data são preenchidos e o status passa para "Emitida". Os dados do cliente são reaproveitados do cadastro.',
  },
  {
    id: 'f5', cat: 'Comissões',
    q: 'Como funciona o cálculo de comissões?',
    a: 'Comissões de vendedores usam um valor fixo por venda fechada (configurado no cadastro do usuário). Para técnicos, além do valor fixo do serviço, soma-se o KM rodado multiplicado pelo valor por quilômetro do técnico. Cada comissão fica como "Pendente" até ser marcada como "Paga".',
  },
  {
    id: 'f6', cat: 'Financeiro',
    q: 'Onde acompanho contas em atraso e a vencer?',
    a: 'O Dashboard traz KPIs de contas a receber e a pagar (em atraso e em aberto no mês). Para o detalhe, use o módulo Financeiro, onde é possível filtrar por status e baixar contas. Itens vencidos aparecem destacados em vermelho.',
  },
  {
    id: 'f7', cat: 'Estoque',
    q: 'Como controlo chips e equipamentos?',
    a: 'Em Estoque você gerencia chips e rastreadores por status: disponível, em uso, defeituoso ou cancelado. Ao vincular um item a um cliente, o status muda para "em uso"; cancelamentos de chip podem registrar protocolo e data junto à operadora.',
  },
  {
    id: 'f8', cat: 'Segurança',
    q: 'Por que não vejo todos os módulos no menu?',
    a: 'O acesso é controlado por perfil. Cada perfil (Administrador, Vendedor, Técnico, Operacional, Contabilidade e Contador) enxerga apenas os módulos pertinentes à sua função. Caso precise de acesso adicional, fale com um administrador.',
  },
]

// ---------- Canais de suporte ----------
const CANAIS = [
  { id: 'wpp', tone: 'green', icon: MessageCircle, titulo: 'WhatsApp', valor: '(11) 99123-4567', sub: 'Atendimento rápido, seg. a sex. 8h–18h', href: 'https://wa.me/5511991234567', cta: 'Abrir conversa' },
  { id: 'mail', tone: 'blue', icon: Mail, titulo: 'E-mail', valor: 'suporte@gpsrastreamento.com', sub: 'Resposta em até 1 dia útil', href: 'mailto:suporte@gpsrastreamento.com', cta: 'Enviar e-mail' },
  { id: 'tel', tone: 'purple', icon: Phone, titulo: 'Telefone', valor: '(11) 4004-1234', sub: 'Central de atendimento', href: 'tel:+551140041234', cta: 'Ligar agora' },
]

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        className="between"
        style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 18px', textAlign: 'left', gap: 12 }}
      >
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <Badge tone="gray">{item.cat}</Badge>
          <span className="bold" style={{ fontSize: 14 }}>{item.q}</span>
        </div>
        <ChevronDown size={18} className="mut" style={{ flexShrink: 0, transition: 'transform .18s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="mut" style={{ padding: '0 18px 16px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-soft)' }}>
          {item.a}
        </div>
      )}
    </div>
  )
}

export default function Ajuda() {
  const [openId, setOpenId] = useState('f1')
  const [q, setQ] = useState('')

  const faqFiltrado = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return FAQ
    return FAQ.filter((f) => `${f.cat} ${f.q} ${f.a}`.toLowerCase().includes(t))
  }, [q])

  return (
    <>
      <PageHead
        title="Central de Ajuda e Suporte"
        subtitle="Atalhos, dúvidas frequentes e canais de atendimento"
      >
        <a className="btn btn-primary" href="https://wa.me/5511991234567" target="_blank" rel="noreferrer">
          <LifeBuoy size={16} /> Falar com o suporte
        </a>
      </PageHead>

      {/* ---------- Atalhos rápidos ---------- */}
      <Card>
        <CardHead title="Atalhos rápidos" sub="Vá direto aos principais módulos do ERP" icon={<TrendingUp size={18} color="var(--brand)" />} />
        <div className="card-pad grid grid-4">
          {ATALHOS.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="card card-pad"
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}
            >
              <div className="stat-ico" style={{ background: `var(--${m.tone}-bg)`, color: `var(--${m.tone})`, flexShrink: 0 }}>
                <m.icon size={20} />
              </div>
              <div>
                <div className="bold" style={{ fontSize: 14 }}>{m.label}</div>
                <div className="mut" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.45 }}>{m.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', marginTop: 16, alignItems: 'start' }}>
        {/* ---------- FAQ accordion ---------- */}
        <Card>
          <div className="card-head">
            <LifeBuoy size={18} color="var(--brand)" />
            <div>
              <h3>Perguntas frequentes</h3>
              <div className="card-sub">Dúvidas comuns sobre os módulos do sistema</div>
            </div>
            <div className="spacer" />
            <div
              className="flex gap-8"
              style={{ maxWidth: 240, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 11px', alignItems: 'center' }}
            >
              <Search size={15} className="mut" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar dúvida..."
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 13 }}
              />
            </div>
          </div>
          <div className="card-pad">
            {faqFiltrado.map((item) => (
              <FaqItem
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
              />
            ))}
            {!faqFiltrado.length && (
              <EmptyState icon={<Search size={40} />} title="Nenhuma dúvida encontrada" sub="Tente outros termos ou fale com o suporte." />
            )}
          </div>
        </Card>

        <div className="col gap-16">
          {/* ---------- Canais de contato ---------- */}
          <Card>
            <CardHead title="Canais de atendimento" sub="Fale com a nossa equipe" icon={<MessageCircle size={18} color="var(--brand)" />} />
            <div className="card-pad col gap-12">
              {CANAIS.map((c) => (
                <div key={c.id} className="card card-pad between" style={{ gap: 12 }}>
                  <div className="flex gap-12" style={{ alignItems: 'center' }}>
                    <div className="stat-ico" style={{ background: `var(--${c.tone}-bg)`, color: `var(--${c.tone})`, flexShrink: 0 }}>
                      <c.icon size={20} />
                    </div>
                    <div>
                      <div className="bold" style={{ fontSize: 14 }}>{c.titulo}</div>
                      <div className="mono" style={{ fontSize: 13 }}>{c.valor}</div>
                      <div className="mut" style={{ fontSize: 12 }}>{c.sub}</div>
                    </div>
                  </div>
                  <a className="btn btn-sm" href={c.href} target="_blank" rel="noreferrer">{c.cta}</a>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </>
  )
}
