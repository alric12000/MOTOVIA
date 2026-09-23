import { useMemo, useState } from 'react'
import { useCollection } from '../lib/useCollection'
import { restockProduct, createProduct, updateProductPrices } from '../lib/inventory'
import { remainingStock, isLowStock, formatNPR } from '../lib/calc'

export default function Inventory() {
  const { data: products } = useCollection('products')
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [editingPriceId, setEditingPriceId] = useState(null)
  const [priceForm, setPriceForm] = useState({ cost_price: '', default_selling_price: '' })

  // New stock form state
  const [newStock, setNewStock] = useState({
    name: '',
    sku: '',
    category: 'Car Care',
    type: 'component',
    cost_price: '',
    default_selling_price: '',
    opening_stock: '0',
    reorder_level: '5',
    bundleComponents: [{ productId: '', qty: 1 }],
  })

  const components = useMemo(
    () => products.filter((p) => p.type === 'component').sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )
  const bundles = useMemo(
    () => products.filter((p) => p.type === 'bundle').sort((a, b) => a.name.localeCompare(b.name)),
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

  const handleSaveNewStock = async (e) => {
    e.preventDefault()
    setErr('')
    if (!newStock.name.trim()) {
      setErr('Please enter product name.')
      return
    }
    if (newStock.cost_price === '' || newStock.default_selling_price === '') {
      setErr('Please set both Cost Price (CP) and Selling Price (SP).')
      return
    }

    setAddBusy(true)
    try {
      let comps = []
      if (newStock.type === 'bundle') {
        comps = newStock.bundleComponents.filter((c) => c.productId && Number(c.qty) > 0)
        if (comps.length === 0) {
          throw new Error('Please select at least one component product for the bundle.')
        }
      }

      await createProduct({
        ...newStock,
        components: comps,
      })

      // Reset form
      setNewStock({
        name: '', sku: '', category: 'Car Care', type: 'component',
        cost_price: '', default_selling_price: '', opening_stock: '0', reorder_level: '5',
        bundleComponents: [{ productId: '', qty: 1 }],
      })
      setShowAddForm(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setAddBusy(false)
    }
  }

  const startEditPrices = (p) => {
    setEditingPriceId(p.id)
    setPriceForm({
      cost_price: p.cost_price ?? '',
      default_selling_price: p.default_selling_price ?? '',
    })
  }

  const handleSavePrices = async (pId) => {
    setErr('')
    setBusyId(pId)
    try {
      await updateProductPrices(pId, priceForm.cost_price, priceForm.default_selling_price)
      setEditingPriceId(null)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Inventory</h1>
        <button
          className="btn sm"
          style={{ width: 'auto' }}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '✕ Close' : '➕ Add New Stock'}
        </button>
      </div>

      {low.length > 0 && (
        <div className="banner warn">
          ⚠ Low stock: {low.map((c) => c.name).join(', ')} — time to restock.
        </div>
      )}
      {err && <div className="banner error">{err}</div>}

      {showAddForm && (
        <div className="card" style={{ border: '2px solid var(--accent)' }}>
          <h2 style={{ marginTop: 0, color: 'var(--accent)' }}>Enter New Stock / Product</h2>
          <form onSubmit={handleSaveNewStock}>
            <label>Product Name</label>
            <input
              placeholder="e.g. Hydro Wash Shampoo, FoamX"
              value={newStock.name}
              onChange={(e) => setNewStock((s) => ({ ...s, name: e.target.value }))}
              required
            />

            <div className="row">
              <div>
                <label>Product Type</label>
                <select
                  value={newStock.type}
                  onChange={(e) => setNewStock((s) => ({ ...s, type: e.target.value }))}
                >
                  <option value="component">Single Stock Item</option>
                  <option value="bundle">Bundle / Wash Combo</option>
                </select>
              </div>
              <div>
                <label>Category</label>
                <input
                  value={newStock.category}
                  onChange={(e) => setNewStock((s) => ({ ...s, category: e.target.value }))}
                />
              </div>
            </div>

            <div className="row">
              <div>
                <label>Cost Price (CP - Rs)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 150"
                  value={newStock.cost_price}
                  onChange={(e) => setNewStock((s) => ({ ...s, cost_price: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Selling Price (SP - Rs)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 359"
                  value={newStock.default_selling_price}
                  onChange={(e) => setNewStock((s) => ({ ...s, default_selling_price: e.target.value }))}
                  required
                />
              </div>
            </div>

            {newStock.type === 'component' ? (
              <div className="row">
                <div>
                  <label>Initial / Opening Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={newStock.opening_stock}
                    onChange={(e) => setNewStock((s) => ({ ...s, opening_stock: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Reorder Level Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={newStock.reorder_level}
                    onChange={(e) => setNewStock((s) => ({ ...s, reorder_level: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
                <label style={{ marginTop: 0 }}>Bundle Components (consumed stock)</label>
                {newStock.bundleComponents.map((c, idx) => (
                  <div className="row" key={idx} style={{ marginBottom: 6 }}>
                    <select
                      value={c.productId}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewStock((s) => {
                          const next = [...s.bundleComponents]
                          next[idx].productId = val
                          return { ...s, bundleComponents: next }
                        })
                      }}
                    >
                      <option value="">Select component…</option>
                      {components.map((comp) => (
                        <option key={comp.id} value={comp.id}>{comp.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      style={{ maxWidth: 80 }}
                      value={c.qty}
                      onChange={(e) => {
                        const val = e.target.value
                        setNewStock((s) => {
                          const next = [...s.bundleComponents]
                          next[idx].qty = val
                          return { ...s, bundleComponents: next }
                        })
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ marginTop: 6 }}
                  onClick={() => setNewStock((s) => ({ ...s, bundleComponents: [...s.bundleComponents, { productId: '', qty: 1 }] }))}
                >
                  + Add Component to Bundle
                </button>
              </div>
            )}

            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" className="btn secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={addBusy}>
                {addBusy ? 'Saving stock…' : 'Save Stock Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      <h2>Component Stock Items</h2>

      {components.map((p) => {
        const remaining = remainingStock(p)
        const lowFlag = isLowStock(p)
        const isEditing = editingPriceId === p.id

        return (
          <div className="card" key={p.id}>
            <div className="list-item" style={{ paddingTop: 0 }}>
              <div className="grow">
                <div className="title">{p.name}</div>
                <div className="sub mono">{p.sku || 'SKU'} · {p.category || 'Car Care'}</div>
              </div>
              <div className="right">
                <div className="value" style={{ fontSize: '1.4rem', fontWeight: 700, color: lowFlag ? 'var(--warn)' : 'var(--text)' }}>
                  {remaining}
                </div>
                <div className="small muted">in stock</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, marginBottom: 8, fontSize: '0.88rem' }}>
              <span>CP: <strong style={{ color: 'var(--muted)' }}>{formatNPR(p.cost_price || 0)}</strong></span>
              <span>SP: <strong style={{ color: 'var(--good)' }}>{formatNPR(p.default_selling_price || 0)}</strong></span>
              <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => startEditPrices(p)}>
                ✏️ Edit CP/SP
              </button>
            </div>

            {isEditing && (
              <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, marginBottom: 10 }}>
                <div className="row">
                  <div>
                    <label style={{ marginTop: 0 }}>Cost Price (CP)</label>
                    <input
                      type="number"
                      value={priceForm.cost_price}
                      onChange={(e) => setPriceForm((f) => ({ ...f, cost_price: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ marginTop: 0 }}>Selling Price (SP)</label>
                    <input
                      type="number"
                      value={priceForm.default_selling_price}
                      onChange={(e) => setPriceForm((f) => ({ ...f, default_selling_price: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn secondary sm" onClick={() => setEditingPriceId(null)}>Cancel</button>
                  <button type="button" className="btn sm" onClick={() => handleSavePrices(p.id)}>Save Prices</button>
                </div>
              </div>
            )}

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
        <p className="muted">No stock items yet. Click "+ Add New Stock" above or seed defaults from the More tab.</p>
      )}

      {bundles.length > 0 && (
        <>
          <h2>Bundles & Wash Combos</h2>
          {bundles.map((b) => {
            const isEditing = editingPriceId === b.id
            return (
              <div className="card" key={b.id}>
                <div className="title">{b.name}</div>
                <div className="small muted">
                  {(b.components || []).map((c) => {
                    const comp = products.find((p) => p.id === c.productId)
                    return comp ? `${c.qty}× ${comp.name}` : null
                  }).filter(Boolean).join(' + ')}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, fontSize: '0.88rem' }}>
                  <span>CP: <strong style={{ color: 'var(--muted)' }}>{formatNPR(b.cost_price || 0)}</strong></span>
                  <span>SP: <strong style={{ color: 'var(--good)' }}>{formatNPR(b.default_selling_price || 0)}</strong></span>
                  <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => startEditPrices(b)}>
                    ✏️ Edit CP/SP
                  </button>
                </div>

                {isEditing && (
                  <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, marginTop: 8 }}>
                    <div className="row">
                      <div>
                        <label style={{ marginTop: 0 }}>Cost Price (CP)</label>
                        <input
                          type="number"
                          value={priceForm.cost_price}
                          onChange={(e) => setPriceForm((f) => ({ ...f, cost_price: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ marginTop: 0 }}>Selling Price (SP)</label>
                        <input
                          type="number"
                          value={priceForm.default_selling_price}
                          onChange={(e) => setPriceForm((f) => ({ ...f, default_selling_price: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <button type="button" className="btn secondary sm" onClick={() => setEditingPriceId(null)}>Cancel</button>
                      <button type="button" className="btn sm" onClick={() => handleSavePrices(b.id)}>Save Prices</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

