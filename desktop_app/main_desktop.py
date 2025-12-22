"""
Desktop application entry point for Student Schedule Generator.
Uses pywebview to create a native window and runs FastAPI backend in a thread.
"""
import os
import sys
from pathlib import Path

# Set environment variables BEFORE any other imports
# This prevents GitPython from trying to find a git repo in the dist directory
os.environ["DESKTOP_MODE"] = "true"
os.environ["GIT_PYTHON_REFRESH"] = "quiet"  # Prevent GitPython from auto-detecting repos

# Prevent GitPython errors in PyInstaller bundles
if getattr(sys, 'frozen', False):
    # Create dummy git module to prevent import errors
    import types
    
    class InvalidGitRepositoryError(Exception):
        pass
    
    # Create a dummy Repo class that silently fails
    class DummyRepo:
        def __init__(self, path=None, *args, **kwargs):
            # Silently accept any path without checking
            self.path = path or os.getcwd()
    
    # Create dummy git module structure
    dummy_git = types.ModuleType('git')
    dummy_repo = types.ModuleType('git.repo')
    dummy_base = types.ModuleType('git.repo.base')
    dummy_exc = types.ModuleType('git.exc')
    
    # Add Repo to multiple locations to handle different import styles
    dummy_base.Repo = DummyRepo
    dummy_repo.Repo = DummyRepo  # Some code might import from git.repo
    dummy_repo.base = dummy_base
    dummy_exc.InvalidGitRepositoryError = InvalidGitRepositoryError
    dummy_git.Repo = DummyRepo  # Some code might import Repo directly from git
    dummy_git.repo = dummy_repo
    dummy_git.exc = dummy_exc
    
    # Insert dummy modules into sys.modules before any real imports
    sys.modules['git'] = dummy_git
    sys.modules['git.repo'] = dummy_repo
    sys.modules['git.repo.base'] = dummy_base
    sys.modules['git.exc'] = dummy_exc
    
    # Change working directory to user's home to avoid git repo detection issues
    # The app uses absolute paths for data directories anyway
    try:
        cwd = os.getcwd()
        if 'dist' in cwd or cwd.endswith('dist'):
            os.chdir(os.path.expanduser("~"))
    except:
        pass

import webview
import threading
import uvicorn
import time

# Add backend to path
if getattr(sys, 'frozen', False):
    # In PyInstaller bundle, backend is in the same directory as the exe
    backend_path = Path(sys._MEIPASS) / "backend"
else:
    backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Import FastAPI app
try:
    from main import app
except ImportError:
    # Try alternative import path for PyInstaller
    import importlib.util
    spec = importlib.util.spec_from_file_location("main", backend_path / "main.py")
    main_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(main_module)
    app = main_module.app


def start_server():
    """Start FastAPI server in background thread"""
    try:
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            log_level="warning",  # Reduce console noise
            access_log=False
        )
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)


def wait_for_server(max_attempts=30, delay=0.5):
    """Wait for the server to be ready"""
    import urllib.request
    import urllib.error
    
    for _ in range(max_attempts):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1)
            return True
        except (urllib.error.URLError, OSError):
            time.sleep(delay)
    return False


if __name__ == "__main__":
    # Start backend server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Wait for server to be ready
    if not wait_for_server():
        print("Error: Backend server failed to start")
        sys.exit(1)
    
    # Create webview window
    window = webview.create_window(
        title="Student Schedule Generator",
        url="http://127.0.0.1:8000",
        width=1200,
        height=800,
        min_size=(800, 600),
        resizable=True
    )
    
    # Start webview (blocks until window is closed)
    webview.start(debug=False)

