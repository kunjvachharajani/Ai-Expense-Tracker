import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import AddExpense from './pages/AddExpense';
import ScanReceipt from './pages/ScanReceipt';
import Expenses from './pages/Expenses';
import Analytics from './pages/Analytics';
import Budgets from './pages/Budgets';
import SettingsPage from './pages/Settings';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', subtitle: 'Overview of your expenses' },
  '/add-expense': { title: 'Add Expense', subtitle: 'Record a new expense using AI' },
  '/scan-receipt': { title: 'Scan Receipt', subtitle: 'Upload a receipt to extract expenses' },
  '/expenses': { title: 'Expenses', subtitle: 'View and manage all expenses' },
  '/analytics': { title: 'Analytics', subtitle: 'Insights into your spending habits' },
  '/budgets': { title: 'Budgets', subtitle: 'Set and track monthly budgets' },
  '/settings': { title: 'Settings', subtitle: 'Account and preferences' },
};

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return <div className="loading-page" style={{ minHeight: '100vh' }}><span className="loading-spinner lg" /><p>Loading...</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'ExpenseAI' };

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header title={pageInfo.title} subtitle={pageInfo.subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add-expense" element={<AddExpense />} />
            <Route path="/scan-receipt" element={<ScanReceipt />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function AuthRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-page" style={{ minHeight: '100vh' }}><span className="loading-spinner lg" /></div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-page" style={{ minHeight: '100vh' }}><span className="loading-spinner lg" /></div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
      <Route path="/*" element={user ? <ProtectedLayout /> : <Navigate to="/login" />} />
    </Routes>
  );
}
