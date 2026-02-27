import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Wallets from './pages/Wallets';
import WalletDetail from './pages/WalletDetail';
import FXExchange from './pages/FXExchange';
import Settlements from './pages/Settlements';
import Cards from './pages/Cards';
import KYC from './pages/KYC';
import CreditScore from './pages/CreditScore';
import AdminDashboard from './pages/AdminDashboard';
import ApiKeys from './pages/ApiKeys';
import Notifications from './pages/Notifications';
import Webhooks from './pages/Webhooks';
import CollectionAccounts from './pages/CollectionAccounts';
import Subscriptions from './pages/Subscriptions';

import './styles/global.css';

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"      element={<Dashboard />} />
          <Route path="wallets"        element={<Wallets />} />
          <Route path="wallets/:id"    element={<WalletDetail />} />
          <Route path="fx"             element={<FXExchange />} />
          <Route path="settlements"    element={<Settlements />} />
          <Route path="cards"          element={<Cards />} />
          <Route path="kyc"            element={<KYC />} />
          <Route path="credit"         element={<CreditScore />} />
          <Route path="api-keys"       element={<ApiKeys />} />
          <Route path="webhooks"       element={<Webhooks />} />
          <Route path="collection-accounts" element={<CollectionAccounts />} />
          <Route path="notifications"  element={<Notifications />} />
          <Route path="subscriptions"  element={<Subscriptions />} />
          <Route
            path="admin"
            element={
              <PrivateRoute adminOnly>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
