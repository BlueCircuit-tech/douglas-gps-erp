// Teste de interação: login multi-perfil, gating por permissão e fluxo de criação.
import puppeteer from 'puppeteer-core'
const BASE = process.env.BASE || 'http://localhost:4173'
const CHROME = process.env.CHROME || '/usr/bin/google-chrome-stable'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})
const results = []
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); }

async function freshPage() {
  const page = await browser.newPage()
  page.on('pageerror', (e) => results.push({ name: 'pageerror', ok: false, extra: e.message }))
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' })
  await page.evaluate(() => { localStorage.removeItem('erp_gps_session') })
  return page
}

// 1) LOGIN como Técnico → dashboard, e SEM Financeiro no menu (gating de permissão)
{
  const page = await freshPage()
  await page.reload({ waitUntil: 'networkidle0' })
  // clicar no chip "Técnico"
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.role-chip')].find((e) => /Técnico/.test(e.textContent))
    el && el.click()
  })
  await sleep(150)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Entrar')
    b && b.click()
  })
  await sleep(700)
  const url = page.url()
  check('Técnico → /dashboard após login', /\/dashboard$/.test(url), url)
  const menu = await page.evaluate(() => document.querySelector('.sidebar')?.textContent || '')
  check('Técnico vê "Ordens de Serviço" no menu', /Ordens de Serviço/.test(menu))
  check('Técnico NÃO vê "Financeiro" no menu (Tarefa 14)', !/Financeiro/.test(menu))
  // acessar /financeiro direto deve redirecionar (sem crash, sem ficar lá)
  await page.goto(BASE + '/financeiro', { waitUntil: 'networkidle0' })
  await sleep(400)
  check('Técnico bloqueado de /financeiro (redirect)', !/\/financeiro$/.test(page.url()), page.url())
  await page.close()
}

// 2) ADMIN cria um cliente via modal → aparece na lista
{
  const page = await freshPage()
  await page.evaluate(() => localStorage.setItem('erp_gps_session', JSON.stringify({ id: 'u_douglas', name: 'Douglas Ferreira', role: 'admin', email: 'd@x.com' })))
  await page.goto(BASE + '/clientes', { waitUntil: 'networkidle0' })
  await sleep(300)
  const before = await page.evaluate(() => document.querySelectorAll('table.tbl tbody tr').length)
  // abrir modal "Cadastrar Cliente"
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => /Cadastrar Cliente/.test(e.textContent))
    b && b.click()
  })
  await sleep(300)
  const modalOpen = await page.evaluate(() => !!document.querySelector('.modal'))
  check('Modal de cadastro abre', modalOpen)
  // preencher razão social (1º input de texto do modal) e salvar
  await page.evaluate(() => {
    const inp = document.querySelector('.modal-body input[type="text"], .modal-body input:not([type])')
    if (inp) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(inp, 'Cliente Teste Automatizado')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await sleep(150)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.modal button')].find((e) => /Salvar cliente/.test(e.textContent))
    b && b.click()
  })
  await sleep(500)
  const after = await page.evaluate(() => document.querySelectorAll('table.tbl tbody tr').length)
  check('Cliente criado aparece na lista', after === before + 1, `antes=${before} depois=${after}`)
  const hasName = await page.evaluate(() => /Cliente Teste Automatizado/.test(document.body.textContent))
  check('Nome do novo cliente visível', hasName)
  // limpar o cliente de teste do storage para não poluir
  await page.close()
}

await browser.close()
console.log('\n===== INTERACTION TEST =====')
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.extra ? '  ('+r.extra+')' : ''}`)
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks OK`)
process.exit(failed ? 1 : 0)
