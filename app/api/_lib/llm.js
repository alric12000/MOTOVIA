// Provider-agnostic OpenAI-compatible chat completions over plain fetch.
// Configure with env vars only:
//   LLM_BASE_URL        e.g. https://generativelanguage.googleapis.com/v1beta/openai
//   LLM_API_KEY
//   LLM_MODEL           e.g. gemini-3.5-flash
//   LLM_REASONING_EFFORT optional, e.g. "none" for "thinking" models — otherwise hidden
//                       reasoning eats max_tokens and the reply comes back cut off
//   LLM_FALLBACK_MODEL  optional, tried on any error / 429 / invalid output
//   LLM_FALLBACK_BASE_URL / LLM_FALLBACK_API_KEY  optional; default to the primary's, so
//                       the fallback can live on another provider with its own free quota
//   LLM_FALLBACK_REASONING_EFFORT  same as above, for the fallback model

const TIMEOUT_MS = 20_000
// Replies are asked to stay under 60 words; the headroom is for light model reasoning.
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 400

export class LlmError extends Error {
  constructor(message, { status, model } = {}) { super(message); this.status = status; this.model = model }
}

/** Configured providers in order: primary, then fallback. */
export function llmProviders() {
  const env = process.env
  const primary = {
    model: env.LLM_MODEL,
    baseUrl: env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: env.LLM_API_KEY,
    reasoningEffort: env.LLM_REASONING_EFFORT,
  }
  const fallback = {
    model: env.LLM_FALLBACK_MODEL,
    baseUrl: env.LLM_FALLBACK_BASE_URL || primary.baseUrl,
    apiKey: env.LLM_FALLBACK_API_KEY || primary.apiKey,
    reasoningEffort: env.LLM_FALLBACK_REASONING_EFFORT,
  }
  return [primary, fallback].filter((p) => p.model && p.apiKey)
}
export const llmModels = () => llmProviders().map((p) => p.model)
export const llmConfigured = () => llmProviders().length > 0

async function callOnce({ model, baseUrl, apiKey, reasoningEffort }, messages) {
  const base = baseUrl.replace(/\/+$/, '')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
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
    // Gemini's OpenAI endpoint wraps errors in an array.
    const err = Array.isArray(body) ? body[0]?.error : body.error
    if (!res.ok || err) {
      throw new LlmError(err?.message || `HTTP ${res.status}`, { status: res.status === 200 ? err?.code : res.status, model })
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
 * Try the primary model, then the fallback. `validate(text)` returns
 * { ok, reason } — invalid output also falls through to the next model.
 * `onAttempt({ model, ok, status, error })` is called for usage stats.
 */
export async function completeWithFallback(messages, { validate, onAttempt = () => {} }) {
  const errors = []
  for (const provider of llmProviders()) {
    const { model } = provider
    try {
      const text = await callOnce(provider, messages)
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
