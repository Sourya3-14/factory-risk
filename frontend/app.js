// YantraWatch - Main Frontend Application Logic
// Handles stream replay, simulated clock, fleet status, Gemma 4 modal, and Kanban escalation

let streamIndex = [];
let currentTickIndex = 0;
let isPlaying = false;
let playInterval = null;
let currentMachinesData = [];
let selectedMachine = null;
let uploadedPhotoBase64 = null;
let activeFilter = 'all';

// DOM Elements
const timeSlider = document.getElementById('timeSlider');
const sliderTickLabel = document.getElementById('sliderTickLabel');
const clockTimestamp = document.getElementById('clockTimestamp');
const btnPlayPause = document.getElementById('btnPlayPause');
const playIcon = document.getElementById('playIcon');
const btnPrevTick = document.getElementById('btnPrevTick');
const btnNextTick = document.getElementById('btnNextTick');
const jumpFailureSelect = document.getElementById('jumpFailureSelect');
const machineGrid = document.getElementById('machineGrid');

const globalRiskLoss = document.getElementById('globalRiskLoss');
const globalCriticalCount = document.getElementById('globalCriticalCount');
const globalLossSaved = document.getElementById('globalLossSaved');
const activeTasksBadge = document.getElementById('activeTasksBadge');

// Modal Elements
const alertModal = document.getElementById('alertModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalMachineTitle = document.getElementById('modalMachineTitle');
const modalAlertBadge = document.getElementById('modalAlertBadge');
const modalFormulaEquation = document.getElementById('modalFormulaEquation');
const modalSlaText = document.getElementById('modalSlaText');
const modalTelemetryRow = document.getElementById('modalTelemetryRow');
const modalFactorsList = document.getElementById('modalFactorsList');
const btnRunGemma = document.getElementById('btnRunGemma');
const gemmaOutputBox = document.getElementById('gemmaOutputBox');
const gemmaSummaryText = document.getElementById('gemmaSummaryText');
const gemmaRootCausesList = document.getElementById('gemmaRootCausesList');
const gemmaActionsList = document.getElementById('gemmaActionsList');
const gemmaPhotoObsWrap = document.getElementById('gemmaPhotoObsWrap');
const gemmaPhotoObsText = document.getElementById('gemmaPhotoObsText');
const gemmaSourceLabel = document.getElementById('gemmaSourceLabel');

// Photo Upload Elements
const dropZone = document.getElementById('dropZone');
const photoInput = document.getElementById('photoInput');
const dropPrompt = document.getElementById('dropPrompt');
const imagePreview = document.getElementById('imagePreview');
const btnRemovePhoto = document.getElementById('btnRemovePhoto');
const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');

// Kanban Elements
const actionTypeSelect = document.getElementById('actionTypeSelect');
const btnAssignAction = document.getElementById('btnAssignAction');
const colActiveTasks = document.getElementById('colActiveTasks');
const colEscalatedTasks = document.getElementById('colEscalatedTasks');
const colResolvedTasks = document.getElementById('colResolvedTasks');
const countActiveTasks = document.getElementById('countActiveTasks');
const countEscalatedTasks = document.getElementById('countEscalatedTasks');
const countResolvedTasks = document.getElementById('countResolvedTasks');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupPhotoDropzone();
  setupControls();

  if (geminiApiKeyInput) {
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    geminiApiKeyInput.value = savedKey;
    geminiApiKeyInput.addEventListener('change', (e) => {
      localStorage.setItem('gemini_api_key', e.target.value.trim());
    });
  }

  await loadStreamIndex();
  await loadMetrics();
  await loadTasks();
});

// --- Tab Navigation ---
function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(tab.dataset.view);
      if (targetView) targetView.classList.add('active');
    });
  });

  // Filter pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      renderFleetGrid();
    });
  });
}

// --- Load Stream Index & Initial Tick ---
async function loadStreamIndex() {
  try {
    const res = await fetch('/api/stream/index');
    streamIndex = await res.json();
    timeSlider.max = streamIndex.length - 1;
    timeSlider.value = 0;
    await loadTick(0);
  } catch (err) {
    console.error('Error loading stream index:', err);
  }
}

