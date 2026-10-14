"""
YantraWatch - FastAPI Application Server
Provides REST endpoints for the replay stream, Gemma 4 explanations,
and the ₹-weighted escalation Kanban engine. Serves the custom frontend.
"""

import os
import json
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.src.gemma_explainer import (
    explain_machine_risk,
    chat_maintenance_copilot,
    generate_shift_handover_briefing,
)

from backend.src.escalation_engine import EscalationManager
from backend.src.db.connection import init_db
from backend.src.auth.router import router as auth_router, seed_demo_users
from backend.src.db.connection import AsyncSessionLocal
from backend.src.email_service import notify_supervisors_on_machine_risk, get_supervisor_emails

app = FastAPI(title="YantraWatch API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

# In-memory cached replay stream & index
STREAM_DATA = {}
STREAM_INDEX = []
METRICS_DATA = {}
escalation_mgr = EscalationManager()

@app.on_event("startup")
async def startup_handler():
    global STREAM_DATA, STREAM_INDEX, METRICS_DATA
    
    # 1. Initialize PostgreSQL tables in Neon
    try:
        await init_db()
        # Seed demo accounts if empty
        async with AsyncSessionLocal() as session:
            await seed_demo_users(session)
    except Exception as e:
        print(f"[!] Database startup error: {e}")

    # 2. Load cached stream and metrics
    stream_path = "backend/data/processed/replay_stream.json"
    index_path = "backend/data/processed/stream_index.json"
    metrics_path = "backend/models/eval_metrics.json"

    if os.path.exists(stream_path):
        print(f"[*] Loading replay stream cache from {stream_path}...")
        with open(stream_path, "r", encoding="utf-8") as f:
            STREAM_DATA = json.load(f)
        print(f"[OK] Replay stream loaded ({len(STREAM_DATA)} timestamps)")

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
    api_key: Optional[str] = None

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

class AlertSupervisorRequest(BaseModel):
    machine_id: int
    current_simulated_time: Optional[str] = None
    force: bool = False

class CopilotRequest(BaseModel):
    machine_id: int
    question: str
    model_name: Optional[str] = "model1"
    age: Optional[int] = 5
    risk_score: Optional[float] = 0.5
    expected_loss_inr: Optional[int] = 50000
    sla_hours: Optional[int] = 4
    telemetry: Optional[Dict[str, float]] = None
    top_factors: Optional[list] = None
    chat_history: Optional[List[Dict[str, str]]] = None

class ShiftHandoverRequest(BaseModel):
    current_simulated_time: str
    total_units: Optional[int] = 25
    critical_count: Optional[int] = 0
    warning_count: Optional[int] = 0
    total_loss_inr: Optional[int] = 0
    total_mitigated_inr: Optional[int] = 0
    critical_machines: Optional[List[Dict[str, Any]]] = None
    active_tasks: Optional[List[Dict[str, Any]]] = None
    escalated_tasks: Optional[List[Dict[str, Any]]] = None

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
async def get_stream_tick(timestamp: str, background_tasks: BackgroundTasks):
    if timestamp not in STREAM_DATA:
        # Try finding closest match or error
        raise HTTPException(status_code=404, detail=f"Timestamp {timestamp} not found in precomputed stream.")
    
    machines = STREAM_DATA[timestamp]

    # Automatically check if any machine generates critical failure probability and notify 1st supervisor
    auto_notified_machines = []
    for m in machines:
        if m.get("alert_status") == "CRITICAL" or m.get("risk_score", 0) >= 0.80:
            background_tasks.add_task(notify_supervisors_on_machine_risk, m, timestamp, False)
            auto_notified_machines.append(m.get("machine_id"))

    return {
        "timestamp": timestamp,
        "machines": machines,
        "auto_notified_machines": auto_notified_machines
    }

@app.post("/api/alerts/notify-supervisor")
async def trigger_supervisor_alert(req: AlertSupervisorRequest):
    """
    Manually or programmatically triggers an email alert to all supervisors in the database.
    """
    target_machine = None
    timestamp = req.current_simulated_time

    if timestamp and timestamp in STREAM_DATA:
        for m in STREAM_DATA[timestamp]:
            if m["machine_id"] == req.machine_id:
                target_machine = m
                break

    if not target_machine:
        # Fallback to finding the machine in the loaded stream
        for ts, machines in reversed(list(STREAM_DATA.items())):
            for m in machines:
                if m["machine_id"] == req.machine_id:
                    target_machine = m
                    timestamp = ts
                    break
            if target_machine:
                break

    if not target_machine:
        raise HTTPException(status_code=404, detail=f"Machine {req.machine_id} not found.")

    res = await notify_supervisors_on_machine_risk(target_machine, timestamp, force=req.force)
    return res

@app.get("/api/alerts/supervisors")
async def get_active_supervisors():
    """Returns the list of supervisor email recipients fetched from the database."""
    emails = await get_supervisor_emails()
    return {"supervisors": emails, "count": len(emails)}


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
        photo_base64=req.photo_base64,
        # api_key=req.api_key
    )

@app.post("/api/gemma/copilot")
def copilot_chat_endpoint(req: CopilotRequest):
    machine_context = {
        "machine_id": req.machine_id,
        "model": req.model_name,
        "age": req.age,
        "risk_score": req.risk_score,
        "expected_loss_inr": req.expected_loss_inr,
        "sla_hours": req.sla_hours,
        "telemetry": req.telemetry or {},
        "top_factors": req.top_factors or [],
    }
    return chat_maintenance_copilot(machine_context, req.question, req.chat_history)

@app.post("/api/gemma/shift-handover")
def shift_handover_endpoint(req: ShiftHandoverRequest):
    summary_data = {
        "current_simulated_time": req.current_simulated_time,
        "total_units": req.total_units,
        "critical_count": req.critical_count,
        "warning_count": req.warning_count,
        "total_loss_inr": req.total_loss_inr,
        "total_mitigated_inr": req.total_mitigated_inr,
        "critical_machines": req.critical_machines or [],
        "active_tasks": req.active_tasks or [],
        "escalated_tasks": req.escalated_tasks or [],
    }
    return generate_shift_handover_briefing(summary_data)


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

# Mount frontend directory for static serving (prefer built dist directory if available)
DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
FRONTEND_DIR = DIST_DIR if os.path.exists(DIST_DIR) else os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
os.makedirs(FRONTEND_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

