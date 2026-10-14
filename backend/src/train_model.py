"""
Model Training & Evaluation Pipeline
LightGBM Classifier for 24-hour Machine Failure Risk
Includes threshold tuning, baseline benchmark, and lead-time calculation.
"""

import os
import json
import time
import pickle
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score

def train_and_evaluate(
    data_dir: str = "backend/data/processed",
    output_model_dir: str = "backend/models",
    metrics_path: str = "backend/models/eval_metrics.json"
):
    t0 = time.time()
    os.makedirs(output_model_dir, exist_ok=True)
    print("[*] Starting Model Training & Evaluation...")

    # 1. Load data
    train_path = os.path.join(data_dir, "train.parquet")
    val_path = os.path.join(data_dir, "val.parquet")
    test_path = os.path.join(data_dir, "test.parquet")
    ans_key_path = os.path.join(data_dir, "failures_answer_key.csv")

    df_train = pd.read_parquet(train_path)
    df_val = pd.read_parquet(val_path)
    df_test = pd.read_parquet(test_path)
    df_failures = pd.read_csv(ans_key_path)
    df_failures["datetime"] = pd.to_datetime(df_failures["datetime"])

    # Identify feature columns
    excluded_cols = ["datetime", "machineID", "volt", "rotate", "pressure", "vibration", "failure_next_24h", "failure_comp"]
    feature_cols = [c for c in df_train.columns if c not in excluded_cols]
    print(f"  -> Features ({len(feature_cols)}): {feature_cols}")

    X_train = df_train[feature_cols]
    y_train = df_train["failure_next_24h"]

    X_val = df_val[feature_cols]
    y_val = df_val["failure_next_24h"]

    X_test = df_test[feature_cols]
    y_test = df_test["failure_next_24h"]

    # 2. Train LightGBM with balanced class weights
    print("  -> Training LightGBM Classifier...")
    pos_weight = (len(y_train) - y_train.sum()) / max(y_train.sum(), 1)
    
    clf = lgb.LGBMClassifier(
        n_estimators=150,
        learning_rate=0.05,
        num_leaves=31,
        scale_pos_weight=pos_weight * 0.8, # Balanced sensitivity
        random_state=42,
        n_jobs=-1,
        verbose=-1
    )
    clf.fit(X_train, y_train)

    # 3. Threshold Tuning on Validation Split (Aug 15 - Aug 31)
    print("  -> Tuning alert threshold on validation set (Aug 15-31)...")
    val_probs = clf.predict_proba(X_val)[:, 1]
    
    best_thresh = 0.5
    best_f1 = 0.0
    threshold_candidates = np.linspace(0.2, 0.8, 31)
    
    for th in threshold_candidates:
        preds = (val_probs >= th).astype(int)
        f = f1_score(y_val, preds, zero_division=0)
        rec = recall_score(y_val, preds, zero_division=0)
        prec = precision_score(y_val, preds, zero_division=0)
        if f > best_f1 and rec >= 0.65: # Ensure we catch >= 65% of impending failures
            best_f1 = f
            best_thresh = float(th)

    print(f"  -> Selected optimal threshold: {best_thresh:.2f} (Val F1: {best_f1:.4f})")

    # 4. Evaluation on Held-Out Test Set (Sep 1 - Dec 31)
    print("  -> Evaluating on Held-Out Test Set (Sep - Dec 2015)...")
    test_probs = clf.predict_proba(X_test)[:, 1]
    test_preds = (test_probs >= best_thresh).astype(int)

    test_prec = precision_score(y_test, test_preds, zero_division=0)
    test_rec = recall_score(y_test, test_preds, zero_division=0)
    test_f1 = f1_score(y_test, test_preds, zero_division=0)
    test_auc = roc_auc_score(y_test, test_probs)

    print(f"  [LightGBM Model Test Results]")
    print(f"    - Precision: {test_prec:.4f}")
    print(f"    - Recall:    {test_rec:.4f}")
    print(f"    - F1 Score:  {test_f1:.4f}")
    print(f"    - ROC AUC:   {test_auc:.4f}")

    # 5. Baseline Comparison: Simple Vibration Threshold
    # Rule: Alert when 3h mean vibration > 48 mm/s or 24h vibration > 45 mm/s
    vib_baseline_preds = ((df_test["vibration_mean_3h"] > 48) | (df_test["vibration_mean_24h"] > 45)).astype(int)
    base_prec = precision_score(y_test, vib_baseline_preds, zero_division=0)
    base_rec = recall_score(y_test, vib_baseline_preds, zero_division=0)
    base_f1 = f1_score(y_test, vib_baseline_preds, zero_division=0)

    print(f"  [Baseline Model: Vibration > 48 mm/s]")
    print(f"    - Precision: {base_prec:.4f}")
    print(f"    - Recall:    {base_rec:.4f}")
    print(f"    - F1 Score:  {base_f1:.4f}")

    # 6. Measured Lead Time Analysis
    # For every test failure event, find how many hours prior the first alert fired
    print("  -> Calculating early warning lead times on test failure events...")
    test_failures = df_failures[df_failures["datetime"] >= "2015-09-01"].copy()
    
    # Attach predictions back to test dataframe
    df_test_eval = df_test[["datetime", "machineID", "failure_next_24h"]].copy()
    df_test_eval["risk_score"] = test_probs
    df_test_eval["alert_fired"] = test_preds

    lead_times = []
    detected_failures = 0

    for _, f_row in test_failures.iterrows():
        m_id = f_row["machineID"]
        f_time = f_row["datetime"]
        # Look back 24 hours prior to failure
        window_start = f_time - pd.Timedelta(hours=24)
        m_slice = df_test_eval[
            (df_test_eval["machineID"] == m_id) & 
            (df_test_eval["datetime"] >= window_start) & 
            (df_test_eval["datetime"] <= f_time)
        ].sort_values("datetime")

        alerts_in_window = m_slice[m_slice["alert_fired"] == 1]
        if not alerts_in_window.empty:
            first_alert_time = alerts_in_window.iloc[0]["datetime"]
            lead_hours = (f_time - first_alert_time).total_seconds() / 3600.0
            lead_times.append(lead_hours)
            detected_failures += 1

    mean_lead_time = float(np.mean(lead_times)) if lead_times else 0.0
    median_lead_time = float(np.median(lead_times)) if lead_times else 0.0
    detection_rate = detected_failures / max(len(test_failures), 1)

    print(f"  [Measured Lead Time Results]")
    print(f"    - Test Failures Evaluated: {len(test_failures)}")
    print(f"    - Failures Pre-Alerted:    {detected_failures} ({detection_rate*100:.1f}%)")
    print(f"    - Mean Lead Time:          {mean_lead_time:.1f} hours before failure")
    print(f"    - Median Lead Time:        {median_lead_time:.1f} hours before failure")

    # 7. Feature Importance Ranking
    importances = clf.feature_importances_
    feat_imp = sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True)
    print(f"  -> Top 5 Driving Features:")
    for feat, imp in feat_imp[:5]:
        print(f"     * {feat}: {imp}")

    # 8. Save Artifacts
    model_file = os.path.join(output_model_dir, "lgbm_model.pkl")
    with open(model_file, "wb") as f:
        pickle.dump(clf, f)

    features_file = os.path.join(output_model_dir, "feature_names.json")
    with open(features_file, "w") as f:
        json.dump(feature_cols, f, indent=2)

    eval_data = {
        "model_type": "LightGBM Classifier",
        "optimal_threshold": best_thresh,
        "test_period": "2015-09-01 to 2015-12-31",
        "test_failures_count": len(test_failures),
        "lightgbm_metrics": {
            "precision": round(test_prec, 4),
            "recall": round(test_rec, 4),
            "f1_score": round(test_f1, 4),
            "roc_auc": round(test_auc, 4)
        },
        "baseline_vibration_metrics": {
            "precision": round(base_prec, 4),
            "recall": round(base_rec, 4),
            "f1_score": round(base_f1, 4)
        },
        "lead_time_metrics": {
            "failures_detected": detected_failures,
            "total_failures": len(test_failures),
            "detection_rate": round(detection_rate, 4),
            "mean_lead_time_hours": round(mean_lead_time, 2),
            "median_lead_time_hours": round(median_lead_time, 2)
        },
        "top_features": [{"feature": k, "importance": int(v)} for k, v in feat_imp[:10]]
    }

    with open(metrics_path, "w") as f:
        json.dump(eval_data, f, indent=2)

    print(f"[✓] Model & Evaluation Metrics saved in {time.time()-t0:.2f}s!")
    print(f"    Model:   {model_file}")
    print(f"    Metrics: {metrics_path}")

    return eval_data

if __name__ == "__main__":
    train_and_evaluate()
