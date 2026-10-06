// One inbound customer message, end to end:
//   idempotency marker → store message + conversation → (auto-reply?) → bot reply →
//   send through the platform adapter → store outbound + update conversation.
// Never throws: errors are logged and stored on the conversation.
import crypto from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { FieldValue } from './admin.js'
import { botReply } from './bot.js'
import { loadKnowledge } from './knowledge.js'
import { getAdapter } from './adapters/index.js'
import { recordUsage } from './usage.js'

const hashId = (s) => crypto.createHash('sha1').update(s).digest('hex')
export const conversationId = (platform, externalUserId) =>
  `${platform}_${externalUserId}`.replace(/[^A-Za-z0-9_-]/g, '_')

/** Claim a platform message id. Returns false if it was already processed. */
export async function claimEvent(db, platform, messageId) {
  try {
    await db.collection('processed_events').doc(hashId(`${platform}:${messageId}`)).create({
      platform, message_id: messageId, at: FieldValue.serverTimestamp(),
    })
    return true
  } catch (e) {
    if (e.code === 6 || /already exists/i.test(e.message)) return false
    throw e
  }
}

async function recentHistory(convRef, excludeId) {
  const snap = await convRef.collection('messages').orderBy('created_at', 'desc').limit(7).get()
  return snap.docs.filter((d) => d.id !== excludeId).slice(0, 6).reverse()
    .map((d) => ({ direction: d.data().direction, text: d.data().text }))
}

export async function processInbound(db, ev) {
  const tag = `[${ev.platform} ${ev.messageId}]`
  try {
    if (!(await claimEvent(db, ev.platform, ev.messageId))) {
      console.log(tag, 'duplicate — skipped')
      return { status: 'duplicate' }
    }

    const cid = conversationId(ev.platform, ev.externalUserId)
    const convRef = db.collection('conversations').doc(cid)
    const convSnap = await convRef.get()
    const conv = convSnap.exists ? convSnap.data() : null
    const adapter = getAdapter(ev.platform)

    let customerName = ev.customerName || conv?.customer_name || ''
    if (!customerName && adapter.fetchProfile) {
      customerName = (await adapter.fetchProfile(ev).catch(() => null))?.name || ''
    }

    // Store the inbound message first so the admin sees it even if replying fails.
    const inId = hashId(`${ev.platform}:${ev.messageId}`)
    const inboundAt = Timestamp.fromMillis(ev.timestamp)
    const history = conv ? await recentHistory(convRef, inId) : []
    await convRef.collection('messages').doc(inId).set({
      direction: 'in', text: ev.text, platform_message_id: ev.messageId, created_at: inboundAt,
    })
    await convRef.set({
      platform: ev.platform,
      external_user_id: ev.externalUserId,
      account_id: ev.accountId || conv?.account_id || null,
      customer_name: customerName,
      last_message: ev.text.slice(0, 200),
      last_direction: 'in',
      last_inbound_at: inboundAt,
      unread: true,
      updated_at: FieldValue.serverTimestamp(),
      ...(conv ? {} : { created_at: FieldValue.serverTimestamp(), needs_human: false, auto_reply_paused: false }),
    }, { merge: true })
    await recordUsage(db, { messages_in: 1, in_by_platform: { [ev.platform]: 1 } })

    // Photos, voice notes, stickers… → a person should look.
    if (!ev.isText) {
      await convRef.update({ needs_human: true })
      return { status: 'flagged-non-text' }
    }

    const { settings } = await loadKnowledge(db)
    if (!settings.auto_reply_enabled || conv?.auto_reply_paused || ev.autoReply === false) {
      return { status: 'auto-reply-off' }
    }

    const out = await botReply(db, {
      text: ev.text, prevLanguage: conv?.language, history, platform: ev.platform,
    })
    // Don't repeat "team will reply soon" while the conversation is already waiting for you.
    if (out.layer === 'fallback' && conv?.needs_human) {
      await convRef.update({ language: out.language })
      return { status: 'already-waiting-for-human' }
    }
    // Public channels (TikTok comments): only post real answers, never greetings or
    // "team will reply" — those would just be noise under the video.
    if (adapter.publicReplies && (out.layer === 'template' || out.layer === 'fallback')) {
      await convRef.update({ language: out.language, ...(out.needs_human ? { needs_human: true } : {}) })
      return { status: 'public-no-answer' }
    }

    const sent = await adapter.send({ ...ev, text: out.reply })
    await convRef.collection('messages').add({
      direction: 'out', text: out.reply, language: out.language, sent_by: out.sent_by,
      layer: out.layer, model: out.model || null, platform_message_id: sent.messageId || null,
      created_at: Timestamp.now(),
    })
    await convRef.update({
      language: out.language,
      needs_human: Boolean(conv?.needs_human || out.needs_human),
      last_message: out.reply.slice(0, 200),
      last_direction: 'out',
      last_layer: out.layer,
      last_error: FieldValue.delete(),
      updated_at: FieldValue.serverTimestamp(),
    })
    return { status: 'replied', layer: out.layer }
  } catch (e) {
    console.error(tag, 'processing failed', e)
    try {
      await db.collection('conversations').doc(conversationId(ev.platform, ev.externalUserId)).set({
        needs_human: true, last_error: String(e.message || e).slice(0, 300),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true })
      await recordUsage(db, { send_errors: 1 })
    } catch (e2) {
      console.error(tag, 'could not record failure', e2)
    }
    return { status: 'error', error: e.message }
  }
}
