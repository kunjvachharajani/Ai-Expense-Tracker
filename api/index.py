"""
Vercel Serverless Function entry point for FastAPI backend.
"""
import os
import sys

# Add the backend directory to Python path across local and Vercel environments
base_dir = os.path.dirname(__file__)
candidates = [
    os.path.abspath(os.path.join(base_dir, "..", "backend")),
    os.path.abspath(os.path.join(os.getcwd(), "backend")),
    os.path.abspath(os.path.join(base_dir, "backend")),
    os.path.abspath(os.path.join(base_dir, "..")),
]
for candidate in candidates:
    if os.path.isdir(candidate) and candidate not in sys.path:
        sys.path.insert(0, candidate)

from app.main import app
