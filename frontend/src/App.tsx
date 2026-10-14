import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Machine,
  StreamIndexItem,
  TaskItem,
  MetricsData,
  ActiveTab,
  FilterType,
} from './types';
import {
  fetchStreamIndex,
  fetchStreamTick,
  fetchMetrics,
  fetchTasks,
  createTask,
  completeTask,
  syncClockTasks,
} from './api';
import { Header } from './components/Header';
import { ClockBanner } from './components/ClockBanner';
import { FleetMatrix } from './components/FleetMatrix';
import { AlertModal } from './components/AlertModal';
import { KanbanView } from './components/KanbanView';
import { BenchmarkView } from './components/BenchmarkView';

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
    </div>
  );
}

export default App;
