// TikTok comment webhook: POST /api/webhooks/tiktok
// Verifies TikTok-Signature on the raw body, answers 200 right away, then fetches each
// changed comment (the webhook carries no text/author) and runs the normal inbound flow.
// Auto-replies are posted only when TIKTOK_REPLY_TO_COMMENTS=true; otherwise comments
// are just collected in the Inbox.
import { waitUntil } from '@vercel/functions'
import { adminDb } from '../_lib/admin.js'
import { rawBody } from '../_lib/http.js'
import { verifyTikTokSignature, commentRefsFromWebhook, parseJsonKeepingBigIds, fetchComment } from '../_lib/tiktok.js'
import { processInbound } from '../_lib/inbound.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok') // TikTok's URL check
  let raw
  try {
    raw = await rawBody(req)
  } catch {
    return res.status(400).send('Bad request')
  }
  if (!verifyTikTokSignature(raw, req.headers['tiktok-signature'], process.env.TIKTOK_APP_SECRET)) {
    console.warn('tiktok webhook: invalid signature')
    return res.status(401).send('Invalid signature')
  }

  let refs = []
  try {
    refs = commentRefsFromWebhook(parseJsonKeepingBigIds(raw.toString('utf8')))
  } catch (e) {
    console.error('tiktok webhook: bad payload', e)
  }
  if (refs.length) {
    const db = adminDb()
    waitUntil((async () => {
      for (const ref of refs) {
        try {
          const c = await fetchComment(ref)
          if (!c || c.owner === true || c.owner === 'true') continue // gone, or our own reply
          const text = (c.text || '').trim()
          // Replies go under the top-level comment so the thread stays together.
          const threadId = String(c.parent_comment_id && c.parent_comment_id !== '0' ? c.parent_comment_id : ref.commentId)
          await processInbound(db, {
            platform: 'tiktok',
            externalUserId: `${ref.videoId}:${threadId}`,
            accountId: process.env.TIKTOK_BUSINESS_ID,
            messageId: ref.commentId,
            text: text || '[comment]',
            isText: Boolean(text),
            timestamp: (Number(c.create_time) || 0) * 1000 || Date.now(),
            customerName: c.display_name || (c.username ? `@${c.username}` : ''),
            autoReply: process.env.TIKTOK_REPLY_TO_COMMENTS === 'true',
          })
        } catch (e) {
          console.error('tiktok webhook: comment failed', ref, e)
        }
      }
    })())
  }
  return res.status(200).send('ok')
}
