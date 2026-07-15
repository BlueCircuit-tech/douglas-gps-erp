// Smoke test de runtime: visita cada rota logado e captura erros de console/crash.
// Uso: node scripts/smoke.mjs  (requer `npm run preview` rodando em :4173)
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE || 'http://localhost:4173'
const CHROME = process.env.CHROME || '/usr/bin/google-chrome-stable'

const ROUTES = [
  '/login', '/dashboard', '/clientes', '/clientes/c_veloz', '/funil', '/contratos',
  '/comissoes', '/os', '/os/os_1001', '/estoque', '/financeiro', '/boletos',
  '/contabilidade', '/produtos', '/planos', '/relatorios', '/equipe',
  '/notificacoes', '/auditoria', '/ajuda',
]

const SESSION = JSON.stringify({
  id: 'u_douglas', name: 'Douglas Spessoto', role: 'admin', email: 'douglas@gpsrastreamento.com',
})

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

let totalErrors = 0
const report = []

for (const route of ROUTES) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })
  page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url()))

  // Injeta sessão antes do app carregar.
  await page.evaluateOnNewDocument((s) => {
    try { localStorage.setItem('erp_gps_session', s) } catch (e) { }
  }, SESSION)

  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 20000 })
    await new Promise((r) => setTimeout(r, 350)) // deixa efeitos rodarem
    const rootChildren = await page.evaluate(() => document.getElementById('root')?.children.length || 0)
    if (rootChildren === 0) errors.push('RENDER VAZIO: #root sem filhos (tela em branco)')
  } catch (e) {
    errors.push('NAV: ' + e.message)
  }

  // Ignora ruídos conhecidos (fontes externas, favicon).
  const real = errors.filter((e) =>
    !/fonts\.g(oogleapis|static)/.test(e) &&
    !/favicon/.test(e) &&
    !/Failed to load resource.*404/.test(e))

  totalErrors += real.length
  report.push({ route, ok: real.length === 0, errors: real })
  await page.close()
}

await browser.close()

console.log('\n===== SMOKE TEST =====')
for (const r of report) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.route}`)
  r.errors.forEach((e) => console.log('     ' + e))
}
const failed = report.filter((r) => !r.ok).length
console.log(`\n${report.length - failed}/${report.length} rotas OK · ${totalErrors} erro(s)`)
process.exit(failed ? 1 : 0)
