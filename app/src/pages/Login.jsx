import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigured } from '../lib/firebase'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (e) {
      setErr(e.code === 'auth/invalid-credential'
        ? 'Wrong email or password.'
        : e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <img src="/logo.png" alt="MotoviaNepal" />
      {!firebaseConfigured && (
        <div className="banner error" style={{ maxWidth: 360 }}>
          Firebase isn’t configured yet. Copy <span className="mono">.env.example</span> to{' '}
          <span className="mono">.env</span> and add your Firebase keys, then restart the dev server.
        </div>
      )}
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360 }}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="username" required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" required />
        {err && <div className="banner error" style={{ marginTop: 14 }}>{err}</div>}
        <button className="btn" style={{ marginTop: 18 }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="muted small">Private business tool · MotoviaNepal</p>
    </div>
  )
}
