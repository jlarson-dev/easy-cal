from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import time


class BlockedTime(BaseModel):
    day: str
    start: str  # Format: "HH:MM"
    end: str    # Format: "HH:MM"
    label: Optional[str] = None  # Optional label/description for display


class StudentSchedule(BaseModel):
    blocked_times: List[BlockedTime]
    can_overlap: Optional[List[str]] = []  # List of student names this student can be scheduled with


class SubjectConfig(BaseModel):
    name: str
    constraint_type: str  # "daily" or "weekly"
    daily_minutes: Optional[int] = None  # Required if constraint_type is "daily"
    weekly_days: Optional[int] = None  # Number of sessions per week, required if "weekly"
    weekly_minutes_per_session: Optional[int] = None  # Minutes per session, required if "weekly"


class StudentConfig(BaseModel):
    name: str
    subjects: List[SubjectConfig]
    color: Optional[str] = None  # Hex color code for schedule display


class WorkingHours(BaseModel):
    days: List[str]  # e.g., ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    start_time: str  # Format: "HH:MM"
    end_time: str    # Format: "HH:MM"


class ScheduleRequest(BaseModel):
    students: Dict[str, StudentSchedule]  # student_name -> schedule
    student_configs: List[StudentConfig]
    working_hours: WorkingHours
    lunch_time: str  # Format: "HH:MM"
    prep_time_required: bool = True  # Whether to include 1 hour prep time daily (flexible scheduling)


class TimeSlot(BaseModel):
    day: str
    start: str
    end: str
    student: Optional[str] = None  # For backward compatibility (single student)
    students: Optional[List[str]] = None  # For multi-student sessions
    subject: Optional[str] = None
    type: str  # "session", "lunch", "prep", "blocked"
    label: Optional[str] = None  # Optional label for blocked times


class ScheduleResponse(BaseModel):
    schedule: List[TimeSlot]
    success: bool
    message: Optional[str] = None
    conflicts: Optional[List[str]] = None

