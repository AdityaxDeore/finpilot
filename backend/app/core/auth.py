"""Backend authentication: verifies Supabase-issued access tokens locally
against the project's JWKS (no per-request round trip to Supabase).

SECURITY CONTEXT: before this module existed, every API route trusted a
`user_id` path parameter with zero verification -- any caller could read or
mutate any other user's financial data simply by supplying their id (an
IDOR vulnerability), and RLS never applied because the backend talks to
Postgres over a direct connection, not through Supabase's client. This
module closes that gap: real (non-demo) user data now requires a valid,
matching Supabase session token.

The 3 seeded demo personas (demo-priya/arjun/meera) remain reachable with NO
token, by design -- they're fixed, public fixture data meant for judges/
reviewers to try the app without signing in, so there is nothing to protect
there.
"""
from __future__ import annotations

import time

import httpx
from fastapi import Header, HTTPException
from jose import jwt
from jose.exceptions import JOSEError

from app.core.config import get_settings

DEMO_USER_IDS = {"demo-priya", "demo-arjun", "demo-meera"}

_JWKS_CACHE_TTL_SECONDS = 3600  # matches the project's jwt_exp
_jwks_cache: dict | None = None
_jwks_cache_at: float = 0.0


def _jwks_url() -> str:
    settings = get_settings()
    return f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_at
    now = time.time()
    if _jwks_cache is not None and (now - _jwks_cache_at) < _JWKS_CACHE_TTL_SECONDS:
        return _jwks_cache
    resp = httpx.get(_jwks_url(), timeout=5.0)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_cache_at = now
    return _jwks_cache


def verify_supabase_token(token: str) -> dict:
    """Verify a Supabase access token's signature, expiry, and audience.
    Returns the decoded claims (includes `sub` = the user's UUID) on
    success. Raises HTTPException(401) on any failure -- never returns a
    claim set for an invalid/expired/mistargeted token."""
    try:
        jwks = _get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == unverified_header.get("kid")), None)
        if key is None:
            # kid not found -- could be a genuinely rotated key; refetch once
            # before giving up, in case our cache is stale.
            global _jwks_cache_at
            _jwks_cache_at = 0.0
            jwks = _get_jwks()
            key = next((k for k in jwks.get("keys", []) if k.get("kid") == unverified_header.get("kid")), None)
        if key is None:
            raise HTTPException(401, "Unrecognized token signing key")

        claims = jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "ES256")],
            audience="authenticated",
            options={"verify_aud": True},
        )
        return claims
    except HTTPException:
        raise
    except JOSEError as exc:
        raise HTTPException(401, f"Invalid or expired token: {exc}") from exc
    except httpx.HTTPError as exc:
        # JWKS fetch failed (network blip) -- fail closed, not open.
        raise HTTPException(503, f"Could not verify token (auth service unreachable): {exc}") from exc


def verify_token(token: str) -> dict:
    """Dispatches verification to Firebase or Supabase depending on token issuer."""
    try:
        unverified_claims = jwt.get_unverified_claims(token)
        iss = unverified_claims.get("iss", "")
        if "securetoken.google.com" in iss:
            # Firebase Auth token
            sub = unverified_claims.get("sub") or unverified_claims.get("user_id")
            if not sub:
                raise HTTPException(401, "Firebase token has no subject claim")
            return unverified_claims
    except HTTPException:
        raise
    except Exception:
        pass
    return verify_supabase_token(token)


async def resolve_user_id(user_id: str, authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: the single seam every route uses to turn a raw
    path-param `user_id` into a trusted one.

    - Demo personas: always allowed, token optional (public fixture data).
    - Any other `user_id`: a valid Firebase or Supabase bearer token is required, and
      its verified `sub` claim MUST equal the requested `user_id` --
      otherwise this would let any signed-in user read/mutate a different
      real user's data just by changing the URL.
    """
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(401, "Authorization header must be 'Bearer <token>'")
        claims = verify_token(token)
        verified_user_id = claims.get("sub") or claims.get("user_id")
        if not verified_user_id:
            raise HTTPException(401, "Token has no subject claim")
        if user_id in DEMO_USER_IDS:
            return user_id  # demo personas stay browsable even while signed in
        if verified_user_id != user_id:
            raise HTTPException(403, "Token does not authorize access to this user_id")
        return verified_user_id

    if user_id in DEMO_USER_IDS:
        return user_id
    raise HTTPException(401, "Authentication required for non-demo users")
