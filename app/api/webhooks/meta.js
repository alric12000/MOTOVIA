// Meta webhook for Messenger, Instagram and WhatsApp Cloud API.
//   GET  /api/webhooks/meta  — subscription verification (hub.challenge)
//   POST /api/webhooks/meta  — events; signature checked against the RAW body
//
// Meta wants a fast 200. We validate, answer 200 immediately, and finish the work
// (LLM call + send) with waitUntil, which keeps this invocation alive afterwards.
import { waitUntil } from '@vercel/functions'
import { adminDb } from '../_lib/admin.js'
import { rawBody } from '../_lib/http.js'
import { verifyMetaSignature, normalizeMetaPayload } from '../_lib/meta.js'
import { processInbound } from '../_lib/inbound.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).setHeader('Content-Type', 'text/plain').send(String(challenge))
    }
    return res.status(403).send('Forbidden')
  }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  let raw
  try {
    raw = await rawBody(req)
  } catch (e) {
    console.error('meta webhook: could not read body', e)
    return res.status(400).send('Bad request')
  }
  if (!verifyMetaSignature(raw, req.headers['x-hub-signature-256'], process.env.META_APP_SECRET)) {
    console.warn('meta webhook: invalid signature')
    return res.status(401).send('Invalid signature')
  }

  // From here on Meta always gets 200 — a non-200 only makes it retry the same events.
  let events = []
  try {
    events = normalizeMetaPayload(JSON.parse(raw.toString('utf8')))
  } catch (e) {
    console.error('meta webhook: bad payload', e)
  }
  if (events.length) {
    const db = adminDb()
    // Sequential so two quick messages from one customer are answered in order.
    waitUntil((async () => {
      for (const ev of events) await processInbound(db, ev)
    })())
  }
  return res.status(200).send('EVENT_RECEIVED')
}
