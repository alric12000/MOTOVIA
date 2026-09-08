import { useMemo, useState } from 'react'
import { useCollection } from '../lib/useCollection'
import { restockProduct } from '../lib/inventory'
import { remainingStock, isLowStock } from '../lib/calc'

export default function Inventory() {
  const { data: products } = useCollection('products')
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState('')

  const components = useMemo(
    () => products.filter((p) => p.type === 'component').sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )
  const low = components.filter((c) => isLowStock(c))

  const restock = async (p) => {
    const qtyStr = window.prompt(`Add stock for ${p.name}. How many units received?`, '10')
    if (qtyStr == null) return
    const qty = Number(qtyStr)
    if (!qty || qty <= 0) return
    setErr(''); setBusyId(p.id)
    try {
      await restockProduct(p.id, qty)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <h1>Inventory</h1>

      {low.length > 0 && (
        <div className="banner warn">
          ⚠ Low stock: {low.map((c) => c.name).join(', ')} — time to restock.
        </div>
      )}
      {err && <div className="banner error">{err}</div>}

      {components.map((p) => {
        const remaining = remainingStock(p)
        const lowFlag = isLowStock(p)
        return (
          <div className="card" key={p.id}>
            <div className="list-item" style={{ paddingTop: 0 }}>
              <div className="grow">
                <div className="title">{p.name}</div>
                <div className="sub mono">{p.sku} · {p.category}</div>
              </div>
              <div className="right">
                <div className="value" style={{ fontSize: '1.4rem', fontWeight: 700, color: lowFlag ? 'var(--warn)' : 'var(--text)' }}>
                  {remaining}
                </div>
                <div className="small muted">in stock</div>
              </div>
            </div>
            <div className="small muted">
              Opening {p.opening_stock || 0} · Restocked {p.restocked_qty || 0} · Sold {p.sold_qty || 0} · Reorder ≤ {p.reorder_level || 0}
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn secondary sm" disabled={busyId === p.id} onClick={() => restock(p)}>
                {busyId === p.id ? 'Updating…' : '+ Restock'}
              </button>
            </div>
          </div>
        )
      })}

      {components.length === 0 && (
        <p className="muted">No products yet. Import your spreadsheet or seed defaults from the More tab.</p>
      )}

      {products.some((p) => p.type === 'bundle') && (
        <>
          <h2>Bundles</h2>
          {products.filter((p) => p.type === 'bundle').map((b) => (
            <div className="card" key={b.id}>
              <div className="title">{b.name}</div>
              <div className="small muted">
                {(b.components || []).map((c) => {
                  const comp = products.find((p) => p.id === c.productId)
                  return comp ? `${c.qty}× ${comp.name}` : null
                }).filter(Boolean).join(' + ')}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
