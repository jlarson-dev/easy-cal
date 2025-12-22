"""
Build script for creating PyInstaller executable.
Builds frontend first, then creates the desktop executable.
"""
import subprocess
import sys
import os
from pathlib import Path


def build_frontend():
    """Build React frontend"""
    print("Building frontend...")
    frontend_dir = Path(__file__).parent.parent / "frontend"
    
    if not frontend_dir.exists():
        print(f"Error: Frontend directory not found at {frontend_dir}")
        return False
    
    try:
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=frontend_dir,
            check=True,
            capture_output=True,
            text=True
        )
        print("Frontend build successful!")
        
        # Verify build output
        dist_dir = frontend_dir / "dist"
        index_file = dist_dir / "index.html"
        if not index_file.exists():
            print(f"Error: Frontend build output not found at {index_file}")
            return False
        
        print(f"Frontend build output verified: {dist_dir}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error building frontend: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        print("Error: npm not found. Please install Node.js and npm.")
        return False


def build_executable():
    """Build PyInstaller executable"""
    print("\nBuilding executable...")
    desktop_dir = Path(__file__).parent
    spec_file = desktop_dir / "app.spec"
    
    if not spec_file.exists():
        print(f"Error: Spec file not found at {spec_file}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, "-m", "PyInstaller", "--clean", str(spec_file)],
            cwd=desktop_dir,
            check=True
        )
        print("\nBuild complete! Executable in dist/ directory")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error building executable: {e}")
        return False
    except FileNotFoundError:
        print("Error: PyInstaller not found. Install with: pip install pyinstaller")
        return False


def main():
    """Main build function"""
    print("=" * 50)
    print("Student Schedule Generator - Desktop App Builder")
    print("=" * 50)
    
    # Build frontend
    if not build_frontend():
        print("\nBuild failed at frontend stage")
        sys.exit(1)
    
    # Build executable
    if not build_executable():
        print("\nBuild failed at executable stage")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("Build successful!")
    print("=" * 50)
    print("\nExecutable location:")
    desktop_dir = Path(__file__).parent
    dist_dir = desktop_dir / "dist"
    
    if sys.platform == "win32":
        exe_name = "StudentScheduleGenerator.exe"
    elif sys.platform == "darwin":
        exe_name = "StudentScheduleGenerator.app"
    else:
        exe_name = "StudentScheduleGenerator"
    
    exe_path = dist_dir / exe_name
    if exe_path.exists():
        print(f"  {exe_path}")
    else:
        print(f"  Check {dist_dir} for output files")


if __name__ == "__main__":
    main()

