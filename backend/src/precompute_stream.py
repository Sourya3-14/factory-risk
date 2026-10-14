"""
Precomputed Stream Generator for Replay Demo
Scores the held-out test period (Sep 1 to Dec 31, 2015) offline.
Generates exact risk scores, TreeSHAP top contributing factors, ₹ impact, and dynamic SLAs.
"""

import os
import json
import time
import pickle
import yaml
import pandas as pd
import numpy as np

FEATURE_HUMAN_NAMES = {
    "volt_mean_3h": "Voltage (3h avg)",
    "volt_std_3h": "Voltage Volatility (3h)",
    "volt_mean_24h": "Voltage (24h avg)",
    "volt_std_24h": "Voltage Volatility (24h)",
    "rotate_mean_3h": "Rotational Speed (3h avg)",
    "rotate_std_3h": "Rotation Fluctuation (3h)",
    "rotate_mean_24h": "Rotational Speed (24h avg)",
    "rotate_std_24h": "Rotation Fluctuation (24h)",
    "pressure_mean_3h": "Hydraulic Pressure (3h avg)",
    "pressure_std_3h": "Pressure Volatility (3h)",
    "pressure_mean_24h": "Hydraulic Pressure (24h avg)",
    "pressure_std_24h": "Pressure Volatility (24h)",
    "vibration_mean_3h": "Vibration Amplitude (3h avg)",
    "vibration_std_3h": "Vibration Spike (3h)",
    "vibration_mean_24h": "Vibration (24h avg)",
    "vibration_std_24h": "Vibration Fluctuation (24h)",
    "error1_count_24h": "Error-1 Warnings (24h)",
    "error2_count_24h": "Error-2 Warnings (24h)",
    "error3_count_24h": "Error-3 Warnings (24h)",
    "error4_count_24h": "Error-4 Warnings (24h)",
    "error5_count_24h": "Critical Error-5 Count (24h)",
    "hours_since_comp1_maint": "Component 1 Operating Age",
    "hours_since_comp2_maint": "Component 2 Operating Age",
    "hours_since_comp3_maint": "Component 3 Operating Age",
    "hours_since_comp4_maint": "Component 4 Operating Age",
    "age": "Machine Equipment Age (years)",
    "model_model1": "Model Type 1",
    "model_model2": "Model Type 2",
    "model_model3": "Model Type 3",
    "model_model4": "Model Type 4",
}

def determine_sla_hours(expected_loss_inr: float, escalation_rules: dict) -> int:
    """Computes dynamic SLA deadline window based on ₹ money at stake."""
    crit_thresh = escalation_rules.get("critical_loss_threshold", 150000)
    high_thresh = escalation_rules.get("high_loss_threshold", 75000)
    med_thresh = escalation_rules.get("medium_loss_threshold", 30000)

    if expected_loss_inr >= crit_thresh:
        return escalation_rules.get("critical_sla_hours", 2)
    elif expected_loss_inr >= high_thresh:
        return escalation_rules.get("high_sla_hours", 4)
    elif expected_loss_inr >= med_thresh:
        return escalation_rules.get("medium_sla_hours", 8)
    else:
        return escalation_rules.get("standard_sla_hours", 16)

