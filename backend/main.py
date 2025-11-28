from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os
from typing import Dict

try:
    from .models import ScheduleRequest, ScheduleResponse, StudentSchedule, BlockedTime
    from .scheduler import generate_schedule
except ImportError:
    from models import ScheduleRequest, ScheduleResponse, StudentSchedule, BlockedTime
    from scheduler import generate_schedule

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


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/api/upload")
async def upload_schedule(file: UploadFile = File(...)):
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
        
        # Save file for reference (optional)
        file_path = os.path.join(uploads_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Return parsed data
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
            }
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

