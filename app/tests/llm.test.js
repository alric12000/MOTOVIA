import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completeWithFallback, llmProviders } from '../api/_lib/llm.js'

const ENV = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_REASONING_EFFORT', 'LLM_FALLBACK_MODEL',
  'LLM_FALLBACK_BASE_URL', 'LLM_FALLBACK_API_KEY', 'LLM_FALLBACK_REASONING_EFFORT']
function withEnv(vars, fn) {
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
  for (const k of ENV) delete process.env[k]
  Object.assign(process.env, vars)
  return Promise.resolve(fn()).finally(() => {
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  })
}

test('fallback uses its own provider, key and reasoning setting', async () => {
  await withEnv({
    LLM_BASE_URL: 'https://gemini.example/v1', LLM_API_KEY: 'g-key', LLM_MODEL: 'gemini-x', LLM_REASONING_EFFORT: 'none',
    LLM_FALLBACK_MODEL: 'nemo:free', LLM_FALLBACK_BASE_URL: 'https://openrouter.ai/api/v1', LLM_FALLBACK_API_KEY: 'or-key',
  }, async () => {
    const calls = []
    const realFetch = globalThis.fetch
    globalThis.fetch = async (url, opts) => {
      const body = JSON.parse(opts.body)
      calls.push({ url, auth: opts.headers.Authorization, model: body.model, effort: body.reasoning_effort })
      if (body.model === 'gemini-x') return new Response(JSON.stringify([{ error: { code: 429, message: 'quota' } }]), { status: 429 })
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'ok reply' } }] }))
    }
    try {
      const r = await completeWithFallback([], { validate: (t) => ({ ok: true, reply: t }) })
      assert.equal(r.model, 'nemo:free')
    } finally { globalThis.fetch = realFetch }
    assert.deepEqual(calls, [
      { url: 'https://gemini.example/v1/chat/completions', auth: 'Bearer g-key', model: 'gemini-x', effort: 'none' },
      { url: 'https://openrouter.ai/api/v1/chat/completions', auth: 'Bearer or-key', model: 'nemo:free', effort: undefined },
    ])
  })
})

test('fallback defaults to the primary provider; models without a key are skipped', async () => {
  await withEnv({ LLM_BASE_URL: 'https://x/v1', LLM_API_KEY: 'k', LLM_MODEL: 'a', LLM_FALLBACK_MODEL: 'b' }, () => {
    assert.deepEqual(llmProviders().map((p) => [p.model, p.baseUrl, p.apiKey]), [['a', 'https://x/v1', 'k'], ['b', 'https://x/v1', 'k']])
  })
  await withEnv({ LLM_MODEL: 'a', LLM_FALLBACK_MODEL: 'b', LLM_FALLBACK_API_KEY: 'or' }, () => {
    assert.deepEqual(llmProviders().map((p) => p.model), ['b'])
  })
})
