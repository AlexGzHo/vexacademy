import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  // Manejo defensivo en desarrollo/producción sin exponer secretos
  console.error(
    '[VEX ACADEMY] Error de configuración: faltan las variables de entorno de Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY). Por favor verifica tu archivo .env.local',
  )
}

export const supabase = createClient(supabaseUrl || '', supabasePublishableKey || '', {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export default supabase

