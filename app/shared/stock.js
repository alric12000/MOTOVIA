// Stock math shared by the browser (src/lib/calc.js) and the Vercel functions.
// Plain JS, no imports, so Node can load it without Vite.

// remaining = opening + restocked − sold (sold_qty is maintained transactionally by
// src/lib/inventory.js, so this is the authoritative figure).
export function remainingStock(component) {
  const opening = Number(component.opening_stock) || 0
  const restocked = Number(component.restocked_qty) || 0
  const sold = Number(component.sold_qty) || 0
  return opening + restocked - sold
}

// Can at least one unit of this product be sold right now? Bundles have no stock
// of their own — they're available only if every component covers its qty.
export function isAvailable(product, productsById) {
  if (!product) return false
  if (product.type === 'bundle') {
    const comps = Array.isArray(product.components) ? product.components : []
    if (!comps.length) return false
    return comps.every((c) => {
      const comp = productsById[c.productId]
      return comp && remainingStock(comp) >= (Number(c.qty) || 1)
    })
  }
  return remainingStock(product) > 0
}
