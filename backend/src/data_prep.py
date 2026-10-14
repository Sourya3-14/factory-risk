"""
Data Preparation & Feature Engineering Pipeline
Microsoft Azure Predictive Maintenance Dataset
"""

import os
import time
import pandas as pd
import numpy as np

def build_features(data_dir: str = "archive", output_dir: str = "backend/data/processed", sample_step_hours: int = 3):
    t0 = time.time()
    os.makedirs(output_dir, exist_ok=True)
    print(f"[*] Starting Feature Engineering from: {data_dir}...")

    # 1. Load raw datasets
    print("  -> Loading machines metadata...")
    df_machines = pd.read_csv(os.path.join(data_dir, "PdM_machines.csv"))

    print("  -> Loading telemetry (876k records)...")
    df_telem = pd.read_csv(os.path.join(data_dir, "PdM_telemetry.csv"))
    df_telem["datetime"] = pd.to_datetime(df_telem["datetime"])
    df_telem = df_telem.sort_values(["machineID", "datetime"]).reset_index(drop=True)

    print("  -> Loading errors...")
    df_errors = pd.read_csv(os.path.join(data_dir, "PdM_errors.csv"))
    df_errors["datetime"] = pd.to_datetime(df_errors["datetime"])

    print("  -> Loading maintenance records...")
    df_maint = pd.read_csv(os.path.join(data_dir, "PdM_maint.csv"))
    df_maint["datetime"] = pd.to_datetime(df_maint["datetime"])

    print("  -> Loading failures...")
    df_failures = pd.read_csv(os.path.join(data_dir, "PdM_failures.csv"))
    df_failures["datetime"] = pd.to_datetime(df_failures["datetime"])

    # 2. Rolling features on Telemetry (3h and 24h mean and std)
    print("  -> Computing rolling 3h and 24h stats for sensors...")
    sensors = ["volt", "rotate", "pressure", "vibration"]
    for s in sensors:
        grp = df_telem.groupby("machineID")[s]
        df_telem[f"{s}_mean_3h"] = grp.transform(lambda x: x.rolling(3, min_periods=1).mean())
        df_telem[f"{s}_std_3h"] = grp.transform(lambda x: x.rolling(3, min_periods=1).std().fillna(0))
        df_telem[f"{s}_mean_24h"] = grp.transform(lambda x: x.rolling(24, min_periods=1).mean())
        df_telem[f"{s}_std_24h"] = grp.transform(lambda x: x.rolling(24, min_periods=1).std().fillna(0))

    # 3. 24h rolling error counts
    print("  -> Computing 24h rolling error counts...")
    df_err_dummies = pd.get_dummies(df_errors, columns=["errorID"], prefix="", prefix_sep="")
    err_cols = ["error1", "error2", "error3", "error4", "error5"]
    for col in err_cols:
        if col not in df_err_dummies.columns:
            df_err_dummies[col] = 0

    df_err_grouped = df_err_dummies.groupby(["machineID", "datetime"])[err_cols].sum().reset_index()
    df_telem = pd.merge(df_telem, df_err_grouped, on=["machineID", "datetime"], how="left").fillna(0)
    df_telem = df_telem.sort_values(["machineID", "datetime"]).reset_index(drop=True)

    for col in err_cols:
        df_telem[f"{col}_count_24h"] = df_telem.groupby("machineID")[col].transform(
            lambda x: x.rolling(24, min_periods=1).sum()
        )
    df_telem.drop(columns=err_cols, inplace=True)

    # 4. Maintenance: hours since last maintenance per component
    print("  -> Computing hours since last maintenance for comp1..comp4...")
    df_telem = df_telem.sort_values("datetime").reset_index(drop=True)
    for comp in ["comp1", "comp2", "comp3", "comp4"]:
        m_comp = df_maint[df_maint["comp"] == comp].sort_values("datetime").reset_index(drop=True)
        m_comp["last_maint"] = m_comp["datetime"]
        df_telem = pd.merge_asof(
            df_telem,
            m_comp[["machineID", "datetime", "last_maint"]],
            on="datetime",
            by="machineID",
            direction="backward"
        )
        df_telem[f"hours_since_{comp}_maint"] = (df_telem["datetime"] - df_telem["last_maint"]).dt.total_seconds() / 3600.0
        df_telem.drop(columns=["last_maint"], inplace=True)

    # 5. Join machine metadata
    print("  -> Merging machine metadata (model, age)...")
    df_machines_encoded = pd.get_dummies(df_machines, columns=["model"], prefix="model", dtype=int)
    df_telem = pd.merge(df_telem, df_machines_encoded, on="machineID", how="left")

    # 6. Binary label: failure within next 24h
    print("  -> Creating 24-hour lookahead failure labels...")
    fail_records = []
    for _, row in df_failures.iterrows():
        m_id = row["machineID"]
        f_time = row["datetime"]
        comp = row["failure"]
        # The 24 hours prior to failure event: [f_time - 23h, ..., f_time]
        dts = pd.date_range(f_time - pd.Timedelta(hours=23), f_time, freq="1h")
        for dt in dts:
            fail_records.append({"machineID": m_id, "datetime": dt, "failure_next_24h": 1, "failure_comp": comp})

    df_fail_labels = pd.DataFrame(fail_records).drop_duplicates(subset=["machineID", "datetime"])
    df_telem = pd.merge(df_telem, df_fail_labels, on=["machineID", "datetime"], how="left")
    df_telem["failure_next_24h"] = df_telem["failure_next_24h"].fillna(0).astype(int)
    df_telem["failure_comp"] = df_telem["failure_comp"].fillna("none")

    # 7. Sample every N hours (e.g. 3 hours) for fast training and crisp stream replay
    print(f"  -> Sampling dataset every {sample_step_hours} hours...")
    df_sampled = df_telem[df_telem["datetime"].dt.hour % sample_step_hours == 0].copy()
    df_sampled = df_sampled.sort_values(["machineID", "datetime"]).reset_index(drop=True)

    print(f"  -> Total sampled records: {len(df_sampled)} across 100 machines.")

    # 8. Train / Val / Test Temporal Split
    # Train: 2015-01-01 to 2015-08-14
    # Val:   2015-08-15 to 2015-08-31 (threshold tuning)
    # Test:  2015-09-01 to 2015-12-31 (held out test & live demo replay)
    train_mask = df_sampled["datetime"] < "2015-08-15"
    val_mask = (df_sampled["datetime"] >= "2015-08-15") & (df_sampled["datetime"] < "2015-09-01")
    test_mask = df_sampled["datetime"] >= "2015-09-01"

    df_train = df_sampled[train_mask].reset_index(drop=True)
    df_val = df_sampled[val_mask].reset_index(drop=True)
    df_test = df_sampled[test_mask].reset_index(drop=True)

    print(f"  -> Train set: {len(df_train)} rows | Positives: {df_train['failure_next_24h'].sum()}")
    print(f"  -> Val set:   {len(df_val)} rows   | Positives: {df_val['failure_next_24h'].sum()}")
    print(f"  -> Test set:  {len(df_test)} rows  | Positives: {df_test['failure_next_24h'].sum()}")

    # Save to parquet
    train_path = os.path.join(output_dir, "train.parquet")
    val_path = os.path.join(output_dir, "val.parquet")
    test_path = os.path.join(output_dir, "test.parquet")
    failures_anskey_path = os.path.join(output_dir, "failures_answer_key.csv")

    df_train.to_parquet(train_path, index=False)
    df_val.to_parquet(val_path, index=False)
    df_test.to_parquet(test_path, index=False)
    df_failures.to_csv(failures_anskey_path, index=False)

    print(f"[✓] Feature Engineering Complete in {time.time()-t0:.2f}s!")
    print(f"    Train: {train_path}")
    print(f"    Val:   {val_path}")
    print(f"    Test:  {test_path}")
    print(f"    Failures Key: {failures_anskey_path}")

if __name__ == "__main__":
    build_features()
