// detect language → template / LLM (primary → fallback model) → keyword FAQ → "team
// will reply soon" + needs_human. Pure orchestration: data access and the LLM call are
// injected so this can run in tests and in the Test Bot without any platform.
import { detectLanguage, greetingLanguage } from './language.js'
import { selectRelevant, keywordReply } from './faqMatcher.js'
import { buildMessages, checkReply } from './prompt.js'

// layer → sent_by value stored on the outgoing message.
export const SENT_BY = { llm: 'bot', keyword: 'keyword', template: 'template', fallback: 'template' }

/**
 * @param {object} p
 * @param {string} p.text              customer message
 * @param {string} [p.prevLanguage]    conversation language so far
 * @param {Array}  [p.history]         earlier messages [{ direction, text }]
 * @param {object} p.knowledge         from loadKnowledge()
 * @param {Function|null} p.complete   (messages, opts) => { model, check }  (null = LLM off)
 * @param {Function} [p.record]        usage recorder (counts) => void
 */
export async function generateReply({ text, prevLanguage, history = [], knowledge, complete, record = () => {} }) {
  const detection = detectLanguage(text, prevLanguage)
  let lang = detection.language
  const { settings } = knowledge
  const result = (layer, reply, extra = {}) => ({
    language: lang, detection, layer, sent_by: SENT_BY[layer], reply,
    needs_human: layer === 'fallback', ...extra,
  })

  // 1. Pure greeting → template, no LLM call.
  const g = greetingLanguage(text)
  if (g) {
    if (g === 'ne' || prevLanguage === 'ne') lang = 'ne'
    return result('template', lang === 'ne' ? settings.greeting_ne : settings.greeting_en)
  }

  const relevant = selectRelevant(text, knowledge)
  const llmErrors = []

  // Decided without the LLM: a person must answer these, so flag them (an LLM would
  // happily say "the team will confirm" without anyone being told to follow up).
  if (relevant.intents.includes('order_status')) {
    return result('fallback', lang === 'ne' ? settings.fallback_ne : settings.fallback_en,
      { reason: 'question about an existing order' })
  }
  if (relevant.intents.includes('price') && relevant.productsMatched &&
      relevant.products.some((p) => p.price == null)) {
    return result('fallback', lang === 'ne' ? settings.fallback_ne : settings.fallback_en,
      { reason: 'price not set for this product' })
  }

  // 2. LLM: primary → fallback model.
  if (complete) {
    const { messages, facts } = buildMessages({
      text, lang, relevant, history,
      paymentMethods: knowledge.paymentMethods, brandTone: knowledge.brandTone,
    })
    try {
      const { model, check } = await complete(messages, {
        validate: (raw) => checkReply(raw, lang, facts),
        onAttempt: (a) => {
          record({
            llm_requests: 1,
            ...(a.ok ? {} : { llm_errors: 1 }),
            ...(a.status === 429 ? { llm_rate_limited: 1 } : {}),
          })
          if (!a.ok) llmErrors.push(`${a.model}: ${a.error}`)
        },
      })
      if (check.needsHuman) {
        return result('fallback', lang === 'ne' ? settings.fallback_ne : settings.fallback_en,
          { model, reason: 'LLM could not answer from the facts' })
      }
      return result('llm', check.reply, { model, llm_errors: llmErrors })
    } catch {
      // fall through to keyword layer
    }
  }

  // 3. Keyword FAQ matcher.
  const kw = keywordReply(text, lang, knowledge)
  if (kw) return result('keyword', kw, { llm_errors: llmErrors, intents: relevant.intents })

  // 4. Nothing we can answer safely.
  return result('fallback', lang === 'ne' ? settings.fallback_ne : settings.fallback_en,
    { llm_errors: llmErrors, reason: 'no answer in knowledge' })
}
