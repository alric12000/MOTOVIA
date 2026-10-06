import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPost } from '../lib/api'
import { LangBadge, LayerBadge } from '../components/BotBadges'

// Mixed English / Romanized Nepali / Devanagari messages for a quick regression run.
const SAMPLES = [
  'hi',
  'namaste 🙏',
  'foamx kati ho?',
  'combo ma k k aaucha?',
  'delivery kati din lagcha?',
  'How much is the Clean Wash Combo?',
  'Do you deliver outside Kathmandu valley? What is the charge?',
  'cod hunchha ki esewa ma pay garnu parcha?',
  'फोमएक्स कति हो?',
  'Is the towel in stock?',
  'product damage aayo bhane exchange garna milcha?',
  'How do I use FoamX?',
  'malai wash combo chahiyo, kasari order garne?',
  'Do you sell car wax or tyre polish?',
  'mero aghi ko order kaha pugyo? 9812345678',
]

function ResultCard({ r }) {
  return (
    <div className="card">
      <div className="small muted" style={{ marginBottom: 6 }}>“{r.text}”</div>
      {r.error ? (
        <div className="banner error" style={{ marginBottom: 0 }}>{r.error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <LangBadge lang={r.language} />
            <LayerBadge layer={r.layer} />
            {r.needs_human && <span className="badge needs-human">needs human</span>}
            <span className="badge plain">{r.detection?.method}</span>
            <span className="badge plain">{r.ms} ms</span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{r.reply}</div>
          {(r.model || r.reason || r.llm_errors?.length > 0) && (
            <div className="small muted" style={{ marginTop: 8 }}>
              {r.model && <div>model: <span className="mono">{r.model}</span></div>}
              {r.reason && <div>reason: {r.reason}</div>}
              {r.llm_errors?.map((e, i) => <div key={i}>LLM error: {e}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function TestBot() {
  const [text, setText] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const run = async (msg) => {
    try {
      return { text: msg, ...(await apiPost('test-reply', { text: msg })) }
    } catch (e) {
      return { text: msg, error: e.message }
    }
  }

  const send = async (e) => {
    e.preventDefault()
    const msg = text.trim()
    if (!msg) return
    setBusy(true)
    const r = await run(msg)
    setResults((xs) => [r, ...xs])
    setText('')
    setBusy(false)
  }

  // Sequential on purpose: free LLM tiers rate-limit bursts.
  const runSamples = async () => {
    setBusy(true); setResults([])
    for (let i = 0; i < SAMPLES.length; i++) {
      setProgress(`${i + 1}/${SAMPLES.length}`)
      const r = await run(SAMPLES[i])
      setResults((xs) => [...xs, r])
    }
    setProgress(''); setBusy(false)
  }

  const summary = results.reduce((m, r) => {
    const k = r.error ? 'error' : r.layer
    m[k] = (m[k] || 0) + 1
    return m
  }, {})

  return (
    <div className="page">
      <h1>Test Bot</h1>
      <p className="muted small">
        Try the auto-reply without any platform connected. Nothing is sent to customers.
        Edit answers in <Link to="/bot/knowledge">Bot Knowledge</Link>.
      </p>

      <form className="card" onSubmit={send}>
        <textarea value={text} placeholder="e.g. foamx kati ho?" onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy || !text.trim()}>Send</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={runSamples}>
            {progress ? `Running ${progress}…` : `Run sample set (${SAMPLES.length})`}
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="field-chips" style={{ marginBottom: 12 }}>
          {Object.entries(summary).map(([k, n]) => (
            <span className="chip" key={k}><span className="num">{n}</span>{k}</span>
          ))}
        </div>
      )}
      {results.map((r, i) => <ResultCard key={i} r={r} />)}
    </div>
  )
}
