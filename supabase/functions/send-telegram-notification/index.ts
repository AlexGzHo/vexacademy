// ==============================================================================
// VEX ACADEMY — Edge Function: Notificaciones Telegram para Pagos Yape/Plin
// Archivo: supabase/functions/send-telegram-notification/index.ts
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}



serve(async (req: Request) => {
  // Manejo de CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. Verificación de Autenticación en la invocación del Endpoint
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado. Se requiere cabecera Authorization.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID')

    if (!telegramBotToken || !telegramChatId) {
      console.error('[Telegram Edge Function] Faltan variables TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.')
      return new Response(
        JSON.stringify({
          error: 'Configuración del bot de Telegram incompleta en los secretos del servidor.',
          details: 'Por favor, configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Supabase Secrets.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Validar token de usuario o service_role
    if (token !== supabaseServiceKey) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Token de acceso no válido o expirado.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 2. Procesar la Cola de Notificaciones
    // Solo obtenemos items 'pending' o 'failed' (con menos de 3 intentos)
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('telegram_notification_queue')
      .select('*')
      .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)')
      .order('created_at', { ascending: true })
      .limit(5)

    if (queueError) {
      throw new Error(`Error al leer la cola: ${queueError.message}`)
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No hay notificaciones pendientes en la cola.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://vexacademy.com'
    const adminPanelLink = `${appUrl}/admin`
    const results = []

    for (const item of queueItems) {
      const { id: queue_id, event_type, payload, attempts } = item
      const { course_title, amount_pen, payment_method, request_id, reason, message } = payload

      const methodUpper = (payment_method || 'YAPE').toUpperCase()
      const formattedAmount = amount_pen ? Number(amount_pen).toFixed(2) : '0.00'

      let telegramText = ''
      if (event_type === 'payment_submitted') {
        telegramText = `<b>🔔 NUEVA SOLICITUD DE PAGO YAPE/PLIN</b>\n\n` +
          `📚 <b>Curso:</b> ${course_title || 'Curso VEX'}\n` +
          `💰 <b>Monto:</b> S/ ${formattedAmount} PEN\n` +
          `💳 <b>Método:</b> ${methodUpper}\n` +
          `🆔 <b>ID Solicitud:</b> <code>${request_id || 'N/A'}</code>\n` +
          `📌 <b>Estado:</b> PENDIENTE DE REVISIÓN\n\n` +
          `🔗 <a href="${adminPanelLink}">Revisar en el Panel de Administración</a>`
      } else if (event_type === 'payment_approved') {
        telegramText = `<b>✅ PAGO APROBADO Y ESTUDIANTE MATRICULADO</b>\n\n` +
          `📚 <b>Curso:</b> ${course_title || 'Curso VEX'}\n` +
          `💰 <b>Monto:</b> S/ ${formattedAmount} PEN\n` +
          `💳 <b>Método:</b> ${methodUpper}\n` +
          `🆔 <b>ID Solicitud:</b> <code>${request_id || 'N/A'}</code>\n` +
          `📌 <b>Estado:</b> APROBADO`
      } else if (event_type === 'payment_rejected') {
        telegramText = `<b>❌ PAGO RECHAZADO</b>\n\n` +
          `📚 <b>Curso:</b> ${course_title || 'Curso VEX'}\n` +
          `💰 <b>Monto:</b> S/ ${formattedAmount} PEN\n` +
          `💳 <b>Método:</b> ${methodUpper}\n` +
          `🆔 <b>ID Solicitud:</b> <code>${request_id || 'N/A'}</code>\n` +
          `📝 <b>Motivo:</b> ${reason || 'Comprobante no válido o no verificado.'}\n` +
          `📌 <b>Estado:</b> RECHAZADO`
      } else if (event_type === 'test_notification') {
        telegramText = `<b>🧪 NOTIFICACIÓN DE PRUEBA TELEGRAM</b>\n\n` +
          `Este es un aviso de prueba enviado desde VEX ACADEMY para verificar la integración del Bot de Telegram.\n` +
          `💬 <b>Mensaje:</b> ${message || 'Prueba de conexión exitosa.'}\n` +
          `⏱️ <b>Fecha:</b> ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
      } else {
        continue // Ignorar tipos desconocidos
      }

      const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
      let success = false
      let tgError = null

      try {
        const telegramResponse = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: telegramText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        })
        const responseData = await telegramResponse.json()
        if (telegramResponse.ok && responseData.ok) {
          success = true
        } else {
          tgError = responseData.description || 'Error API Telegram'
        }
      } catch (e: any) {
        tgError = e.message
      }

      if (success) {
        await supabaseAdmin
          .from('telegram_notification_queue')
          .update({ status: 'sent', processed_at: new Date().toISOString(), attempts: attempts + 1, last_error: null })
          .eq('id', queue_id)
        results.push({ queue_id, success: true })
      } else {
        await supabaseAdmin
          .from('telegram_notification_queue')
          .update({ status: 'failed', attempts: attempts + 1, last_error: tgError })
          .eq('id', queue_id)
        results.push({ queue_id, success: false, error: tgError })
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[Telegram Edge Function] Excepción inesperada:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno en la Edge Function.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
