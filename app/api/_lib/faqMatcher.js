// Keyword-based intent matching. Used two ways:
//  1. to pick which products/FAQs go into the LLM prompt (saves tokens), and
//  2. as the no-LLM fallback layer that answers from ready-made text.
import { findProducts, describeProduct, normalizeForMatch } from './catalog.js'

// Patterns tolerate common Romanized Nepali spellings (kati/katti, k ho/ke ho, din/dina…).
const INTENTS = {
  price: /\b(kati|katti|price|prices|rate|rates|paisa|parcha|parchha|parxa|cost|costs|mol|k ho|ke ho|how much|dam|daam)\b|\brs\.?\s*\?/,
  contents: /\b(k k|ke ke|kk|k-k|ke k|kun kun|what(?:'s| is)? (?:in|inside)|includes?|including|contains?|comes? with)\b/,
  delivery_time: /\b(kati din|katti din|how (?:many|long)|kahile|when will|days?|dina?|aaipugcha|aaipugchha|arrive|delivery time)\b/,
  delivery_charge: /\b(delivery|deliver|shipping|ship|charge|charges|dhuwani|pathauna|pathaunu|outside valley|bahira)\b/,
  payment: /\b(cod|cash on delivery|esewa|e-sewa|khalti|fonepay|payment|pay|bank|transfer|qr)\b/,
  returns: /\b(return|returns|exchange|refund|firta|fircha|firta garna|change garna|damage|damaged|broken|bigriyo|galat|wrong)\b/,
  usage: /\b(how (?:do|should|can) (?:i|we|you) use|how to use|use garne|use garna|kasari use|kasari chalaune|kasari lagaune|tips?|apply|prayog|method|tarika|steps?)\b/,
  // Questions about an existing order always go to a person.
  order_status: /\b(kaha pugyo|kaha pugeko|kaha pugcha|order status|where is my (?:order|parcel)|track|tracking|aghi ko order|mero order|not received|aayena|aaena|pugena|pugeko chaina)\b/,
  contact: /\b(contact|number|call|phone|hours|timing|open|khulcha|khulchha|baje|office|shop|pasal|location|where are you)\b/,
  how_to_order: /\b(order|kinna|kinne|kinchu|buy|purchase|book|chahiyo|chaiyo|chainchha|chahincha|lina|linchu)\b/,
  stock: /\b(stock|available|availability|paincha|painchha|painxa|pauchha|in stock|milcha|milchha)\b|\b(cha|chha|xa)\s*\?/,
}

// Which bot/knowledge FAQ keys answer which intent.
const INTENT_FAQ = {
  delivery_time: 'delivery_time',
  delivery_charge: 'delivery_charge',
  returns: 'returns',
  usage: 'usage',
  how_to_order: 'how_to_order',
  contact: 'contact',
}

export function detectIntents(text) {
  const t = normalizeForMatch(text)
  const found = Object.keys(INTENTS).filter((k) => INTENTS[k].test(t))
  // "combo ma ... aaucha?" asks what's inside (but "kahile aaucha?" is about delivery).
  if (/\bcombo\b/.test(t) && /\b(aa?u(ch|x)h?a|aaunchha|hunchha)\b/.test(t) && !found.includes('contents')) {
    found.push('contents')
  }
  // "where is my order" is not "how do I order".
  if (found.includes('order_status')) return found.filter((k) => k !== 'how_to_order')
  // "delivery kati din" is a time question, not a charge question.
  if (found.includes('delivery_time') && found.includes('delivery_charge') && !/charge|kati paisa|rs|cost|dhuwani/.test(t)) {
    return found.filter((k) => k !== 'delivery_charge' && k !== 'price')
  }
  return found
}

// Custom FAQs added in the admin UI match on any distinctive word of their label.
function customFaqHits(text, faqs) {
  const t = normalizeForMatch(text)
  return faqs.filter((f) => !Object.values(INTENT_FAQ).includes(f.key)).filter((f) =>
    (f.label || '').toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 4 && t.includes(w)))
}

/**
 * Pick the products and FAQs relevant to a message.
 * Falls back to "everything" when nothing specific matched — the catalog and FAQ
 * list are small, so that's still a short prompt.
 */
export function selectRelevant(text, { catalog, faqs }) {
  const intents = detectIntents(text)
  const products = findProducts(text, catalog)
  const faqKeys = new Set(intents.map((i) => INTENT_FAQ[i]).filter(Boolean))
  const relFaqs = faqs.filter((f) => faqKeys.has(f.key)).concat(customFaqHits(text, faqs))
  return {
    intents,
    products: products.length ? products : catalog,
    productsMatched: products.length > 0,
    faqs: relFaqs.length ? relFaqs : faqs,
    faqsMatched: relFaqs.length > 0,
  }
}

/**
 * Answer from ready-made text only. Returns the reply string, or null when the
 * message isn't confidently covered (→ "team will reply soon" + needs_human).
 */
export function keywordReply(text, lang, { catalog, faqs, paymentMethods }) {
  const intents = detectIntents(text)
  const products = findProducts(text, catalog)
  const parts = []
  const faqText = (key) => {
    const f = faqs.find((x) => x.key === key)
    return f ? (lang === 'ne' ? f.ne || f.en : f.en || f.ne) : null
  }

  if (intents.includes('order_status')) return null
  // Price asked for a product with no price set → let a human answer.
  if (intents.includes('price') && products.some((p) => p.price == null)) return null

  const productQ = intents.some((i) => ['price', 'contents', 'stock'].includes(i))
  if (productQ || (products.length && !intents.length)) {
    const list = products.length ? products : (intents.includes('contents')
      ? catalog.filter((p) => p.type === 'bundle')
      : intents.includes('price') ? catalog : [])
    for (const p of list) parts.push(describeProduct(p, lang))
  }
  if (intents.includes('payment') && paymentMethods.length) {
    parts.push(lang === 'ne'
      ? `Payment ${paymentMethods.join(', ')} bata garna milcha.`
      : `You can pay by ${paymentMethods.join(', ')}.`)
  }
  for (const intent of Object.keys(INTENT_FAQ)) {
    if (intents.includes(intent)) {
      const a = faqText(INTENT_FAQ[intent])
      if (a) parts.push(a)
    }
  }
  for (const f of customFaqHits(text, faqs)) {
    const a = lang === 'ne' ? f.ne || f.en : f.en || f.ne
    if (a) parts.push(a)
  }

  const unique = [...new Set(parts)]
  return unique.length ? unique.slice(0, 4).join(' ') : null
}
