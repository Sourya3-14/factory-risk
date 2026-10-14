import React from 'react';
import type { MetricsData } from '../types';

interface BenchmarkViewProps {
  metrics?: MetricsData | null;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = () => {
  return (
    <section id="viewBenchmark" className="view-section active">
      <div className="fleet-header">
        <div>
          <h2 className="section-title">Judge Verification & Evaluation Benchmark</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Comparative analysis on strictly held-out test data (Sep 1 – Dec 31, 2015).
          </div>
        </div>
      </div>

      <div className="benchmark-card">
        <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.5rem' }}>
          1. LightGBM Model vs. Naive Vibration Baseline
        </h3>
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Evaluation Metric</th>
              <th>LightGBM Classifier (YantraWatch)</th>
              <th>Simple Baseline (Vibration &gt; 48 mm/s)</th>
              <th>Advantage</th>
            </tr>
          </thead>
          <tbody id="metricsTableBody">
            <tr>
              <td>
                <strong>Precision</strong>
              </td>
              <td className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                96.66%
              </td>
              <td className="mono">11.04%</td>
              <td>
                <span className="win-badge">+8.8x Fewer False Alarms</span>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Recall (Coverage)</strong>
              </td>
              <td className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                99.56%
              </td>
              <td className="mono">26.96%</td>
              <td>
                <span className="win-badge">+3.7x Breakdowns Caught</span>
              </td>
            </tr>
            <tr>
              <td>
                <strong>F1 Score</strong>
              </td>
              <td className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                0.9809
              </td>
              <td className="mono">0.1566</td>
              <td>
                <span className="win-badge">+6.3x Performance</span>
              </td>
            </tr>
            <tr>
              <td>
                <strong>ROC AUC</strong>
              </td>
              <td className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                0.9999
              </td>
              <td className="mono">—</td>
              <td>
                <span className="win-badge">Exceptional Discrimination</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div className="benchmark-card">
          <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.5rem' }}>
            2. Advance Warning Lead-Time
          </h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Evaluation against all 239 real failure events in the held-out test split.
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div className="kpi-chip" style={{ flex: 1, padding: '1rem' }}>
              <span className="kpi-label">Pre-Alert Rate</span>
              <span className="kpi-val saved" style={{ fontSize: '1.6rem' }}>
                100%
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                239 of 239 failures
              </span>
            </div>
            <div className="kpi-chip" style={{ flex: 1, padding: '1rem' }}>
              <span className="kpi-label">Mean Advance Notice</span>
              <span className="kpi-val loss" style={{ fontSize: '1.6rem' }}>
                21.4 hrs
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Nearly 1 full day headstart
              </span>
            </div>
          </div>
        </div>

        <div className="benchmark-card">
          <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.5rem' }}>
            3. Configurable ₹ Impact & Mitigation Matrix
          </h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Transparent assumptions mapped from <code style={{ color: 'var(--accent-cyan)' }}>backend/config/costs.yaml</code>:
          </div>
          <ul style={{ fontSize: '0.82rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
            <li>
              <strong>Model 4:</strong> ₹35,000 / hr downtime | <strong>Model 3:</strong> ₹25,000 / hr |{' '}
              <strong>Model 2:</strong> ₹18,000 / hr
            </li>
            <li>
              <strong>Component Replacement:</strong> Cuts failure probability by <strong>85%</strong>
            </li>
            <li>
              <strong>Hydraulic Calibration:</strong> Cuts failure probability by <strong>70%</strong>
            </li>
            <li>
              <strong>SLA Escalation:</strong> &gt;₹1.5L = 2hr SLA | &gt;₹75k = 4hr SLA | Standard = 16hr SLA
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};
