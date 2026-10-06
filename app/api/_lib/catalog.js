// Turns raw Firestore product docs into customer-safe facts: name, price, bundle
// contents and in/out of stock. cost_price and exact stock counts never leave here.
import { isAvailable } from '../../shared/stock.js'

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Common customer spellings → canonical word, applied before product matching.
const SPELLINGS = [
  [/\bfoam\s*x\b|\bfom\s*x\b|\bfoamex\b|\bfoam\b/g, 'foamx'],
  [/\bs+h?[ae]m+p+o+\b|\bsampu\b|\bshampu\b/g, 'shampoo'],
  [/\btauliya\b|\btaulia\b|\brumal\b|\bmicrofiber\b|\bcloth\b/g, 'towel'],
  [/\bcombos\b|\bkombo\b|\bbundle\b|\bpackage\b|\bset\b/g, 'combo'],
]

export function normalizeForMatch(text) {
  let t = (text || '').toLowerCase()
  for (const [re, to] of SPELLINGS) t = t.replace(re, to)
  return t
}

// Words in a product name that identify it on their own ("hydro", "shampoo").
const GENERIC = new Set(['wash', 'car', 'care', 'the', 'and', 'combo', 'kit', 'pack'])

export function buildCatalog(products) {
  const active = products.filter((p) => p.active !== false)
  const byId = {}
  for (const p of products) byId[p.id] = p
  return active.map((p) => {
    const words = (p.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    const aliases = new Set([norm(p.name)])
    if (p.type !== 'bundle') for (const w of words) if (w.length >= 4 && !GENERIC.has(w)) aliases.add(w)
    // "Clean Wash Combo" is also "clean combo".
    if (p.type === 'bundle' && words.length > 2) aliases.add(norm(`${words[0]} combo`))
    return {
      id: p.id,
      name: p.name,
      type: p.type === 'bundle' ? 'bundle' : 'component',
      price: Number(p.default_selling_price) || 0,
      contents: p.type === 'bundle'
        ? (p.components || []).map((c) => {
            const comp = byId[c.productId]
            const qty = Number(c.qty) || 1
            return comp ? (qty > 1 ? `${qty}× ${comp.name}` : comp.name) : null
          }).filter(Boolean)
        : [],
      in_stock: isAvailable(p, byId),
      aliases: [...aliases],
    }
  }).sort((a, b) => (a.type === b.type ? a.price - b.price : a.type === 'component' ? -1 : 1))
}

/**
 * Products a message refers to. A bare "combo" means every bundle, unless a more
 * specific bundle name ("clean wash combo") also matched.
 */
export function findProducts(text, catalog) {
  const t = normalizeForMatch(text)
  const squashed = norm(t)
  const tokens = new Set(t.split(/[^a-z0-9]+/))
  const hits = catalog.filter((p) =>
    p.aliases.some((a) => (a.length >= 8 ? squashed.includes(a) : tokens.has(a))))
  // "wash combo" is a substring of "clean wash combo" — keep only the longest bundle match.
  const bundleHits = hits.filter((p) => p.type === 'bundle')
  const specific = bundleHits.filter((p) =>
    !bundleHits.some((q) => q !== p && norm(q.name).includes(norm(p.name))))
  const result = hits.filter((p) => p.type !== 'bundle').concat(specific)
  if (!bundleHits.length && tokens.has('combo')) {
    return result.concat(catalog.filter((p) => p.type === 'bundle'))
  }
  return result
}

const rs = (n) => `Rs. ${Number(n).toLocaleString('en-IN')}`

// One-line, customer-facing description of a product in the reply language.
export function describeProduct(p, lang) {
  if (lang === 'ne') {
    const stock = p.in_stock ? 'stock ma cha' : 'ahile stock ma chaina'
    if (p.type === 'bundle') {
      return `${p.name} ma ${joinNe(p.contents)} aaucha, ${rs(p.price)} ma (${stock}).`
    }
    return `${p.name} ko price ${rs(p.price)} ho (${stock}).`
  }
  const stock = p.in_stock ? 'in stock' : 'currently out of stock'
  if (p.type === 'bundle') {
    return `${p.name} includes ${joinEn(p.contents)} for ${rs(p.price)} (${stock}).`
  }
  return `${p.name} is ${rs(p.price)} (${stock}).`
}

const joinNe = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ra ${xs[xs.length - 1]}`)
const joinEn = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// Compact plain-text facts block for the LLM prompt.
export function catalogFacts(items) {
  return items.map((p) => {
    const base = `- ${p.name}: ${rs(p.price)}, ${p.in_stock ? 'in stock' : 'OUT OF STOCK'}`
    return p.type === 'bundle' ? `${base}; contains ${p.contents.join(' + ')}` : base
  }).join('\n')
}
