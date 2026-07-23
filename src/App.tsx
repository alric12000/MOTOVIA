import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { Layout } from './components/Layout';
import { AuthPage } from './components/AuthPage';
import { InventoryPage } from './components/InventoryPage';
import { SalesPage } from './components/SalesPage';

import { DashboardPage } from './components/DashboardPage';
import { ExpensesPage } from './components/ExpensesPage';
import { AdSpendPage } from './components/AdSpendPage';
import { CustomersPage } from './components/CustomersPage';
import { PnLPage } from './components/PnLPage';
import { InvoicePage } from './components/InvoicePage';
import { DataImportPage } from './components/DataImportPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <AuthPage /> : <Navigate to="/" />} />

        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="ad-spend" element={<AdSpendPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="pnl" element={<PnLPage />} />
          <Route path="invoice" element={<InvoicePage />} />
          <Route path="import" element={<DataImportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
