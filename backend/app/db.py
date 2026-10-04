"""
Supabase client helper.
"""
from typing import Optional
from supabase import create_client, Client
from app.config import settings

_service_client: Optional[Client] = None
_anon_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Return a Supabase client using the service role key (for server-side ops)."""
    global _service_client
    if _service_client is None:
        _service_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _service_client


def get_supabase_anon_client() -> Client:
    """Return a Supabase client using the anon key (for auth verification)."""
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _anon_client

