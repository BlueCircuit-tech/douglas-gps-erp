import { useState, useEffect, useCallback, useRef } from 'react'
import { api, clientsApi, fornecedoresApi, ordensApi, setCache } from '../data/api.js'
import { META } from '../data/seed.js'

// Função de listagem por coleção (usa mapeadores relacionais quando preciso).
const LISTERS = {
  clients: () => clientsApi.list(),
  fornecedores: () => fornecedoresApi.list(),
  ordens: () => ordensApi.list(),
}
const listOf = (coll) => LISTERS[coll] || (() => api[coll].list())

// Busca várias coleções e devolve um objeto { db, loading, error, refetch }
// com o mesmo formato do store antigo (db.clients, db.users, ...).
export function useCollections(names) {
  const key = names.join(',')
  const fetcher = useCallback(async () => {
    const results = await Promise.all(names.map((n) => listOf(n)()))
    const db = { meta: META }
    names.forEach((n, i) => { db[n] = results[i]; setCache(n, results[i]) })
    return db
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const { data, loading, error, refetch } = useQuery(fetcher, [key])
  return { db: data || {}, loading, error, refetch }
}

export function useQuery(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const mounted = useRef(true)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fetcherRef.current()
      if (mounted.current) setState({ data, loading: false, error: null })
    } catch (e) {
      if (mounted.current) setState({ data: null, loading: false, error: e })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  return { ...state, refetch: load }
}
