import { useState, useRef } from 'react'
import {
  CreditCard,
  QrCode,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import { brandConfig } from '../../config/brand.ts'
import { useAuth } from '../../context/AuthContext.tsx'
import type { Course, PaymentMethod } from '../../types/index.ts'

interface PaymentRequestModalProps {
  course: Course
  onClose: () => void
  onSuccess?: () => void
}

export function PaymentRequestModal({ course, onClose, onSuccess }: PaymentRequestModalProps) {
  const { user } = useAuth()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('yape')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ requestId: string; amount: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(selected.type)) {
      setError('Formato no válido. Adjunta una imagen JPG, PNG o WEBP de tu comprobante.')
      return
    }

    // Validar tamaño máximo (5MB)
    if (selected.size > 5 * 1024 * 1024) {
      setError('La imagen supera el límite de 5MB. Por favor adjunta un archivo de menor tamaño.')
      return
    }

    setError(null)
    setFile(selected)
    setFilePreview(URL.createObjectURL(selected))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('Debes iniciar sesión para registrar una solicitud de pago.')
      return
    }

    if (!file) {
      setError('Es obligatorio adjuntar la captura o foto del comprobante de Yape o Plin.')
      return
    }

    try {
      setUploading(true)
      setError(null)

      // 1. Subir la imagen al bucket privado 'payment-proofs' bajo la carpeta del estudiante
      const fileExt = file.name.split('.').pop() || 'png'
      const fileName = `${user.id}/${Date.now()}_proof.${fileExt}`

      const { data: storageData, error: storageError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (storageError) {
        console.error('Error al subir comprobante a Supabase Storage:', storageError)
        throw new Error('No se pudo subir la imagen del comprobante. Intenta nuevamente.')
      }

      const proofPath = storageData.path

      // 2. Invocar la función RPC atómica create_payment_request
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_payment_request', {
        p_course_id: course.id,
        p_payment_method: paymentMethod,
        p_proof_url: proofPath,
      })

      if (rpcError) throw rpcError

      const requestId = rpcData?.request_id
      const amountPen = rpcData?.amount_pen || course.price_pen

      // 3. Invocar Edge Function de Telegram (sin fallar el flujo si falla el servicio externo)
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
              event_type: 'payment_submitted',
              request_id: requestId,
              course_title: course.title,
              amount_pen: amountPen,
              payment_method: paymentMethod,
            }),
          }).catch((err) => console.warn('Aviso diferido a Telegram:', err))
        }
      } catch (tgErr) {
        console.warn('Excepción al invocar notificador de Telegram:', tgErr)
      }

      setSuccessData({
        requestId: requestId || 'ENVIADO',
        amount: Number(amountPen),
      })

      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error('Error al procesar solicitud de pago:', err)
      setError(err.message || 'Error al registrar la solicitud de pago.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard className="text-primary" size={22} />
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Pago con Yape / Plin</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: '1rem' }}>
          {successData ? (
            <div className="student-empty-card" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <div className="empty-icon-bubble" style={{ background: '#dcfce7', color: '#166534' }}>
                <CheckCircle size={48} />
              </div>
              <h3 style={{ marginTop: '1rem', color: '#166534' }}>¡Solicitud enviada con éxito!</h3>
              <p style={{ marginTop: '0.5rem', color: '#475569' }}>
                Hemos recibido tu comprobante para el curso <strong>{course.title}</strong> por el monto de{' '}
                <strong>S/ {successData.amount.toFixed(2)} PEN</strong>.
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '8px',
                  margin: '1.25rem 0',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                }}
              >
                <div>ID de Solicitud: <code style={{ fontWeight: 'bold' }}>{successData.requestId}</code></div>
                <div style={{ marginTop: '0.25rem', color: '#64748b' }}>
                  Estado: <span className="badge badge-preview" style={{ background: '#fef3c7', color: '#92400e' }}>Pendiente de Revisión</span>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Un encargado de admisiones verificará tu transferencia y activará tu acceso automáticamente. Puedes consultar el avance en tu panel.
              </p>

              <button
                type="button"
                className="btn-primary btn-lg"
                style={{ width: '100%', marginTop: '1.5rem' }}
                onClick={onClose}
              >
                Entendido, ir al Campus
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Información del curso y monto */}
              <div
                style={{
                  background: 'var(--color-bg)',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    Curso Seleccionado
                  </span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>
                    {course.title}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Inversión</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                    S/ {Number(course.price_pen).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Selector de Método de Pago */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  1. Selecciona la aplicación de pago:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('yape')}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '8px',
                      border: paymentMethod === 'yape' ? '2px solid #71277a' : '1px solid var(--color-border)',
                      background: paymentMethod === 'yape' ? '#fcf4fd' : 'white',
                      fontWeight: 700,
                      color: paymentMethod === 'yape' ? '#71277a' : 'var(--color-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Smartphone size={18} />
                    YAPE
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('plin')}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '8px',
                      border: paymentMethod === 'plin' ? '2px solid #00a4e4' : '1px solid var(--color-border)',
                      background: paymentMethod === 'plin' ? '#f0f9ff' : 'white',
                      fontWeight: 700,
                      color: paymentMethod === 'plin' ? '#00a4e4' : 'var(--color-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Smartphone size={18} />
                    PLIN
                  </button>
                </div>
              </div>

              {/* Datos de cobro de la Academia */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <QrCode size={18} className="text-primary" />
                  <strong style={{ fontSize: '0.9rem' }}>
                    Datos de destino ({paymentMethod.toUpperCase()})
                  </strong>
                </div>
                <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                  <div>Número oficial: <strong>{brandConfig.paymentInfo.yapeNumber}</strong></div>
                  <div>Titular de cuenta: <strong>{brandConfig.paymentInfo.accountHolder}</strong></div>
                  <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>
                    {brandConfig.paymentInfo.instructions}
                  </div>
                </div>
              </div>

              {/* Adjuntar comprobante */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  2. Adjunta la captura o foto del comprobante:
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: filePreview ? '#f8fafc' : 'white',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {filePreview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <img
                        src={filePreview}
                        alt="Vista previa del comprobante"
                        style={{ maxHeight: '140px', borderRadius: '6px', objectFit: 'contain' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                        {file?.name} (Clic para cambiar imagen)
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Upload size={28} className="text-primary" />
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        Selecciona o arrastra la captura del pago
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Formatos soportados: JPG, PNG, WEBP (Máx. 5MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensajes de error */}
              {error && (
                <div className="auth-alert error-alert" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={18} className="alert-icon" />
                  <span style={{ fontSize: '0.875rem' }}>{error}</span>
                </div>
              )}

              {/* Garantía de Seguridad */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                <ShieldCheck size={16} className="text-success" />
                <span>Tus comprobantes son almacenados de forma privada y segura.</span>
              </div>

              {/* Botón de envío */}
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                  disabled={uploading}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={uploading || !file}
                  style={{ flex: 2 }}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" style={{ marginRight: '6px' }} />
                      Enviando comprobante...
                    </>
                  ) : (
                    <>
                      Enviarme comprobante y solicitar matrícula
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

