// Run with: npm test   (Node's built-in test runner — no extra dependencies)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLanguage, greetingLanguage } from '../api/_lib/language.js'
import { buildCatalog, findProducts } from '../api/_lib/catalog.js'
import { detectIntents, keywordReply } from '../api/_lib/faqMatcher.js'
import { maskPII } from '../api/_lib/mask.js'
import { DEFAULT_KNOWLEDGE } from '../shared/botDefaults.js'

const lang = (t, prev) => detectLanguage(t, prev).language

test('Devanagari → ne', () => {
  for (const t of ['फोमएक्स कति हो?', 'डेलिभरी कति दिनमा हुन्छ', 'नमस्ते', 'combo मा के के आउँछ?']) {
    assert.equal(lang(t), 'ne', t)
  }
})

test('Romanized Nepali → ne', () => {
  for (const t of [
    'foamx kati ho?', 'combo ma k k aaucha?', 'delivery kati din lagcha?',
    'cod hunchha?', 'malai wash combo chahiyo', 'yo stock ma cha?',
    'esewa bata pay garna milcha?', 'Pokhara ma delivery garnuhuncha?',
    'katti ho dai', 'towel ko price k ho',
  ]) assert.equal(lang(t), 'ne', t)
})

test('English → en', () => {
  for (const t of [
    'How much is FoamX?', 'What is included in the wash combo?',
    'How many days does delivery take?', 'Do you accept eSewa?',
    'Is the towel in stock?', 'Can I return it if it is damaged?',
    'I want to order the clean wash combo please',
  ]) assert.equal(lang(t), 'en', t)
})

test('Mixed Nepali/English → ne', () => {
  for (const t of [
    'Hi, FoamX ko price kati ho?', 'Is the combo available? kati parcha',
    'delivery charge kati ho for Pokhara', 'I want foamx, kasari order garne?',
  ]) assert.equal(lang(t), 'ne', t)
})

test('No signal → keeps previous language, defaults to en', () => {
  assert.equal(lang('FoamX?'), 'en')
  assert.equal(lang('FoamX?', 'ne'), 'ne')
  assert.equal(lang('1499 👍', 'ne'), 'ne')
})

test('greetings are recognised without an LLM call', () => {
  assert.equal(greetingLanguage('hi'), 'en')
  assert.equal(greetingLanguage('Hello!'), 'en')
  assert.equal(greetingLanguage('namaste 🙏'), 'ne')
  assert.equal(greetingLanguage('नमस्ते'), 'ne')
  assert.equal(greetingLanguage('hi dai'), 'ne')
  assert.equal(greetingLanguage('hi foamx kati ho'), null)
})

// --- Catalog / keyword layer -------------------------------------------------

const PRODUCTS = [
  { id: 's', name: 'Hydro Wash Shampoo', type: 'component', default_selling_price: 359, cost_price: 150, opening_stock: 10, restocked_qty: 0, sold_qty: 3 },
  { id: 'f', name: 'FoamX', type: 'component', default_selling_price: 1499, cost_price: 600, opening_stock: 5, restocked_qty: 0, sold_qty: 1 },
  { id: 't', name: 'Towel', type: 'component', default_selling_price: 499, cost_price: 150, opening_stock: 0, restocked_qty: 0, sold_qty: 0 },
  { id: 'wc', name: 'Wash Combo', type: 'bundle', default_selling_price: 1859, cost_price: 750, components: [{ productId: 's', qty: 1 }, { productId: 'f', qty: 1 }] },
  { id: 'cwc', name: 'Clean Wash Combo', type: 'bundle', default_selling_price: 2199, cost_price: 900, components: [{ productId: 's', qty: 1 }, { productId: 'f', qty: 1 }, { productId: 't', qty: 1 }] },
]
const catalog = buildCatalog(PRODUCTS)
const kb = { catalog, faqs: DEFAULT_KNOWLEDGE.faqs, paymentMethods: ['COD', 'eSewa', 'Khalti'] }
const names = (t) => findProducts(t, catalog).map((p) => p.name).sort()

