import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { verifyTikTokSignature, commentRefsFromWebhook, parseJsonKeepingBigIds } from '../api/_lib/tiktok.js'

const SECRET = 'tt-secret'
const header = (raw, t) => `t=${t},s=${crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')}`

test('TikTok signature: valid, tampered, stale', () => {
  const raw = Buffer.from('{"event":"comment.update"}')
  const now = 1_800_000_000
  assert.equal(verifyTikTokSignature(raw, header(raw, now), SECRET, now), true)
  assert.equal(verifyTikTokSignature(Buffer.from('{}'), header(raw, now), SECRET, now), false)
  assert.equal(verifyTikTokSignature(raw, header(raw, now - 600), SECRET, now), false)
  assert.equal(verifyTikTokSignature(raw, undefined, SECRET, now), false)
})

test('19-digit ids keep their precision', () => {
  const o = parseJsonKeepingBigIds('{"comment_id": 7312345678901234567, "count": 3}')
  assert.equal(o.comment_id, '7312345678901234567'); assert.equal(o.count, 3)
})

test('comment refs from webhook bodies (string or object content), deletes skipped', () => {
  assert.deepEqual(commentRefsFromWebhook({
    event: 'comment.update',
    content: '{"comment_id": 7312345678901234567, "video_id": 7300000000000000001, "action": "insert"}',
  }), [{ commentId: '7312345678901234567', videoId: '7300000000000000001' }])
  assert.deepEqual(commentRefsFromWebhook({ event: 'comment.update', content: { comment_id: '1', item_id: '2', action: 'delete' } }), [])
  assert.deepEqual(commentRefsFromWebhook({ event: 'video.publish', content: { comment_id: '1', video_id: '2' } }), [])
})
