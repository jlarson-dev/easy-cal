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


class SubjectConfig(BaseModel):
    name: str
    hours_per_week: float
    frequency_per_week: int  # How many times per week


class StudentConfig(BaseModel):
    name: str
    subjects: List[SubjectConfig]
    daily_minimum_hours: float
    weekly_total_hours: float


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
    student: Optional[str] = None
    subject: Optional[str] = None
    type: str  # "session", "lunch", "prep", "blocked"
    label: Optional[str] = None  # Optional label for blocked times


class ScheduleResponse(BaseModel):
    schedule: List[TimeSlot]
    success: bool
    message: Optional[str] = None
    conflicts: Optional[List[str]] = None

