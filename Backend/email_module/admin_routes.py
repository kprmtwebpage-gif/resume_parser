"""
Admin-only FastAPI routes for Email Tracking Analytics.

Endpoints:
  GET /email/admin/stats  — aggregate email stats with period/HR filter
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/admin", tags=["email-admin"])

# ── Palette (10 colours, cycles) ─────────────────────────────────────────────
_PALETTE = [
    "#2563EB", "#10B981", "#F59E0B", "#6366F1", "#EC4899",
    "#06B6D4", "#8B5CF6", "#EF4444", "#14B8A6", "#F97316",
]


def _hr_color(index: int) -> str:
    return _PALETTE[index % len(_PALETTE)]


# ── Auth helpers ─────────────────────────────────────────────────────────────

def _require_admin(request: Request):
    """Raise 403 if the requester is not admin/superuser."""
    try:
        from auth import decode_token, get_user_by_username
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authentication required")
        token = auth_header[7:]
        payload = decode_token(token)
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        role = user.get("role", "")
        if role not in ("superuser", "admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Admin auth check failed: %s", e)
        raise HTTPException(status_code=401, detail="Authentication required")


# ── Period → date range + SQL truncation ─────────────────────────────────────

def _period_params(period: str, start_date: Optional[str], end_date: Optional[str]):
    """Return (start_dt, end_dt, trunc_unit) for a given period."""
    now = datetime.now(timezone.utc)

    if period == "daily":
        return now - timedelta(days=90), now, "day"
    elif period == "weekly":
        return now - timedelta(weeks=24), now, "week"
    elif period == "monthly":
        return now - timedelta(days=365), now, "month"
    elif period == "yearly":
        return now - timedelta(days=365 * 5), now, "year"
    elif period == "custom":
        try:
            s = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        except Exception:
            s = now - timedelta(days=30)
        try:
            e = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
            if e.hour == 0 and e.minute == 0 and e.second == 0:
                e = e.replace(hour=23, minute=59, second=59)
        except Exception:
            e = now
        span_days = max(1, (e - s).days)
        if span_days <= 92:
            trunc = "day"
        elif span_days <= 730:
            trunc = "week"
        elif span_days <= 1825:
            trunc = "month"
        else:
            trunc = "year"
        return s, e, trunc
    else:
        # fallback — 30 days daily
        return now - timedelta(days=30), now, "day"


# ══════════════════════════════════════════════════════════════════════════════
# GET /email/admin/stats
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
def get_email_stats(
    request: Request,
    period: str = Query("daily"),           # daily|weekly|monthly|yearly|custom
    hrId: Optional[str] = Query(None),      # filter to single HR sent_by username
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return aggregate email statistics for the Email Tracking admin dashboard.

    Response shape compatible with Upload Metrics frontend patterns:
    {
      hrs: [{id, name, color}],
      totalEmails, totalHRs, totalRecipients, totalSent, totalFailed,
      chartData: [{date, "<hr_name>": count, ..., "Total": count}],
      hrStats: [{id, name, color, totalEmails, sent, failed,
                 uniqueRecipients, lastEmailSent, provider}],
      period, startDate, endDate,
    }
    """
    _require_admin(request)

    start_dt, end_dt, trunc_unit = _period_params(period, startDate, endDate)

    # ── Base HR filter ────────────────────────────────────────────────────────
    params: dict = {"start_dt": start_dt, "end_dt": end_dt}
    hr_filter = ""
    if hrId and hrId.strip():
        hr_filter = "AND LOWER(el.sent_by) = LOWER(:hr_id)"
        params["hr_id"] = hrId.strip()

    # ── Summary counts ────────────────────────────────────────────────────────
    summary_sql = text(f"""
        SELECT
            COUNT(*)                                             AS total_emails,
            COUNT(DISTINCT el.sent_by)                          AS total_hrs,
            COUNT(DISTINCT el.recipient_email)                  AS total_recipients,
            COUNT(*) FILTER (WHERE el.status = 'sent')          AS total_sent,
            COUNT(*) FILTER (WHERE el.status = 'failed')        AS total_failed
        FROM email_logs el
        WHERE el.sent_at >= :start_dt
          AND el.sent_at <= :end_dt
          AND el.direction = 'sent'
          {hr_filter}
    """)
    row = db.execute(summary_sql, params).fetchone()
    total_emails     = int(row.total_emails or 0)
    total_hrs        = int(row.total_hrs or 0)
    total_recipients = int(row.total_recipients or 0)
    total_sent       = int(row.total_sent or 0)
    total_failed     = int(row.total_failed or 0)

    # ── Per-HR stats ──────────────────────────────────────────────────────────
    hr_sql = text(f"""
        SELECT
            COALESCE(u.id, 0)                                        AS hr_id,
            el.sent_by                                               AS hr_name,
            COUNT(*)                                                 AS total_emails,
            COUNT(*) FILTER (WHERE el.status = 'sent')               AS sent_emails,
            COUNT(*) FILTER (WHERE el.status = 'failed')             AS failed_emails,
            COUNT(DISTINCT el.recipient_email)                       AS unique_recipients,
            MAX(el.sent_at)                                          AS last_email_sent,
            MODE() WITHIN GROUP (ORDER BY el.provider)               AS top_provider
        FROM email_logs el
        LEFT JOIN users u ON LOWER(u.username) = LOWER(el.sent_by)
        WHERE el.sent_at >= :start_dt
          AND el.sent_at <= :end_dt
          AND el.direction = 'sent'
          AND el.sent_by IS NOT NULL
          AND el.sent_by != ''
          {hr_filter}
        GROUP BY u.id, el.sent_by
        ORDER BY total_emails DESC
    """)
    hr_rows = db.execute(hr_sql, params).fetchall()

    hrs = []
    hr_stats = []
    for idx, r in enumerate(hr_rows):
        last_sent = r.last_email_sent.isoformat() if r.last_email_sent else None
        color = _hr_color(idx)
        entry = {
            "id": int(r.hr_id),
            "name": r.hr_name or "Unknown",
            "color": color,
            "totalEmails": int(r.total_emails),
            "sent": int(r.sent_emails or 0),
            "failed": int(r.failed_emails or 0),
            "uniqueRecipients": int(r.unique_recipients),
            "lastEmailSent": last_sent,
            "provider": r.top_provider or "—",
        }
        hrs.append({"id": entry["id"], "name": entry["name"], "color": color})
        hr_stats.append(entry)

    # ── Time-series chart data ────────────────────────────────────────────────
    ts_sql = text(f"""
        SELECT
            DATE_TRUNC('{trunc_unit}', el.sent_at AT TIME ZONE 'UTC')::date AS bucket,
            el.sent_by,
            COUNT(*) AS cnt
        FROM email_logs el
        WHERE el.sent_at >= :start_dt
          AND el.sent_at <= :end_dt
          AND el.direction = 'sent'
          AND el.sent_by IS NOT NULL
          {hr_filter}
        GROUP BY bucket, el.sent_by
        ORDER BY bucket ASC
    """)
    ts_rows = db.execute(ts_sql, params).fetchall()

    # Pivot: bucket → {hr_name: count}
    buckets: dict = defaultdict(lambda: defaultdict(int))
    all_hr_names: set = set()
    for r in ts_rows:
        bucket_str = r.bucket.isoformat() if hasattr(r.bucket, "isoformat") else str(r.bucket)
        hr_name = r.sent_by or "Unknown"
        buckets[bucket_str][hr_name] += int(r.cnt)
        all_hr_names.add(hr_name)

    chart_data = []
    for bucket_str in sorted(buckets.keys()):
        row_data: dict = {"date": bucket_str}
        row_total = 0
        for hr_name in sorted(all_hr_names):
            val = buckets[bucket_str].get(hr_name, 0)
            row_data[hr_name] = val
            row_total += val
        row_data["Total"] = row_total
        chart_data.append(row_data)

    return {
        "hrs": hrs,
        "totalEmails": total_emails,
        "totalHRs": total_hrs,
        "totalRecipients": total_recipients,
        "totalSent": total_sent,
        "totalFailed": total_failed,
        "chartData": chart_data,
        "hrStats": hr_stats,
        "period": period,
        "startDate": start_dt.isoformat(),
        "endDate": end_dt.isoformat(),
    }
