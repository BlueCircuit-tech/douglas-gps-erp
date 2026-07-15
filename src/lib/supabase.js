// ============================================================
// Cliente Supabase (único para o app).
// Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.
// ============================================================
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Erro explícito em dev para não "falhar silenciosamente".
  console.error(
    '[Supabase] Variáveis ausentes. Defina VITE_SUPABASE_URL e ' +
    'VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example).',
  )
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'anon', {
  auth: { persistSession: false },
})

export const supabaseReady = Boolean(url && anonKey)
