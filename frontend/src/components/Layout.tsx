import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';

const topNavTitles: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/wallets':     'Wallets',
  '/fx':          'FX Exchange',
  '/settlements': 'Settlements',
  '/cards':       'Cards',
  '/kyc':         'KYC Verification',
  '/credit':      'Credit Score',
  '/admin':       'Admin Dashboard',
};

const Layout: React.FC = () => {
  const { user } = useAuth();
  const pathname = window.location.pathname;
  const title = Object.entries(topNavTitles).find(([k]) => pathname.startsWith(k))?.[1] ?? 'WekezaGlobal';
  const kycStatus = user?.kyc_status ?? 'pending';

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        {/* Top bar */}
        <header className="navbar">
          <span className="navbar-title">{title}</span>
          <div className="navbar-actions">
            <span className={`kyc-status-badge ${kycStatus}`}>
              {kycStatus === 'verified' ? '✅' : kycStatus === 'rejected' ? '❌' : '⏳'} KYC {kycStatus}
            </span>
            <div className="navbar-badge" title="Notifications">
              🔔
              <span className="badge-dot" />
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
