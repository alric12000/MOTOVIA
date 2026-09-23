import {
  doc, collection, runTransaction, serverTimestamp, setDoc, updateDoc
} from 'firebase/firestore'
import { db } from './firebase'
import { NON_SELLING_STATUSES } from './constants'

const ORDER_COUNTER = doc(db, 'counters', 'orders')

// Given a product doc, return [{ ref, qtyPerUnit }] of the COMPONENT products it consumes.
export function componentRefsFor(product) {
  if (!product) return []
  if (product.type === 'bundle' && Array.isArray(product.components)) {
    return product.components.map((c) => ({
      ref: doc(db, 'products', c.productId),
      qtyPerUnit: Number(c.qty) || 0,
    }))
  }
  // A component consumes itself.
  return [{ ref: doc(db, 'products', product.id), qtyPerUnit: 1 }]
}

function computeRemaining(data) {
  return (Number(data.opening_stock) || 0)
    + (Number(data.restocked_qty) || 0)
    - (Number(data.sold_qty) || 0)
}

/**
 * Extract normalized items list from an order object or legacy single product fields.
 */
export function extractOrderItems(order, productsById = {}) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((it) => {
      const p = productsById[it.product_id]
      return {
        product_id: it.product_id || '',
        product_name: p ? p.name : (it.product_name || 'Product'),
        product_type: p ? p.type : (it.product_type || 'component'),
        quantity: Math.max(1, Number(it.quantity) || 1),
        selling_price: Number(it.selling_price) ?? (p ? Number(p.default_selling_price) || 0 : 0),
        cost_price_snapshot: Number(it.cost_price_snapshot) ?? (p ? Number(p.cost_price) || 0 : 0),
      }
    })
  }

  // Legacy single-item order fallback
  const pId = order.product_id
  const p = productsById[pId]
  return [{
    product_id: pId || '',
    product_name: p ? p.name : (order.product_name || 'Product'),
    product_type: p ? p.type : (order.product_type || 'component'),
    quantity: Math.max(1, Number(order.quantity) || 1),
    selling_price: Number(order.selling_price) ?? (p ? Number(p.default_selling_price) || 0 : 0),
    cost_price_snapshot: Number(order.cost_price_snapshot) ?? (p ? Number(p.cost_price) || 0 : 0),
  }]
}

/**
 * Create an order and atomically deduct component stock for all items (including extra products).
 * `order` can contain `items: [...]` or single product fields.
 */
export async function createOrderWithStock(order, productsById = {}) {
  const items = extractOrderItems(order, productsById)

  // Map of component productId -> total required units across all order items
  const componentNeeds = new Map()
  for (const item of items) {
    const p = productsById[item.product_id]
    if (!p) continue
    const refs = componentRefsFor(p)
    const qty = item.quantity
    for (const c of refs) {
      const pId = c.ref.id
      const current = componentNeeds.get(pId) || { ref: c.ref, need: 0 }
      current.need += c.qtyPerUnit * qty
      componentNeeds.set(pId, current)
    }
  }

  const needsList = Array.from(componentNeeds.values())

  return runTransaction(db, async (tx) => {
    // --- all reads first (Firestore transaction requirement) ---
    const counterSnap = await tx.get(ORDER_COUNTER)
    const compSnaps = await Promise.all(needsList.map((c) => tx.get(c.ref)))

    // Verify + compute new stock for each component.
    const updates = []
    compSnaps.forEach((snap, i) => {
      if (!snap.exists()) throw new Error(`Missing product: ${needsList[i].ref.id}`)
      const data = snap.data()
      const need = needsList[i].need
      const remaining = computeRemaining(data)
      if (remaining - need < 0) {
        throw new Error(`Not enough stock for ${data.name} (have ${remaining}, need ${need})`)
      }
      updates.push({ ref: needsList[i].ref, newSold: (Number(data.sold_qty) || 0) + need })
    })

    // Allocate next order number.
    const current = counterSnap.exists() ? Number(counterSnap.data().current) || 1000 : 1000
    const nextNo = current + 1
    const orderNo = `ORD-${nextNo}`

    // Compute top-level summary totals for backward compatibility
    const totalRevenue = items.reduce((s, it) => s + (it.selling_price * it.quantity), 0)
    const totalCogs = items.reduce((s, it) => s + (it.cost_price_snapshot * it.quantity), 0)
    const totalQty = items.reduce((s, it) => s + it.quantity, 0)
    const productNameSummary = items.length === 1
      ? items[0].product_name
      : items.map((it) => `${it.product_name} ×${it.quantity}`).join(', ')

    // --- writes ---
    for (const u of updates) tx.update(u.ref, { sold_qty: u.newSold })
    tx.set(ORDER_COUNTER, { current: nextNo }, { merge: true })

    const orderRef = doc(collection(db, 'orders'))
    tx.set(orderRef, {
      customer_name: (order.customer_name || '').trim(),
      phone: (order.phone || '').trim(),
      address: (order.address || '').trim(),
      platform: order.platform || '',
      payment_method: order.payment_method || 'COD',
      status: order.status || 'Pending',
      notes: (order.notes || '').trim(),
      order_date: order.order_date || new Date().toISOString().slice(0, 10),
      items,
      // Backward-compatible fields:
      product_id: items[0]?.product_id || '',
      product_name: productNameSummary,
      product_type: items[0]?.product_type || 'component',
      quantity: totalQty,
      selling_price: items.length === 1 ? items[0].selling_price : totalRevenue,
      cost_price_snapshot: items.length === 1 ? items[0].cost_price_snapshot : totalCogs,
      order_no: orderNo,
      stock_applied: true,
      created_at: serverTimestamp(),
      status_updated_at: serverTimestamp(),
    })
    return { id: orderRef.id, order_no: orderNo }
  })
}

