"""
YantraWatch - ₹-Weighted Escalation & Action Reduction Engine
Handles dynamic SLAs, automated hierarchy escalation, and risk reduction tracking.
Storage backed by SQLite for robust local state persistence.
"""

import os
import sqlite3
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

DB_PATH = "backend/data/tasks.db"
CONFIG_PATH = "backend/config/costs.yaml"

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        machine_id INTEGER NOT NULL,
        machine_model TEXT NOT NULL,
        created_time TEXT NOT NULL,
        due_time TEXT NOT NULL,
        sla_hours INTEGER NOT NULL,
        initial_risk REAL NOT NULL,
        current_risk REAL NOT NULL,
        initial_loss_inr INTEGER NOT NULL,
        current_loss_inr INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        action_label TEXT NOT NULL,
        mitigation_factor REAL NOT NULL,
        assigned_role TEXT NOT NULL,
        escalation_level TEXT NOT NULL,
        status TEXT NOT NULL,
        hours_overdue REAL DEFAULT 0,
        saved_loss_inr INTEGER DEFAULT 0,
        completed_time TEXT,
        notes TEXT
    )
    """)
    conn.commit()
    conn.close()

def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}

class EscalationManager:
    def __init__(self):
        init_db()
        self.config = load_config()
        self.mitigation_factors = self.config.get("mitigation_factors", {
            "lubricate_and_cool": 0.50,
            "replace_worn_component": 0.85,
            "tighten_electrical_leads": 0.60,
            "calibrate_pressure_valve": 0.70,
            "inspect_and_clean": 0.40
        })

    def create_task(
        self,
        machine_id: int,
        machine_model: str,
        current_simulated_time: str,
        risk_score: float,
        expected_loss_inr: int,
        sla_hours: int,
        action_type: str = "replace_worn_component",
        notes: str = ""
    ) -> Dict[str, Any]:
        """Creates a corrective action with ₹-weighted dynamic SLA."""
        conn = get_db()
        cursor = conn.cursor()

        # Generate task ID
        cursor.execute("SELECT COUNT(*) FROM tasks")
        count = cursor.fetchone()[0] + 1
        task_id = f"TASK-{count:04d}"

        dt_created = datetime.fromisoformat(current_simulated_time)
        dt_due = dt_created + timedelta(hours=sla_hours)
        due_time_str = dt_due.isoformat()

        factor = self.mitigation_factors.get(action_type, 0.60)
        action_label = action_type.replace("_", " ").title()

        initial_role = "Maintenance Technician"
        initial_level = "LEVEL_1"

        cursor.execute("""
            INSERT INTO tasks (
                task_id, machine_id, machine_model, created_time, due_time,
                sla_hours, initial_risk, current_risk, initial_loss_inr, current_loss_inr,
                action_type, action_label, mitigation_factor, assigned_role,
                escalation_level, status, hours_overdue, saved_loss_inr, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        """, (
            task_id, machine_id, machine_model, current_simulated_time, due_time_str,
            sla_hours, risk_score, risk_score, expected_loss_inr, expected_loss_inr,
            action_type, action_label, factor, initial_role, initial_level, "IN_PROGRESS", notes
        ))
        conn.commit()
        conn.close()

        return self.get_task(task_id)

    def sync_simulated_clock(self, current_simulated_time: str) -> List[Dict[str, Any]]:
        """
        Advances the simulated clock and updates escalation ladder:
        Overdue > 0h -> Alert warning
        Overdue >= 1h -> LEVEL 2: Shift Supervisor
        Overdue >= 3h -> LEVEL 3: Plant Operations Manager
        """
        conn = get_db()
        cursor = conn.cursor()
        dt_current = datetime.fromisoformat(current_simulated_time)

        cursor.execute("SELECT * FROM tasks WHERE status != 'COMPLETED'")
        rows = cursor.fetchall()
        updated_tasks = []

        for row in rows:
            dt_due = datetime.fromisoformat(row["due_time"])
            diff_hours = (dt_current - dt_due).total_seconds() / 3600.0

            if diff_hours > 0:
                hours_overdue = round(diff_hours, 1)
                if diff_hours >= 3.0:
                    new_role = "Plant Operations Manager"
                    new_level = "LEVEL_3 (Executive Escalation)"
                    new_status = "ESCALATED"
                elif diff_hours >= 1.0:
                    new_role = "Shift Supervisor"
                    new_level = "LEVEL_2 (Supervisor Escalation)"
                    new_status = "ESCALATED"
                else:
                    new_role = "Maintenance Technician (Urgent SLA Breach)"
                    new_level = "LEVEL_1 (Overdue)"
                    new_status = "ESCALATED"
            else:
                hours_overdue = 0
                new_role = "Maintenance Technician"
                new_level = "LEVEL_1"
                new_status = row["status"] if row["status"] != "ESCALATED" else "IN_PROGRESS"

            cursor.execute("""
                UPDATE tasks
                SET hours_overdue = ?, assigned_role = ?, escalation_level = ?, status = ?
                WHERE task_id = ?
            """, (hours_overdue, new_role, new_level, new_status, row["task_id"]))

        conn.commit()
        cursor.execute("SELECT * FROM tasks ORDER BY created_time DESC")
        all_tasks = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return all_tasks

    def complete_task(self, task_id: str, current_simulated_time: str) -> Dict[str, Any]:
        """Completes an action and visibly slashes risk and ₹ exposure."""
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM tasks WHERE task_id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            conn.close()
            raise ValueError(f"Task {task_id} not found.")

        factor = task["mitigation_factor"]
        initial_risk = task["initial_risk"]
        initial_loss = task["initial_loss_inr"]

        reduced_risk = round(initial_risk * (1.0 - factor), 4)
        reduced_loss = int(round(initial_loss * (1.0 - factor)))
        saved_loss = initial_loss - reduced_loss

        cursor.execute("""
            UPDATE tasks
            SET status = 'COMPLETED',
                current_risk = ?,
                current_loss_inr = ?,
                saved_loss_inr = ?,
                completed_time = ?
            WHERE task_id = ?
        """, (reduced_risk, reduced_loss, saved_loss, current_simulated_time, task_id))

        conn.commit()
        conn.close()
        return self.get_task(task_id)

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE task_id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def list_tasks(self) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks ORDER BY created_time DESC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows
