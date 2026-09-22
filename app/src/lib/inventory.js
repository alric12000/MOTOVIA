import {
  doc, collection, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { NON_SELLING_STATUSES } from './constants'

const ORDER_COUNTER = doc(db, 'counters', 'orders')

// Given a product doc, return [{ ref, qtyPerUnit }] of the COMPONENT products it consumes.
function componentRefsFor(product) {
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
 * Create an order and atomically deduct component stock.
 * `order` must include product_id, quantity, selling_price, etc.
 * Allocates the next ORD-#### id from counters/orders in the same transaction.
 */
export async function createOrderWithStock(order, product) {
  const qty = Number(order.quantity) || 0
  const components = componentRefsFor(product)

  return runTransaction(db, async (tx) => {
    // --- all reads first (Firestore transaction requirement) ---
    const counterSnap = await tx.get(ORDER_COUNTER)
    const compSnaps = await Promise.all(components.map((c) => tx.get(c.ref)))

    // Verify + compute new stock for each component.
    const updates = []
    compSnaps.forEach((snap, i) => {
      if (!snap.exists()) throw new Error(`Missing product: ${components[i].ref.id}`)
      const data = snap.data()
      const need = components[i].qtyPerUnit * qty
      const remaining = computeRemaining(data)
      if (remaining - need < 0) {
        throw new Error(`Not enough stock for ${data.name} (have ${remaining}, need ${need})`)
      }
      updates.push({ ref: components[i].ref, newSold: (Number(data.sold_qty) || 0) + need })
    })

    // Allocate next order number.
    const current = counterSnap.exists() ? Number(counterSnap.data().current) || 1000 : 1000
    const nextNo = current + 1
    const orderNo = `ORD-${nextNo}`

    // --- writes ---
    for (const u of updates) tx.update(u.ref, { sold_qty: u.newSold })
    tx.set(ORDER_COUNTER, { current: nextNo }, { merge: true })

    const orderRef = doc(collection(db, 'orders'))
    tx.set(orderRef, {
      ...order,
      order_no: orderNo,
      product_name: product.name,
      product_type: product.type,
      cost_price_snapshot: order.cost_price_snapshot ?? (Number(product.cost_price) || 0),
      stock_applied: true,
      created_at: serverTimestamp(),
      status_updated_at: serverTimestamp(),
    })
    return { id: orderRef.id, order_no: orderNo }
  })
}

/**
 * Change an order's status. Handles stock restock/re-deduct atomically:
 *  - moving INTO Returned/Cancelled while stock is applied -> restock components
 *  - moving OUT of Returned/Cancelled back to active -> re-deduct components
 */
export async function changeOrderStatus(orderId, newStatus, product) {
  const orderRef = doc(db, 'orders', orderId)
  // If the order has no linked product (e.g. an imported row we couldn't match),
  // we can still record the status change — just skip the stock maths.
  const canAdjustStock = Boolean(product && product.id)
  const components = canAdjustStock ? componentRefsFor(product) : []

  return runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Order not found')
    const order = orderSnap.data()
    const qty = Number(order.quantity) || 0

    const wasSelling = !NON_SELLING_STATUSES.includes(order.status)
    const willSell = !NON_SELLING_STATUSES.includes(newStatus)
    const stockApplied = order.stock_applied !== false

    let direction = 0 // +1 = deduct, -1 = restock
    if (wasSelling && !willSell && stockApplied) direction = -1
    else if (!wasSelling && willSell && !stockApplied) direction = +1
    if (!canAdjustStock) direction = 0

    const compSnaps = direction !== 0
      ? await Promise.all(components.map((c) => tx.get(c.ref)))
      : []

    if (direction !== 0) {
      compSnaps.forEach((snap, i) => {
        if (!snap.exists()) return
        const data = snap.data()
        const delta = components[i].qtyPerUnit * qty * direction
        const newSold = (Number(data.sold_qty) || 0) + delta
        if (newSold < 0) throw new Error(`Stock underflow for ${data.name}`)
        tx.update(components[i].ref, { sold_qty: newSold })
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
 * Update an existing order with new details (customer, location/address, price, product, quantity, status, etc.).
 * Atomically adjusts component stock deductions based on net changes.
 */
export async function updateOrderWithStock(orderId, newOrderData, oldProduct, newProduct) {
  const orderRef = doc(db, 'orders', orderId)

  return runTransaction(db, async (tx) => {
    // 1. Read existing order snap
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Order not found')
    const currentOrder = orderSnap.data()

    const wasStockApplied = currentOrder.stock_applied !== false
    const targetStatus = newOrderData.status ?? currentOrder.status
    const willSell = !NON_SELLING_STATUSES.includes(targetStatus)

    const oldQty = Number(currentOrder.quantity) || 0
    const newQty = Number(newOrderData.quantity) || 0

    const oldComponents = oldProduct ? componentRefsFor(oldProduct) : []
    const newComponents = newProduct ? componentRefsFor(newProduct) : []

    // Calculate net delta per component product doc ID
    // delta > 0 means add to sold_qty (deduct stock)
    // delta < 0 means subtract from sold_qty (restock)
    const deltasMap = new Map()

    if (wasStockApplied) {
      // Revert old stock deduction
      for (const c of oldComponents) {
        const pId = c.ref.id
        const current = deltasMap.get(pId) || { ref: c.ref, delta: 0 }
        current.delta -= c.qtyPerUnit * oldQty
        deltasMap.set(pId, current)
      }
    }

    if (willSell) {
      // Apply new stock deduction
      for (const c of newComponents) {
        const pId = c.ref.id
        const current = deltasMap.get(pId) || { ref: c.ref, delta: 0 }
        current.delta += c.qtyPerUnit * newQty
        deltasMap.set(pId, current)
      }
    }

    // Collect all component refs that have non-zero delta
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

    const costPriceSnapshot = newProduct
      ? (Number(newProduct.cost_price) || 0)
      : (currentOrder.cost_price_snapshot ?? 0)

    const patch = {
      customer_name: (newOrderData.customer_name ?? currentOrder.customer_name ?? '').trim(),
      phone: (newOrderData.phone ?? currentOrder.phone ?? '').trim(),
      address: (newOrderData.address ?? currentOrder.address ?? '').trim(),
      platform: newOrderData.platform ?? currentOrder.platform ?? '',
      product_id: newOrderData.product_id ?? currentOrder.product_id ?? '',
      product_name: newProduct ? newProduct.name : (currentOrder.product_name || ''),
      product_type: newProduct ? newProduct.type : (currentOrder.product_type || 'single'),
      quantity: newQty,
      selling_price: Number(newOrderData.selling_price) ?? (Number(currentOrder.selling_price) || 0),
      cost_price_snapshot: costPriceSnapshot,
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

