from typing import List, Dict, Optional
from datetime import datetime, timedelta
try:
    from .models import (
        StudentSchedule, StudentConfig, WorkingHours,
        ScheduleRequest, TimeSlot, ScheduleResponse
    )
except ImportError:
    from models import (
        StudentSchedule, StudentConfig, WorkingHours,
        ScheduleRequest, TimeSlot, ScheduleResponse
    )


def parse_time(time_str: str) -> datetime:
    """Parse time string 'HH:MM' to datetime object (using arbitrary date)"""
    hour, minute = map(int, time_str.split(':'))
    return datetime(2024, 1, 1, hour, minute)


def format_time(dt: datetime) -> str:
    """Format datetime to 'HH:MM' string"""
    return dt.strftime('%H:%M')


def time_to_minutes(time_str: str) -> int:
    """Convert time string 'HH:MM' to minutes since midnight"""
    hour, minute = map(int, time_str.split(':'))
    return hour * 60 + minute


def minutes_to_time(minutes: int) -> str:
    """Convert minutes since midnight to 'HH:MM' string"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def is_time_in_range(time_str: str, start_str: str, end_str: str) -> bool:
    """Check if time_str is within [start_str, end_str)"""
    time_mins = time_to_minutes(time_str)
    start_mins = time_to_minutes(start_str)
    end_mins = time_to_minutes(end_str)
    return start_mins <= time_mins < end_mins


def get_blocked_slots_for_day(
    day: str,
    student_schedules: Dict[str, StudentSchedule],
    working_start: str,
    working_end: str,
    slot_duration: int = 30
) -> List[tuple]:
    """Get all blocked time slots for a given day"""
    blocked_slots = []
    
    for student_name, schedule in student_schedules.items():
        for blocked_time in schedule.blocked_times:
            if blocked_time.day.lower() == day.lower():
                start_mins = time_to_minutes(blocked_time.start)
                end_mins = time_to_minutes(blocked_time.end)
                
                # Clip to working hours
                work_start_mins = time_to_minutes(working_start)
                work_end_mins = time_to_minutes(working_end)
                start_mins = max(start_mins, work_start_mins)
                end_mins = min(end_mins, work_end_mins)
                
                # Generate blocked slots
                current = start_mins
                while current < end_mins:
                    slot_end = min(current + slot_duration, end_mins)
                    blocked_slots.append((current, slot_end))
                    current = slot_end
    
    return blocked_slots


def generate_available_slots(
    day: str,
    working_start: str,
    working_end: str,
    blocked_slots: List[tuple],
    slot_duration: int = 30
) -> List[tuple]:
    """Generate available time slots for a day"""
    work_start_mins = time_to_minutes(working_start)
    work_end_mins = time_to_minutes(working_end)
    
    # Sort blocked slots
    blocked_slots = sorted(blocked_slots, key=lambda x: x[0])
    
    available = []
    current = work_start_mins
    
    for blocked_start, blocked_end in blocked_slots:
        # Add available slot before this blocked slot
        if current < blocked_start:
            slot_end = min(current + slot_duration, blocked_start)
            while current < blocked_start:
                slot_end = min(current + slot_duration, blocked_start)
                if slot_end > current:
                    available.append((current, slot_end))
                current = slot_end
        
        # Move past blocked slot
        current = max(current, blocked_end)
    
    # Add remaining available slots
    while current < work_end_mins:
        slot_end = min(current + slot_duration, work_end_mins)
        if slot_end > current:
            available.append((current, slot_end))
        current = slot_end
    
    return available


def generate_schedule(request: ScheduleRequest) -> ScheduleResponse:
    """
    Generate a schedule based on constraints.
    Uses a greedy algorithm to fill time slots.
    """
    slot_duration = 30  # 30-minute slots
    schedule: List[TimeSlot] = []
    conflicts: List[str] = []
    
    # Convert student configs to dict for easier access
    student_config_dict = {config.name: config for config in request.student_configs}
    
    # Track scheduled hours per student per subject
    scheduled_hours: Dict[str, Dict[str, float]] = {}
    daily_hours: Dict[str, Dict[str, float]] = {}  # day -> student -> hours
    
    for config in request.student_configs:
        scheduled_hours[config.name] = {subj.name: 0.0 for subj in config.subjects}
        daily_hours[config.name] = {}
    
    # Add lunch time slots (fixed)
    lunch_mins = time_to_minutes(request.lunch_time)
    
    for day in request.working_hours.days:
        # Add lunch (fixed time)
        schedule.append(TimeSlot(
            day=day,
            start=request.lunch_time,
            end=minutes_to_time(lunch_mins + 60),
            type="lunch"
        ))
        
        # Initialize daily hours tracking
        for student_name in scheduled_hours.keys():
            daily_hours[student_name][day] = 0.0
    
    # Get blocked slots for each day (from student schedules)
    blocked_by_day: Dict[str, List[tuple]] = {}
    for day in request.working_hours.days:
        blocked_by_day[day] = get_blocked_slots_for_day(
            day,
            request.students,
            request.working_hours.start_time,
            request.working_hours.end_time,
            slot_duration
        )
        
        # Add lunch as blocked time (prep will be scheduled flexibly later)
        lunch_start = lunch_mins
        lunch_end = lunch_mins + 60
        
        # Add lunch blocked slots
        current = lunch_start
        while current < lunch_end:
            slot_end = min(current + slot_duration, lunch_end)
            blocked_by_day[day].append((current, slot_end))
            current = slot_end
    
    # Add blocked time slots to schedule (student blocked times)
    for day in request.working_hours.days:
        # Get blocked times with labels for this day
        for student_name, student_schedule in request.students.items():
            for blocked_time in student_schedule.blocked_times:
                if blocked_time.day.lower() == day.lower():
                    # Check if within working hours
                    blocked_start_mins = time_to_minutes(blocked_time.start)
                    blocked_end_mins = time_to_minutes(blocked_time.end)
                    work_start_mins = time_to_minutes(request.working_hours.start_time)
                    work_end_mins = time_to_minutes(request.working_hours.end_time)
                    
                    if blocked_end_mins > work_start_mins and blocked_start_mins < work_end_mins:
                        # Clip to working hours
                        start_mins = max(blocked_start_mins, work_start_mins)
                        end_mins = min(blocked_end_mins, work_end_mins)
                        
                        schedule.append(TimeSlot(
                            day=day,
                            start=minutes_to_time(start_mins),
                            end=minutes_to_time(end_mins),
                            type="blocked",
                            label=blocked_time.label
                        ))
    
    # Generate available slots for each day
    available_by_day: Dict[str, List[tuple]] = {}
    for day in request.working_hours.days:
        available_by_day[day] = generate_available_slots(
            day,
            request.working_hours.start_time,
            request.working_hours.end_time,
            blocked_by_day[day],
            slot_duration
        )
    
    # Sort students by priority (more hours = higher priority)
    student_priority = sorted(
        request.student_configs,
        key=lambda s: s.weekly_total_hours,
        reverse=True
    )
    
    # Schedule sessions: try to meet weekly requirements first
    for student_config in student_priority:
        student_name = student_config.name
        
        # Schedule each subject
        for subject in student_config.subjects:
            hours_needed = subject.hours_per_week
            sessions_needed = subject.frequency_per_week
            hours_per_session = hours_needed / sessions_needed if sessions_needed > 0 else 0
            
            sessions_scheduled = 0
            
            # Try to schedule sessions across days
            for day in request.working_hours.days:
                if sessions_scheduled >= sessions_needed:
                    break
                
                if day not in available_by_day:
                    continue
                
                # Check if we can add a session on this day
                available_slots = available_by_day[day]
                
                # Calculate how many slots we need for this session
                slots_needed = int((hours_per_session * 60) / slot_duration)
                if slots_needed == 0:
                    slots_needed = 1
                
                # Find consecutive available slots
                for i in range(len(available_slots) - slots_needed + 1):
                    consecutive_slots = available_slots[i:i + slots_needed]
                    
                    # Slots are already filtered to exclude lunch/prep/blocked
                    # So we can use them directly
                    slot_start_mins = consecutive_slots[0][0]
                    slot_end_mins = consecutive_slots[-1][1]
                    
                    # Double-check: ensure no overlap with lunch (shouldn't happen, but safety check)
                    lunch_start_mins = lunch_mins
                    lunch_end_mins = lunch_mins + 60
                    
                    overlaps_lunch = not (slot_end_mins <= lunch_start_mins or slot_start_mins >= lunch_end_mins)
                    
                    if not overlaps_lunch:
                        # Create session
                        schedule.append(TimeSlot(
                            day=day,
                            start=minutes_to_time(slot_start_mins),
                            end=minutes_to_time(slot_end_mins),
                            student=student_name,
                            subject=subject.name,
                            type="session"
                        ))
                        
                        # Update tracking
                        scheduled_hours[student_name][subject.name] += hours_per_session
                        daily_hours[student_name][day] += hours_per_session
                        sessions_scheduled += 1
                        
                        # Remove used slots
                        available_slots = available_slots[i + slots_needed:]
                        available_by_day[day] = available_slots
                        break
    
    # Schedule flexible prep time (1 hour per day if required)
    if request.prep_time_required:
        for day in request.working_hours.days:
            # Recalculate available slots for this day (excluding scheduled sessions and lunch)
            # Get all scheduled session times for this day
            scheduled_sessions = [
                (time_to_minutes(s.start), time_to_minutes(s.end))
                for s in schedule
                if s.day == day and s.type == "session"
            ]
            
            # Combine with lunch and student blocked times
            all_blocked = blocked_by_day[day].copy()
            all_blocked.extend(scheduled_sessions)
            all_blocked.sort(key=lambda x: x[0])
            
            # Generate available slots
            day_available = generate_available_slots(
                day,
                request.working_hours.start_time,
                request.working_hours.end_time,
                all_blocked,
                slot_duration
            )
            
            # Try to find a 1-hour slot (2 consecutive 30-minute slots)
            prep_scheduled = False
            for i in range(len(day_available) - 1):
                slot1 = day_available[i]
                slot2 = day_available[i + 1]
                
                # Check if slots are consecutive and total 1 hour
                if slot1[1] == slot2[0] and (slot2[1] - slot1[0]) >= 60:
                    # Found 1-hour slot
                    prep_start = slot1[0]
                    prep_end = slot1[0] + 60
                    
                    schedule.append(TimeSlot(
                        day=day,
                        start=minutes_to_time(prep_start),
                        end=minutes_to_time(prep_end),
                        type="prep"
                    ))
                    prep_scheduled = True
                    break
            
            # If no 1-hour slot found, try 2x 30-minute slots
            if not prep_scheduled and len(day_available) >= 2:
                # Take first two available slots if they're at least 30 minutes each
                slot1 = day_available[0]
                slot2 = day_available[1] if len(day_available) > 1 else None
                
                if slot2 and (slot2[1] - slot1[0]) >= 60:
                    # Schedule as two 30-minute prep slots
                    schedule.append(TimeSlot(
                        day=day,
                        start=minutes_to_time(slot1[0]),
                        end=minutes_to_time(slot1[0] + 30),
                        type="prep"
                    ))
                    schedule.append(TimeSlot(
                        day=day,
                        start=minutes_to_time(slot1[0] + 30),
                        end=minutes_to_time(slot1[0] + 60),
                        type="prep"
                    ))
                    prep_scheduled = True
            
            if not prep_scheduled:
                conflicts.append(f"Could not schedule prep time on {day}")
    
    # Check if we met all requirements
    for student_config in request.student_configs:
        student_name = student_config.name
        
        # Check weekly subject hours
        for subject in student_config.subjects:
            scheduled = scheduled_hours[student_name][subject.name]
            needed = subject.hours_per_week
            if scheduled < needed - 0.1:  # Allow small floating point errors
                conflicts.append(
                    f"{student_name} - {subject.name}: "
                    f"Scheduled {scheduled:.1f}h, needed {needed:.1f}h"
                )
        
        # Check weekly total hours
        total_scheduled = sum(scheduled_hours[student_name].values())
        if total_scheduled < student_config.weekly_total_hours - 0.1:
            conflicts.append(
                f"{student_name} total hours: "
                f"Scheduled {total_scheduled:.1f}h, needed {student_config.weekly_total_hours:.1f}h"
            )
        
        # Check daily minimum hours
        for day in request.working_hours.days:
            daily = daily_hours[student_name].get(day, 0.0)
            if daily < student_config.daily_minimum_hours - 0.1:
                conflicts.append(
                    f"{student_name} on {day}: "
                    f"Scheduled {daily:.1f}h, minimum {student_config.daily_minimum_hours:.1f}h"
                )
    
    # Sort schedule by day and time
    day_order = {day: i for i, day in enumerate(request.working_hours.days)}
    schedule.sort(key=lambda s: (
        day_order.get(s.day, 999),
        time_to_minutes(s.start)
    ))
    
    success = len(conflicts) == 0
    
    return ScheduleResponse(
        schedule=schedule,
        success=success,
        message="Schedule generated successfully" if success else "Schedule generated with conflicts",
        conflicts=conflicts if conflicts else None
    )

