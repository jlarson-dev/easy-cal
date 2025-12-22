"""
Desktop application entry point for Student Schedule Generator.
Uses pywebview to create a native window and runs FastAPI backend in a thread.
"""
import webview
import threading
import uvicorn
import os
import sys
import time
from pathlib import Path

# Set desktop mode environment variable
os.environ["DESKTOP_MODE"] = "true"

# Add backend to path
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