/**
 * Change an order's status. Handles stock restock/re-deduct atomically for multi-item orders.
 */
export async function changeOrderStatus(orderId, newStatus, productsById = {}) {
  const orderRef = doc(db, 'orders', orderId)

  return runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Order not found')
    const order = orderSnap.data()

    const wasSelling = !NON_SELLING_STATUSES.includes(order.status)
    const willSell = !NON_SELLING_STATUSES.includes(newStatus)
    const stockApplied = order.stock_applied !== false

    let direction = 0 // +1 = deduct, -1 = restock
    if (wasSelling && !willSell && stockApplied) direction = -1
    else if (!wasSelling && willSell && !stockApplied) direction = +1

    const items = extractOrderItems(order, productsById)
    const deltasMap = new Map()

    if (direction !== 0) {
      for (const item of items) {
        const p = productsById[item.product_id]
        if (!p) continue
        const refs = componentRefsFor(p)
        for (const c of refs) {
          const pId = c.ref.id
          const current = deltasMap.get(pId) || { ref: c.ref, delta: 0 }
          current.delta += c.qtyPerUnit * item.quantity * direction
          deltasMap.set(pId, current)
        }
      }
    }

    const activeDeltas = Array.from(deltasMap.values()).filter((d) => d.delta !== 0)
    const compSnaps = activeDeltas.length > 0
      ? await Promise.all(activeDeltas.map((d) => tx.get(d.ref)))
      : []

    if (direction !== 0) {
      compSnaps.forEach((snap, i) => {
        if (!snap.exists()) return
        const data = snap.data()
        const delta = activeDeltas[i].delta
        const newSold = (Number(data.sold_qty) || 0) + delta
        if (newSold < 0) throw new Error(`Stock underflow for ${data.name}`)
        tx.update(activeDeltas[i].ref, { sold_qty: newSold })
      })
    }

    const patch = { status: newStatus, status_updated_at: serverTimestamp() }
    if (direction === -1) patch.stock_applied = false
    if (direction === +1) patch.stock_applied = true
    tx.update(orderRef, patch)
  })
}

// Manual restock — increments restocked_qty atomically.
export async function restockProduct(productId, addQty) {
  const ref = doc(db, 'products', productId)
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Product not found')
    const cur = Number(snap.data().restocked_qty) || 0
    tx.update(ref, { restocked_qty: cur + (Number(addQty) || 0) })
  })
}

/**
 * Update an existing order with new details & items.
 * Atomically adjusts component stock deductions based on net changes across old and new items.
 */
