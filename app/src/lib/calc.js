import { NON_SELLING_STATUSES } from './constants'

// An order counts toward revenue/COGS/stock only if it isn't Returned/Cancelled.
export const isSellingOrder = (order) =>
  !NON_SELLING_STATUSES.includes(order.status)

export const orderRevenue = (o) =>
  isSellingOrder(o) ? (Number(o.selling_price) || 0) * (Number(o.quantity) || 0) : 0

export const orderCogs = (o) =>
  isSellingOrder(o) ? (Number(o.cost_price_snapshot) || 0) * (Number(o.quantity) || 0) : 0

export const orderProfit = (o) => orderRevenue(o) - orderCogs(o)

// Expand a product (component or bundle) into the component quantities it consumes.
// Returns a map of componentProductId -> qty per single unit of the product.
export function componentsForProduct(product, productsById) {
  if (!product) return {}
  if (product.type === 'bundle' && Array.isArray(product.components)) {
    const map = {}
    for (const c of product.components) {
      map[c.productId] = (map[c.productId] || 0) + (Number(c.qty) || 0)
    }
    return map
  }
  // A component consumes one of itself.
  return { [product.id]: 1 }
}

// Remaining stock from the transaction-maintained counter on the product doc.
// sold_qty is kept atomically by createOrderWithStock / changeOrderStatus, so this
// is the authoritative figure and can't drift from rapid taps.
export function remainingStock(component) {
  const opening = Number(component.opening_stock) || 0
  const restocked = Number(component.restocked_qty) || 0
  const sold = Number(component.sold_qty) || 0
  return opening + restocked - sold
}

export function isLowStock(component) {
  return remainingStock(component) <= (Number(component.reorder_level) || 0)
}

// Dashboard-level aggregation. Accepts already-filtered arrays.
export function summarize(orders, expenses, adSpend) {
  const revenue = orders.reduce((s, o) => s + orderRevenue(o), 0)
  const cogs = orders.reduce((s, o) => s + orderCogs(o), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const totalAdSpend = adSpend.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const grossProfit = revenue - cogs
  const netProfit = grossProfit - totalExpenses - totalAdSpend
  const sellingOrders = orders.filter(isSellingOrder)
  // Total Customers counts everyone you've dealt with in range — a returned or
  // cancelled order still came from a real customer.
  const customers = new Set(
    orders.map((o) => (o.customer_name || '').trim().toLowerCase()).filter(Boolean)
  )
  return {
    revenue, cogs, grossProfit, totalExpenses, totalAdSpend, netProfit,
    totalOrders: sellingOrders.length,
    totalCustomers: customers.size,
  }
}

// Group a numeric metric by a key extractor.
export function breakdownBy(orders, keyFn, valueFn = orderRevenue) {
  const map = {}
  for (const o of orders) {
    const k = keyFn(o) || 'Unknown'
    map[k] = (map[k] || 0) + valueFn(o)
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

// Monthly series for the dashboard chart (revenue/expenses/net within a year).
export function monthlySeries(orders, expenses, adSpend, year) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    revenue: 0, expenses: 0, cogs: 0, netProfit: 0,
  }))
  const inYear = (d) => d && new Date(d).getFullYear() === year
  for (const o of orders) {
    if (!inYear(o.order_date)) continue
    const m = new Date(o.order_date).getMonth()
    months[m].revenue += orderRevenue(o)
    months[m].cogs += orderCogs(o)
  }
  for (const e of expenses) {
    if (!inYear(e.date)) continue
    months[new Date(e.date).getMonth()].expenses += Number(e.amount) || 0
  }
  for (const a of adSpend) {
    if (!inYear(a.date)) continue
    months[new Date(a.date).getMonth()].expenses += Number(a.amount) || 0
  }
  for (const m of months) m.netProfit = m.revenue - m.cogs - m.expenses
  return months
}

export const formatNPR = (n) =>
  'Rs ' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')
