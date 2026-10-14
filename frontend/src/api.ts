/**
 * YantraWatch API Client
 * Centralized service for all backend REST endpoints with automatic auth token injection.
 */

import { getAuthToken } from './auth';
import type {
  StreamIndexItem,
  TickResponse,
  MetricsData,
  ExplainRequest,
  ExplainResponse,
  TaskItem,
  CreateTaskPayload,
  CopilotPayload,
  CopilotResponse,
  ShiftHandoverPayload,
  ShiftHandoverBriefing,
} from './types';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach auth token if available
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new ApiError(`API Error (${response.status}): ${errorDetail}`, response.status);
  }

  return response.json() as Promise<T>;
}

// ==========================================
// API Endpoints
// ==========================================

export async function fetchHealth(): Promise<{ status: string; service: string; cached_ticks: number }> {
  return request('/api/health');
}

export async function fetchStreamIndex(): Promise<StreamIndexItem[]> {
  return request<StreamIndexItem[]>('/api/stream/index');
}

export async function fetchStreamTick(timestamp: string): Promise<TickResponse> {
  return request<TickResponse>(`/api/stream/tick/${encodeURIComponent(timestamp)}`);
}

export async function fetchMetrics(): Promise<MetricsData> {
  return request<MetricsData>('/api/metrics');
}

export async function explainMachine(payload: ExplainRequest): Promise<ExplainResponse> {
  return request<ExplainResponse>('/api/explain', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchTasks(): Promise<TaskItem[]> {
  return request<TaskItem[]>('/api/tasks');
}

export async function createTask(payload: CreateTaskPayload): Promise<TaskItem> {
  return request<TaskItem>('/api/tasks/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function completeTask(taskId: string, currentSimulatedTime: string): Promise<TaskItem> {
  return request<TaskItem>(`/api/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ current_simulated_time: currentSimulatedTime }),
  });
}

export async function syncClockTasks(currentSimulatedTime: string): Promise<TaskItem[]> {
  return request<TaskItem[]>('/api/clock/sync', {
    method: 'POST',
    body: JSON.stringify({ current_simulated_time: currentSimulatedTime }),
  });
}

export async function notifySupervisor(machineId: number, currentSimulatedTime?: string, force = true): Promise<any> {
  return request('/api/alerts/notify-supervisor', {
    method: 'POST',
    body: JSON.stringify({
      machine_id: machineId,
      current_simulated_time: currentSimulatedTime,
      force,
    }),
  });
}

export async function fetchSupervisors(): Promise<{ supervisors: string[]; count: number }> {
  return request('/api/alerts/supervisors');
}

export async function askMaintenanceCopilot(payload: CopilotPayload): Promise<CopilotResponse> {
  return request<CopilotResponse>('/api/gemma/copilot', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchShiftBriefing(payload: ShiftHandoverPayload): Promise<ShiftHandoverBriefing> {
  return request<ShiftHandoverBriefing>('/api/gemma/shift-handover', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


