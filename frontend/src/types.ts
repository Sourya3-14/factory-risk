export interface Telemetry {
  volt: number;
  rotate: number;
  pressure: number;
  vibration: number;
}

export interface ShapFactor {
  label: string;
  shap_impact: number;
  current_value: string | number;
}

export interface Machine {
  machine_id: number;
  model: string;
  age: number;
  risk_score: number;
  alert_status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  expected_loss_inr: number;
  hourly_cost_inr: number;
  downtime_hours: number;
  sla_hours: number;
  telemetry: Telemetry;
  top_factors: ShapFactor[];
}

export interface StreamIndexItem {
  timestamp: string;
  critical_count: number;
  total_loss_inr: number;
}

export interface TickResponse {
  timestamp: string;
  machines: Machine[];
}

export type TaskStatus = 'ACTIVE' | 'ESCALATED' | 'COMPLETED';

export interface TaskItem {
  task_id: string;
  machine_id: number;
  machine_model: string;
  created_simulated_time: string;
  status: TaskStatus;
  escalation_level: string;
  action_type: string;
  action_label: string;
  sla_hours: number;
  assigned_role: string;
  current_loss_inr: number;
  saved_loss_inr: number;
  hours_overdue: number;
  notes?: string;
}

export interface CreateTaskPayload {
  machine_id: number;
  machine_model: string;
  current_simulated_time: string;
  risk_score: number;
  expected_loss_inr: number;
  sla_hours: number;
  action_type: string;
  notes?: string;
}

export interface ExplainRequest {
  machine_id: number;
  model_name: string;
  age: number;
  risk_score: number;
  alert_status: string;
  expected_loss_inr: number;
  hourly_cost_inr: number;
  downtime_hours: number;
  telemetry: Telemetry;
  top_factors: ShapFactor[];
  photo_base64?: string | null;
}

export interface ExplainResponse {
  source?: string;
  summary: string;
  root_causes: string[];
  recommended_actions: string[];
  photo_observation?: string | null;
}

export interface MetricsData {
  test_period?: string;
  model_metrics?: Record<string, unknown>;
  lead_time_metrics?: {
    advance_notice_rate?: number;
    mean_hours_advance_warning?: number;
    total_failures_evaluated?: number;
  };
  [key: string]: unknown;
}

export type ActiveTab = 'fleet' | 'kanban' | 'benchmark';
export type FilterType = 'all' | 'CRITICAL' | 'WARNING' | 'NORMAL';
