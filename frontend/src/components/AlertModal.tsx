import React, { useState, useEffect, useRef } from 'react';
import type { Machine, ExplainResponse } from '../types';
import { explainMachine } from '../api';

interface AlertModalProps {
  machine: Machine | null;
  onClose: () => void;
  currentSimulatedTime: string;
  onAssignTask: (actionType: string) => Promise<void>;
}

const ACTION_OPTIONS = [
  { value: 'replace_worn_component', label: 'Replace Worn Component (85% Risk Reduction)' },
  { value: 'calibrate_pressure_valve', label: 'Calibrate Pressure Valve (70% Risk Reduction)' },
  { value: 'tighten_electrical_leads', label: 'Tighten Electrical Connections (60% Risk Reduction)' },
  { value: 'lubricate_and_cool', label: 'Lubricate & Flush Assembly (50% Risk Reduction)' },
  { value: 'inspect_and_clean', label: 'Comprehensive Safety Inspection (40% Risk Reduction)' },
];

export const AlertModal: React.FC<AlertModalProps> = ({
  machine,
  onClose,
  onAssignTask,
}) => {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isGeneratingGemma, setIsGeneratingGemma] = useState(false);
  const [gemmaResult, setGemmaResult] = useState<ExplainResponse | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('replace_worn_component');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when machine changes
  useEffect(() => {
    if (machine) {
      setPhotoBase64(null);
      setGemmaResult(null);
      setSelectedAction('replace_worn_component');
      setIsGeneratingGemma(false);
      setIsAssigning(false);
    }
  }, [machine]);

  if (!machine) return null;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPhotoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRunGemma = async () => {
    if (!machine || isGeneratingGemma) return;
    setIsGeneratingGemma(true);

    try {
      const res = await explainMachine({
        machine_id: machine.machine_id,
        model_name: machine.model,
        age: machine.age,
        risk_score: machine.risk_score,
        alert_status: machine.alert_status,
        expected_loss_inr: machine.expected_loss_inr,
        hourly_cost_inr: machine.hourly_cost_inr,
        downtime_hours: machine.downtime_hours,
        telemetry: machine.telemetry,
        top_factors: machine.top_factors,
        photo_base64: photoBase64,
      });
      setGemmaResult(res);
    } catch (err) {
      console.error('Error running Gemma diagnosis:', err);
    } finally {
      setIsGeneratingGemma(false);
    }
  };

  const handleAssign = async () => {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      await onAssignTask(selectedAction);
      onClose();
    } catch (err) {
      console.error('Error assigning task:', err);
    } finally {
      setIsAssigning(false);
    }
  };

  const badgeClass =
    machine.alert_status === 'CRITICAL'
      ? 'badge-critical'
      : machine.alert_status === 'WARNING'
      ? 'badge-warning'
      : 'badge-normal';

  const lossFormatted = `₹${machine.expected_loss_inr.toLocaleString('en-IN')}`;
  const rateFormatted = `₹${machine.hourly_cost_inr.toLocaleString('en-IN')}/hr`;

  return (
    <div className="modal-overlay active" id="alertModal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span id="modalMachineTitle">
              Machine #{machine.machine_id} ({machine.model}, age {machine.age}y)
            </span>
            <span className={`status-badge ${badgeClass}`} id="modalAlertBadge">
              {machine.alert_status}
            </span>
          </div>
          <button className="close-btn" id="modalCloseBtn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Verified Financial Formula Card */}
          <div className="fin-equation-card">
            <div
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                letterSpacing: '0.05em',
              }}
            >
              Verified Financial Loss Equation
            </div>
            <div className="eq-formula" id="modalFormulaEquation">
              Expected Loss = {(machine.risk_score * 100).toFixed(1)}% × {machine.downtime_hours} hrs × {rateFormatted} = {lossFormatted}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }} id="modalSlaText">
              Dynamic Escalation SLA: <strong>{machine.sla_hours} Hours</strong> (Shrinks automatically as ₹ risk rises)
            </div>
          </div>

          {/* Live Sensor Telemetry */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
              }}
            >
              Live Sensor Telemetry
            </h4>
            <div
              className="sensors-row"
              id="modalTelemetryRow"
              style={{
                gridTemplateColumns: 'repeat(4, 1fr)',
                padding: '0.85rem',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 'var(--radius-sm)',
                borderTop: 'none',
              }}
            >
              <div className="sensor-box">
                <div className="sensor-name">Voltage</div>
                <div className="sensor-val">{machine.telemetry.volt} V</div>
              </div>
              <div className="sensor-box">
                <div className="sensor-name">Rotation</div>
                <div className="sensor-val">{machine.telemetry.rotate} rpm</div>
              </div>
              <div className="sensor-box">
                <div className="sensor-name">Hydraulic Pressure</div>
                <div className="sensor-val">{machine.telemetry.pressure} psi</div>
              </div>
              <div className="sensor-box">
                <div className="sensor-name">Vibration</div>
                <div className="sensor-val" style={{ color: 'var(--accent-rose)' }}>
                  {machine.telemetry.vibration} mm/s
                </div>
              </div>
            </div>
          </div>

          {/* Top Contributing Drivers (TreeSHAP) */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
              }}
            >
              Top Contributing Drivers (TreeSHAP)
            </h4>
            <div className="factors-list" id="modalFactorsList">
              {machine.top_factors.map((f, i) => {
                const impactPercent = Math.min(Math.max((Math.abs(f.shap_impact) / 5) * 100, 15), 100);
                return (
                  <div key={i} className="factor-item">
                    <div className="factor-header">
                      <span className="factor-label">
                        {f.label} ({f.current_value})
                      </span>
                      <span className="factor-impact">TreeSHAP Impact: +{f.shap_impact}</span>
                    </div>
                    <div className="factor-bar-bg">
                      <div className="factor-bar-fill" style={{ width: `${impactPercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Photo Upload & Evidence Dropzone */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
              }}
            >
              Visual Evidence (Optional Technician Photo)
            </h4>
            <div
              className="photo-upload-wrap"
              id="dropZone"
              style={{
                borderColor: isDragOver ? 'var(--accent-cyan)' : undefined,
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              {!photoBase64 ? (
                <div id="dropPrompt">
                  <svg
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{ margin: '0 auto 0.5rem', color: 'var(--text-dim)', display: 'block' }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Click to attach equipment photo or drag & drop
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                    Supports JPG, PNG (fault code display, worn bearing, leaking seal)
                  </div>
                </div>
              ) : (
                <>
                  <img src={photoBase64} alt="Uploaded preview" className="preview-img" style={{ display: 'block' }} />
                  <button
                    onClick={handleClearPhoto}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-rose)',
                      fontSize: '0.75rem',
                      marginTop: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove Photo
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Gemma 4 Diagnosis Action Button */}
          <button
            className="ctrl-btn play-btn"
            id="btnRunGemma"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem' }}
            disabled={isGeneratingGemma}
            onClick={handleRunGemma}
          >
            {isGeneratingGemma ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                Synthesizing Multimodal Diagnosis...
              </>
            ) : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Plain-Language Diagnosis (Gemma 4)
              </>
            )}
          </button>

          {/* Gemma Output Box */}
          {gemmaResult && (
            <div className="gemma-box" style={{ display: 'block' }}>
              <div className="gemma-badge">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span>{gemmaResult.source || 'Gemma 4 Multimodal Explanation'}</span>
              </div>
              <div className="gemma-summary">{gemmaResult.summary}</div>

              {gemmaResult.root_causes && gemmaResult.root_causes.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Floor Root Causes:</strong>
                  <ul className="gemma-list" style={{ marginTop: '0.35rem' }}>
                    {gemmaResult.root_causes.map((rc, i) => (
                      <li key={i}>{rc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gemmaResult.recommended_actions && gemmaResult.recommended_actions.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Prescribed Mitigation Steps:</strong>
                  <ul className="gemma-list" style={{ marginTop: '0.35rem' }}>
                    {gemmaResult.recommended_actions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gemmaResult.photo_observation && (
                <div style={{ marginTop: '0.75rem' }}>
                  <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Visual Photo Observation:</strong>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {gemmaResult.photo_observation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Task Assignment Form */}
          <div
            style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass)',
            }}
          >
            <h4 style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.75rem' }}>
              Create Corrective Action & Start SLA Clock
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select
                id="actionTypeSelect"
                className="jump-select"
                style={{ flex: 1, minWidth: '200px' }}
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                className="complete-btn"
                id="btnAssignAction"
                style={{ marginTop: 0, width: 'auto', padding: '0.45rem 1.25rem' }}
                disabled={isAssigning}
                onClick={handleAssign}
              >
                {isAssigning ? 'Assigning...' : 'Assign to Technician'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