async function loadMetrics() {
  try {
    const res = await fetch('/api/metrics');
    const data = await res.json();
    if (data.lead_time_metrics) {
      console.log('Model evaluation loaded:', data);
    }
  } catch (err) {
    console.error('Error loading metrics:', err);
  }
}

async function loadTick(index) {
  if (!streamIndex[index]) return;
  currentTickIndex = index;
  const tickMeta = streamIndex[index];
  const isoTime = tickMeta.timestamp;

  clockTimestamp.textContent = isoTime.replace('T', ' ');
  timeSlider.value = index;
  sliderTickLabel.textContent = `Tick: ${index + 1}/${streamIndex.length}`;

  try {
    const res = await fetch(`/api/stream/tick/${encodeURIComponent(isoTime)}`);
    const data = await res.json();
    currentMachinesData = data.machines;
    renderFleetGrid();
    updateGlobalKpis();

    // Sync active tasks with simulated time
    await syncClockTasks(isoTime);
  } catch (err) {
    console.error(`Error loading tick ${isoTime}:`, err);
  }
}

// --- Render Fleet Matrix ---
function renderFleetGrid() {
  machineGrid.innerHTML = '';

  const filtered = currentMachinesData.filter(m => {
    if (activeFilter === 'all') return true;
    return m.alert_status === activeFilter;
  });

  if (filtered.length === 0) {
    machineGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 3rem;">No machines matching status filter "${activeFilter}"</div>`;
    return;
  }

  filtered.forEach(m => {
    const card = document.createElement('div');
    const statusClass = m.alert_status === 'CRITICAL' ? 'status-critical' : (m.alert_status === 'WARNING' ? 'status-warning' : '');
    const badgeClass = m.alert_status === 'CRITICAL' ? 'badge-critical' : (m.alert_status === 'WARNING' ? 'badge-warning' : 'badge-normal');
    const barColor = m.alert_status === 'CRITICAL' ? 'var(--accent-rose)' : (m.alert_status === 'WARNING' ? 'var(--accent-amber)' : 'var(--accent-emerald)');

    card.className = `machine-card ${statusClass}`;
    card.innerHTML = `
      <div class="card-top">
        <div class="machine-ident">
          <span class="machine-number">Unit #${m.machine_id}</span>
          <span class="model-tag">${m.model} (${m.age}y)</span>
        </div>
        <span class="status-badge ${badgeClass}">
          ${m.alert_status === 'CRITICAL' ? '● ' : ''}${m.alert_status}
        </span>
      </div>

      <div class="card-loss-wrap">
        <div class="loss-row">
          <span class="loss-label">₹ Exposure (24h)</span>
          <span class="loss-amount">₹${m.expected_loss_inr.toLocaleString('en-IN')}</span>
        </div>
        <div class="risk-progress-bg">
          <div class="risk-progress-fill" style="width: ${(m.risk_score * 100).toFixed(1)}%; background: ${barColor};"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.35rem;">
          <span style="font-size: 0.7rem; color: var(--text-dim);">P(Failure): ${(m.risk_score * 100).toFixed(1)}%</span>
          <span class="sla-pill">SLA: ${m.sla_hours}h</span>
        </div>
      </div>

      <div class="sensors-row">
        <div class="sensor-box">
          <div class="sensor-name">Volt</div>
          <div class="sensor-val">${m.telemetry.volt}V</div>
        </div>
        <div class="sensor-box">
          <div class="sensor-name">Rotate</div>
          <div class="sensor-val">${m.telemetry.rotate}</div>
        </div>
        <div class="sensor-box">
          <div class="sensor-name">Pressure</div>
          <div class="sensor-val">${m.telemetry.pressure}</div>
        </div>
        <div class="sensor-box">
          <div class="sensor-name">Vibration</div>
          <div class="sensor-val" style="${m.telemetry.vibration > 45 ? 'color: var(--accent-rose); font-weight:700;' : ''}">${m.telemetry.vibration}</div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openAlertModal(m));
    machineGrid.appendChild(card);
  });
}

function updateGlobalKpis() {
  const critCount = currentMachinesData.filter(m => m.alert_status === 'CRITICAL').length;
  const totLoss = currentMachinesData
    .filter(m => m.alert_status !== 'NORMAL')
    .reduce((sum, m) => sum + m.expected_loss_inr, 0);

  globalCriticalCount.textContent = critCount;
  globalRiskLoss.textContent = `₹${totLoss.toLocaleString('en-IN')}`;
}

// --- Playback Controls ---
function setupControls() {
  timeSlider.addEventListener('input', (e) => {
    loadTick(parseInt(e.target.value));
  });

  btnPrevTick.addEventListener('click', () => {
    if (currentTickIndex > 0) loadTick(currentTickIndex - 1);
  });

  btnNextTick.addEventListener('click', () => {
    if (currentTickIndex < streamIndex.length - 1) loadTick(currentTickIndex + 1);
  });

  btnPlayPause.addEventListener('click', togglePlay);

  jumpFailureSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    const matchIdx = streamIndex.findIndex(s => s.timestamp === val);
    if (matchIdx !== -1) {
      loadTick(matchIdx);
    }
  });
}

function togglePlay() {
  isPlaying = !isPlaying;
  if (isPlaying) {
    playIcon.textContent = '⏸ Pause';
    btnPlayPause.classList.add('playing');
    playInterval = setInterval(() => {
      if (currentTickIndex < streamIndex.length - 1) {
        loadTick(currentTickIndex + 1);
      } else {
        togglePlay();
      }
    }, 1800);
  } else {
    playIcon.textContent = '▶ Play';
    btnPlayPause.classList.remove('playing');
    clearInterval(playInterval);
  }
}

// --- Alert Modal & Gemma 4 Integration ---
function openAlertModal(machine) {
  selectedMachine = machine;
  modalMachineTitle.textContent = `Machine #${machine.machine_id} (${machine.model}, age ${machine.age}y)`;
  modalAlertBadge.textContent = machine.alert_status;
  modalAlertBadge.className = `status-badge ${machine.alert_status === 'CRITICAL' ? 'badge-critical' : (machine.alert_status === 'WARNING' ? 'badge-warning' : 'badge-normal')}`;

  const lossFormatted = `₹${machine.expected_loss_inr.toLocaleString('en-IN')}`;
  const rateFormatted = `₹${machine.hourly_cost_inr.toLocaleString('en-IN')}/hr`;
  modalFormulaEquation.textContent = `Expected Loss = ${(machine.risk_score * 100).toFixed(1)}% × ${machine.downtime_hours} hrs × ${rateFormatted} = ${lossFormatted}`;
  modalSlaText.innerHTML = `Dynamic Escalation SLA: <strong>${machine.sla_hours} Hours</strong> (Shrinks automatically as ₹ risk rises)`;

  // Sensors
  modalTelemetryRow.innerHTML = `
    <div class="sensor-box"><div class="sensor-name">Voltage</div><div class="sensor-val">${machine.telemetry.volt} V</div></div>
    <div class="sensor-box"><div class="sensor-name">Rotation</div><div class="sensor-val">${machine.telemetry.rotate} rpm</div></div>
    <div class="sensor-box"><div class="sensor-name">Hydraulic Pressure</div><div class="sensor-val">${machine.telemetry.pressure} psi</div></div>
    <div class="sensor-box"><div class="sensor-name">Vibration</div><div class="sensor-val" style="color: var(--accent-rose);">${machine.telemetry.vibration} mm/s</div></div>
  `;

  // Top Factors (SHAP)
  modalFactorsList.innerHTML = '';
  machine.top_factors.forEach(f => {
    const item = document.createElement('div');
    item.className = 'factor-item';
    const impactPercent = Math.min(Math.max((Math.abs(f.shap_impact) / 5) * 100, 15), 100);
    item.innerHTML = `
      <div class="factor-header">
        <span class="factor-label">${f.label} (${f.current_value})</span>
        <span class="factor-impact">TreeSHAP Impact: +${f.shap_impact}</span>
      </div>
      <div class="factor-bar-bg">
        <div class="factor-bar-fill" style="width: ${impactPercent}%;"></div>
      </div>
    `;
    modalFactorsList.appendChild(item);
  });

  // Reset Gemma box and photo
  gemmaOutputBox.style.display = 'none';
  clearPhotoUpload();

  alertModal.classList.add('active');
}

modalCloseBtn.addEventListener('click', () => alertModal.classList.remove('active'));
alertModal.addEventListener('click', (e) => {
  if (e.target === alertModal) alertModal.classList.remove('active');
});

// Photo upload handlers
function setupPhotoDropzone() {
  dropZone.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', handleFileSelect);

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent-cyan)';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  btnRemovePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPhotoUpload();
  });
}

