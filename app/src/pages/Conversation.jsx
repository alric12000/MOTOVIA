import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, onSnapshot, orderBy, query, limitToLast, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useDoc } from '../lib/useCollection'
import { apiPost } from '../lib/api'
import { LangBadge, LayerBadge, PLATFORM_ICON, PLATFORM_LABEL } from '../components/BotBadges'

const DAY_MS = 24 * 60 * 60 * 1000
const fmt = (ts) => (ts?.toDate ? ts.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

export default function Conversation() {
  const { id } = useParams()
  const { data: conv, loading } = useDoc('conversations', id)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const bottom = useRef(null)

  useEffect(() => {
    const q = query(collection(db, 'conversations', id, 'messages'), orderBy('created_at'), limitToLast(100))
    return onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [id])

  // Opening the conversation marks it read.
  useEffect(() => {
    if (conv?.unread) updateDoc(doc(db, 'conversations', id), { unread: false }).catch(() => {})
  }, [conv?.unread, id])

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length])

  const setFlag = (patch) => updateDoc(doc(db, 'conversations', id), patch).catch((e) => setErr(e.message))

  const send = async (e) => {
    e.preventDefault()
    const msg = text.trim()
    if (!msg) return
    setBusy(true); setErr('')
    try {
      await apiPost('send', { conversationId: id, text: msg })
      setText('')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!conv) return <div className="page"><div className="banner error">Conversation not found.</div><Link to="/inbox">← Inbox</Link></div>

  const lastIn = conv.last_inbound_at?.toMillis?.() || 0
  const windowOpen = Date.now() - lastIn < DAY_MS

  return (
    <div className="page">
      <Link to="/inbox" className="small">← Inbox</Link>
      <h1 style={{ marginTop: 8, marginBottom: 6 }}>
        {PLATFORM_ICON[conv.platform]} {conv.customer_name || 'Customer'}
      </h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="badge plain">{PLATFORM_LABEL[conv.platform] || conv.platform}</span>
        <LangBadge lang={conv.language} />
        {conv.needs_human && <span className="badge needs-human">needs human</span>}
        {conv.auto_reply_paused && <span className="badge paused">bot paused</span>}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn secondary sm" onClick={() => setFlag({ auto_reply_paused: !conv.auto_reply_paused })}>
          {conv.auto_reply_paused ? '▶ Resume bot' : '⏸ Pause bot here'}
        </button>
        {conv.needs_human && (
          <button className="btn secondary sm" onClick={() => setFlag({ needs_human: false })}>✓ Mark handled</button>
        )}
      </div>
      {conv.last_error && <div className="banner error">Last error: {conv.last_error}</div>}

      <div className="card">
        {messages.length === 0 && <div className="muted small">No messages.</div>}
        {messages.map((m) => {
          const out = m.direction === 'out'
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
              <div style={{
                maxWidth: '85%', padding: '9px 12px', borderRadius: 14, whiteSpace: 'pre-wrap',
                background: out ? 'var(--accent-dim)' : 'var(--surface-2)',
                border: out ? 'none' : '1px solid var(--border)',
              }}>
                <div>{m.text}</div>
                <div className="small" style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', opacity: 0.8 }}>
                  {out && <LayerBadge layer={m.layer || (m.sent_by === 'admin' ? 'admin' : m.sent_by)} />}
                  <span>{fmt(m.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </div>

      {err && <div className="banner error">{err}</div>}
      {windowOpen ? (
        <form onSubmit={send}>
          <textarea value={text} placeholder="Type your reply…" onChange={(e) => setText(e.target.value)} />
          <button className="btn" style={{ marginTop: 8 }} disabled={busy || !text.trim()}>
            {busy ? 'Sending…' : 'Send reply'}
          </button>
        </form>
      ) : (
        <div className="banner warn">
          More than 24 hours since the customer's last message, so the platform no longer allows a
          normal reply from here. Reply from the {PLATFORM_LABEL[conv.platform] || 'platform'} app instead.
        </div>
      )}
    </div>
  )
}
