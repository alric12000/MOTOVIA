// TikTok API for Business (Accounts API) — organic video comments.
//
// What TikTok allows (Oct 2026, see docs/SOCIAL_SETUP.md):
//  - Comments on your own videos: list + reply via /business/comment/*, with a
//    comment.update webhook. This is what we automate.
//  - DMs: the Business Messaging API is an approval-gated open beta (not EEA/CH/UK),
//    user must message first, 48h reply window. Not implemented — see adapters/tiktok.js.
//
// The webhook tells us a comment changed but not its text or author, so we fetch it.
import crypto from 'node:crypto'

const API = 'https://business-api.tiktok.com/open_api/v1.3'

/**
 * TikTok-Signature: "t=<unix seconds>,s=<hex>" where s = HMAC-SHA256(secret, `${t}.${rawBody}`).
 * Rejects signatures older than 5 minutes (replay protection).
 */
export function verifyTikTokSignature(rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !header) return false
  const parts = Object.fromEntries(String(header).split(',').map((kv) => kv.trim().split('=')))
  const t = Number(parts.t)
  if (!t || !parts.s || Math.abs(nowSec - t) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex')
  if (parts.s.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(parts.s, 'hex'), Buffer.from(expected, 'hex'))
}

// IDs are 19 digits — quote them before JSON.parse so they don't lose precision.
export const parseJsonKeepingBigIds = (text) =>
  JSON.parse(text.replace(/("[a-z_]*id"\s*:\s*)(\d{16,})/gi, '$1"$2"'))

/**
 * Pull { commentId, videoId } references out of a webhook body. Defensive about shape:
 * `content` may be a JSON string or object, and fields may be comment_id / item_id.
 */
export function commentRefsFromWebhook(body) {
  const events = Array.isArray(body) ? body : [body]
  const refs = []
  for (const ev of events) {
    if (!ev) continue
    const type = String(ev.event || ev.event_type || ev.type || '').toLowerCase()
    if (type && !type.includes('comment')) continue
    let c = ev.content ?? ev.data ?? ev
    if (typeof c === 'string') { try { c = parseJsonKeepingBigIds(c) } catch { continue } }
    const action = String(c.action || c.status || c.event_action || 'insert').toLowerCase()
    if (/(delete|hide|private)/.test(action)) continue
    const commentId = c.comment_id ?? c.reply_id
    const videoId = c.video_id ?? c.item_id
    if (commentId && videoId) refs.push({ commentId: String(commentId), videoId: String(videoId) })
  }
  return refs
}

async function call(path, { method = 'GET', query, body }) {
  const token = process.env.TIKTOK_ACCESS_TOKEN
  if (!token) throw new Error('TIKTOK_ACCESS_TOKEN is not set')
  const url = new URL(`${API}${path}`)
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  const res = await fetch(url, {
    method,
    headers: { 'Access-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const data = parseJsonKeepingBigIds(await res.text())
  if (!res.ok || (data.code && data.code !== 0)) {
    throw new Error(`TikTok ${path}: ${data.message || `HTTP ${res.status}`} (code ${data.code})`)
  }
  return data.data || {}
}

const businessId = () => {
  const id = process.env.TIKTOK_BUSINESS_ID
  if (!id) throw new Error('TIKTOK_BUSINESS_ID is not set')
  return id
}

/** Fetch one comment. Returns null if it no longer exists. */
export async function fetchComment({ videoId, commentId }) {
  const data = await call('/business/comment/list/', {
    query: { business_id: businessId(), video_id: videoId, comment_ids: [commentId] },
  })
  return (data.comments || []).find((c) => String(c.comment_id) === commentId) || null
}

export async function replyToComment({ videoId, commentId, text }) {
  const data = await call('/business/comment/reply/create/', {
    method: 'POST',
    body: { business_id: businessId(), video_id: videoId, comment_id: commentId, text },
  })
  return { messageId: data.comment_id ? String(data.comment_id) : null }
}
