import React from 'react';
import type { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  totalRiskLoss: number;
  activeCriticalCount: number;
  totalLossSaved: number;
  activeTasksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  totalRiskLoss,
  activeCriticalCount,
  totalLossSaved,
  activeTasksCount,
}) => {
  return (
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
      </div>
    </header>
  );
};
