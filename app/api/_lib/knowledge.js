// Loads everything the bot may know: live products, payment methods, FAQs, settings.
// Cached briefly per warm instance so a burst of messages costs a handful of reads.
import { buildCatalog } from './catalog.js'
import { DEFAULT_KNOWLEDGE, DEFAULT_BOT_SETTINGS } from '../../shared/botDefaults.js'

const TTL_MS = 30_000
let cache = null

export async function loadKnowledge(db, { fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value

  const [productsSnap, configSnap, knowledgeSnap, settingsSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('settings').doc('config').get(),
    db.collection('bot').doc('knowledge').get(),
    db.collection('bot').doc('settings').get(),
  ])
  const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const knowledge = { ...DEFAULT_KNOWLEDGE, ...(knowledgeSnap.exists ? knowledgeSnap.data() : {}) }

  const value = {
    catalog: buildCatalog(products),
    paymentMethods: (configSnap.exists && configSnap.data().payment_methods) || [],
    faqs: knowledge.faqs || [],
    brandTone: knowledge.brand_tone || '',
    settings: { ...DEFAULT_BOT_SETTINGS, ...(settingsSnap.exists ? settingsSnap.data() : {}) },
  }
  cache = { at: Date.now(), value }
  return value
}
