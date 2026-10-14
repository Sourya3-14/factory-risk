import React from 'react';
import type { TaskItem } from '../types';

interface KanbanViewProps {
  tasks: TaskItem[];
  onCompleteTask: (taskId: string) => Promise<void>;
}

export const KanbanView: React.FC<KanbanViewProps> = ({ tasks, onCompleteTask }) => {
  const activeTasks = tasks.filter((t) => t.status === 'ACTIVE');
  const escalatedTasks = tasks.filter((t) => t.status === 'ESCALATED');
  const resolvedTasks = tasks.filter((t) => t.status === 'COMPLETED');

  const renderCard = (t: TaskItem) => {
    let levelBadgeClass = 'badge-level1';
    if (t.escalation_level.includes('LEVEL_2')) levelBadgeClass = 'badge-level2';
    if (t.escalation_level.includes('LEVEL_3')) levelBadgeClass = 'badge-level3';

    return (
      <div
        key={t.task_id}
        className={`task-card ${t.status === 'ESCALATED' ? 'escalated' : ''}`}
      >
        <div className="task-top">
          <span className="task-id">
            {t.task_id} • Unit #{t.machine_id}
          </span>
          <span className={`escalation-badge ${levelBadgeClass}`}>
            {t.escalation_level}
          </span>
        </div>
        <div className="task-action-name">{t.action_label}</div>
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--accent-rupee)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          ₹{t.current_loss_inr.toLocaleString('en-IN')} at risk
        </div>
        <div className="task-meta-row">
          <span>
            Owner: <strong>{t.assigned_role}</strong>
          </span>
          <span>SLA: {t.sla_hours}h</span>
        </div>
        {t.hours_overdue > 0 && (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--accent-rose)',
              fontWeight: 700,
              marginTop: '0.35rem',
            }}
          >
            ⚠ OVERDUE BY {t.hours_overdue} HOURS
          </div>
        )}
        {t.status !== 'COMPLETED' ? (
          <button
            className="complete-btn"
            onClick={() => onCompleteTask(t.task_id)}
          >
            ✔ Complete Action (De-Risk Machine)
          </button>
        ) : (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--accent-emerald)',
              fontWeight: 700,
            }}
          >
            ✔ Mitigated: Saved ₹{t.saved_loss_inr.toLocaleString('en-IN')}
          </div>
        )}
      </div>
    );
  };

  return (
    <section id="viewKanban" className="view-section active">
      <div className="fleet-header">
        <div>
          <h2 className="section-title">₹-Weighted Escalation Kanban</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Resolution deadlines shrink as financial exposure rises. Unresolved risks escalate up the chain automatically.
          </div>
        </div>
      </div>

      <div className="kanban-grid">
        {/* Column 1: Active Remediation */}
        <div className="kanban-column">
          <div className="kanban-header">
            <span className="kanban-title">
              <span style={{ color: 'var(--accent-cyan)' }}>●</span> Active Corrective Tasks
            </span>
            <span className="tab-count-badge" id="countActiveTasks">
              {activeTasks.length}
            </span>
          </div>
          <div className="task-list" id="colActiveTasks">
            {activeTasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem', fontSize: '0.85rem' }}>
                No active tasks
              </div>
            ) : (
              activeTasks.map(renderCard)
            )}
          </div>
        </div>

        {/* Column 2: Escalated Hierarchy */}
        <div className="kanban-column" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div className="kanban-header">
            <span className="kanban-title">
              <span style={{ color: 'var(--accent-rose)' }}>▲</span> Escalated (SLA Breached)
            </span>
            <span className="tab-count-badge" style={{ background: 'var(--accent-rose)' }} id="countEscalatedTasks">
              {escalatedTasks.length}
            </span>
          </div>
          <div className="task-list" id="colEscalatedTasks">
            {escalatedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem', fontSize: '0.85rem' }}>
                No escalated tasks
              </div>
            ) : (
              escalatedTasks.map(renderCard)
            )}
          </div>
        </div>

        {/* Column 3: Resolved & Mitigated */}
        <div className="kanban-column">
          <div className="kanban-header">
            <span className="kanban-title">
              <span style={{ color: 'var(--accent-emerald)' }}>✔</span> Resolved & De-Risked
            </span>
            <span className="tab-count-badge" style={{ background: 'var(--accent-emerald)' }} id="countResolvedTasks">
              {resolvedTasks.length}
            </span>
          </div>
          <div className="task-list" id="colResolvedTasks">
            {resolvedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem', fontSize: '0.85rem' }}>
                No resolved tasks yet
              </div>
            ) : (
              resolvedTasks.map(renderCard)
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
