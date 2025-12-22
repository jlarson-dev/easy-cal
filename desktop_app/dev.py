"""
Development helper script to run the desktop app in development mode.
Useful for testing before building the executable.
"""
import sys
import subprocess
from pathlib import Path

if __name__ == "__main__":
    # Run main_desktop.py as a script
    desktop_app_dir = Path(__file__).parent
    main_desktop_path = desktop_app_dir / "main_desktop.py"
    
    subprocess.run([sys.executable, str(main_desktop_path)])

