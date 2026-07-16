const digits = (v) => String(v || '').replace(/\D/g, '')

// CEP -> { cep, logradouro, bairro, cidade, uf } | null
export async function buscarCep(cepRaw) {
  const cep = digits(cepRaw)
  if (cep.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    if (!r.ok) return null
    const d = await r.json()
    if (d.erro) return null
    return {
      cep,
      logradouro: d.logradouro || '',
      bairro: d.bairro || '',
      cidade: d.localidade || '',
      uf: d.uf || '',
    }
  } catch {
    return null
  }
}

// CNPJ -> { razaoSocial, nomeFantasia, endereco:{...}, email, telefone } | null
export async function buscarCnpj(cnpjRaw) {
  const cnpj = digits(cnpjRaw)
  if (cnpj.length !== 14) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
    if (!r.ok) return null
    const d = await r.json()
    return {
      razaoSocial: d.razao_social || '',
      nomeFantasia: d.nome_fantasia || '',
      email: d.email || '',
      telefone: d.ddd_telefone_1 || '',
      endereco: {
        cep: digits(d.cep),
        logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ').trim(),
        numero: d.numero || '',
        bairro: d.bairro || '',
        cidade: d.municipio || '',
        uf: d.uf || '',
      },
    }
  } catch {
    return null
  }
}
