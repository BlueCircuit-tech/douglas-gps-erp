import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, ShieldCheck, Zap, Users, Mail, Lock, ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { ROLES } from '../data/seed.js'
import { Field, Btn } from '../components/ui.jsx'

// Tela de login multi-perfil (Tarefas 1, 14) + recuperar senha.
export default function Login() {
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // login | recuperar
  const [role, setRole] = useState('admin')
  const [email, setEmail] = useState('douglas@gpsrastreamento.com')
  const [senha, setSenha] = useState('123456')
  const [sent, setSent] = useState(false)

  const [entrando, setEntrando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setEntrando(true)
    try {
      await loginAs(role, email)
      navigate('/dashboard')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="login-wrap">
      <aside className="login-aside">
        <div className="flex gap-12" style={{ marginBottom: 28 }}>
          <div className="logo" style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--brand)', display: 'grid', placeItems: 'center' }}>
            <MapPin size={24} />
          </div>
          <div>
            <b style={{ fontSize: 18 }}>GPS RASTREAMENTO</b>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>ERP de Gestão</div>
          </div>
        </div>
        <h2>Gestão completa do seu negócio de rastreamento veicular.</h2>
        <p>Clientes, ordens de serviço, estoque, financeiro, contratos e contabilidade — tudo num só lugar.</p>
        <div className="feat"><div className="ico"><Users size={18} /></div> Multi-perfil: Admin, Vendedor, Técnico, Operacional e Contabilidade</div>
        <div className="feat"><div className="ico"><Zap size={18} /></div> Dashboard executivo com métricas em tempo real</div>
        <div className="feat"><div className="ico"><ShieldCheck size={18} /></div> Permissões granulares e auditoria de ações</div>
      </aside>

      <div className="login-form-side">
        <div className="login-card">
          <div className="brand-row">
            <div className="logo"><MapPin size={22} /></div>
            <div>
              <b style={{ fontSize: 16 }}>GPS RASTREAMENTO</b>
              <div className="mut" style={{ fontSize: 12 }}>Painel de Gestão</div>
            </div>
          </div>

          {mode === 'login' ? (
            <form onSubmit={entrar}>
              <h1 style={{ fontSize: 22, marginBottom: 4 }}>Bem-vindo de volta</h1>
              <p className="soft" style={{ margin: '0 0 20px' }}>Entre com suas credenciais para continuar.</p>

              <Field label="Perfil de acesso" hint="Selecione o perfil para entrar (demo).">
                <div className="role-grid">
                  {Object.entries(ROLES).filter(([k]) => k !== 'contador').map(([k, r]) => (
                    <div key={k} className={`role-chip ${role === k ? 'active' : ''}`} onClick={() => setRole(k)}>
                      <ShieldCheck size={16} /> {r.label}
                    </div>
                  ))}
                </div>
              </Field>

              <Field label="E-mail">
                <div className="flex" style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-mut)' }} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: 36 }} type="email" />
                </div>
              </Field>
              <Field label="Senha">
                <div className="flex" style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-mut)' }} />
                  <input value={senha} onChange={(e) => setSenha(e.target.value)} style={{ paddingLeft: 36 }} type="password" />
                </div>
              </Field>

              <div className="between" style={{ margin: '4px 0 18px' }}>
                <label className="flex gap-6 soft" style={{ fontSize: 13 }}>
                  <input type="checkbox" defaultChecked /> Manter conectado
                </label>
                <a className="soft bold" style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => setMode('recuperar')}>Esqueci a senha</a>
              </div>

              <Btn variant="primary" className="btn-block" type="submit" disabled={entrando}>{entrando ? 'Entrando...' : 'Entrar'}</Btn>
            </form>
          ) : (
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setMode('login'); setSent(false) }} style={{ marginBottom: 12, paddingLeft: 0 }}>
                <ArrowLeft size={15} /> Voltar para o login
              </button>
              <h1 style={{ fontSize: 22, marginBottom: 4 }}>Recuperar senha</h1>
              <p className="soft" style={{ margin: '0 0 20px' }}>Enviaremos um link de recuperação para seu e-mail.</p>
              {sent ? (
                <div className="card card-pad" style={{ background: 'var(--green-bg)', borderColor: '#bbf7d0' }}>
                  <div className="bold" style={{ color: 'var(--green)' }}>Link enviado!</div>
                  <div className="soft" style={{ marginTop: 4 }}>Verifique a caixa de entrada de <b>{email}</b>.</div>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
                  <Field label="E-mail">
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="seu@email.com" />
                  </Field>
                  <Btn variant="primary" className="btn-block" type="submit">Enviar link de recuperação</Btn>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