def generate_precomputed_stream(
    test_parquet: str = "backend/data/processed/test.parquet",
    config_yaml: str = "backend/config/costs.yaml",
    model_pkl: str = "backend/models/lgbm_model.pkl",
    features_json: str = "backend/models/feature_names.json",
    metrics_json: str = "backend/models/eval_metrics.json",
    output_json: str = "backend/data/processed/replay_stream.json",
    output_index_json: str = "backend/data/processed/stream_index.json",
    num_machines: int = 25
):
    t0 = time.time()
    print(f"[*] Generating Precomputed Replay Stream for {num_machines} machines...")

    # Load config
    with open(config_yaml, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    # Load model & features
    with open(model_pkl, "rb") as f:
        clf = pickle.load(f)

    with open(features_json, "r") as f:
        feature_cols = json.load(f)

    with open(metrics_json, "r") as f:
        eval_metrics = json.load(f)
    optimal_threshold = eval_metrics.get("optimal_threshold", 0.58)

    # Load test data and filter machines 1..num_machines
    df_test = pd.read_parquet(test_parquet)
    df_test = df_test[df_test["machineID"] <= num_machines].copy()
    df_test = df_test.sort_values(["datetime", "machineID"]).reset_index(drop=True)

    print(f"  -> Total test records to score: {len(df_test)}")

    # Score model
    X = df_test[feature_cols]
    probs = clf.predict_proba(X)[:, 1]
    
    # TreeSHAP native calculation: returns array of shape (N, num_features + 1)
    # where the last column is the base value / bias
    shap_vals = clf.booster_.predict(X, pred_contrib=True)[:, :-1]

    # Map model name back from one-hot
    model_series = []
    for _, row in df_test.iterrows():
        if row.get("model_model1", 0) == 1:
            m = "model1"
        elif row.get("model_model2", 0) == 1:
            m = "model2"
        elif row.get("model_model3", 0) == 1:
            m = "model3"
        else:
            m = "model4"
        model_series.append(m)

    df_test["model_name"] = model_series
    df_test["risk_score"] = probs

    # Build stream grouped by timestamp
    cost_per_hr = config.get("downtime_cost_per_hour", {})
    comp_hours = config.get("downtime_hours_by_component", {})
    default_downtime = comp_hours.get("default", 8)
    escalation_rules = config.get("escalation_rules", {})

    stream_by_timestamp = {}
    unique_timestamps = sorted(df_test["datetime"].unique())

    print(f"  -> Processing {len(unique_timestamps)} unique timestamps...")

    for i in range(len(df_test)):
        row = df_test.iloc[i]
        dt_str = row["datetime"].strftime("%Y-%m-%dT%H:%M:%S")
        m_id = int(row["machineID"])
        m_name = row["model_name"]
        risk_p = float(probs[i])

        # Top 3 contributing features from SHAP
        row_shap = shap_vals[i]
        top_indices = np.argsort(row_shap)[::-1][:3]
        top_factors = []
        for idx in top_indices:
            feat_name = feature_cols[idx]
            val = float(X.iloc[i, idx])
            shap_impact = float(row_shap[idx])
            top_factors.append({
                "feature_key": feat_name,
                "label": FEATURE_HUMAN_NAMES.get(feat_name, feat_name),
                "current_value": round(val, 2),
                "shap_impact": round(shap_impact, 3)
            })

        # Downtime calculation
        dt_hours = default_downtime
        hourly_rate = cost_per_hr.get(m_name, 20000)
        expected_loss = int(round(risk_p * dt_hours * hourly_rate))
        sla_hrs = determine_sla_hours(expected_loss, escalation_rules)

        if risk_p >= 0.80:
            status = "CRITICAL"
        elif risk_p >= optimal_threshold:
            status = "WARNING"
        else:
            status = "NORMAL"

        record = {
            "machine_id": m_id,
            "model": m_name,
            "age": int(row["age"]),
            "telemetry": {
                "volt": round(float(row["volt"]), 1),
                "rotate": round(float(row["rotate"]), 1),
                "pressure": round(float(row["pressure"]), 1),
                "vibration": round(float(row["vibration"]), 1)
            },
            "risk_score": round(risk_p, 4),
            "alert_status": status,
            "downtime_hours": dt_hours,
            "hourly_cost_inr": hourly_rate,
            "expected_loss_inr": expected_loss,
            "sla_hours": sla_hrs,
            "top_factors": top_factors,
            "ground_truth": {
                "will_fail_24h": bool(row["failure_next_24h"] == 1),
                "failure_comp": str(row["failure_comp"])
            }
        }

        if dt_str not in stream_by_timestamp:
            stream_by_timestamp[dt_str] = []
        stream_by_timestamp[dt_str].append(record)

    # Save output JSON
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(stream_by_timestamp, f)

    # Save index of timestamps with summary metadata
    index_list = []
    for dt_str, machines in stream_by_timestamp.items():
        n_crit = sum(1 for m in machines if m["alert_status"] == "CRITICAL")
        n_warn = sum(1 for m in machines if m["alert_status"] == "WARNING")
        tot_loss = sum(m["expected_loss_inr"] for m in machines if m["alert_status"] in ["CRITICAL", "WARNING"])
        index_list.append({
            "timestamp": dt_str,
            "critical_count": n_crit,
            "warning_count": n_warn,
            "total_risk_exposure_inr": tot_loss
        })

    with open(output_index_json, "w", encoding="utf-8") as f:
        json.dump(index_list, f, indent=2)

    print(f"[✓] Precomputed stream created in {time.time()-t0:.2f}s!")
    print(f"    Stream Data:  {output_json} ({os.path.getsize(output_json)/(1024*1024):.1f} MB)")
    print(f"    Stream Index: {output_index_json} ({len(index_list)} ticks)")

if __name__ == "__main__":
    generate_precomputed_stream()
