import { useCallback, useEffect, useState } from 'react'
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Send,
  ExternalLink,
  Lock,
  Clock
} from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../../context/AuthContext.tsx'
import type { PaymentRequest, PaymentReviewer } from '../../types/index.ts'

export function PaymentManagement() {
  const { role } = useAuth()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [reviewers, setReviewers] = useState<PaymentReviewer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal de Comprobante Firmado
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null)
  const [loadingProof, setLoadingProof] = useState(false)

  // Diálogo de Rechazo
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processingAction, setProcessingAction] = useState(false)

  // Sub-panel de gestión de encargados
  const [showReviewersModal, setShowReviewersModal] = useState(false)
  const [newReviewerUserId, setNewReviewerUserId] = useState('')
  const [reviewerActionLoading, setReviewerActionLoading] = useState(false)

  // Test de Notificación de Telegram
  const [sendingTestTelegram, setSendingTestTelegram] = useState(false)
  const [telegramTestStatus, setTelegramTestStatus] = useState<string | null>(null)

  const loadPaymentRequests = useCallback(async (isInitial = false) => {
    try {
      if (!isInitial) {
        setLoading(true)
      }
      setError(null)

      // Cargar solicitudes con join de cursos
      const { data, error: fetchErr } = await supabase
        .from('payment_requests')
        .select(`
          *,
          course:courses (
            id,
            title,
            price_pen
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      const paymentRequests = data || []
      const userIds = Array.from(new Set(paymentRequests.map((r: any) => r.user_id)))
      
      let profilesMap: Record<string, any> = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds)
          
        if (profilesData) {
          profilesData.forEach((p: any) => {
            profilesMap[p.id] = p
          })
        }
      }

      const combinedData = paymentRequests.map((r: any) => ({
        ...r,
        profile: profilesMap[r.user_id] || null
      }))

      setRequests(combinedData as PaymentRequest[])

      // Si es admin, cargar también la lista de encargados designados
      if (role === 'admin') {
        const { data: revData } = await supabase
          .from('payment_reviewers')
          .select('*')
          
        if (revData && revData.length > 0) {
          const revUserIds = revData.map((r: any) => r.user_id)
          const { data: revProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', revUserIds)
            
          const revProfilesMap: Record<string, any> = {}
          if (revProfiles) {
            revProfiles.forEach((p: any) => {
              revProfilesMap[p.id] = p
            })
          }
          
          const combinedRevData = revData.map((r: any) => ({
            ...r,
            profile: revProfilesMap[r.user_id] || null
          }))
          
          setReviewers(combinedRevData as PaymentReviewer[])
        } else {
          setReviewers([])
        }
      }
    } catch (err: any) {
      console.error('Error al cargar solicitudes de pago:', err)
      setError(err.message || 'Error al conectar con la base de datos de pagos.')
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    loadPaymentRequests(true)

    // Suscripción Realtime a cambios en payment_requests (Mantiene la lista sincronizada sin duplicar avisos)
    const channel = supabase
      .channel('admin_payment_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as PaymentRequest
            const { data, error: fetchErr } = await supabase
              .from('payment_requests')
              .select(`
                *,
                course:courses (
                  id,
                  title,
                  price_pen
                )
              `)
              .eq('id', newRecord.id)
              .single()

            if (!fetchErr && data) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', newRecord.user_id)
                .single()

              const fullData = {
                ...data,
                profile: profileData || null
              } as PaymentRequest

              setRequests((prev) => {
                if (prev.some((item) => item.id === fullData.id)) return prev
                return [fullData, ...prev]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedRecord = payload.new as PaymentRequest
            setRequests((prev) =>
              prev.map((item) => {
                if (item.id === updatedRecord.id) {
                  return {
                    ...item,
                    ...updatedRecord,
                    course: item.course,
                    profile: item.profile,
                  }
                }
                return item
              })
            )
          } else if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { id: string }
            setRequests((prev) => prev.filter((item) => item.id !== oldRecord.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadPaymentRequests])

  // Abrir comprobante privado mediante URL firmada de 15 minutos
  const handleViewProof = async (proofUrlPath: string) => {
    try {
      setLoadingProof(true)
      setSelectedProofUrl(proofUrlPath)

      const { data, error: signErr } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(proofUrlPath, 900) // 15 minutos de validez

      if (signErr) throw signErr

      setSignedImageUrl(data.signedUrl)
    } catch (err: any) {
      console.error('Error al generar URL firmada para comprobante:', err)
      alert(err.message || 'No fue posible abrir el comprobante encriptado.')
      setSelectedProofUrl(null)
    } finally {
      setLoadingProof(false)
    }
  }

  // Aprobar pago atómicamente
  const handleApprove = async (request: PaymentRequest) => {
    const confirmed = confirm(
      `¿Confirmas la recepción efectiva del dinero por S/ ${Number(request.amount_pen).toFixed(2)} PEN en ${request.payment_method.toUpperCase()} para el curso "${request.course?.title}"?\n\nEsta acción matriculará al estudiante atómicamente.`
    )
    if (!confirmed) return

    try {
      setProcessingAction(true)

      const { error: rpcErr } = await supabase.rpc('approve_payment_request', {
        p_request_id: request.id,
      })

      if (rpcErr) throw rpcErr

      // Invocar Edge Function de Telegram para notificar al grupo
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const authToken = sessionData.session?.access_token

        if (authToken) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              event_type: 'payment_approved',
              request_id: request.id,
              course_title: request.course?.title,
              amount_pen: request.amount_pen,
              payment_method: request.payment_method,
            }),
          }).catch((err) => console.warn('Aviso Telegram diferido:', err))
        }
      } catch (tgErr) {
        console.warn('Excepción invocando Telegram:', tgErr)
      }

      await loadPaymentRequests()
    } catch (err: any) {
      console.error('Error aprobando solicitud:', err)
      alert(err.message || 'Error al procesar la aprobación del pago.')
    } finally {
      setProcessingAction(false)
    }
  }

  // Rechazar pago
  const handleConfirmReject = async () => {
    if (!rejectingRequestId) return
    if (!rejectionReason.trim()) {
      alert('Por favor especifica la razón del rechazo.')
      return
    }

    const request = requests.find((r) => r.id === rejectingRequestId)

    try {
      setProcessingAction(true)

      const { error: rpcErr } = await supabase.rpc('reject_payment_request', {
        p_request_id: rejectingRequestId,
        p_reason: rejectionReason.trim(),
      })

      if (rpcErr) throw rpcErr

      // Notificar rechazo a Telegram
      if (request) {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const authToken = sessionData.session?.access_token

          if (authToken) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                event_type: 'payment_rejected',
                request_id: request.id,
                course_title: request.course?.title,
                amount_pen: request.amount_pen,
                payment_method: request.payment_method,
                reason: rejectionReason.trim(),
              }),
            }).catch((err) => console.warn('Aviso Telegram diferido:', err))
          }
        } catch (tgErr) {
          console.warn('Excepción invocando Telegram:', tgErr)
        }
      }

      setRejectingRequestId(null)
      setRejectionReason('')
      await loadPaymentRequests()
    } catch (err: any) {
      console.error('Error al rechazar pago:', err)
      alert(err.message || 'Error al rechazar la solicitud.')
    } finally {
      setProcessingAction(false)
    }
  }

  // Designar / Revocar encargados (Solo Admin)
  const handleManageReviewer = async (targetUserId: string, action: 'add' | 'remove') => {
    try {
      setReviewerActionLoading(true)

      const { error: rpcErr } = await supabase.rpc('manage_payment_reviewer', {
        p_target_user_id: targetUserId,
        p_action: action,
      })

      if (rpcErr) throw rpcErr

      if (action === 'add') setNewReviewerUserId('')
      await loadPaymentRequests()
    } catch (err: any) {
      console.error('Error al administrar encargado de pago:', err)
      alert(err.message || 'Error al cambiar permisos de encargado.')
    } finally {
      setReviewerActionLoading(false)
    }
  }

  // Probar notificación a Telegram
  const handleSendTestTelegram = async () => {
    try {
      setSendingTestTelegram(true)
      setTelegramTestStatus(null)

      const { data: sessionData } = await supabase.auth.getSession()
      const authToken = sessionData.session?.access_token

      if (!authToken) {
        throw new Error('No hay sesión activa para probar la Edge Function.')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            event_type: 'test_notification',
            message: 'Comprobación de conectividad iniciada por el administrador en VEX ACADEMY.',
          }),
        }
      )

      const json = await response.json()

      if (response.ok && json.success) {
        setTelegramTestStatus('✅ Notificación de prueba enviada con éxito al grupo de Telegram.')
      } else {
        setTelegramTestStatus(
          `⚠️ Error (${response.status}): ${json.error || json.telegram_error || 'Falló la entrega'}`
        )
      }
    } catch (err: any) {
      console.error('Error enviando notificación de prueba:', err)
      setTelegramTestStatus(`❌ Excepción: ${err.message}`)
    } finally {
      setSendingTestTelegram(false)
    }
  }

  // Filtrado de solicitudes
  const filteredRequests = requests.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter

    const studentName = r.profile?.full_name?.toLowerCase() || ''
    const courseTitle = r.course?.title?.toLowerCase() || ''
    const requestId = r.id.toLowerCase()

    const matchSearch =
      studentName.includes(searchTerm.toLowerCase()) ||
      courseTitle.includes(searchTerm.toLowerCase()) ||
      requestId.includes(searchTerm.toLowerCase())

    return matchStatus && matchSearch
  })

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  return (
    <div className="space-y-6">
      {/* Encabezado y acciones de gestión */}
      <div className="admin-actions-bar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="kpi-icon-box bg-primary-soft">
            <CreditCard size={22} className="text-primary" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
              Gestión de Pagos Manuales (Yape / Plin)
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Revisión delegada, comprobantes privados y notificaciones automáticas a Telegram.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowReviewersModal(true)}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <UserCheck size={16} />
              Encargados ({reviewers.length})
            </button>
          )}

          <button
            type="button"
            onClick={handleSendTestTelegram}
            disabled={sendingTestTelegram}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {sendingTestTelegram ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Probar Telegram
          </button>

          <button
            type="button"
            onClick={() => loadPaymentRequests(false)}
            className="btn-secondary"
            title="Recargar solicitudes"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Alerta de estado de prueba de Telegram */}
      {telegramTestStatus && (
        <div
          className="auth-alert"
          style={{
            background: telegramTestStatus.startsWith('✅') ? '#f0fdf4' : '#fff1f2',
            border: `1px solid ${telegramTestStatus.startsWith('✅') ? '#bbf7d0' : '#fecdd3'}`,
            color: telegramTestStatus.startsWith('✅') ? '#166534' : '#991b1b',
          }}
        >
          <span style={{ fontSize: '0.875rem' }}>{telegramTestStatus}</span>
        </div>
      )}

      {/* Tarjetas de Métricas de Pagos */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <Clock size={20} className="text-warning" />
          <div className="stat-info">
            <span className="stat-number">{pendingCount}</span>
            <span className="stat-label">Pendientes de Revisión</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <CheckCircle size={20} className="text-success" />
          <div className="stat-info">
            <span className="stat-number">{approvedCount}</span>
            <span className="stat-label">Aprobados y Matriculados</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <XCircle size={20} className="text-danger" />
          <div className="stat-info">
            <span className="stat-number">{rejectedCount}</span>
            <span className="stat-label">Rechazados</span>
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="admin-actions-bar">
        <div className="admin-search-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por estudiante, curso o ID de solicitud..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="admin-filters-wrap">
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`btn-xs ${statusFilter === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Pendientes ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`btn-xs ${statusFilter === 'approved' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Aprobados
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('rejected')}
              className={`btn-xs ${statusFilter === 'rejected' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Rechazados
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`btn-xs ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Todos
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de solicitudes */}
      {loading ? (
        <div className="catalog-loading-state">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p>Cargando lista de pagos reportados...</p>
        </div>
      ) : error ? (
        <div className="auth-alert error-alert">
          <AlertCircle size={20} className="alert-icon" />
          <div>{error}</div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="placeholder-box" style={{ padding: '3.5rem 1.5rem' }}>
          <CreditCard size={48} className="text-muted" style={{ margin: '0 auto 1rem' }} />
          <h3>No se encontraron solicitudes de pago</h3>
          <p>
            {searchTerm || statusFilter !== 'all'
              ? 'Prueba modificando tus filtros o términos de búsqueda.'
              : 'No hay reportes de pago registrados actualmente.'}
          </p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Curso</th>
                <th>Método / Importe</th>
                <th>Fecha de Reporte</th>
                <th>Estado</th>
                <th>Comprobante</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr key={req.id}>
                  <td>
                    <div>
                      <strong>{req.profile?.full_name || 'Estudiante VEX'}</strong>
                      <div className="table-slug" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        ID: {req.user_id.slice(0, 8)}...
                      </div>
                    </div>
                  </td>

                  <td>
                    <strong>{req.course?.title || 'Curso'}</strong>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        className="badge"
                        style={{
                          background: req.payment_method === 'yape' ? '#71277a' : '#00a4e4',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                        }}
                      >
                        {req.payment_method.toUpperCase()}
                      </span>
                      <strong style={{ fontSize: '0.95rem' }}>S/ {Number(req.amount_pen).toFixed(2)}</strong>
                    </div>
                  </td>

                  <td>
                    <span style={{ fontSize: '0.85rem' }}>
                      {new Date(req.created_at).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>

                  <td>
                    {req.status === 'pending' && (
                      <span className="badge badge-preview" style={{ background: '#fef3c7', color: '#92400e' }}>
                        Pendiente
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span className="badge badge-preview" style={{ background: '#dcfce7', color: '#166534' }}>
                        Aprobado
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="badge badge-preview" style={{ background: '#ffe4e6', color: '#9f1239' }}>
                        Rechazado
                      </span>
                    )}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => handleViewProof(req.proof_url)}
                      className="btn-secondary btn-xs"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Eye size={14} />
                      Ver Captura
                    </button>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    {req.status === 'pending' ? (
                      <div className="table-actions-group" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => handleApprove(req)}
                          disabled={processingAction}
                          className="btn-primary btn-xs"
                          style={{ background: '#16a34a', borderColor: '#16a34a' }}
                          title="Aprobar pago y matricular al estudiante"
                        >
                          <CheckCircle size={14} style={{ marginRight: '4px' }} />
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingRequestId(req.id)}
                          disabled={processingAction}
                          className="btn-secondary btn-xs"
                          style={{ color: '#dc2626' }}
                          title="Rechazar solicitud con motivo"
                        >
                          <XCircle size={14} style={{ marginRight: '4px' }} />
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {req.processed_at ? new Date(req.processed_at).toLocaleDateString('es-PE') : 'Procesado'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Comprobante Firmado */}
      {selectedProofUrl && (
        <div className="modal-backdrop" onClick={() => setSelectedProofUrl(null)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock className="text-success" size={20} />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Comprobante Privado Protegido</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedProofUrl(null)}>
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              {loadingProof ? (
                <div style={{ padding: '2rem' }}>
                  <Loader2 size={32} className="animate-spin text-primary" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '0.5rem', color: '#64748b' }}>Generando enlace seguro de acceso...</p>
                </div>
              ) : signedImageUrl ? (
                <div>
                  <img
                    src={signedImageUrl}
                    alt="Comprobante de pago"
                    style={{
                      maxHeight: '450px',
                      maxWidth: '100%',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      objectFit: 'contain',
                      margin: '0 auto',
                    }}
                  />
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                    <a
                      href={signedImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary btn-sm"
                    >
                      <ExternalLink size={14} style={{ marginRight: '4px' }} />
                      Abrir en pestaña completa
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-danger">No fue posible cargar el comprobante.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Motivo de Rechazo */}
      {rejectingRequestId && (
        <div className="modal-backdrop" onClick={() => setRejectingRequestId(null)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#dc2626' }}>Indicar motivo de rechazo</h3>
              <button type="button" className="modal-close-btn" onClick={() => setRejectingRequestId(null)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                Explica brevemente la razón por la cual se rechaza el comprobante (ej: "No figura el abono en la cuenta", "Comprobante ilegible", "Monto incompleto").
              </p>

              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Escribe la razón aquí..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                }}
              />

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setRejectingRequestId(null)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={processingAction || !rejectionReason.trim()}
                  className="btn-primary"
                  style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
                >
                  {processingAction ? 'Guardando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-panel Modal para Designar Encargados de Pago (Solo Admin) */}
      {showReviewersModal && (
        <div className="modal-backdrop" onClick={() => setShowReviewersModal(false)}>
          <div className="modal-content" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck className="text-primary" size={22} />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Designar Encargados de Revisión de Pagos</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowReviewersModal(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                Los encargados de pagos pueden aprobar y rechazar comprobantes Yape/Plin sin tener privilegios de administración de cursos ni acceso a configuraciones sensibles del sistema.
              </p>

              {/* Agregar nuevo encargado */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                  Asignar por ID de Usuario (UUID):
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Ingrese el UUID de auth.users..."
                    value={newReviewerUserId}
                    onChange={(e) => setNewReviewerUserId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleManageReviewer(newReviewerUserId.trim(), 'add')}
                    disabled={reviewerActionLoading || !newReviewerUserId.trim()}
                    className="btn-primary btn-sm"
                  >
                    Asignar
                  </button>
                </div>
              </div>

              {/* Lista actual de encargados */}
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem' }}>Encargados Autorizados Actualmente:</h4>
                {reviewers.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    No hay encargados adicionales. Solo los administradores principales pueden revisar pagos.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {reviewers.map((rev) => (
                      <div
                        key={rev.user_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          background: '#f1f5f9',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div>
                          <strong>{rev.profile?.full_name || 'Encargado de Pagos'}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{rev.user_id}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleManageReviewer(rev.user_id, 'remove')}
                          disabled={reviewerActionLoading}
                          className="btn-secondary btn-xs"
                          style={{ color: '#dc2626' }}
                        >
                          Revocar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



