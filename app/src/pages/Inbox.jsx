import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useDoc } from '../lib/useCollection'
import { LangBadge, LayerBadge, PLATFORM_ICON, PLATFORM_LABEL } from '../components/BotBadges'

const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date())

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'needs_human', label: 'Needs you' },
  { key: 'unread', label: 'Unread' },
]

function timeAgo(ts) {
  if (!ts?.toMillis) return ''
  const s = Math.round((Date.now() - ts.toMillis()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function StatsCard({ usage, conversations }) {
  const u = usage || {}
  const layers = u.by_layer || {}
  const auto = (layers.llm || 0) + (layers.keyword || 0) + (layers.template || 0)
  const waiting = conversations.filter((c) => c.needs_human).length
  const perPlatform = Object.entries(u.in_by_platform || {})
  return (
    <div className="card">
      <div className="kpis">
        <div className="kpi"><div className="label">Messages today</div><div className="value">{u.messages_in || 0}</div></div>
        <div className="kpi"><div className="label">Auto-resolved</div><div className="value good">{auto}</div></div>
        <div className="kpi"><div className="label">Needs you (open)</div><div className={`value ${waiting ? 'bad' : ''}`}>{waiting}</div></div>
        <div className="kpi">
          <div className="label">LLM requests today</div>
          <div className="value">{u.llm_requests || 0}</div>
          {(u.llm_errors > 0) && (
            <div className="small muted">{u.llm_errors} errors{u.llm_rate_limited ? `, ${u.llm_rate_limited} rate-limited` : ''}</div>
          )}
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 10 }}>
        {perPlatform.length
          ? perPlatform.map(([p, n]) => `${PLATFORM_ICON[p] || ''} ${PLATFORM_LABEL[p] || p}: ${n}`).join(' · ')
          : 'No messages yet today.'}
        {' '}· Replies today: {layers.llm || 0} AI, {layers.keyword || 0} keyword, {layers.template || 0} template, {layers.fallback || 0} handed to you
      </div>
    </div>
  )
}

export default function Inbox() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const { data: usage } = useDoc('bot_usage', todayKey())
  const { data: botSettings } = useDoc('bot', 'settings')
  const autoOn = botSettings ? botSettings.auto_reply_enabled !== false : true

  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('updated_at', 'desc'), limit(200))
    return onSnapshot(q,
      (snap) => { setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      (e) => { setError(e.message); setLoading(false) })
  }, [])

  const shown = useMemo(() => conversations.filter((c) =>
    filter === 'all' ? true : Boolean(c[filter])), [conversations, filter])

  const toggleGlobal = async () => {
    const next = !autoOn
    if (!next && !window.confirm('Pause auto-replies on ALL platforms?')) return
    await setDoc(doc(db, 'bot', 'settings'), { auto_reply_enabled: next }, { merge: true })
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ flex: 1 }}>Inbox</h1>
        <button className={`btn sm ${autoOn ? 'secondary' : ''}`} onClick={toggleGlobal}>
          {autoOn ? '🤖 Auto-reply on' : '⏸ Auto-reply paused'}
        </button>
      </div>
      {!autoOn && <div className="banner warn">Auto-reply is paused for every conversation. Messages are still collected here.</div>}

      <StatsCard usage={usage} conversations={conversations} />

      <div className="field-chips" style={{ marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button key={f.key} className="chip"
            style={{ cursor: 'pointer', color: filter === f.key ? 'var(--accent)' : 'var(--text)', borderColor: filter === f.key ? 'var(--accent)' : undefined }}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
        <Link className="chip" to="/bot/test">🧪 Test Bot</Link>
        <Link className="chip" to="/bot/knowledge">🧠 Knowledge</Link>
      </div>

      {error && <div className="banner error">{error}</div>}
      {loading ? <div className="spinner" /> : (
        <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {shown.length === 0 && <div className="list-item muted">No conversations{filter !== 'all' ? ' in this view' : ' yet'}.</div>}
          {shown.map((c) => (
            <Link key={c.id} to={`/inbox/${c.id}`} className="list-item" style={{ color: 'var(--text)' }}>
              <span style={{ fontSize: '1.4rem' }} title={PLATFORM_LABEL[c.platform]}>{PLATFORM_ICON[c.platform] || '💬'}</span>
              <div className="grow">
                <div className="title" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.unread ? '● ' : ''}{c.customer_name || 'Customer'}
                  </span>
                </div>
                <div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.last_direction === 'out' ? '↩ ' : ''}{c.last_message}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  <LangBadge lang={c.language} />
                  {c.last_direction === 'out' && <LayerBadge layer={c.last_layer} />}
                  {c.needs_human && <span className="badge needs-human">needs human</span>}
                  {c.auto_reply_paused && <span className="badge paused">bot paused</span>}
                </div>
              </div>
              <span className="small muted">{timeAgo(c.updated_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