function handleFileSelect(e) {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedPhotoBase64 = e.target.result;
    imagePreview.src = uploadedPhotoBase64;
    imagePreview.style.display = 'block';
    dropPrompt.style.display = 'none';
    btnRemovePhoto.style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
}

function clearPhotoUpload() {
  uploadedPhotoBase64 = null;
  photoInput.value = '';
  imagePreview.src = '';
  imagePreview.style.display = 'none';
  dropPrompt.style.display = 'block';
  btnRemovePhoto.style.display = 'none';
}

// Gemma 4 API Request
btnRunGemma.addEventListener('click', async () => {
  if (!selectedMachine) return;

  btnRunGemma.disabled = true;
  btnRunGemma.innerHTML = `
    <span style="display: inline-block; animation: spin 1s linear infinite;">⟳</span>
    Synthesizing Multimodal Diagnosis...
  `;

  try {
    const userKey = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : null;
    const payload = {
      machine_id: selectedMachine.machine_id,
      model_name: selectedMachine.model,
      age: selectedMachine.age,
      risk_score: selectedMachine.risk_score,
      alert_status: selectedMachine.alert_status,
      expected_loss_inr: selectedMachine.expected_loss_inr,
      hourly_cost_inr: selectedMachine.hourly_cost_inr,
      downtime_hours: selectedMachine.downtime_hours,
      telemetry: selectedMachine.telemetry,
      top_factors: selectedMachine.top_factors,
      photo_base64: uploadedPhotoBase64,
      api_key: userKey || undefined
    };

    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    gemmaSourceLabel.textContent = data.source || 'Gemma 4 Multimodal Explanation';
    gemmaSummaryText.textContent = data.summary || 'Summary unavailable.';

    gemmaRootCausesList.innerHTML = '';
    (data.root_causes || []).forEach(rc => {
      const li = document.createElement('li');
      li.textContent = rc;
      gemmaRootCausesList.appendChild(li);
    });

    gemmaActionsList.innerHTML = '';
    (data.recommended_actions || []).forEach(act => {
      const li = document.createElement('li');
      li.textContent = act;
      gemmaActionsList.appendChild(li);
    });

    if (data.photo_observation) {
      gemmaPhotoObsWrap.style.display = 'block';
      gemmaPhotoObsText.textContent = data.photo_observation;
    } else {
      gemmaPhotoObsWrap.style.display = 'none';
    }

    gemmaOutputBox.style.display = 'block';

  } catch (err) {
    console.error('Error generating Gemma diagnosis:', err);
  } finally {
    btnRunGemma.disabled = false;
    btnRunGemma.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
      Generate Plain-Language Diagnosis (Gemma 4)
    `;
  }
});

// --- Kanban & Task Creation ---
btnAssignAction.addEventListener('click', async () => {
  if (!selectedMachine) return;
  const currentSimulatedTime = streamIndex[currentTickIndex]?.timestamp || '2015-09-01T00:00:00';
  const actionType = actionTypeSelect.value;

  try {
    const res = await fetch('/api/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: selectedMachine.machine_id,
        machine_model: selectedMachine.model,
        current_simulated_time: currentSimulatedTime,
        risk_score: selectedMachine.risk_score,
        expected_loss_inr: selectedMachine.expected_loss_inr,
        sla_hours: selectedMachine.sla_hours,
        action_type: actionType,
        notes: `Created via YantraWatch alert console`
      })
    });

    if (res.ok) {
      alertModal.classList.remove('active');
      await loadTasks();

      // Switch to Kanban view to demonstrate accountability
      document.getElementById('tabKanbanBtn').click();
    }
  } catch (err) {
    console.error('Error creating task:', err);
  }
});

async function syncClockTasks(isoTime) {
  try {
    const res = await fetch('/api/clock/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_simulated_time: isoTime })
    });
    const tasks = await res.json();
    renderKanbanTasks(tasks);
  } catch (err) {
    console.error('Error syncing clock tasks:', err);
  }
}

async function loadTasks() {
  try {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    renderKanbanTasks(tasks);
  } catch (err) {
    console.error('Error loading tasks:', err);
  }
}

function renderKanbanTasks(tasks) {
  colActiveTasks.innerHTML = '';
  colEscalatedTasks.innerHTML = '';
  colResolvedTasks.innerHTML = '';

  let activeCount = 0;
  let escalatedCount = 0;
  let resolvedCount = 0;
  let totalSaved = 0;

  tasks.forEach(t => {
    const card = document.createElement('div');
    card.className = `task-card ${t.status === 'ESCALATED' ? 'escalated' : ''}`;

    let levelBadgeClass = 'badge-level1';
    if (t.escalation_level.includes('LEVEL_2')) levelBadgeClass = 'badge-level2';
    if (t.escalation_level.includes('LEVEL_3')) levelBadgeClass = 'badge-level3';

    card.innerHTML = `
      <div class="task-top">
        <span class="task-id">${t.task_id} • Unit #${t.machine_id}</span>
        <span class="escalation-badge ${levelBadgeClass}">${t.escalation_level}</span>
      </div>
      <div class="task-action-name">${t.action_label}</div>
      <div style="font-size: 0.8rem; color: var(--accent-rupee); font-family: var(--font-mono);">
        ₹${t.current_loss_inr.toLocaleString('en-IN')} at risk
      </div>
      <div class="task-meta-row">
        <span>Owner: <strong>${t.assigned_role}</strong></span>
        <span>SLA: ${t.sla_hours}h</span>
      </div>
      ${t.hours_overdue > 0 ? `
        <div style="font-size: 0.72rem; color: var(--accent-rose); font-weight: 700; margin-top: 0.35rem;">
          ⚠ OVERDUE BY ${t.hours_overdue} HOURS
        </div>
      ` : ''}
      ${t.status !== 'COMPLETED' ? `
        <button class="complete-btn" onclick="completeTaskAction('${t.task_id}')">
          ✔ Complete Action (De-Risk Machine)
        </button>
      ` : `
        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--accent-emerald); font-weight: 700;">
          ✔ Mitigated: Saved ₹${t.saved_loss_inr.toLocaleString('en-IN')}
        </div>
      `}
    `;

    if (t.status === 'COMPLETED') {
      colResolvedTasks.appendChild(card);
      resolvedCount++;
      totalSaved += t.saved_loss_inr;
    } else if (t.status === 'ESCALATED') {
      colEscalatedTasks.appendChild(card);
      escalatedCount++;
      activeCount++;
    } else {
      colActiveTasks.appendChild(card);
      activeCount++;
    }
  });

  countActiveTasks.textContent = activeCount;
  countEscalatedTasks.textContent = escalatedCount;
  countResolvedTasks.textContent = resolvedCount;
  activeTasksBadge.textContent = activeCount;
  globalLossSaved.textContent = `₹${totalSaved.toLocaleString('en-IN')}`;
}

// Global window function for complete action button
window.completeTaskAction = async function(taskId) {
  const currentSimulatedTime = streamIndex[currentTickIndex]?.timestamp || '2015-09-01T00:00:00';
  try {
    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_simulated_time: currentSimulatedTime })
    });
    if (res.ok) {
      await loadTasks();
    }
  } catch (err) {
    console.error(`Error completing task ${taskId}:`, err);
  }
};
