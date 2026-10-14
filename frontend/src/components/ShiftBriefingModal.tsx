import React, { useState } from 'react';
import type { ShiftHandoverBriefing } from '../types';

interface ShiftBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefing: ShiftHandoverBriefing | null;
  isLoading: boolean;
  onRefresh: () => void;
  onEmailSupervisors: () => Promise<void>;
}

export const ShiftBriefingModal: React.FC<ShiftBriefingModalProps> = ({
  isOpen,
  onClose,
  briefing,
  isLoading,
  onRefresh,
  onEmailSupervisors,
}) => {
  const [copied, setCopied] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!briefing) return;
    const text = `
=== YANTRAWATCH SHIFT HANDOVER BRIEFING ===
Time Horizon: ${briefing.timestamp}
Status: ${briefing.shift_status}
Headline: ${briefing.executive_headline}

KPIS:
- Critical Units: ${briefing.kpis.critical_units}
- Warning Units: ${briefing.kpis.warning_units}
- Loss at Risk: ${briefing.kpis.total_loss_at_risk}
- Escalated Tasks: ${briefing.kpis.escalated_tasks}

DIRECTIVE:
${briefing.shift_directive}
============================================
`.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    setEmailStatus(null);
    try {
      await onEmailSupervisors();
      setEmailStatus('Briefing dispatched to all supervisors in database.');
    } catch (err: any) {
      setEmailStatus(`Failed: ${err.message || 'Error sending email'}`);
    } finally {
      setEmailSending(false);
    }
  };

  const statusColor =
    briefing?.shift_status === 'CRITICAL ALERT'
      ? 'var(--accent-rose)'
      : briefing?.shift_status === 'ELEVATED PRECAUTION'
      ? 'var(--accent-amber)'
      : 'var(--accent-emerald)';

  return (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 60 }}>
      <div
        className="modal-box"
        style={{ maxWidth: '850px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <span>📋 Executive Shift Handover Briefing</span>
            <span
              className="status-badge"
              style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              Gemma 4 Plant Sentinel
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div
                style={{
                  display: 'inline-block',
                  fontSize: '2rem',
                  animation: 'spin 1s linear infinite',
                  color: 'var(--accent-cyan)',
                }}
              >
                ⟳
              </div>
              <div style={{ marginTop: '1rem', fontSize: '1rem', color: '#fff', fontWeight: 600 }}>
                Synthesizing Autonomous Fleet & Financial Handover...
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                Analyzing all 25 production units, ₹ loss exposure, and Kanban SLA escalations
              </div>
            </div>
          ) : briefing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Headline Banner */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderLeft: `4px solid ${statusColor}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      color: statusColor,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    ● {briefing.shift_status}
                  </span>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Horizon: {briefing.timestamp.replace('T', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '1.05rem', color: '#fff', fontWeight: 600, marginTop: '0.5rem' }}>
                  {briefing.executive_headline}
                </div>
              </div>

              {/* Plant KPI Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div className="kpi-chip" style={{ padding: '0.75rem' }}>
                  <span className="kpi-label">Critical Units</span>
                  <span className="kpi-val critical" style={{ fontSize: '1.4rem' }}>
                    {briefing.kpis.critical_units}
                  </span>
                </div>
                <div className="kpi-chip" style={{ padding: '0.75rem' }}>
                  <span className="kpi-label">Warning Units</span>
                  <span className="kpi-val loss" style={{ fontSize: '1.4rem' }}>
                    {briefing.kpis.warning_units}
                  </span>
                </div>
                <div className="kpi-chip" style={{ padding: '0.75rem' }}>
                  <span className="kpi-label">Loss at Risk</span>
                  <span className="kpi-val loss" style={{ fontSize: '1.4rem' }}>
                    {briefing.kpis.total_loss_at_risk}
                  </span>
                </div>
                <div className="kpi-chip" style={{ padding: '0.75rem' }}>
                  <span className="kpi-label">Loss Mitigated</span>
                  <span className="kpi-val saved" style={{ fontSize: '1.4rem' }}>
                    {briefing.kpis.cumulative_savings}
                  </span>
                </div>
                <div className="kpi-chip" style={{ padding: '0.75rem' }}>
                  <span className="kpi-label">SLA Breaches</span>
                  <span
                    className="kpi-val"
                    style={{
                      fontSize: '1.4rem',
                      color: briefing.kpis.escalated_tasks > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                    }}
                  >
                    {briefing.kpis.escalated_tasks}
                  </span>
                </div>
              </div>

              {/* Immediate Critical Priorities */}
              {briefing.critical_priorities && briefing.critical_priorities.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Critical Machine Priorities (Incoming Shift)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {briefing.critical_priorities.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem 1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#fff' }}>
                            Unit #{item.machine_id} {item.model ? `(${item.model})` : ''}
                          </span>
                          <span className="mono" style={{ color: 'var(--accent-rupee)', fontSize: '0.8rem' }}>
                            {item.expected_loss} at risk
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          <strong>Fault:</strong> {item.primary_issue}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
                          <strong>Directive:</strong> {item.directive}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SLA Escalations */}
              {briefing.sla_escalations && briefing.sla_escalations.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    SLA Breaches & Escalated Handoffs
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {briefing.sla_escalations.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>
                            {item.task_id} {item.machine_id ? `• Unit #${item.machine_id}` : ''} ({item.action})
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                            Assigned to: <strong style={{ color: 'var(--text-muted)' }}>{item.assigned_role}</strong> | {item.level}
                          </div>
                        </div>
                        <span
                          className="status-badge"
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: 'var(--accent-rose)',
                            fontSize: '0.72rem',
                          }}
                        >
                          Overdue +{item.overdue_hours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operational Shift Directive */}
              <div
                style={{
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  Incoming Shift General Order
                </div>
                <div style={{ fontSize: '0.85rem', color: '#fff', marginTop: '0.35rem', lineHeight: 1.6 }}>
                  {briefing.shift_directive}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button
                  className="ctrl-btn"
                  onClick={handleCopy}
                  style={{ flex: 1, justifyContent: 'center', padding: '0.6rem' }}
                >
                  {copied ? '✔ Copied to Clipboard!' : '📋 Copy Briefing Text'}
                </button>
                <button
                  className="ctrl-btn"
                  onClick={handleSendEmail}
                  disabled={emailSending}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    padding: '0.6rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: 'var(--accent-rose)',
                  }}
                >
                  {emailSending ? 'Dispatching...' : '🚨 Email Briefing to Supervisors'}
                </button>
                <button
                  className="ctrl-btn play-btn"
                  onClick={onRefresh}
                  style={{ width: 'auto', padding: '0.6rem 1rem' }}
                  title="Re-run briefing synthesis"
                >
                  ⟳ Re-Synthesize
                </button>
              </div>

              {emailStatus && (
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent-emerald)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  {emailStatus}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
              No briefing generated yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
