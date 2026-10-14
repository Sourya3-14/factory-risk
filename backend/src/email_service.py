"""
YantraWatch - Automated Supervisor Email Alert Notification Service
Sends high-priority machine risk & failure probability alerts to factory supervisors.
Supervisor emails are dynamically fetched from the PostgreSQL (Neon) database.
"""

import os
import smtplib
import ssl
import socket
import asyncio
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict, Any, Optional
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import select

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Import database session & models
from backend.src.db.connection import AsyncSessionLocal
from backend.src.db.models import User, UserRole

# Alert deduplication tracker (machine_id -> epoch timestamp of last alert)
_ALERT_COOLDOWN_SECONDS = 1800  # 30-minute cooldown per machine to prevent spam
_last_alert_times: Dict[int, float] = {}


def get_smtp_config():
    """Reads SMTP credentials from environment."""
    return {
        "user": os.getenv("EMAIL", "").strip(),
        "password": os.getenv("MAIL_PASSWORD", "").strip(),
        "from_name": os.getenv("MAIL_FROM_NAME", "YantraWatch Plant Sentinel").strip(),
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com").strip(),
        "port": int(os.getenv("SMTP_PORT", "587")),
    }


async def get_supervisor_emails() -> List[str]:
    """
    Fetches all active supervisor emails directly from the database.
    Does not use environment variables for recipients.
    """
    try:
        async with AsyncSessionLocal() as session:
            # Match role 'supervisor' case-insensitively
            result = await session.execute(
                select(User.email).where(
                    User.role.ilike("supervisor"), User.is_active == True
                )
            )
            emails = [e for e in result.scalars().all() if e and "@" in e]
            return list(set(emails))
    except Exception as e:
        print(f"[!] EmailService: Error fetching supervisors from database: {e}")
        return []


