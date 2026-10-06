"""Central configuration loaded from the repo-root .env.local (never committed).

Falls back to safe defaults so the app boots (and tests run) even with no
secrets present -- this is what lets "demo mode" work offline.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# repo root is two levels up from this file: backend/app/core/config.py -> repo/
_REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_REPO_ROOT / ".env.local", override=False)
load_dotenv(_REPO_ROOT / "backend" / ".env", override=False)


class Settings:
    # Supabase
    supabase_url: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_project_ref: str = os.getenv("SUPABASE_PROJECT_REF", "")

    # Database (direct Postgres connection, falls back to local sqlite for offline dev/tests)
    # On Vercel the deployment filesystem is read-only except /tmp, so the
    # sqlite fallback lives there (per-instance and ephemeral -- set
    # DATABASE_URL to a real Postgres for data that must persist).
    database_url: str = (
        os.getenv("DATABASE_URL")
        or ("sqlite:////tmp/finpilot.db" if os.getenv("VERCEL") else "sqlite:///./finpilot_dev.db")
    )

    # Gemini
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
    gemini_embed_model: str = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")

    # Resend (optional cash-flow-gap alert emails)
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    email_from: str = os.getenv("EMAIL_FROM", "FinPilot <onboarding@resend.dev>")
    hr_alert_email: str = os.getenv("HR_ALERT_EMAIL", "")

    # Auth behaviour
    demo_mode: bool = os.getenv("FINPILOT_DEMO_MODE", "true").lower() == "true"

    # Firebase
    firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "hackmatrix-1c5a2")

    @property
    def has_firebase(self) -> bool:
        return bool(self.firebase_project_id)

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def has_resend(self) -> bool:
        return bool(self.resend_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
