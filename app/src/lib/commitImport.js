import {
  collection, doc, getDocs, writeBatch, setDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_BUNDLES } from './constants'

// Normalize a product name for matching: lowercase, strip spaces/punctuation.
// So "Foam X" (Inventory sheet) and "FoamX" (derived on an order) both -> "foamx".
const normName = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Resolve a product name (as it appears on an order) to a product id.
// Bundles are matched by name; components by name too.
function buildNameIndex(productDocs) {
  const idx = {}
  for (const p of productDocs) idx[normName(p.name)] = p
  // Aliases the Orders sheet may produce that differ from catalog names.
  const alias = (from, toName) => {
    const target = productDocs.find((p) => normName(p.name) === normName(toName))
    if (target) idx[normName(from)] = target
  }
  alias('Shampoo', 'Car Shampoo')
  return idx
}

/**
 * Commit a previously-built import plan to Firestore.
 * Idempotent for orders: skips any order_no that already exists.
 * Returns a summary of what was written / skipped.
 */
export async function commitImportPlan(plan, fileName) {
  const summary = {
    products: 0, bundles: 0, customers: 0, orders: 0, ordersSkipped: 0,
    expenses: 0, adSpend: 0, settings: false,
  }

  // 1) Settings (single doc)
  if (plan.settings) {
    await setDoc(doc(db, 'settings', 'config'), plan.settings, { merge: true })
    summary.settings = true
  }

  // 2) Component products (with cost/sell back-filled from Sales).
  //    Idempotent: an existing product with the same SKU is reused, not duplicated.
  const productDocs = []
  const existingProducts = []
  {
    const snap = await getDocs(collection(db, 'products'))
    snap.forEach((d) => existingProducts.push({ id: d.id, ...d.data() }))
  }
  const existingBySku = {}
  for (const p of existingProducts) if (p.sku) existingBySku[p.sku] = p
  {
    const batch = writeBatch(db)
    let writes = 0
    for (const p of plan.products) {
      const prior = existingBySku[p.sku]
      if (prior) { productDocs.push(prior); continue }
      const ref = doc(collection(db, 'products'))
      const cost = plan.costByProduct[p.name] || p.cost_price || 0
      const sell = plan.sellByProduct[p.name] || p.default_selling_price || 0
      const data = {
        ...p, cost_price: cost, default_selling_price: sell,
        sold_qty: 0, active: true,
      }
      batch.set(ref, data)
      writes++
      productDocs.push({ id: ref.id, ...data })
    }
    if (writes) await batch.commit()
    summary.products = writes
  }

  // 3) Bundles — reference components by resolving their SKUs to created ids.
  {
    const bySku = {}
    for (const p of productDocs) bySku[p.sku] = p.id
    const batch = writeBatch(db)
    let writes = 0
    for (const b of DEFAULT_BUNDLES) {
      const prior = existingBySku[b.sku]
      if (prior) { productDocs.push(prior); continue }
      const components = b.componentSkus
        .map((c) => ({ productId: bySku[c.sku], qty: c.qty }))
        .filter((c) => c.productId)
      if (!components.length) continue
      const ref = doc(collection(db, 'products'))
      const cost = plan.costByProduct[b.name] || b.cost_price || 0
      const sell = plan.sellByProduct[b.name] || b.default_selling_price || 0
      const data = {
        name: b.name, sku: b.sku, category: b.category, type: 'bundle',
        cost_price: cost, default_selling_price: sell, components, active: true,
      }
      batch.set(ref, data)
      writes++
      productDocs.push({ id: ref.id, ...data })
    }
    if (writes) await batch.commit()
    summary.bundles = writes
  }

  const nameIndex = buildNameIndex(productDocs)

  // 4) Customers — skip ones already stored (matched on phone, else name).
  {
    const seen = new Set()
    const snap = await getDocs(collection(db, 'customers'))
    snap.forEach((d) => {
      const c = d.data()
      seen.add(c.phone ? `p:${c.phone}` : `n:${normName(c.name)}`)
    })
    const batch = writeBatch(db)
    let writes = 0
    for (const c of plan.customers) {
      const key = c.phone ? `p:${c.phone}` : `n:${normName(c.name)}`
      if (seen.has(key)) continue
      seen.add(key)
      const ref = doc(collection(db, 'customers'))
      batch.set(ref, { ...c, created_at: new Date().toISOString() })
      writes++
    }
    if (writes) await batch.commit()
    summary.customers = writes
  }

  // 5) Orders — skip any order_no already present (idempotent re-import).
  const existing = new Set()
  {
    const snap = await getDocs(collection(db, 'orders'))
    snap.forEach((d) => existing.add(d.data().order_no))
  }
  {
    let batch = writeBatch(db)
    let inBatch = 0
    for (const o of plan.orders) {
      if (existing.has(o.order_no)) { summary.ordersSkipped++; continue }
      const product = nameIndex[normName(o.product_name)]
      const ref = doc(collection(db, 'orders'))
      batch.set(ref, {
        order_no: o.order_no,
        order_date: o.order_date,
        customer_name: o.customer_name,
        phone: o.phone,
        address: o.address,
        platform: o.platform,
        product_id: product ? product.id : null,
        product_name: o.product_name,
        product_type: product ? product.type : null,
        quantity: o.quantity,
        selling_price: o.selling_price,
        cost_price_snapshot: product ? (product.cost_price || 0) : 0,
        payment_method: o.payment_method,
        status: o.status,
        notes: o.notes,
        // Imported orders already reflect their outcome in the sheet; we DON'T
        // re-run stock math here. sold_qty on components is recomputed next.
        stock_applied: !['Returned', 'Cancelled'].includes(o.status),
        created_at: o.order_date || new Date().toISOString(),
        status_updated_at: o.order_date || new Date().toISOString(),
        imported: true,
      })
      summary.orders++
      if (++inBatch >= 400) { await batch.commit(); batch = writeBatch(db); inBatch = 0 }
    }
    if (inBatch) await batch.commit()
  }

  // 6) Recompute component sold_qty from all active (selling) orders so the
  //    transaction counter starts life consistent with imported history.
  await recomputeSoldQty(productDocs)

  // 7) Expenses — fingerprinted so a re-import doesn't duplicate rows.
  {
    const fp = (e) => `${e.date}|${normName(e.category)}|${normName(e.description)}|${e.amount}`
    const seen = new Set()
    const snap = await getDocs(collection(db, 'expenses'))
    snap.forEach((d) => seen.add(fp(d.data())))
    const batch = writeBatch(db)
    let writes = 0
    for (const e of plan.expenses) {
      if (seen.has(fp(e))) continue
      seen.add(fp(e))
      batch.set(doc(collection(db, 'expenses')), e)
      writes++
    }
    if (writes) await batch.commit()
    summary.expenses = writes
  }

  // 8) Ad spend — same fingerprint guard.
  {
    const fp = (a) => `${a.date}|${normName(a.platform)}|${normName(a.campaign)}|${a.amount}`
    const seen = new Set()
    const snap = await getDocs(collection(db, 'ad_spend'))
    snap.forEach((d) => seen.add(fp(d.data())))
    const batch = writeBatch(db)
    let writes = 0
    for (const a of plan.adSpend) {
      if (seen.has(fp(a))) continue
      seen.add(fp(a))
      batch.set(doc(collection(db, 'ad_spend')), a)
      writes++
    }
    if (writes) await batch.commit()
    summary.adSpend = writes
  }

  // 9) Order counter — only ever move forward, so a re-import can't hand out
  //    an order number you've already used since the first import.
  {
    const ref = doc(db, 'counters', 'orders')
    const snap = await getDocs(collection(db, 'orders'))
    let maxSeen = Number(plan.maxOrderNo) || 1000
    snap.forEach((d) => {
      const m = /(\d+)/.exec(d.data().order_no || '')
      if (m) maxSeen = Math.max(maxSeen, Number(m[1]))
    })
    await setDoc(ref, { current: maxSeen }, { merge: true })
  }

  // 10) Import log
  await setDoc(doc(db, 'counters', 'import'), {
    fileName, at: new Date().toISOString(), summary,
  }, { merge: true })

  return summary
}

// Recompute each component's sold_qty from live orders (excludes Returned/Cancelled).
async function recomputeSoldQty(productDocs) {
  const componentsById = {}
  for (const p of productDocs) if (p.type === 'component') componentsById[p.id] = { ...p, _sold: 0 }

  const perUnitFor = (product) => {
    if (!product) return {}
    if (product.type === 'bundle') {
      const m = {}
      for (const c of product.components) m[c.productId] = (m[c.productId] || 0) + c.qty
      return m
    }
    return { [product.id]: 1 }
  }
  const byId = {}
  for (const p of productDocs) byId[p.id] = p

  const snap = await getDocs(collection(db, 'orders'))
  snap.forEach((d) => {
    const o = d.data()
    if (['Returned', 'Cancelled'].includes(o.status)) return
    const product = byId[o.product_id]
    const per = perUnitFor(product)
    for (const [cid, q] of Object.entries(per)) {
      if (componentsById[cid]) componentsById[cid]._sold += q * (Number(o.quantity) || 0)
    }
  })

  const batch = writeBatch(db)
  for (const c of Object.values(componentsById)) {
    batch.update(doc(db, 'products', c.id), { sold_qty: c._sold })
  }
  await batch.commit()
}