def _send_email_sync(
    to_emails: List[str], subject: str, html_body: str, text_body: str
) -> bool:
    """
    Synchronous SMTP sender with IPv4 enforcement, modern TLS context,
    and automatic port fallback (executed via asyncio.to_thread).
    """
    cfg = get_smtp_config()
    sender_email = cfg["user"]
    password = cfg["password"]
    host = cfg["host"]
    port = cfg["port"]
    from_name = cfg["from_name"]

    if not sender_email or not password:
        print(
            "[!] EmailService: EMAIL or MAIL_PASSWORD missing in environment. Email not sent."
        )
        return False

    if not to_emails:
        print("[!] EmailService: No recipient supervisor emails provided.")
        return False

    # Check if password looks like a masked string (e.g. contains '...')
    if "..." in password:
        print(
            "[!] EmailService WARNING: 'MAIL_PASSWORD' appears masked ('...'). Use the unmasked 16-character App Password."
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{sender_email}>"
    msg["To"] = ", ".join(to_emails)

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Force IPv4 socket resolution to prevent broken IPv6 route handshake drops
    orig_getaddrinfo = socket.getaddrinfo

    def getaddrinfo_ipv4(h, p, family=0, type=0, proto=0, flags=0):
        return orig_getaddrinfo(h, p, socket.AF_INET, type, proto, flags)

    # Secure SSL context
    context = ssl.create_default_context()

    methods = (
        [(465, True), (587, False)] if port == 465 else [(port, False), (465, True)]
    )
    last_error = None

    try:
        socket.getaddrinfo = getaddrinfo_ipv4

        for target_port, use_ssl in methods:
            try:
                mode = "SSL" if use_ssl else "STARTTLS"
                print(
                    f"[*] EmailService: Connecting to {host}:{target_port} ({mode}) for {len(to_emails)} recipients..."
                )

                if use_ssl:
                    server = smtplib.SMTP_SSL(
                        host, target_port, timeout=20, context=context
                    )
                    server.ehlo()
                else:
                    server = smtplib.SMTP(host, target_port, timeout=20)
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()

                with server:
                    server.login(sender_email, password)
                    server.sendmail(sender_email, to_emails, msg.as_string())

                print(
                    f"[OK] EmailService: Successfully sent risk alert email to {to_emails}"
                )
                return True

            except smtplib.SMTPAuthenticationError as auth_err:
                print(
                    f"[!] EmailService Authentication Error: Google rejected login for {sender_email}. (Code {auth_err.smtp_code}: {auth_err.smtp_error})"
                )
                print(
                    "[!] Ensure 2FA is active and you're using a 16-character Google App Password without spaces."
                )
                return False
            except Exception as e:
                last_error = e
                print(
                    f"[-] EmailService: Failed on port {target_port}: {e}. Trying alternate port..."
                )

    finally:
        socket.getaddrinfo = orig_getaddrinfo

    print(
        f"[!] EmailService: All SMTP connection attempts failed. Last error: {last_error}"
    )
    return False


async def send_email_async(
    to_emails: List[str], subject: str, html_body: str, text_body: str
) -> bool:
    """Non-blocking asynchronous wrapper for sending emails."""
    return await asyncio.to_thread(
        _send_email_sync, to_emails, subject, html_body, text_body
    )


def build_machine_alert_html(
    machine: Dict[str, Any], current_time: Optional[str] = None
) -> str:
    """Builds a rich, industrial-grade HTML email alert."""
    m_id = machine.get("machine_id", "N/A")
    model = machine.get("model", "N/A")
    age = machine.get("age", "N/A")
    risk_score = machine.get("risk_score", 0.0)
    risk_pct = f"{risk_score * 100:.1f}%"
    status = machine.get("alert_status", "CRITICAL")
    loss_inr = machine.get("expected_loss_inr", 0)
    loss_fmt = f"₹{loss_inr:,.0f}"
    sla_hours = machine.get("sla_hours", 2)
    telemetry = machine.get("telemetry", {})
    top_factors = machine.get("top_factors", [])

    time_str = current_time or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    factors_html = ""
    for f in top_factors:
        label = f.get("label", f.get("feature_key", "Feature"))
        val = f.get("current_value", "")
        impact = f.get("shap_impact", 0)
        factors_html += f"""
        <tr style="border-bottom: 1px solid #2d3748;">
            <td style="padding: 8px 12px; color: #e2e8f0; font-size: 13px;">{label}</td>
            <td style="padding: 8px 12px; color: #a0aec0; font-size: 13px; font-family: monospace;">{val}</td>
            <td style="padding: 8px 12px; color: #f56565; font-size: 13px; font-weight: bold; font-family: monospace;">+{impact}</td>
        </tr>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f7fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 650px; margin: 0 auto; background: #131b2e; border: 1px solid #2d3748; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
        .header {{ background: linear-gradient(135deg, #991b1b, #dc2626); padding: 20px 24px; }}
        .header h1 {{ margin: 0; font-size: 20px; color: #ffffff; letter-spacing: -0.5px; }}
        .header p {{ margin: 4px 0 0; color: #fecaca; font-size: 13px; }}
        .content {{ padding: 24px; }}
        .metric-grid {{ display: flex; gap: 12px; margin-bottom: 20px; }}
        .kpi-box {{ flex: 1; background: #1a2236; border: 1px solid #2d3748; padding: 14px; border-radius: 8px; text-align: center; }}
        .kpi-label {{ font-size: 11px; text-transform: uppercase; color: #a0aec0; letter-spacing: 0.5px; }}
        .kpi-val {{ font-size: 20px; font-weight: bold; margin-top: 4px; font-family: monospace; }}
        .val-danger {{ color: #f87171; }}
        .val-warning {{ color: #fbbf24; }}
        .val-cyan {{ color: #38bdf8; }}
        .telemetry-table {{ width: 100%; border-collapse: collapse; margin-top: 12px; background: #1a2236; border-radius: 8px; overflow: hidden; }}
        .telemetry-table th {{ background: #232d45; color: #a0aec0; font-size: 11px; text-transform: uppercase; padding: 8px 12px; text-align: left; }}
        .telemetry-table td {{ padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #2d3748; }}
        .action-btn {{ display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; margin-top: 20px; }}
        .footer {{ padding: 16px 24px; background: #0c1220; border-top: 1px solid #232d45; font-size: 12px; color: #718096; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>🚨 High Breakdown Risk Alert: Machine #{m_id}</h1>
          <p>YantraWatch Autonomous Sentinel detected critical predictive failure symptoms at {
        time_str
    }</p>
        </div>

        <div class="content">
          <table style="width: 100%; border-spacing: 8px 0; margin-bottom: 20px;">
            <tr>
              <td class="kpi-box">
                <div class="kpi-label">Failure Probability</div>
                <div class="kpi-val val-danger">{risk_pct}</div>
              </td>
              <td class="kpi-box">
                <div class="kpi-label">₹ Exposure (24h)</div>
                <div class="kpi-val val-warning">{loss_fmt}</div>
              </td>
              <td class="kpi-box">
                <div class="kpi-label">Dynamic SLA</div>
                <div class="kpi-val val-cyan">{sla_hours} Hours</div>
              </td>
            </tr>
          </table>

          <h3 style="font-size: 14px; text-transform: uppercase; color: #cbd5e1; margin-bottom: 8px; border-bottom: 1px solid #2d3748; padding-bottom: 4px;">
            Unit Profile & Telemetry Readouts
          </h3>
          <p style="font-size: 13px; color: #94a3b8; margin: 4px 0 12px;">
            Machine Model: <strong>{model}</strong> | Equipment Age: <strong>{
        age
    } years</strong> | Alert Status: <span style="color: #f87171; font-weight: bold;">{
        status
    }</span>
          </p>

          <table class="telemetry-table">
            <thead>
              <tr>
                <th>Voltage</th>
                <th>Rotation Speed</th>
                <th>Hydraulic Pressure</th>
                <th>Vibration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-family: monospace; color: #e2e8f0;">{
        telemetry.get("volt", "N/A")
    } V</td>
                <td style="font-family: monospace; color: #e2e8f0;">{
        telemetry.get("rotate", "N/A")
    } rpm</td>
                <td style="font-family: monospace; color: #e2e8f0;">{
        telemetry.get("pressure", "N/A")
    } psi</td>
                <td style="font-family: monospace; color: #f87171; font-weight: bold;">{
        telemetry.get("vibration", "N/A")
    } mm/s</td>
              </tr>
            </tbody>
          </table>

          {
        f'''
          <h3 style="font-size: 14px; text-transform: uppercase; color: #cbd5e1; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #2d3748; padding-bottom: 4px;">
            Top Contributing Failure Drivers (TreeSHAP)
          </h3>
          <table class="telemetry-table">
            <thead>
              <tr>
                <th>Contributing Sensor / Factor</th>
                <th>Observed Value</th>
                <th>SHAP Impact</th>
              </tr>
            </thead>
            <tbody>
              {factors_html}
            </tbody>
          </table>
          '''
        if factors_html
        else ""
    }

          <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 12px;">
              Immediate corrective action is required within the {
        sla_hours
    }-hour SLA to avoid estimated unplanned downtime loss.
            </p>
          </div>
        </div>

        <div class="footer">
          YantraWatch AI Sentinel • Autonomous ₹-Weighted Industrial Risk Loop
        </div>
      </div>
    </body>
    </html>
    """


def build_machine_alert_text(
    machine: Dict[str, Any], current_time: Optional[str] = None
) -> str:
    """Plain-text fallback for email clients."""
    m_id = machine.get("machine_id", "N/A")
    risk_pct = f"{machine.get('risk_score', 0) * 100:.1f}%"
    loss_fmt = f"₹{machine.get('expected_loss_inr', 0):,}"
    sla = machine.get("sla_hours", 2)
    return (
        f"[YantraWatch Alert] Machine #{m_id} Failure Risk Warning\n"
        f"Time: {current_time or datetime.now()}\n"
        f"Status: {machine.get('alert_status', 'CRITICAL')}\n"
        f"Probability of Failure: {risk_pct}\n"
        f"Expected Financial Exposure: {loss_fmt}\n"
        f"Resolution SLA Window: {sla} Hours\n\n"
        f"Please login to YantraWatch Console to assign a technician."
    )


async def notify_supervisors_on_machine_risk(
    machine: Dict[str, Any], current_time: Optional[str] = None, force: bool = False
) -> Dict[str, Any]:
    """
    Evaluates machine risk and sends email to any supervisor registered in the database.
    Applies cooldown tracking unless force=True.
    """
    m_id = machine.get("machine_id")
    risk_score = machine.get("risk_score", 0.0)
    status = machine.get("alert_status", "NORMAL")

    # Only notify for CRITICAL alerts or high probability >= 0.80
    if status != "CRITICAL" and risk_score < 0.80 and not force:
        return {"sent": False, "reason": "Risk score below alert threshold"}

    # Cooldown check
    now = time.time()
    last_sent = _last_alert_times.get(m_id, 0)
    if not force and (now - last_sent < _ALERT_COOLDOWN_SECONDS):
        return {
            "sent": False,
            "reason": f"Alert on cooldown for machine #{m_id} (sent {int(now - last_sent)}s ago)",
        }

    # Fetch supervisor emails directly from Neon database
    supervisor_emails = await get_supervisor_emails()
    if not supervisor_emails:
        print(
            "[!] EmailService: No active supervisors found in the database. Skipping notification."
        )
        return {"sent": False, "reason": "No supervisors found in database"}

    # Update cooldown timestamp
    _last_alert_times[m_id] = now

    subject = f"🚨 [YantraWatch Alert] Unit #{m_id} Critical Failure Risk ({risk_score * 100:.1f}%) - ₹{machine.get('expected_loss_inr', 0):,} at Risk"
    html_body = build_machine_alert_html(machine, current_time)
    text_body = build_machine_alert_text(machine, current_time)

    success = await send_email_async(supervisor_emails, subject, html_body, text_body)
    return {
        "sent": success,
        "recipients": supervisor_emails,
        "machine_id": m_id,
        "risk_score": risk_score,
    }
