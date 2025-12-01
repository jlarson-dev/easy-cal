from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import json
import os
from typing import Dict, Optional

try:
    from .models import ScheduleRequest, ScheduleResponse, StudentSchedule, BlockedTime
    from .scheduler import generate_schedule
    from .schedule_storage import (
        load_all_schedules, save_student_schedule, delete_student_schedule,
        list_schedule_files, reload_schedules, get_deletion_log, restore_student_schedule,
        permanently_delete_from_log
    )
except ImportError:
    from models import ScheduleRequest, ScheduleResponse, StudentSchedule, BlockedTime
    from scheduler import generate_schedule
    from schedule_storage import (
        load_all_schedules, save_student_schedule, delete_student_schedule,
        list_schedule_files, reload_schedules, get_deletion_log, restore_student_schedule,
        permanently_delete_from_log
    )

app = FastAPI(title="Student Schedule Generator API")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "http://localhost",        # Docker frontend
        "http://frontend",         # Docker internal network
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)

# In-memory cache for file metadata (for reload detection)
file_metadata_cache: Dict[str, float] = {}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/api/upload")
async def upload_schedule(
    file: UploadFile = File(...),
    overwrite: bool = Query(default=False, description="Whether to overwrite existing schedules")
):
    """
    Upload and parse student schedule JSON file.
    Expected format:
    {
        "student_name": {
            "blocked_times": [
                {"day": "Monday", "start": "09:00", "end": "10:00"},
                ...
            ]
        },
        ...
    }
    Saves each student's schedule as a separate JSON file in the uploads directory.
    
    Args:
        overwrite: If True, overwrite existing schedules. If False, return existing students without overwriting.
    """
    try:
        # Read file content
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        
        # Validate and parse into StudentSchedule objects
        student_schedules: Dict[str, StudentSchedule] = {}
        
        for student_name, schedule_data in data.items():
            blocked_times = [
                BlockedTime(**bt) for bt in schedule_data.get("blocked_times", [])
            ]
            student_schedules[student_name] = StudentSchedule(
                blocked_times=blocked_times
            )
        
        # Check for existing schedules
        existing_students = []
        if not overwrite:
            existing_schedules = load_all_schedules(uploads_dir)
            for student_name in student_schedules.keys():
                if student_name in existing_schedules:
                    existing_students.append(student_name)
        
        # Only save if overwrite is True or student doesn't exist
        saved_students = {}
        for student_name, schedule in student_schedules.items():
            if overwrite or student_name not in existing_students:
                save_student_schedule(uploads_dir, student_name, schedule)
                saved_students[student_name] = schedule
        
        # Update cache
        global file_metadata_cache
        files = list_schedule_files(uploads_dir)
        file_metadata_cache = {f["student_name"]: f["modified_time"] for f in files}
        
        # Return parsed data with info about duplicates
        return {
            "success": True,
            "students": {
                name: {
                    "blocked_times": [
                        {
                            "day": bt.day,
                            "start": bt.start,
                            "end": bt.end,
                            "label": bt.label if hasattr(bt, 'label') and bt.label else None
                        }
                        for bt in schedule.blocked_times
                    ]
                }
                for name, schedule in student_schedules.items()
            },
            "existing_students": existing_students if not overwrite else [],
            "saved_students": list(saved_students.keys())
        }
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/api/generate", response_model=ScheduleResponse)
async def generate(request: ScheduleRequest):
    """
    Generate schedule based on student schedules, subject requirements, and constraints.
    """
    try:
        result = generate_schedule(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating schedule: {str(e)}")


# Schedule persistence endpoints

@app.get("/api/schedules/directory")
async def get_directory():
    """Get current schedule directory path (always uploads directory)."""
    return {
        "directory": uploads_dir,
        "exists": os.path.exists(uploads_dir)
    }


@app.get("/api/schedules/list")
async def list_schedules():
    """List all schedule files in uploads directory with metadata."""
    if not os.path.exists(uploads_dir):
        return {"files": []}
    
    files = list_schedule_files(uploads_dir)
    return {"files": files}


@app.get("/api/schedules/load")
async def load_schedules():
    """Load all schedules from uploads directory."""
    if not os.path.exists(uploads_dir):
        return {"students": {}}
    
    schedules = load_all_schedules(uploads_dir)
    
    # Update cache with current file metadata
    global file_metadata_cache
    files = list_schedule_files(uploads_dir)
    file_metadata_cache = {f["student_name"]: f["modified_time"] for f in files}
    
    # Convert to response format
    return {
        "students": {
            name: {
                "blocked_times": [
                    {
                        "day": bt.day,
                        "start": bt.start,
                        "end": bt.end,
                        "label": bt.label if bt.label else None
                    }
                    for bt in schedule.blocked_times
                ]
            }
            for name, schedule in schedules.items()
        }
    }


@app.post("/api/schedules/reload")
async def reload_schedules_endpoint():
    """Reload schedules from uploads directory and detect changes."""
    if not os.path.exists(uploads_dir):
        return {"students": {}, "changes": {"new": [], "modified": [], "deleted": []}}
    
    # Get previous state from cache
    global file_metadata_cache
    last_known = file_metadata_cache.copy() if file_metadata_cache else None
    
    # Reload and detect changes
    result = reload_schedules(uploads_dir, last_known)
    
    # Update cache
    file_metadata_cache = result["file_metadata"]
    
    # Convert schedules to response format
    return {
        "students": {
            name: {
                "blocked_times": [
                    {
                        "day": bt.day,
                        "start": bt.start,
                        "end": bt.end,
                        "label": bt.label if bt.label else None
                    }
                    for bt in schedule.blocked_times
                ]
            }
            for name, schedule in result["schedules"].items()
        },
        "changes": result["changes"]
    }


@app.post("/api/schedules/save/{student_name}")
async def save_schedule(student_name: str, schedule_data: dict):
    """Save/update a student's schedule to file in uploads directory."""
    # Convert dict to StudentSchedule model
    try:
        blocked_times = [BlockedTime(**bt) for bt in schedule_data.get("blocked_times", [])]
        schedule = StudentSchedule(blocked_times=blocked_times)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid schedule format: {str(e)}")
    
    success, message = save_student_schedule(uploads_dir, student_name, schedule)
    
    if success:
        # Update cache
        global file_metadata_cache
        try:
            from .schedule_storage import get_student_file_path
        except ImportError:
            from schedule_storage import get_student_file_path
        file_path = get_student_file_path(uploads_dir, student_name)
        if os.path.exists(file_path):
            file_metadata_cache[student_name] = os.path.getmtime(file_path)
        
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=500, detail=message)


