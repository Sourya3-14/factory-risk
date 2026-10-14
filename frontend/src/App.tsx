import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Machine,
  StreamIndexItem,
  TaskItem,
  MetricsData,
  ActiveTab,
  FilterType,
  ShiftHandoverBriefing,
} from './types';
import {
  fetchStreamIndex,
  fetchStreamTick,
  fetchMetrics,
  fetchTasks,
  createTask,
  completeTask,
  syncClockTasks,
  fetchShiftBriefing,
  notifySupervisor,
} from './api';
import { Header } from './components/Header';
import { ClockBanner } from './components/ClockBanner';
import { FleetMatrix } from './components/FleetMatrix';
import { AlertModal } from './components/AlertModal';
import { KanbanView } from './components/KanbanView';
import { BenchmarkView } from './components/BenchmarkView';
import { ShiftBriefingModal } from './components/ShiftBriefingModal';


export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('fleet');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const [streamIndex, setStreamIndex] = useState<StreamIndexItem[]>([]);
  const [currentTickIndex, setCurrentTickIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentMachines, setCurrentMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);

  // Shift Handover Briefing State (Feature 2)
  const [isShiftBriefingOpen, setIsShiftBriefingOpen] = useState(false);
  const [shiftBriefing, setShiftBriefing] = useState<ShiftHandoverBriefing | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [sentinelToast, setSentinelToast] = useState<{ machineId: number; time: string } | null>(null);

  const playTimerRef = useRef<number | null>(null);


  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        const [indexData, metricsData, tasksData] = await Promise.all([
          fetchStreamIndex(),
          fetchMetrics().catch(() => null),
          fetchTasks().catch(() => []),
        ]);

        setStreamIndex(indexData);
        if (metricsData) setMetrics(metricsData);
        if (tasksData) setTasks(tasksData);

        if (indexData.length > 0) {
          await loadTick(0, indexData);
        }
      } catch (err) {
        console.error('Failed to initialize YantraWatch data:', err);
      }
    }
    init();
  }, []);

  // Load a specific tick by index
  const loadTick = useCallback(
    async (index: number, indexArr = streamIndex) => {
      if (!indexArr[index]) return;
      setCurrentTickIndex(index);
      const isoTime = indexArr[index].timestamp;

      try {
        const tickRes = await fetchStreamTick(isoTime);
        setCurrentMachines(tickRes.machines);

        // Notify UI if automated alert was dispatched by sentinel
        if (tickRes.auto_notified_machines && tickRes.auto_notified_machines.length > 0) {
          setSentinelToast({ machineId: tickRes.auto_notified_machines[0], time: isoTime });
          setTimeout(() => setSentinelToast(null), 5000);
        }

        // Sync tasks against this simulated time
        const syncedTasks = await syncClockTasks(isoTime);
        setTasks(syncedTasks);
      } catch (err) {
        console.error(`Error loading tick at ${isoTime}:`, err);
      }
    },
    [streamIndex]
  );

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        setCurrentTickIndex((prev) => {
          if (prev < streamIndex.length - 1) {
            const nextIdx = prev + 1;
            loadTick(nextIdx);
            return nextIdx;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 1800);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, streamIndex.length, loadTick]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handlePrevTick = () => {
    if (currentTickIndex > 0) {
      loadTick(currentTickIndex - 1);
    }
  };

  const handleNextTick = () => {
    if (currentTickIndex < streamIndex.length - 1) {
      loadTick(currentTickIndex + 1);
    }
  };

  const handleSliderChange = (newIndex: number) => {
    loadTick(newIndex);
  };

  const handleJumpIncident = (timestamp: string) => {
    const matchIdx = streamIndex.findIndex((s) => s.timestamp === timestamp);
    if (matchIdx !== -1) {
      loadTick(matchIdx);
    }
  };

  // Task creation handler
  const handleAssignTask = async (actionType: string) => {
    if (!selectedMachine) return;
    const currentSimulatedTime = streamIndex[currentTickIndex]?.timestamp || '2015-09-01T00:00:00';

    await createTask({
      machine_id: selectedMachine.machine_id,
      machine_model: selectedMachine.model,
      current_simulated_time: currentSimulatedTime,
      risk_score: selectedMachine.risk_score,
      expected_loss_inr: selectedMachine.expected_loss_inr,
      sla_hours: selectedMachine.sla_hours,
      action_type: actionType,
      notes: 'Created via YantraWatch alert console',
    });

    const refreshed = await fetchTasks();
    setTasks(refreshed);

    // Switch to Kanban view to demonstrate accountability
    setActiveTab('kanban');
  };

  // Task completion handler
  const handleCompleteTask = async (taskId: string) => {
    const currentSimulatedTime = streamIndex[currentTickIndex]?.timestamp || '2015-09-01T00:00:00';
    try {
      await completeTask(taskId, currentSimulatedTime);
      const refreshed = await fetchTasks();
      setTasks(refreshed);
    } catch (err) {
      console.error(`Error completing task ${taskId}:`, err);
    }
  };

  // Financial KPI calculations
  const activeCriticalCount = currentMachines.filter((m) => m.alert_status === 'CRITICAL').length;
  const totalRiskLoss = currentMachines
    .filter((m) => m.alert_status !== 'NORMAL')
    .reduce((sum, m) => sum + m.expected_loss_inr, 0);

  const totalLossSaved = tasks
    .filter((t) => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + (t.saved_loss_inr || 0), 0);

  const activeTasksCount = tasks.filter((t) => t.status !== 'COMPLETED').length;

  // Shift Handover Briefing Handlers (Feature 2)
  const loadShiftBriefing = useCallback(async () => {
    setIsBriefingLoading(true);
    const currentSimTime = streamIndex[currentTickIndex]?.timestamp || '2015-09-01 06:00:00';
    const criticals = currentMachines.filter((m) => m.alert_status === 'CRITICAL');
    const warnings = currentMachines.filter((m) => m.alert_status === 'WARNING');
    const escalated = tasks.filter((t) => t.status === 'ESCALATED');
    const active = tasks.filter((t) => t.status !== 'COMPLETED');

    try {
      const res = await fetchShiftBriefing({
        current_simulated_time: currentSimTime,
        total_units: currentMachines.length || 25,
        critical_count: criticals.length,
        warning_count: warnings.length,
        total_loss_inr: totalRiskLoss,
        total_mitigated_inr: totalLossSaved,
        critical_machines: criticals,
        active_tasks: active,
        escalated_tasks: escalated,
      });
      setShiftBriefing(res);
    } catch (err) {
      console.error('Error fetching shift briefing:', err);
    } finally {
      setIsBriefingLoading(false);
    }
  }, [streamIndex, currentTickIndex, currentMachines, tasks, totalRiskLoss, totalLossSaved]);

  const handleOpenShiftBriefing = () => {
    setIsShiftBriefingOpen(true);
    loadShiftBriefing();
  };

  const handleEmailShiftBriefing = async () => {
    const critMachineId =
      currentMachines.find((m) => m.alert_status === 'CRITICAL')?.machine_id ||
      currentMachines[0]?.machine_id ||
      1;
    await notifySupervisor(critMachineId, streamIndex[currentTickIndex]?.timestamp, true);
  };

  const currentTimestamp = streamIndex[currentTickIndex]?.timestamp || '2015-09-01 00:00:00';

  return (
    <div>


      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        totalRiskLoss={totalRiskLoss}
        activeCriticalCount={activeCriticalCount}
        totalLossSaved={totalLossSaved}
        activeTasksCount={activeTasksCount}
        onOpenShiftBriefing={handleOpenShiftBriefing}
      />

      <ClockBanner
        currentTimestamp={currentTimestamp}
        currentTickIndex={currentTickIndex}
        totalTicks={streamIndex.length}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onPrevTick={handlePrevTick}
        onNextTick={handleNextTick}
        onSliderChange={handleSliderChange}
        onJumpIncident={handleJumpIncident}
      />

      <main className="main-wrapper">
        {activeTab === 'fleet' && (
          <FleetMatrix
            machines={currentMachines}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onSelectMachine={setSelectedMachine}
          />
        )}

        {activeTab === 'kanban' && (
          <KanbanView tasks={tasks} onCompleteTask={handleCompleteTask} />
        )}

        {activeTab === 'benchmark' && <BenchmarkView metrics={metrics} />}
      </main>

      <AlertModal
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
        currentSimulatedTime={currentTimestamp}
        onAssignTask={handleAssignTask}
      />

      <ShiftBriefingModal
        isOpen={isShiftBriefingOpen}
        onClose={() => setIsShiftBriefingOpen(false)}
        briefing={shiftBriefing}
        isLoading={isBriefingLoading}
        onRefresh={loadShiftBriefing}
        onEmailSupervisors={handleEmailShiftBriefing}
      />

      {/* Autonomous Failure Sentinel Toast Notification */}
      {sentinelToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9999,
            border: '1px solid #ef4444',
            animation: 'fadeIn 0.3s ease-out',
            maxWidth: '380px',
          }}
        >
          <span style={{ fontSize: '24px', lineHeight: 1 }}>🚨</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '-0.2px' }}>
              Autonomous Sentinel Alert!
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '2px' }}>
              Critical risk detected on Machine #{sentinelToast.machineId}. Automated alert emailed to 1st Supervisor.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

