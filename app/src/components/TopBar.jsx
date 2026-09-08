import { useAuth } from '../context/AuthContext'

export default function TopBar() {
  const { logout } = useAuth()
  return (
    <header className="topbar">
      <img src="/logo.png" alt="MotoviaNepal" />
      <div className="spacer" />
      <button onClick={() => logout()}>Log out</button>
    </header>
  )
}
