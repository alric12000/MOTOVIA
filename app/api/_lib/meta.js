// Meta webhook helpers: signature check + normalising Messenger / Instagram / WhatsApp
// payloads into one shape:
//   { platform, externalUserId, accountId, messageId, text, isText, timestamp, customerName? }
import crypto from 'node:crypto'

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body). */
export function verifyMetaSignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const given = header.slice('sha256='.length)
  if (given.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'))
}

function fromMessaging(platform, entry) {
  const out = []
  for (const ev of entry.messaging || []) {
    const msg = ev.message
    if (!msg || msg.is_echo) continue // our own replies / page posts
    if (!ev.sender?.id || ev.sender.id === entry.id) continue // sent by the page/IG account itself
    if (msg.is_deleted || msg.is_unsupported) continue
    const text = (msg.text || '').trim()
    out.push({
      platform,
      externalUserId: ev.sender.id,
      accountId: ev.recipient?.id || entry.id,
      messageId: msg.mid,
      text: text || (msg.attachments?.length ? `[${msg.attachments[0].type || 'attachment'}]` : '[unsupported message]'),
      isText: Boolean(text),
      timestamp: Number(ev.timestamp) || Date.now(),
    })
  }
  return out
}

function fromWhatsApp(entry) {
  const out = []
  for (const change of entry.changes || []) {
    const v = change.value || {}
    if (change.field !== 'messages' || !Array.isArray(v.messages)) continue // statuses etc.
    const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]))
    for (const m of v.messages) {
      const text = m.type === 'text' ? (m.text?.body || '').trim()
        : m.type === 'button' ? (m.button?.text || '').trim()
        : m.type === 'interactive' ? (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '').trim()
        : ''
      out.push({
        platform: 'whatsapp',
        externalUserId: m.from,
        accountId: v.metadata?.phone_number_id,
        messageId: m.id,
        text: text || `[${m.type || 'message'}]`,
        isText: Boolean(text),
        timestamp: (Number(m.timestamp) || 0) * 1000 || Date.now(),
        customerName: names[m.from],
      })
    }
  }
  return out
}

export function normalizeMetaPayload(body) {
  const entries = Array.isArray(body?.entry) ? body.entry : []
  const events = []
  for (const entry of entries) {
    if (body.object === 'page') events.push(...fromMessaging('messenger', entry))
    else if (body.object === 'instagram') events.push(...fromMessaging('instagram', entry))
    else if (body.object === 'whatsapp_business_account') events.push(...fromWhatsApp(entry))
  }
  return events.filter((e) => e.messageId && e.externalUserId)
}
