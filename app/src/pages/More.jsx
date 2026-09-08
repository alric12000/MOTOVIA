import { useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, getDocs, writeBatch, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection } from '../lib/useCollection'
import { DEFAULT_PRODUCTS, DEFAULT_BUNDLES, DEFAULT_SETTINGS } from '../lib/constants'

const links = [
  { to: '/expenses', ic: '💸', label: 'Expenses' },
  { to: '/adspend', ic: '📣', label: 'Ad Spend' },
  { to: '/invoice', ic: '🧾', label: 'Invoices' },
  { to: '/import', ic: '📥', label: 'Import spreadsheet' },
  { to: '/settings', ic: '⚙️', label: 'Settings' },
]

export default function More() {
  const { data: products } = useCollection('products')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // One-tap seed of the default catalog + settings when starting fresh.
  const seedDefaults = async () => {
    if (products.length) {
      if (!window.confirm('Products already exist. Seed defaults anyway? (may create duplicates)')) return
    }
    setBusy(true); setMsg('')
    try {
      await setDoc(doc(db, 'settings', 'config'), DEFAULT_SETTINGS, { merge: true })
      const batch = writeBatch(db)
      const bySku = {}
      for (const p of DEFAULT_PRODUCTS) {
        const ref = doc(collection(db, 'products'))
        bySku[p.sku] = ref.id
        batch.set(ref, { ...p, restocked_qty: 0, sold_qty: 0, active: true })
      }
      for (const b of DEFAULT_BUNDLES) {
        const ref = doc(collection(db, 'products'))
        batch.set(ref, {
          name: b.name, sku: b.sku, category: b.category, type: 'bundle',
          cost_price: b.cost_price, default_selling_price: b.default_selling_price,
          components: b.componentSkus.map((c) => ({ productId: bySku[c.sku], qty: c.qty })),
          active: true,
        })
      }
      await batch.commit()
      setMsg('Seeded default products, bundles and dropdown lists.')
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>More</h1>
      {links.map((l) => (
        <Link className="card" key={l.to} to={l.to}
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text)' }}>
          <span style={{ fontSize: '1.4rem' }}>{l.ic}</span>
          <span className="title">{l.label}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>›</span>
        </Link>
      ))}

      <h2>Setup</h2>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          Starting fresh with no spreadsheet? Seed the default Motovia catalog (Shampoo, FoamX,
          Towel + Wash Combo bundles) and dropdown lists.
        </p>
        <button className="btn secondary" disabled={busy} onClick={seedDefaults}>
          {busy ? 'Seeding…' : 'Seed default products & lists'}
        </button>
        {msg && <div className="banner info" style={{ marginTop: 12 }}>{msg}</div>}
      </div>
    </div>
  )
}
