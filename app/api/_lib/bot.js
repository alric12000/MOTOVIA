// Server entry point to the reply pipeline: wires Firestore knowledge, the LLM client
// and usage counters (written once per message, after the reply is decided).
import { loadKnowledge } from './knowledge.js'
import { generateReply } from './pipeline.js'
import { completeWithFallback, llmConfigured } from './llm.js'
import { recordUsage } from './usage.js'

function addCounts(into, add) {
  for (const [k, v] of Object.entries(add)) {
    if (v && typeof v === 'object') into[k] = addCounts(into[k] || {}, v)
    else into[k] = (into[k] || 0) + v
  }
  return into
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ text, prevLanguage?, history?, platform?, test? }} input
 */
export async function botReply(db, { text, prevLanguage, history = [], platform, test = false }) {
  const knowledge = await loadKnowledge(db)
  const counts = {}
  const out = await generateReply({
    text, prevLanguage, history, knowledge,
    complete: llmConfigured() ? completeWithFallback : null,
    record: (c) => addCounts(counts, c),
  })
  // LLM requests always count (they use real quota); test runs don't skew inbox stats.
  addCounts(counts, test
    ? { test_replies: 1 }
    : { replies: 1, by_layer: { [out.layer]: 1 }, ...(platform ? { by_platform: { [platform]: 1 } } : {}) })
  await recordUsage(db, counts)
  return out
}
