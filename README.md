# YantraWatch: AI Early-Warning & ₹-Weighted Escalation Sentinel

> **An AI early-warning tool for small and mid-size factories that predicts machine failure risk from sensor data, puts a ₹ value on it, explains it in plain language with Gemma 4, and won't let the warning be ignored: the more money at stake, the faster it escalates.**

---

## ⚡ Core Innovation: ₹-Weighted Escalation & Action Reduction
Many industrial monitoring tools stop at *"this machine may fail."* The alert gets lost in technical noise because nobody owns the follow-up, and nobody sees what the downtime is worth in cash.

**YantraWatch closes the gap between prediction and fix:**
1. **Predicts** each machine's probability of failing within the next 24 hours using a class-weighted LightGBM model.
2. **Quantifies** expected loss in ₹ with a transparent formula:
   $$\text{Expected Loss (₹)} = P(\text{failure}) \times \text{downtime hours} \times \text{₹/hour}$$
3. **Explains** the root cause with **Gemma 4** in plain English, translating LightGBM TreeSHAP factors into physical mechanics with optional technician photo inspection.
4. **Enforces Accountability** via **dynamic SLAs**: Deadlines shrink as financial exposure rises. High-loss risks receive tight deadlines (2h) while lower-loss risks receive more time (16h).
5. **Escalates Automatically:** Missed deadlines move up the chain on a simulated clock:
   $$\text{Maintenance Technician} \longrightarrow \text{Shift Supervisor} \longrightarrow \text{Plant Operations Manager}$$
6. **Tracks Risk Reduction:** Completing corrective actions visibly slashes risk probability and ₹ exposure, recording factory savings in real time.

---

## 📊 Verified Test-Set Benchmark (Sep 1 – Dec 31, 2015)

Evaluated on the held-out test split of the **Microsoft Azure Predictive Maintenance dataset** (100 machines):

| Metric | LightGBM Classifier (YantraWatch) | Naive Baseline (Vibration > 48 mm/s) | Advantage |
| :--- | :---: | :---: | :---: |
| **Precision** | **96.66%** | 11.04% | **+8.8x Fewer False Alarms** |
| **Recall (Coverage)** | **99.56%** | 26.96% | **+3.7x Breakdowns Caught** |
| **F1 Score** | **0.9809** | 0.1566 | **+6.3x Performance** |
| **ROC AUC** | **0.9999** | — | **Near-Perfect Discrimination** |

### Early Warning Lead-Time
* **Pre-Alert Rate:** **239 / 239 (100.0%)** test-period failures alerted before breakdown.
* **Mean Lead Time:** **21.4 hours** of advance notice.
* **Median Lead Time:** **21.0 hours** of advance notice.

*Note: Failure events serve strictly as the evaluation answer key. They never trigger alerts during inference.*

---

## 🏗️ System Architecture

```
Telemetry + Errors + Maintenance Logs (2015)
   │
   ▼
Feature Pipeline (Rolling 3h/24h stats, error frequencies, maint age)
   │
   ▼
LightGBM Risk Classifier ──► TreeSHAP Top Contributing Drivers
   │                                  │
   ├─► ₹ Impact Formula Engine        ▼
   │         │                  Gemma 4 Explainer (+ Optional Photo)
   ▼         ▼                        │
Precomputed Replay Stream ◄───────────┘
   │
   ▼
Custom Industrial Dark-Mode Web App
   ├── Simulated Timeline Scrubber & Replay Controller
   ├── Fleet Matrix Health Monitor (25 Monitored Production Units)
   ├── Alert Inspection Modal & Financial Loss Breakdown
   ├── ₹-Weighted Dynamic SLA Countdown Clock
   ├── Automated Hierarchy Escalation Engine (SQLite Persistence)
   └── Judge Benchmark & Evaluation Hub
```

---

## ⚖️ Honest Limitations

1. **Synthetic Dataset:** The dataset is simulated by Microsoft Azure. Results demonstrate that the methodology works, not that it is already proven on a live physical factory floor.
2. **Rare Failure Statistics:** Failures are rare events (~2% of hours). While test results are backed by 239 real breakdowns, real factories may exhibit unique failure modes.
3. **Configurable Financial Assumptions:** Hourly downtime costs (₹12,000 to ₹35,000) and mitigation factors (40% to 85%) are configurable operational assumptions defined in `backend/config/costs.yaml`.
4. **Historical Dates:** Replay timestamps reflect 2015 data from the benchmark dataset.

---

## 🚀 Quick Start

### 1. Requirements
* Python 3.11+
* `pip install -r requirements.txt` (or `pip install lightgbm pandas scikit-learn fastapi uvicorn pyyaml pyarrow google-genai`)

### 2. Run the Application
```bash
python -m uvicorn backend.src.main:app --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

### 3. Optional: Retrain Model & Regenerate Stream
```bash
# 1. Feature Engineering
python backend/src/data_prep.py

# 2. Model Training & Lead-Time Evaluation
python backend/src/train_model.py

# 3. Offline Precomputed Replay Generation
python backend/src/precompute_stream.py
```

---

## 📜 License
MIT License.
