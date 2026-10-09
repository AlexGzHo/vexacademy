import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import type { AppRole, AuthContextType } from '../types/index.ts'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<AppRole | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [roleLoading, setRoleLoading] = useState<boolean>(false)

  const [isPaymentReviewer, setIsPaymentReviewer] = useState<boolean>(false)

  // Referencia para evitar condiciones de carrera entre cambios rápidos de sesión
  const activeUserIdRef = useRef<string | null>(null)

  const fetchUserRole = useCallback(async (userId: string) => {
    setRoleLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()

      // Consultar también si es encargado de pago en public.payment_reviewers
      const { data: reviewerData } = await supabase
        .from('payment_reviewers')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()

      // Si el usuario cambió mientras la consulta estaba en vuelo, descartar el resultado
      if (activeUserIdRef.current !== userId) {
        return
      }

      if (error) {
        console.error('[AuthContext] Error al consultar rol en user_roles:', error.message)
        setRole(null)
        setIsPaymentReviewer(false)
        return
      }

      const userRole = data?.role === 'admin' || data?.role === 'student' ? data.role : null
      setRole(userRole)
      setIsPaymentReviewer(userRole === 'admin' || Boolean(reviewerData))
    } catch (err) {
      console.error('[AuthContext] Excepción inesperada al cargar rol:', err)
      if (activeUserIdRef.current === userId) {
        setRole(null)
        setIsPaymentReviewer(false)
      }
    } finally {
      if (activeUserIdRef.current === userId) {
        setRoleLoading(false)
      }
    }
  }, [])


  useEffect(() => {
    // 1. Suscribirse a los cambios de estado de autenticación de Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      const currentUser = currentSession?.user ?? null
      activeUserIdRef.current = currentUser?.id ?? null

      setSession(currentSession)
      setUser(currentUser)

      if (currentUser) {
        // Iniciar carga del rol sin bloquear el callback síncrono del listener
        void fetchUserRole(currentUser.id)
      } else {
        // Al cerrar sesión o ante ausencia de usuario, limpiar inmediatamente estado y rol
        setRole(null)
        setRoleLoading(false)
      }

      // Finalizar la carga inicial en el primer evento (INITIAL_SESSION u otro)
      setLoading(false)

      if (event === 'SIGNED_OUT') {
        activeUserIdRef.current = null
        setRole(null)
        setRoleLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserRole])

  const refreshRole = useCallback(async () => {
    if (user?.id) {
      await fetchUserRole(user.id)
    }
  }, [user, fetchUserRole])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        return { error }
      }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Error al iniciar sesión') }
    }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      try {
        const redirectUrl = `${window.location.origin}/auth/confirm`

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: redirectUrl,
          },
        })

        if (error) {
          return { error, needsEmailConfirmation: false }
        }

        // Si Supabase requiere confirmación de email, el usuario se crea pero no hay sesión activa inmediata
        const needsEmailConfirmation = Boolean(data.user && !data.session)

        return { error: null, needsEmailConfirmation }
      } catch (err) {
        return {
          error: err instanceof Error ? err : new Error('Error al registrar usuario'),
          needsEmailConfirmation: false,
        }
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    activeUserIdRef.current = null
    setUser(null)
    setSession(null)
    setRole(null)
    setIsPaymentReviewer(false)
    setRoleLoading(false)
    await supabase.auth.signOut()
  }, [])

  const value: AuthContextType = useMemo(
    () => ({
      user,
      session,
      role,
      isPaymentReviewer,
      loading,
      roleLoading,
      signIn,
      signUp,
      signOut,
      refreshRole,
    }),
    [user, session, role, isPaymentReviewer, loading, roleLoading, signIn, signUp, signOut, refreshRole],
  )


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider')
  }
  return context
}
