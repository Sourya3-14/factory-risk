"""
YantraWatch - FastAPI Application Server
Provides REST endpoints for the replay stream, Gemma 4 explanations,
and the ₹-weighted escalation Kanban engine. Serves the custom frontend.
"""

import os
import json
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.src.gemma_explainer import explain_machine_risk
from backend.src.escalation_engine import EscalationManager

app = FastAPI(title="YantraWatch API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cached replay stream & index
STREAM_DATA = {}
STREAM_INDEX = []
METRICS_DATA = {}
escalation_mgr = EscalationManager()

@app.on_event("startup")
def load_cached_data():
    global STREAM_DATA, STREAM_INDEX, METRICS_DATA
    stream_path = "backend/data/processed/replay_stream.json"
    index_path = "backend/data/processed/stream_index.json"
    metrics_path = "backend/models/eval_metrics.json"

    if os.path.exists(stream_path):
        print(f"[*] Loading replay stream cache from {stream_path}...")
        with open(stream_path, "r", encoding="utf-8") as f:
            STREAM_DATA = json.load(f)
        print(f"[✓] Replay stream loaded ({len(STREAM_DATA)} timestamps)")

    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            STREAM_INDEX = json.load(f)

    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            METRICS_DATA = json.load(f)

# Request Models
class ExplainRequest(BaseModel):
    machine_id: int
    model_name: str
    age: int
    risk_score: float
    alert_status: str
    expected_loss_inr: int
    hourly_cost_inr: int
    downtime_hours: float
    telemetry: Dict[str, float]
    top_factors: list
    photo_base64: Optional[str] = None

class CreateTaskRequest(BaseModel):
    machine_id: int
    machine_model: str
    current_simulated_time: str
    risk_score: float
    expected_loss_inr: int
    sla_hours: int
    action_type: str = "replace_worn_component"
    notes: Optional[str] = ""

class CompleteTaskRequest(BaseModel):
    current_simulated_time: str

class ClockSyncRequest(BaseModel):
    current_simulated_time: str

# Endpoints
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "YantraWatch Core",
        "cached_ticks": len(STREAM_INDEX)
    }

@app.get("/api/metrics")
def get_metrics():
    return METRICS_DATA

@app.get("/api/stream/index")
def get_stream_index():
    return STREAM_INDEX

@app.get("/api/stream/tick/{timestamp}")
def get_stream_tick(timestamp: str):
    if timestamp not in STREAM_DATA:
        # Try finding closest match or error
        raise HTTPException(status_code=404, detail=f"Timestamp {timestamp} not found in precomputed stream.")
    return {
        "timestamp": timestamp,
        "machines": STREAM_DATA[timestamp]
    }

@app.post("/api/explain")
def get_gemma_explanation(req: ExplainRequest):
    return explain_machine_risk(
        machine_id=req.machine_id,
        model_name=req.model_name,
        age=req.age,
        risk_score=req.risk_score,
        alert_status=req.alert_status,
        expected_loss_inr=req.expected_loss_inr,
        hourly_cost_inr=req.hourly_cost_inr,
        downtime_hours=req.downtime_hours,
        telemetry=req.telemetry,
        top_factors=req.top_factors,
        photo_base64=req.photo_base64
    )

@app.get("/api/tasks")
def list_tasks():
    return escalation_mgr.list_tasks()

@app.post("/api/tasks/create")
def create_task(req: CreateTaskRequest):
    return escalation_mgr.create_task(
        machine_id=req.machine_id,
        machine_model=req.machine_model,
        current_simulated_time=req.current_simulated_time,
        risk_score=req.risk_score,
        expected_loss_inr=req.expected_loss_inr,
        sla_hours=req.sla_hours,
        action_type=req.action_type,
        notes=req.notes or ""
    )

@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: str, req: CompleteTaskRequest):
    return escalation_mgr.complete_task(task_id, req.current_simulated_time)

@app.post("/api/clock/sync")
def sync_clock(req: ClockSyncRequest):
    return escalation_mgr.sync_simulated_clock(req.current_simulated_time)

# Mount frontend directory for static serving
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
os.makedirs(FRONTEND_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
