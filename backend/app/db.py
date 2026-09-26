"""
Supabase client helper.
"""
from supabase import create_client, Client
from app.config import settings


def get_supabase_client() -> Client:
    """Return a Supabase client using the service role key (for server-side ops)."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_anon_client() -> Client:
    """Return a Supabase client using the anon key (for auth verification)."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
