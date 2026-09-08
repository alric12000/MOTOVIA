import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Nav from './components/Nav'
import TopBar from './components/TopBar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OrderEntry from './pages/OrderEntry'
import Orders from './pages/Orders'
import Inventory from './pages/Inventory'
import Expenses from './pages/Expenses'
import AdSpend from './pages/AdSpend'
import Invoice from './pages/Invoice'
import Settings from './pages/Settings'
import Import from './pages/Import'
import More from './pages/More'

export default function App() {
  const { user } = useAuth()
  const location = useLocation()
  const showChrome = user && location.pathname !== '/login'

  return (
    <div className="app">
      {showChrome && <TopBar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/new" element={<ProtectedRoute><OrderEntry /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/adspend" element={<ProtectedRoute><AdSpend /></ProtectedRoute>} />
        <Route path="/invoice" element={<ProtectedRoute><Invoice /></ProtectedRoute>} />
        <Route path="/invoice/:orderId" element={<ProtectedRoute><Invoice /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
        <Route path="/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
      </Routes>
      {showChrome && <Nav />}
    </div>
  )
}
