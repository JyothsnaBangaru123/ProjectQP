import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Navbar = ({ title }) => {
  const { user, role, branchName, logout } = useAuth();

  return (
    <header className="header">
      <div className="page-title">{title || 'QP Management System'}</div>
      <div className="header-user" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {user && (
          <>
            {branchName && (
              <span style={{
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                color: 'var(--accent-cyan, #06b6d4)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                🏛️ {branchName}
              </span>
            )}
            <span className="user-badge" style={{
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--accent-purple, #8b5cf6)',
              borderColor: 'rgba(139, 92, 246, 0.3)',
              fontWeight: 700
            }}>
              {role || user.type || 'User'}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {user.honorific ? `${user.honorific} ` : ''}{user.user_name}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>
              Sign Out
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