export async function updateOrderWithStock(orderId, newOrderData, productsById = {}) {
  const orderRef = doc(db, 'orders', orderId)

  return runTransaction(db, async (tx) => {
    // 1. Read existing order snap
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Order not found')
    const currentOrder = orderSnap.data()

    const wasStockApplied = currentOrder.stock_applied !== false
    const targetStatus = newOrderData.status ?? currentOrder.status
    const willSell = !NON_SELLING_STATUSES.includes(targetStatus)

    const oldItems = extractOrderItems(currentOrder, productsById)
    const newItems = extractOrderItems(newOrderData, productsById)

    // Calculate net delta per component product doc ID
    // delta > 0 means add to sold_qty (deduct stock)
    // delta < 0 means subtract from sold_qty (restock)
    const deltasMap = new Map()

    if (wasStockApplied) {
      // Revert old stock deduction
      for (const item of oldItems) {
        const p = productsById[item.product_id]
        if (!p) continue
        const refs = componentRefsFor(p)
        for (const c of refs) {
          const pId = c.ref.id
          const current = deltasMap.get(pId) || { ref: c.ref, delta: 0 }
          current.delta -= c.qtyPerUnit * item.quantity
          deltasMap.set(pId, current)
        }
      }
    }

    if (willSell) {
      // Apply new stock deduction
      for (const item of newItems) {
        const p = productsById[item.product_id]
        if (!p) continue
        const refs = componentRefsFor(p)
        for (const c of refs) {
          const pId = c.ref.id
          const current = deltasMap.get(pId) || { ref: c.ref, delta: 0 }
          current.delta += c.qtyPerUnit * item.quantity
          deltasMap.set(pId, current)
        }
      }
    }

    const activeDeltas = Array.from(deltasMap.values()).filter((item) => item.delta !== 0)

    // 2. Read component snaps inside transaction (all reads before writes)
    const compSnaps = await Promise.all(activeDeltas.map((item) => tx.get(item.ref)))

    const updates = []
    compSnaps.forEach((snap, i) => {
      if (!snap.exists()) return
      const data = snap.data()
      const delta = activeDeltas[i].delta
      const remaining = computeRemaining(data)
      const newSold = (Number(data.sold_qty) || 0) + delta

      if (delta > 0 && remaining - delta < 0) {
        throw new Error(`Not enough stock for ${data.name} (have ${remaining}, need ${delta})`)
      }
      if (newSold < 0) {
        throw new Error(`Stock underflow for ${data.name}`)
      }
      updates.push({ ref: activeDeltas[i].ref, newSold })
    })

    // 3. Perform writes
    for (const u of updates) {
      tx.update(u.ref, { sold_qty: u.newSold })
    }

    const totalRevenue = newItems.reduce((s, it) => s + (it.selling_price * it.quantity), 0)
    const totalCogs = newItems.reduce((s, it) => s + (it.cost_price_snapshot * it.quantity), 0)
    const totalQty = newItems.reduce((s, it) => s + it.quantity, 0)
    const productNameSummary = newItems.length === 1
      ? newItems[0].product_name
      : newItems.map((it) => `${it.product_name} ×${it.quantity}`).join(', ')

    const patch = {
      customer_name: (newOrderData.customer_name ?? currentOrder.customer_name ?? '').trim(),
      phone: (newOrderData.phone ?? currentOrder.phone ?? '').trim(),
      address: (newOrderData.address ?? currentOrder.address ?? '').trim(),
      platform: newOrderData.platform ?? currentOrder.platform ?? '',
      items: newItems,
      product_id: newItems[0]?.product_id || '',
      product_name: productNameSummary,
      product_type: newItems[0]?.product_type || 'component',
      quantity: totalQty,
      selling_price: newItems.length === 1 ? newItems[0].selling_price : totalRevenue,
      cost_price_snapshot: newItems.length === 1 ? newItems[0].cost_price_snapshot : totalCogs,
      payment_method: newOrderData.payment_method ?? currentOrder.payment_method ?? 'COD',
      status: targetStatus,
      notes: (newOrderData.notes ?? currentOrder.notes ?? '').trim(),
      order_date: newOrderData.order_date ?? currentOrder.order_date ?? '',
      stock_applied: willSell,
      updated_at: serverTimestamp(),
      ...(targetStatus !== currentOrder.status ? { status_updated_at: serverTimestamp() } : {}),
    }

    tx.update(orderRef, patch)
  })
}

/**
 * Add a new product / stock item to Firestore.
 */
export async function createProduct(productData) {
  const ref = doc(collection(db, 'products'))
  const data = {
    name: productData.name.trim(),
    sku: productData.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
    category: (productData.category || 'Car Care').trim(),
    type: productData.type || 'component',
    cost_price: Number(productData.cost_price) || 0,
    default_selling_price: Number(productData.default_selling_price) || 0,
    opening_stock: productData.type === 'component' ? (Number(productData.opening_stock) || 0) : 0,
    reorder_level: productData.type === 'component' ? (Number(productData.reorder_level) || 5) : 0,
    restocked_qty: 0,
    sold_qty: 0,
    active: true,
    ...(productData.type === 'bundle' ? { components: productData.components || [] } : {}),
  }
  await setDoc(ref, data)
  return { id: ref.id, ...data }
}

/**
 * Update Cost Price (CP) and Selling Price (SP) of an existing product.
 */
export async function updateProductPrices(productId, costPrice, sellingPrice) {
  const ref = doc(db, 'products', productId)
  await updateDoc(ref, {
    cost_price: Number(costPrice) || 0,
    default_selling_price: Number(sellingPrice) || 0,
  })
}