test('catalog never exposes cost price or stock counts; bundles follow component stock', () => {
  const json = JSON.stringify(catalog)
  assert.ok(!json.includes('cost_price') && !json.includes('600') && !json.includes('opening'))
  const by = Object.fromEntries(catalog.map((p) => [p.name, p]))
  assert.equal(by['Wash Combo'].in_stock, true)
  assert.equal(by['Clean Wash Combo'].in_stock, false) // Towel is out of stock
  assert.deepEqual(by['Clean Wash Combo'].contents, ['Hydro Wash Shampoo', 'FoamX', 'Towel'])
})

test('product matching handles spellings and combos', () => {
  assert.deepEqual(names('foam x kati'), ['FoamX'])
  assert.deepEqual(names('sampoo ko rate'), ['Hydro Wash Shampoo'])
  assert.deepEqual(names('clean wash combo'), ['Clean Wash Combo'])
  assert.deepEqual(names('wash combo price'), ['Wash Combo'])
  assert.deepEqual(names('combo ma k k aaucha'), ['Clean Wash Combo', 'Wash Combo'])
})

test('intents', () => {
  assert.ok(detectIntents('foamx kati ho?').includes('price'))
  assert.deepEqual(detectIntents('delivery kati din lagcha?'), ['delivery_time'])
  assert.ok(detectIntents('Pokhara delivery charge kati').includes('delivery_charge'))
  assert.ok(detectIntents('cod hunchha?').includes('payment'))
  assert.ok(detectIntents('combo ma k k aaucha?').includes('contents'))
  assert.ok(detectIntents('exchange garna milcha?').includes('returns'))
})

test('keyword replies', () => {
  assert.equal(keywordReply('foamx kati ho?', 'ne', kb), 'FoamX ko price Rs. 1,499 ho (stock ma cha).')
  assert.match(keywordReply('How much is FoamX?', 'en', kb), /FoamX is Rs\. 1,499 \(in stock\)/)
  assert.match(keywordReply('combo ma k k aaucha?', 'ne', kb), /Wash Combo ma Hydro Wash Shampoo ra FoamX aaucha/)
  assert.match(keywordReply('delivery kati din lagcha?', 'ne', kb), /1–2 din/)
  assert.match(keywordReply('cod or esewa?', 'en', kb), /COD, eSewa, Khalti/)
  assert.equal(keywordReply('do you sell car wax?', 'en', kb), null)
})

test('PII masking', () => {
  assert.equal(maskPII('mero number 9812345678 ho'), 'mero number [phone] ho')
  assert.equal(maskPII('call +977-9801234567'), 'call [phone]')
  assert.equal(maskPII('address: Baneshwor-10, Kathmandu'), 'address [address]')
  assert.equal(maskPII('mail me at a.b@gmail.com'), 'mail me at [email]')
  assert.equal(maskPII('Pokhara ma delivery kati?'), 'Pokhara ma delivery kati?')
})

test('unpriced products: no "Rs. 0", price questions handed to a human', () => {
  const cat = buildCatalog([{ id: 'x', name: 'Foam X', type: 'component', default_selling_price: 0, opening_stock: 3, sold_qty: 0 }])
  const k = { catalog: cat, faqs: DEFAULT_KNOWLEDGE.faqs, paymentMethods: [] }
  assert.equal(cat[0].price, null)
  assert.equal(keywordReply('foam x kati ho?', 'ne', k), null)
  assert.equal(keywordReply('is foam x in stock?', 'en', k), 'Foam X is in stock.')
})

test('order status goes to a human; usage questions get usage tips', () => {
  assert.ok(detectIntents('mero aghi ko order kaha pugyo?').includes('order_status'))
  assert.ok(!detectIntents('mero aghi ko order kaha pugyo?').includes('how_to_order'))
  assert.equal(keywordReply('mero aghi ko order kaha pugyo?', 'ne', kb), null)
  assert.equal(keywordReply('where is my order?', 'en', kb), null)
  assert.match(keywordReply('How do I use FoamX?', 'en', kb), /foam sprayer/)
})
