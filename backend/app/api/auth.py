"""
Authentication dependency — verifies Supabase JWT from the Authorization header.
"""
import logging
from fastapi import Depends, HTTPException, status, Request
from app.db import get_supabase_anon_client

logger = logging.getLogger(__name__)


async def get_current_user(request: Request) -> dict:
    """
    Extract and verify the Supabase JWT from the Authorization header.
    Returns the user dict with at least 'id' and 'email'.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header.",
        )

    token = auth_header.split("Bearer ")[1]

    try:
        supabase = get_supabase_anon_client()
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token.",
            )
        user = user_response.user
        return {"id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed.",
        )
