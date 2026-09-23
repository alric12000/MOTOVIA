import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useDoc, indexById } from '../lib/useCollection'
import { changeOrderStatus, updateOrderWithStock, extractOrderItems } from '../lib/inventory'
import StatusButtons from '../components/StatusButtons'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { formatNPR, remainingStock, orderRevenue } from '../lib/calc'

export default function Orders() {
  const { data: orders } = useCollection('orders')
  const { data: products } = useCollection('products')
  const { data: settingsDoc } = useDoc('settings', 'config')
  const settings = settingsDoc || DEFAULT_SETTINGS
  const byId = useMemo(() => indexById(products), [products])
  const sellable = useMemo(
    () => products.filter((p) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )

  const [fStatus, setFStatus] = useState('')
  const [fPlatform, setFPlatform] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editErr, setEditErr] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  const filtered = useMemo(() => {
    return orders
      .filter((o) => !fStatus || o.status === fStatus)
      .filter((o) => !fPlatform || o.platform === fPlatform)
      .filter((o) => !fFrom || (o.order_date && o.order_date >= fFrom))
      .filter((o) => !fTo || (o.order_date && o.order_date <= fTo))
      .sort((a, b) => (b.order_no || '').localeCompare(a.order_no || '', undefined, { numeric: true }))
  }, [orders, fStatus, fPlatform, fFrom, fTo])

  const doStatus = async (order, newStatus) => {
    if (order.status === newStatus) return
    setErr(''); setBusyId(order.id)
    try {
      await changeOrderStatus(order.id, newStatus, byId)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const startEditing = (order) => {
    setEditingId(order.id)
    setEditErr('')
    const extracted = extractOrderItems(order, byId)
    setEditForm({
      customer_name: order.customer_name || '',
      phone: order.phone || '',
      address: order.address || '',
      platform: order.platform || '',
      payment_method: order.payment_method || 'COD',
      status: order.status || 'Pending',
      notes: order.notes || '',
      order_date: order.order_date || new Date().toISOString().slice(0, 10),
      items: extracted.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        selling_price: it.selling_price,
      })),
    })
  }

  const handleEditItemChange = (index, field, val) => {
    setEditForm((f) => {
      const updated = [...(f.items || [])]
      const cur = { ...updated[index], [field]: val }
      if (field === 'product_id') {
        const p = byId[val]
        if (p) {
          cur.selling_price = p.default_selling_price ?? ''
        }
      }
      updated[index] = cur
      return { ...f, items: updated }
    })
  }

  const addEditItemRow = () => {
    setEditForm((f) => ({
      ...f,
      items: [...(f.items || []), { product_id: '', quantity: 1, selling_price: '' }],
    }))
  }

  const removeEditItemRow = (index) => {
    setEditForm((f) => {
      if (!f.items || f.items.length <= 1) return f
      return { ...f, items: f.items.filter((_, i) => i !== index) }
    })
  }

  const editTotalAmount = useMemo(() => {
    return (editForm.items || []).reduce((sum, it) => {
      return sum + ((Number(it.selling_price) || 0) * (Number(it.quantity) || 1))
    }, 0)
  }, [editForm.items])

  const getItemStockNote = (productId) => {
    if (!productId) return null
    const p = byId[productId]
    if (!p) return null
    const comps = p.type === 'bundle' ? p.components : [{ productId: p.id, qty: 1 }]
    return comps.map((c) => {
      const comp = byId[c.productId]
      if (!comp) return null
      return `${comp.name}: ${remainingStock(comp)} left`
    }).filter(Boolean).join(' · ')
  }

  const handleSaveEdit = async (order) => {
    setEditErr('')
    const items = editForm.items || []
    for (let i = 0; i < items.length; i++) {
      if (!items[i].product_id) {
        setEditErr(`Pick a valid product for Item #${i + 1}.`)
        return
      }
      if (items[i].selling_price === '' || Number(items[i].selling_price) < 0) {
        setEditErr(`Set a valid price for Item #${i + 1}.`)
        return
      }
    }

    setEditBusy(true)
    try {
      await updateOrderWithStock(order.id, editForm, byId)
      setEditingId(null)
    } catch (e) {
      setEditErr(e.message)
    } finally {
      setEditBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Orders</h1>

      <div className="card">
        <div className="row">
          <div>
            <label>Status</label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">All</option>
              {settings.statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label>Platform</label>
            <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)}>
              <option value="">All</option>
              {settings.platforms.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label>From</label>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
        </div>
      </div>

      {err && <div className="banner error">{err}</div>}
      <p className="small muted">{filtered.length} orders</p>

      {filtered.map((o) => {
        const orderItemsList = extractOrderItems(o, byId)
        const isEditingThis = editingId === o.id

        return (
          <div className="card" key={o.id}>
            {isEditingThis ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(o); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700 }}>Edit {o.order_no}</div>
                  <button type="button" className="btn ghost sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>

                <label>Customer Name</label>
                <input
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))}
                  required
                />

                <div className="row">
                  <div>
                    <label>Phone</label>
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      inputMode="tel"
                    />
                  </div>
                  <div>
                    <label>Order Date</label>
                    <input
                      type="date"
                      value={editForm.order_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, order_date: e.target.value }))}
                    />
                  </div>
                </div>

                <label>Address / Location</label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Location / Address"
                />

                <label>Platform</label>
                <select
                  value={editForm.platform}
                  onChange={(e) => setEditForm((f) => ({ ...f, platform: e.target.value }))}
                  required
                >
                  <option value="">Select platform…</option>
                  {settings.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>

                <h3 style={{ fontSize: '0.95rem', margin: '16px 0 8px', color: 'var(--accent)' }}>
                  Products & Extra Items
                </h3>

                {(editForm.items || []).map((it, idx) => {
                  const stockNote = getItemStockNote(it.product_id)
                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="small" style={{ fontWeight: 600 }}>Item #{idx + 1}</span>
                        {(editForm.items || []).length > 1 && (
                          <button
                            type="button"
                            className="btn ghost sm"
                            style={{ padding: '2px 6px', fontSize: '0.72rem', color: 'var(--bad)' }}
                            onClick={() => removeEditItemRow(idx)}
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>

                      <select
                        value={it.product_id}
                        onChange={(e) => handleEditItemChange(idx, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">Select product…</option>
                        {sellable.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.type === 'bundle' ? ' (bundle)' : ''} — {formatNPR(p.default_selling_price || 0)}
                          </option>
                        ))}
                      </select>
                      {stockNote && <p className="small muted" style={{ marginTop: 4 }}>{stockNote}</p>}

                      <div className="row" style={{ marginTop: 6 }}>
                        <div>
                          <label style={{ marginTop: 0 }}>Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleEditItemChange(idx, 'quantity', e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ marginTop: 0 }}>Selling Price (Rs)</label>
                          <input
                            type="number"
                            min="0"
                            value={it.selling_price}
                            onChange={(e) => handleEditItemChange(idx, 'selling_price', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}

                <button
                  type="button"
                  className="btn secondary sm"
                  style={{ marginBottom: 12 }}
                  onClick={addEditItemRow}
                >
                  ➕ Add Extra Product / Item
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, marginBottom: 12 }}>
                  <span>Total Order Price:</span>
                  <strong style={{ color: 'var(--good)' }}>{formatNPR(editTotalAmount)}</strong>
                </div>

                <label>Payment Method</label>
                <select
                  value={editForm.payment_method}
                  onChange={(e) => setEditForm((f) => ({ ...f, payment_method: e.target.value }))}
                >
                  {settings.payment_methods.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>

                <label>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {settings.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>

                <label>Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes"
                />

                {editErr && <div className="banner error" style={{ marginTop: 10 }}>{editErr}</div>}

                <div className="row" style={{ marginTop: 14 }}>
                  <button type="button" className="btn secondary" onClick={() => setEditingId(null)} disabled={editBusy}>
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={editBusy}>
                    {editBusy ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="list-item" style={{ paddingTop: 0, paddingBottom: 8 }}
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                  <div className="grow">
                    <div className="title">{o.customer_name || 'Unnamed'}</div>
                    <div className="sub">
                      <span className="mono">{o.order_no}</span> · {o.product_name} · {o.platform}
                    </div>
                  </div>
                  <div className="right">
                    <div className="title">{formatNPR(orderRevenue(o))}</div>
                    <span className={`badge ${o.status}`}>{o.status}</span>
                  </div>
                </div>

                {expanded === o.id && (
                  <>
                    <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, margin: '8px 0' }}>
                      <div className="small" style={{ fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
                        ITEMS IN THIS ORDER:
                      </div>
                      {orderItemsList.map((it, i) => (
                        <div key={i} className="small" style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span>{it.product_name} ×{it.quantity}</span>
                          <span>{formatNPR(it.selling_price * it.quantity)} ({formatNPR(it.selling_price)} each)</span>
                        </div>
                      ))}
                    </div>

                    {o.phone && <div className="small">📞 {o.phone}</div>}
                    {o.address && <div className="small muted">📍 {o.address}</div>}
                    {o.notes && <div className="small muted">📝 {o.notes}</div>}
                    <div className="small muted" style={{ marginTop: 6 }}>
                      {o.order_date} · {o.payment_method}
                    </div>
                    <StatusButtons
                      current={o.status}
                      disabled={busyId === o.id}
                      onChange={(s) => doStatus(o, s)}
                    />
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <Link className="btn secondary sm" to={`/invoice/${o.id}`}>View invoice</Link>
                      <button
                        className="btn secondary sm"
                        onClick={(e) => { e.stopPropagation(); startEditing(o); }}
                      >
                        ✏️ Edit order
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

