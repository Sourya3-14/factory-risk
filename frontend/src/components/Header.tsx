import React, { useState, useEffect } from 'react';
import type { ActiveTab } from '../types';
import { subscribeAuth, logout, type User, fetchCurrentUser } from '../auth';
import { AuthModal } from './AuthModal';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  totalRiskLoss: number;
  activeCriticalCount: number;
  totalLossSaved: number;
  activeTasksCount: number;
  onOpenShiftBriefing?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  totalRiskLoss,
  activeCriticalCount,
  totalLossSaved,
  activeTasksCount,
  onOpenShiftBriefing,
}) => {

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // Subscribe to auth state updates
    const unsubscribe = subscribeAuth((state) => {
      setCurrentUser(state.user);
    });
    // Check session on mount
    fetchCurrentUser();
    return () => unsubscribe();
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'factory_owner':
        return { label: 'Factory Owner', badgeClass: 'badge-owner' };
      case 'supervisor':
        return { label: 'Floor Supervisor', badgeClass: 'badge-supervisor' };
      default:
        return { label: 'Maintenance Engineer', badgeClass: 'badge-engineer' };
    }
  };

  const roleInfo = getRoleBadge(currentUser?.role);
  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'YW';

  return (
    <>
      <header className="top-header">
        <div className="header-container">
          {/* Brand Section */}
          <div className="brand-section">
            <div className="brand-icon">YW</div>
            <div>
              <div className="brand-title">
                YantraWatch
                <span className="brand-badge">Autonomous Plant Sentinel</span>
              </div>
              <div className="brand-subtitle">AI Predictive Failure Risk & ₹-Weighted Escalation Loop</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="nav-tabs" id="navTabs">
            <button
              className={`tab-btn ${activeTab === 'fleet' ? 'active' : ''}`}
              onClick={() => onTabChange('fleet')}
              id="tabFleetBtn"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Fleet Matrix
            </button>

            <button
              className={`tab-btn ${activeTab === 'kanban' ? 'active' : ''}`}
              onClick={() => onTabChange('kanban')}
              id="tabKanbanBtn"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              ₹-Escalation Kanban
              <span className="tab-count-badge" id="activeTasksBadge">
                {activeTasksCount}
              </span>
            </button>

            <button
              className={`tab-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
              onClick={() => onTabChange('benchmark')}
              id="tabBenchmarkBtn"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Judge Benchmark & Evaluation
            </button>
          </nav>

          {/* Global Financial KPI Bar */}
          <div className="header-kpi-bar">
            <div className="kpi-chip">
              <span className="kpi-label">Plant Risk Exposure</span>
              <span className="kpi-val loss" id="globalRiskLoss">
                ₹{totalRiskLoss.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="kpi-chip">
              <span className="kpi-label">Active Critical</span>
              <span className="kpi-val critical" id="globalCriticalCount">
                {activeCriticalCount}
              </span>
            </div>
            <div className="kpi-chip">
              <span className="kpi-label">Loss Mitigated</span>
              <span className="kpi-val saved" id="globalLossSaved">
                ₹{totalLossSaved.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Autonomous Shift Briefing Trigger */}
          <button
            type="button"
            className="ctrl-btn"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(2, 132, 199, 0.25))',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.8rem',
              padding: '0.5rem 0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
            onClick={onOpenShiftBriefing}
            title="Generate AI Executive Shift Handover Briefing"
          >
            <span style={{ color: 'var(--accent-cyan)' }}>✨</span>
            Shift Briefing
          </button>

          {/* User Profile & Role Switcher Section */}
          <div className="user-auth-section">

            {currentUser ? (
              <div className="user-profile-pill">
                <div className="user-avatar">{initials}</div>
                <div className="user-info-text">
                  <div className="user-name">{currentUser.name}</div>
                  <div className={`user-role-badge ${roleInfo.badgeClass}`}>
                    {roleInfo.label}
                  </div>
                </div>
                <button
                  type="button"
                  className="ctrl-btn"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.25rem 0.65rem',
                    marginLeft: '0.4rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderColor: 'rgba(255, 255, 255, 0.15)'
                  }}
                  onClick={() => setIsAuthModalOpen(true)}
                  title="Switch Role or Account"
                >
                  Switch Role
                </button>
                <button
                  type="button"
                  className="logout-btn"
                  onClick={() => logout()}
                  title="Logout"
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="ctrl-btn play-btn"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.95rem' }}
                onClick={() => setIsAuthModalOpen(true)}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In / Switch Role
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};
