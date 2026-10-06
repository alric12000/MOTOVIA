// Provider-agnostic OpenAI-compatible chat completions over plain fetch.
// Configure with env vars only:
//   LLM_BASE_URL        e.g. https://openrouter.ai/api/v1
//   LLM_API_KEY
//   LLM_MODEL           e.g. google/gemma-4-31b-it:free
//   LLM_FALLBACK_MODEL  optional, tried on any error / 429 / invalid output
//   LLM_REASONING_EFFORT optional, e.g. "none" for Gemini 3.x "thinking" models — otherwise
//                       hidden reasoning eats max_tokens and the reply comes back cut off
//   LLM_FALLBACK_REASONING_EFFORT  same, for the fallback model (some reject "none")

const TIMEOUT_MS = 20_000
// Replies are asked to stay under 60 words; the headroom is for light model reasoning.
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 400

export class LlmError extends Error {
  constructor(message, { status, model } = {}) { super(message); this.status = status; this.model = model }
}

export function llmModels() {
  return [process.env.LLM_MODEL, process.env.LLM_FALLBACK_MODEL].filter(Boolean)
}
export const llmConfigured = () => Boolean(process.env.LLM_API_KEY && llmModels().length)

async function callOnce(model, messages, reasoningEffort) {
  const base = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
  }
  // Optional attribution headers OpenRouter asks for; other providers don't need them.
  if (base.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = process.env.APP_URL || 'https://motovia.app'
    headers['X-Title'] = 'MotoviaNepal Inbox'
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model, messages, max_tokens: MAX_TOKENS, temperature: 0.3,
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.error) {
      const msg = body.error?.message || `HTTP ${res.status}`
      throw new LlmError(msg, { status: res.status === 200 ? body.error?.code : res.status, model })
    }
    const choice = body.choices?.[0]
    // A reply cut off by the token limit is never safe to send to a customer.
    if (choice?.finish_reason === 'length') throw new LlmError('reply cut off (max_tokens)', { model })
    const content = choice?.message?.content
    const text = Array.isArray(content) ? content.map((p) => p.text || '').join('') : content
    return text || ''
  } catch (e) {
    if (e instanceof LlmError) throw e
    throw new LlmError(e.name === 'AbortError' ? 'timeout' : e.message, { model })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Try LLM_MODEL then LLM_FALLBACK_MODEL. `validate(text)` returns
 * { ok, reason } — invalid output also falls through to the next model.
 * `onAttempt({ model, ok, status, error })` is called for usage stats.
 */
export async function completeWithFallback(messages, { validate, onAttempt = () => {} }) {
  const errors = []
  for (const model of llmModels()) {
    try {
      const effort = model === process.env.LLM_MODEL
        ? process.env.LLM_REASONING_EFFORT
        : process.env.LLM_FALLBACK_REASONING_EFFORT
      const text = await callOnce(model, messages, effort)
      const check = validate(text)
      onAttempt({ model, ok: check.ok, error: check.ok ? null : check.reason })
      if (check.ok) return { model, check }
      errors.push(`${model}: ${check.reason}`)
    } catch (e) {
      onAttempt({ model, ok: false, status: e.status, error: e.message })
      errors.push(`${model}: ${e.message}`)
    }
  }
  throw new LlmError(errors.join(' | ') || 'no model configured')
}