@app.delete("/api/schedules/{student_name}")
async def delete_schedule(student_name: str):
    """Delete a student's schedule file from uploads directory."""
    success, message = delete_student_schedule(uploads_dir, student_name)
    
    if success:
        # Remove from cache
        global file_metadata_cache
        file_metadata_cache.pop(student_name, None)
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=404, detail=message)


@app.get("/api/schedules/deleted")
async def get_deleted_schedules():
    """Get list of deleted schedules that can be restored."""
    deletions = get_deletion_log(uploads_dir)
    
    # Format for frontend
    deleted_list = [
        {
            "student_name": name,
            "deleted_at": entry.get("deleted_at", ""),
            "blocked_times": entry.get("schedule", {}).get("blocked_times", [])
        }
        for name, entry in deletions.items()
    ]
    
    return {"deleted": deleted_list}


@app.post("/api/schedules/restore/{student_name}")
async def restore_schedule(student_name: str):
    """Restore a deleted student schedule."""
    success, message = restore_student_schedule(uploads_dir, student_name)
    
    if success:
        # Update cache
        global file_metadata_cache
        try:
            from .schedule_storage import get_student_file_path
        except ImportError:
            from schedule_storage import get_student_file_path
        file_path = get_student_file_path(uploads_dir, student_name)
        if os.path.exists(file_path):
            file_metadata_cache[student_name] = os.path.getmtime(file_path)
        
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=404, detail=message)


@app.delete("/api/schedules/deleted/{student_name}")
async def permanently_delete_from_log_endpoint(student_name: str):
    """Permanently delete a student from the deletion log (cannot be restored)."""
    success, message = permanently_delete_from_log(uploads_dir, student_name)
    
    if success:
        return {"success": True, "message": message}
    else:
        raise HTTPException(status_code=404, detail=message)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

