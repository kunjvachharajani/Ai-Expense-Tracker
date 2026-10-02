"""
Root conftest.py — ensures the backend directory is on sys.path
so pytest can resolve `app.*` imports from the tests/ folder.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
