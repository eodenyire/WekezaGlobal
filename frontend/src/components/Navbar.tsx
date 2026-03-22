import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard',          icon: '🏠', label: 'Dashboard',           section: 'main' },
  { path: '/wallets',            icon: '👛', label: 'Wallets',              section: 'main' },
  { path: '/collection-accounts', icon: '🌍', label: 'Collection Accounts', section: 'main' },
  { path: '/fx',                 icon: '💱', label: 'FX Exchange',          section: 'main' },
  { path: '/settlements',        icon: '🏦', label: 'Settlements',          section: 'main' },
  { path: '/cards',              icon: '💳', label: 'Cards',                section: 'main' },
  { path: '/profile',            icon: '👤', label: 'My Profile',           section: 'account' },
  { path: '/kyc',                icon: '📋', label: 'KYC',                  section: 'account' },
  { path: '/credit',             icon: '📊', label: 'Credit Score',         section: 'account' },
  { path: '/api-keys',           icon: '🔑', label: 'API Keys',             section: 'account' },
  { path: '/webhooks',           icon: '🔗', label: 'Webhooks',             section: 'account' },
  { path: '/notifications',      icon: '🔔', label: 'Notifications',        section: 'account' },
  { path: '/subscriptions',     icon: '💎', label: 'Subscription',          section: 'account' },
  { path: '/developer',          icon: '🚀', label: 'Developer Portal',     section: 'developer' },
  { path: '/sandbox',            icon: '🧪', label: 'Sandbox Testing',      section: 'developer' },
  { path: '/developer/analytics', icon: '📈', label: 'Analytics',           section: 'developer' },
  { path: '/developer/changelog', icon: '📝', label: 'Changelog',           section: 'developer' },
  { path: '/overview',           icon: '🗺️', label: 'Platform Overview',    section: 'platform' },
  { path: '/admin',              icon: '⚙️',  label: 'Admin',                section: 'admin', adminOnly: true },
  { path: '/admin/developers',  icon: '👩‍💻', label: 'Developer Management', section: 'admin', adminOnly: true },
];

const Sidebar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const mainItems    = navItems.filter((i) => i.section === 'main' && (!i.adminOnly || isAdmin));
  const accountItems = navItems.filter((i) => i.section === 'account');
  const devItems     = navItems.filter((i) => i.section === 'developer');
  const platformItems = navItems.filter((i) => i.section === 'platform');
  const adminItems   = navItems.filter((i) => i.section === 'admin' && isAdmin);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🌍</div>
        <div className="sidebar-logo-text">
          <span className="brand-name">WekezaGlobal</span>
          <span className="brand-tagline">Infrastructure</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Main</div>
        {mainItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive || location.pathname.startsWith(item.path) ? ' active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="sidebar-section-title">Account</div>
        {accountItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="sidebar-section-title">Developer</div>
        {devItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/developer'}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        {adminItems.length > 0 && (
          <>
            <div className="sidebar-section-title">System</div>
            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}

        {platformItems.length > 0 && (
          <>
            <div className="sidebar-section-title">Platform</div>
            {platformItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{getInitials(user.full_name)}</div>
            <div className="sidebar-user-info">
              <div className="user-name">{user.full_name}</div>
              <div className="user-role">{user.role}</div>
            </div>
          </div>
        )}
        <button className="btn-logout" onClick={logout}>
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
