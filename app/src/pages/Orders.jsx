import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useDoc, indexById } from '../lib/useCollection'
import { changeOrderStatus, updateOrderWithStock } from '../lib/inventory'
import StatusButtons from '../components/StatusButtons'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { formatNPR, remainingStock } from '../lib/calc'

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
      const product = byId[order.product_id]
      await changeOrderStatus(order.id, newStatus, product)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const startEditing = (order) => {
    setEditingId(order.id)
    setEditErr('')
    setEditForm({
      customer_name: order.customer_name || '',
      phone: order.phone || '',
      address: order.address || '',
      platform: order.platform || '',
      product_id: order.product_id || '',
      quantity: order.quantity || 1,
      selling_price: order.selling_price ?? '',
      payment_method: order.payment_method || 'COD',
      status: order.status || 'Pending',
      notes: order.notes || '',
      order_date: order.order_date || new Date().toISOString().slice(0, 10),
    })
  }

  const stockNote = useMemo(() => {
    if (!editForm.product_id) return null
    const p = byId[editForm.product_id]
    if (!p) return null
    const comps = p.type === 'bundle' ? p.components : [{ productId: p.id, qty: 1 }]
    return comps.map((c) => {
      const comp = byId[c.productId]
      if (!comp) return null
      return `${comp.name}: ${remainingStock(comp)} left`
    }).filter(Boolean).join(' · ')
  }, [editForm.product_id, byId])

  const handleSaveEdit = async (order) => {
    setEditErr('')
    const newProduct = byId[editForm.product_id]
    if (!newProduct) {
      setEditErr('Pick a valid product.')
      return
    }
    const oldProduct = byId[order.product_id]
    setEditBusy(true)
    try {
      await updateOrderWithStock(order.id, editForm, oldProduct, newProduct)
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

      {filtered.map((o) => (
        <div className="card" key={o.id}>
          {editingId === o.id ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(o); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>Edit {o.order_no}</div>
                <button type="button" className="btn ghost sm" onClick={() => setEditingId(null)}>Cancel</button>
              </div>

              <label>Customer name</label>
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
                  <label>Order date</label>
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
                <option value="">Select…</option>
                {settings.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>

              <label>Product</label>
              <select
                value={editForm.product_id}
                onChange={(e) => {
                  const pId = e.target.value
                  const p = byId[pId]
                  setEditForm((f) => ({
                    ...f,
                    product_id: pId,
                    selling_price: (f.selling_price === '' || f.selling_price == null) ? (p?.default_selling_price ?? '') : f.selling_price
                  }))
                }}
                required
              >
                <option value="">Select…</option>
                {sellable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.type === 'bundle' ? ' (bundle)' : ''}
                  </option>
                ))}
              </select>
              {stockNote && <p className="small muted" style={{ marginTop: 6 }}>{stockNote}</p>}

              <div className="row">
                <div>
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label>Selling price (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.selling_price}
                    onChange={(e) => setEditForm((f) => ({ ...f, selling_price: e.target.value }))}
                    inputMode="decimal"
                    required
                  />
                </div>
              </div>

              <label>Payment method</label>
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
                    <span className="mono">{o.order_no}</span> · {o.product_name} ×{o.quantity} · {o.platform}
                  </div>
                </div>
                <div className="right">
                  <div className="title">{formatNPR((o.selling_price || 0) * (o.quantity || 1))}</div>
                  <span className={`badge ${o.status}`}>{o.status}</span>
                </div>
              </div>

              {expanded === o.id && (
                <>
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
      ))}
    </div>
  )
}
