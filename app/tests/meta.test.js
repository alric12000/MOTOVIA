import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { verifyMetaSignature, normalizeMetaPayload } from '../api/_lib/meta.js'
import { withinReplyWindow } from '../api/_lib/adapters/index.js'
import handler from '../api/webhooks/meta.js'

const SECRET = 'test-secret'
const sign = (buf) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(buf).digest('hex')

test('signature check uses the raw bytes', () => {
  const raw = Buffer.from('{"object":"page","entry":[]}')
  assert.equal(verifyMetaSignature(raw, sign(raw), SECRET), true)
  assert.equal(verifyMetaSignature(Buffer.from('{"object": "page","entry":[]}'), sign(raw), SECRET), false)
  assert.equal(verifyMetaSignature(raw, 'sha256=00', SECRET), false)
  assert.equal(verifyMetaSignature(raw, undefined, SECRET), false)
  assert.equal(verifyMetaSignature(raw, sign(raw), ''), false)
})

test('Messenger: echoes and page-sent messages are ignored', () => {
  const events = normalizeMetaPayload({
    object: 'page',
    entry: [{ id: 'PAGE', messaging: [
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, timestamp: 1, message: { mid: 'm1', text: 'foamx kati?' } },
      { sender: { id: 'PAGE' }, recipient: { id: 'U1' }, timestamp: 2, message: { mid: 'm2', text: 'reply', is_echo: true } },
      { sender: { id: 'PAGE' }, recipient: { id: 'U1' }, timestamp: 3, message: { mid: 'm3', text: 'from page' } },
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, timestamp: 4, message: { mid: 'm4', attachments: [{ type: 'image' }] } },
      { sender: { id: 'U1' }, recipient: { id: 'PAGE' }, timestamp: 5, read: { watermark: 1 } },
    ] }],
  })
  assert.deepEqual(events.map((e) => [e.platform, e.messageId, e.text, e.isText]), [
    ['messenger', 'm1', 'foamx kati?', true],
    ['messenger', 'm4', '[image]', false],
  ])
})

test('Instagram payload', () => {
  const [e] = normalizeMetaPayload({
    object: 'instagram',
    entry: [{ id: 'IG', messaging: [{ sender: { id: 'IGU' }, recipient: { id: 'IG' }, timestamp: 9, message: { mid: 'ig1', text: 'price?' } }] }],
  })
  assert.equal(e.platform, 'instagram'); assert.equal(e.accountId, 'IG'); assert.equal(e.externalUserId, 'IGU')
})

test('WhatsApp: messages parsed with contact name, statuses ignored', () => {
  const events = normalizeMetaPayload({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [
      { field: 'messages', value: {
        metadata: { phone_number_id: 'PN1' },
        contacts: [{ wa_id: '9779800000000', profile: { name: 'Ram' } }],
        messages: [{ from: '9779800000000', id: 'wamid.1', timestamp: '1700000000', type: 'text', text: { body: 'combo ma k k aaucha?' } }],
      } },
      { field: 'messages', value: { metadata: { phone_number_id: 'PN1' }, statuses: [{ id: 'wamid.0', status: 'read' }] } },
    ] }],
  })
  assert.equal(events.length, 1)
  assert.equal(events[0].customerName, 'Ram'); assert.equal(events[0].accountId, 'PN1')
  assert.equal(events[0].timestamp, 1700000000000)
})

test('24h reply window', () => {
  const now = Date.now()
  assert.equal(withinReplyWindow('messenger', now - 23 * 3600e3, now), true)
  assert.equal(withinReplyWindow('whatsapp', now - 25 * 3600e3, now), false)
})

// --- handler (no Firestore needed for these paths) ---
function mockRes() {
  const res = { statusCode: 0, body: undefined, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.setHeader = (k, v) => { res.headers[k] = v; return res }
  res.send = (b) => { res.body = b; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

test('GET verification echoes hub.challenge only with the right token', async () => {
  process.env.META_VERIFY_TOKEN = 'verify-me'
  const ok = mockRes()
  await handler({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '12345' }, headers: {} }, ok)
  assert.equal(ok.statusCode, 200); assert.equal(ok.body, '12345')
  const bad = mockRes()
  await handler({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' }, headers: {} }, bad)
  assert.equal(bad.statusCode, 403)
})

test('POST with bad signature is rejected; valid signature with no messages → 200', async () => {
  process.env.META_APP_SECRET = SECRET
  const raw = Buffer.from(JSON.stringify({ object: 'page', entry: [] }))
  const req = (sig) => Object.assign(Readable.from([raw]), { method: 'POST', headers: { 'x-hub-signature-256': sig } })
  const bad = mockRes(); await handler(req('sha256=deadbeef'), bad)
  assert.equal(bad.statusCode, 401)
  const ok = mockRes(); await handler(req(sign(raw)), ok)
  assert.equal(ok.statusCode, 200)
})
