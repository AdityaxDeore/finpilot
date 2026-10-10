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
    firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "hackmatrix-3764f")
    # Firestore project may differ (e.g. demo-* with the emulator) from the Auth project that signs ID tokens.
    firestore_project_id: str = os.getenv("FIRESTORE_PROJECT_ID") or firebase_project_id

    @property
    def has_firebase(self) -> bool:
        return bool(self.firebase_project_id)

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_resend(self) -> bool:
        return bool(self.resend_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
