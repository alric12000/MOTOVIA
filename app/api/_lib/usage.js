// Daily counters in bot_usage/{YYYY-MM-DD} (Nepal time), shown on the Inbox stats card.
import { FieldValue } from './admin.js'

export const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date())

/**
 * Increment counters. `counts` may be flat ({ llm_requests: 1 }) or one level nested
 * ({ by_layer: { keyword: 1 } }). Never throws — usage stats must not break replies.
 */
export async function recordUsage(db, counts) {
  try {
    const data = { date: todayKey(), updated_at: FieldValue.serverTimestamp() }
    for (const [k, v] of Object.entries(counts)) {
      if (v && typeof v === 'object') {
        data[k] = {}
        for (const [k2, v2] of Object.entries(v)) data[k][k2] = FieldValue.increment(v2)
      } else {
        data[k] = FieldValue.increment(v)
      }
    }
    await db.collection('bot_usage').doc(todayKey()).set(data, { merge: true })
  } catch (e) {
    console.error('recordUsage failed', e)
  }
}
