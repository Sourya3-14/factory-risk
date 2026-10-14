import React from 'react';
import type { Machine, FilterType } from '../types';
import { MachineCard } from './MachineCard';

interface FleetMatrixProps {
  machines: Machine[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onSelectMachine: (machine: Machine) => void;
}

export const FleetMatrix: React.FC<FleetMatrixProps> = ({
  machines,
  activeFilter,
  onFilterChange,
  onSelectMachine,
}) => {
  const filteredMachines = machines.filter((m) => {
    if (activeFilter === 'all') return true;
    return m.alert_status === activeFilter;
  });

  return (
    <section id="viewFleet" className="view-section active">
      <div className="fleet-header">
        <h2 className="section-title">
          <span>Factory Fleet Status</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
            ({machines.length} Monitored Production Units)
          </span>
        </h2>
        <div className="fleet-filter-bar">
          <button
            className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            All ({machines.length})
          </button>
          <button
            className={`filter-pill ${activeFilter === 'CRITICAL' ? 'active' : ''}`}
            onClick={() => onFilterChange('CRITICAL')}
          >
            Critical Only
          </button>
          <button
            className={`filter-pill ${activeFilter === 'WARNING' ? 'active' : ''}`}
            onClick={() => onFilterChange('WARNING')}
          >
            Warning Only
          </button>
          <button
            className={`filter-pill ${activeFilter === 'NORMAL' ? 'active' : ''}`}
            onClick={() => onFilterChange('NORMAL')}
          >
            Normal
          </button>
        </div>
      </div>

      <div className="machine-grid" id="machineGrid">
        {filteredMachines.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: 'var(--text-dim)',
              padding: '3rem',
            }}
          >
            No machines matching status filter &ldquo;{activeFilter}&rdquo;
          </div>
        ) : (
          filteredMachines.map((m) => (
            <MachineCard key={m.machine_id} machine={m} onClick={onSelectMachine} />
          ))
        )}
      </div>
    </section>
  );
};
