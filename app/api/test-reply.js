// POST /api/test-reply  { text, prevLanguage?, history? }   (admin ID token required)
// Runs the full reply pipeline without any platform: nothing is sent or stored except
// the daily usage counters.
import { adminDb } from './_lib/admin.js'
import { requireAdmin, sendError, HttpError } from './_lib/http.js'
import { botReply } from './_lib/bot.js'
import { llmConfigured, llmModels } from './_lib/llm.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST only')
    await requireAdmin(req)
    const { text, prevLanguage, history } = req.body || {}
    if (!text || typeof text !== 'string' || text.length > 2000) throw new HttpError(400, 'text required (max 2000 chars)')
    const started = Date.now()
    const out = await botReply(adminDb(), {
      text, prevLanguage, history: Array.isArray(history) ? history.slice(-6) : [], test: true,
    })
    res.status(200).json({
      ...out, ms: Date.now() - started,
      llm: { configured: llmConfigured(), models: llmModels() },
    })
  } catch (e) {
    sendError(res, e)
  }
}
