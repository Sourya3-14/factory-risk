import React from 'react';
import type { Machine } from '../types';

interface MachineCardProps {
  machine: Machine;
  onClick: (machine: Machine) => void;
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, onClick }) => {
  const statusClass =
    machine.alert_status === 'CRITICAL'
      ? 'status-critical'
      : machine.alert_status === 'WARNING'
      ? 'status-warning'
      : '';

  const badgeClass =
    machine.alert_status === 'CRITICAL'
      ? 'badge-critical'
      : machine.alert_status === 'WARNING'
      ? 'badge-warning'
      : 'badge-normal';

  const barColor =
    machine.alert_status === 'CRITICAL'
      ? 'var(--accent-rose)'
      : machine.alert_status === 'WARNING'
      ? 'var(--accent-amber)'
      : 'var(--accent-emerald)';

  return (
    <div className={`machine-card ${statusClass}`} onClick={() => onClick(machine)}>
      <div className="card-top">
        <div className="machine-ident">
          <span className="machine-number">Unit #{machine.machine_id}</span>
          <span className="model-tag">
            {machine.model} ({machine.age}y)
          </span>
        </div>
        <span className={`status-badge ${badgeClass}`}>
          {machine.alert_status === 'CRITICAL' && '● '}
          {machine.alert_status}
        </span>
      </div>

      <div className="card-loss-wrap">
        <div className="loss-row">
          <span className="loss-label">₹ Exposure (24h)</span>
          <span className="loss-amount">₹{machine.expected_loss_inr.toLocaleString('en-IN')}</span>
        </div>
        <div className="risk-progress-bg">
          <div
            className="risk-progress-fill"
            style={{
              width: `${(machine.risk_score * 100).toFixed(1)}%`,
              background: barColor,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            P(Failure): {(machine.risk_score * 100).toFixed(1)}%
          </span>
          <span className="sla-pill">SLA: {machine.sla_hours}h</span>
        </div>
      </div>

      <div className="sensors-row">
        <div className="sensor-box">
          <div className="sensor-name">Volt</div>
          <div className="sensor-val">{machine.telemetry.volt}V</div>
        </div>
        <div className="sensor-box">
          <div className="sensor-name">Rotate</div>
          <div className="sensor-val">{machine.telemetry.rotate}</div>
        </div>
        <div className="sensor-box">
          <div className="sensor-name">Pressure</div>
          <div className="sensor-val">{machine.telemetry.pressure}</div>
        </div>
        <div className="sensor-box">
          <div className="sensor-name">Vibration</div>
          <div
            className="sensor-val"
            style={
              machine.telemetry.vibration > 45
                ? { color: 'var(--accent-rose)', fontWeight: 700 }
                : undefined
            }
          >
            {machine.telemetry.vibration}
          </div>
        </div>
      </div>
    </div>
  );
};
