import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', ic: '📊', label: 'Dashboard', end: true },
  { to: '/new', ic: '➕', label: 'New' },
  { to: '/orders', ic: '📦', label: 'Orders' },
  { to: '/inventory', ic: '🏷️', label: 'Stock' },
  { to: '/more', ic: '⋯', label: 'More' },
]

export default function Nav() {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}
          className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ic">{t.ic}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
