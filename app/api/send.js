// POST /api/send  { conversationId, text }   (admin ID token required)
// Manual reply from the Inbox. Respects each platform's free-reply window.
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, FieldValue } from './_lib/admin.js'
import { requireAdmin, sendError, HttpError } from './_lib/http.js'
import { getAdapter, withinReplyWindow } from './_lib/adapters/index.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST only')
    await requireAdmin(req)
    const { conversationId, text } = req.body || {}
    const msg = typeof text === 'string' ? text.trim() : ''
    if (!conversationId || !msg) throw new HttpError(400, 'conversationId and text are required')
    if (msg.length > 2000) throw new HttpError(400, 'Message too long (max 2000 characters)')

    const db = adminDb()
    const convRef = db.collection('conversations').doc(String(conversationId))
    const snap = await convRef.get()
    if (!snap.exists) throw new HttpError(404, 'Conversation not found')
    const conv = snap.data()

    if (!withinReplyWindow(conv.platform, conv.last_inbound_at?.toMillis())) {
      throw new HttpError(409, conv.platform === 'whatsapp'
        ? 'More than 24h since the customer\'s last message — WhatsApp only allows approved template messages now.'
        : 'Outside the platform\'s reply window (24h since the customer\'s last message). Reply from the official app instead.')
    }

    let sent
    try {
      sent = await getAdapter(conv.platform).send({
        externalUserId: conv.external_user_id, accountId: conv.account_id, text: msg,
      })
    } catch (e) {
      throw new HttpError(502, `${conv.platform} rejected the message: ${e.message}`)
    }

    await convRef.collection('messages').add({
      direction: 'out', text: msg, language: conv.language || null, sent_by: 'admin', layer: 'admin',
      platform_message_id: sent.messageId || null, created_at: Timestamp.now(),
    })
    // Replying yourself resolves the "needs human" flag.
    await convRef.update({
      needs_human: false, unread: false,
      last_message: msg.slice(0, 200), last_direction: 'out', last_layer: 'admin',
      updated_at: FieldValue.serverTimestamp(),
    })
    res.status(200).json({ ok: true, messageId: sent.messageId || null })
  } catch (e) {
    sendError(res, e)
  }
}
