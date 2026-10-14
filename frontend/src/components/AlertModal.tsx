import React, { useState, useEffect, useRef } from 'react';
import type { Machine, ExplainResponse, CopilotMessage } from '../types';
import { explainMachine, notifySupervisor, askMaintenanceCopilot } from '../api';

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
  currentSimulatedTime,
  onAssignTask,
}) => {
  const [modalTab, setModalTab] = useState<'overview' | 'copilot'>('overview');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isGeneratingGemma, setIsGeneratingGemma] = useState(false);
  const [gemmaResult, setGemmaResult] = useState<ExplainResponse | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('replace_worn_component');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Copilot Chat State (Feature 1)
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState('');
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [copilotFollowups, setCopilotFollowups] = useState<string[]>([
    'What replacement parts & tools do I need for this machine?',
    'What safety Lockout/Tagout (LOTO) protocols apply?',
    'Can we derate to 60% capacity to survive the shift?',
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Staged tools checklist state (Feature 4)
  const [stagedTools, setStagedTools] = useState<Record<string, boolean>>({});

  // Reset state when machine changes
  useEffect(() => {
    if (machine) {
      setModalTab('overview');
      setPhotoBase64(null);
      setGemmaResult(null);
      setSelectedAction('replace_worn_component');
      setIsGeneratingGemma(false);
      setIsAssigning(false);
      setEmailStatus(null);
      setStagedTools({});
      setCopilotMessages([
        {
          role: 'assistant',
          text: `Hello! I am your Gemma 4 Maintenance Copilot. I'm actively monitoring Unit #${machine.machine_id} (${machine.model}, age ${machine.age}y). Live telemetry indicates P(Failure) at ${(machine.risk_score * 100).toFixed(1)}% with ₹${machine.expected_loss_inr.toLocaleString('en-IN')} at risk. What diagnostic or teardown questions can I assist you with?`,
          suggested_followups: [
            'What replacement parts & tools do I need for this machine?',
            'What safety Lockout/Tagout (LOTO) protocols apply?',
            'Can we derate to 60% capacity to survive the shift?',
          ],
        },
      ]);
      setCopilotFollowups([
        'What replacement parts & tools do I need for this machine?',
        'What safety Lockout/Tagout (LOTO) protocols apply?',
        'Can we derate to 60% capacity to survive the shift?',
      ]);
    }
  }, [machine]);

  // Scroll copilot chat to bottom on new messages
  useEffect(() => {
    if (modalTab === 'copilot') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [copilotMessages, modalTab]);

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

  const handleSendEmail = async () => {
    if (!machine || isSendingEmail) return;
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await notifySupervisor(machine.machine_id, currentSimulatedTime, true);
      if (res && res.sent) {
        const recipients = (res.recipients || []).join(', ');
        setEmailStatus(`Alert email sent to supervisor (${recipients})`);
      } else {
        setEmailStatus(res?.reason || 'Could not send alert email (check supervisor in DB or SMTP settings)');
      }
    } catch (err: any) {
      setEmailStatus(`Failed: ${err.message || 'Error sending alert email'}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendCopilotQuestion = async (qText: string) => {
    if (!qText.trim() || isCopilotLoading) return;
    const userMsg: CopilotMessage = { role: 'user', text: qText.trim() };
    const updatedMessages = [...copilotMessages, userMsg];
    setCopilotMessages(updatedMessages);
    setCopilotInput('');
    setIsCopilotLoading(true);

    try {
      const res = await askMaintenanceCopilot({
        machine_id: machine.machine_id,
        question: qText.trim(),
        model_name: machine.model,
        age: machine.age,
        risk_score: machine.risk_score,
        expected_loss_inr: machine.expected_loss_inr,
        sla_hours: machine.sla_hours,
        telemetry: machine.telemetry,
        top_factors: machine.top_factors,
        chat_history: updatedMessages.map((m) => ({ role: m.role, text: m.text })),
      });

      setCopilotMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.reply,
          suggested_followups: res.suggested_followups,
          safety_warning: res.safety_warning,
        },
      ]);
      if (res.suggested_followups && res.suggested_followups.length > 0) {
        setCopilotFollowups(res.suggested_followups);
      }
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Encountered an issue communicating with Copilot service: ${err.message || 'Network error'}. Please retry.`,
        },
      ]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const toggleToolStaged = (tool: string) => {
    setStagedTools((prev) => ({ ...prev, [tool]: !prev[tool] }));
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
      <div className="modal-box" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
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

        {/* Modal Navigation Tabs (Overview vs Copilot) */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--border-glass)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <button
            type="button"
            className={`tab-btn ${modalTab === 'overview' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
            onClick={() => setModalTab('overview')}
          >
            📋 Diagnosis & Triage
          </button>
          <button
            type="button"
            className={`tab-btn ${modalTab === 'copilot' ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setModalTab('copilot')}
          >
            <span style={{ color: 'var(--accent-cyan)' }}>🤖</span>
            Maintenance Copilot
            <span
              className="tab-count-badge"
              style={{
                background: 'rgba(6, 182, 212, 0.25)',
                color: 'var(--accent-cyan)',
                fontSize: '0.65rem',
              }}
            >
              Gemma 4
            </span>
          </button>
        </div>

        <div className="modal-body">
          {modalTab === 'overview' ? (
            <>
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
                        Supports JPG, PNG (worn bearing cage, seal blow, heat discolouration)
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
                    Synthesizing Multimodal Diagnosis & Visual Triage...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Plain-Language Diagnosis & Defect Triage (Gemma 4)
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

                  {/* Feature 4: Visual Defect Triage Card */}
                  {gemmaResult.visual_triage && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                          🔬 Visual Defect Triage (Feature 4)
                        </span>
                        <span
                          className="status-badge"
                          style={{
                            background:
                              gemmaResult.visual_triage.defect_severity === 'CATASTROPHIC' ||
                              gemmaResult.visual_triage.defect_severity === 'SEVERE'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                            color:
                              gemmaResult.visual_triage.defect_severity === 'CATASTROPHIC' ||
                              gemmaResult.visual_triage.defect_severity === 'SEVERE'
                                ? 'var(--accent-rose)'
                                : 'var(--accent-amber)',
                            fontSize: '0.7rem',
                          }}
                        >
                          Severity: {gemmaResult.visual_triage.defect_severity}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: '#fff' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Detected Assembly: </span>
                          <strong>{gemmaResult.visual_triage.detected_component}</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#fff' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Failure Mechanism: </span>
                          <strong style={{ color: 'var(--accent-rose)' }}>{gemmaResult.visual_triage.defect_class}</strong>
                        </div>
                      </div>

                      {/* Tooling checklist */}
                      {gemmaResult.visual_triage.recommended_tools && (
                        <div style={{ marginTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Required ISO/DIN Technician Tooling Checklist:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {gemmaResult.visual_triage.recommended_tools.map((tool, idx) => (
                              <label
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  background: stagedTools[tool] ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${stagedTools[tool] ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.1)'}`,
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.75rem',
                                  color: stagedTools[tool] ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!stagedTools[tool]}
                                  onChange={() => toggleToolStaged(tool)}
                                />
                                {tool}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                  <button
                    type="button"
                    className="ctrl-btn"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: 'var(--accent-rose)',
                      padding: '0.45rem 1rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: isSendingEmail ? 'not-allowed' : 'pointer',
                    }}
                    disabled={isSendingEmail}
                    onClick={handleSendEmail}
                  >
                    {isSendingEmail ? 'Sending Email...' : '🚨 Alert Supervisor (Email)'}
                  </button>
                </div>
                {emailStatus && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      background: emailStatus.startsWith('Alert email sent')
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      color: emailStatus.startsWith('Alert email sent')
                        ? 'var(--accent-emerald)'
                        : 'var(--accent-rose)',
                      border: `1px solid ${
                        emailStatus.startsWith('Alert email sent')
                          ? 'rgba(16, 185, 129, 0.3)'
                          : 'rgba(239, 68, 68, 0.3)'
                      }`,
                    }}
                  >
                    {emailStatus}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Feature 1: Interactive Maintenance Copilot Tab */
            <div style={{ display: 'flex', flexDirection: 'column', height: '550px' }}>
              <div
                style={{
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    Gemma 4 Maintenance Copilot • Unit #{machine.machine_id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                    Live context: {machine.model} | P(Failure): {(machine.risk_score * 100).toFixed(1)}% | SLA: {machine.sla_hours}h
                  </div>
                </div>
                <span className="win-badge" style={{ fontSize: '0.7rem' }}>
                  Interactive AI Active
                </span>
              </div>

              {/* Chat Thread */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  padding: '0.5rem',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {copilotMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        background:
                          msg.role === 'user'
                            ? 'linear-gradient(135deg, #0284c7, #06b6d4)'
                            : 'rgba(26, 38, 64, 0.9)',
                        color: '#fff',
                        border: msg.role === 'assistant' ? '1px solid var(--border-glass)' : 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                    >
                      {msg.text}

                      {msg.safety_warning && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--accent-rose)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          ⚠️ {msg.safety_warning}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.2rem', padding: '0 0.4rem' }}>
                      {msg.role === 'user' ? 'You' : 'Gemma Copilot'}
                    </span>
                  </div>
                ))}

                {isCopilotLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontSize: '0.8rem', padding: '0.5rem' }}>
                    <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
                    Gemma Copilot is analyzing equipment specs & telemetry...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Action Suggestion Chips */}
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', width: '100%' }}>
                  Suggested Follow-ups:
                </span>
                {copilotFollowups.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendCopilotQuestion(q)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    💬 {q}
                  </button>
                ))}
              </div>

              {/* Chat Input Field */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCopilotQuestion(copilotInput);
                }}
                style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}
              >
                <input
                  type="text"
                  placeholder="Ask Gemma about parts, safety LOTO, torque specs, derating..."
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  disabled={isCopilotLoading}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent-cyan)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-glass)')}
                />
                <button
                  type="submit"
                  className="ctrl-btn play-btn"
                  disabled={!copilotInput.trim() || isCopilotLoading}
                  style={{ width: 'auto', padding: '0.6rem 1.25rem' }}
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
