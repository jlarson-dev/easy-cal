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


def can_students_overlap(student1: str, student2: str, student_schedules: Dict[str, StudentSchedule]) -> bool:
    """Check if two students can overlap (bidirectional check)"""
    if student1 not in student_schedules or student2 not in student_schedules:
        return False
    
    schedule1 = student_schedules[student1]
    schedule2 = student_schedules[student2]
    
    # Check bidirectional: student1 must have student2 in can_overlap, and vice versa
    can_overlap_1 = schedule1.can_overlap or []
    can_overlap_2 = schedule2.can_overlap or []
    
    return student2 in can_overlap_1 and student1 in can_overlap_2


def check_all_can_overlap(student_names: List[str], student_schedules: Dict[str, StudentSchedule]) -> bool:
    """Check if all students in a list can overlap with each other (all pairs must be valid)"""
    if len(student_names) < 2:
        return True  # Single student or empty list
    
    # Check all pairs
    for i in range(len(student_names)):
        for j in range(i + 1, len(student_names)):
            if not can_students_overlap(student_names[i], student_names[j], student_schedules):
                return False
    
    return True


def are_students_blocked_at_time(
    student_names: List[str],
    day: str,
    slot_start_mins: int,
    slot_end_mins: int,
    student_schedules: Dict[str, StudentSchedule]
) -> bool:
    """Check if any of the students are blocked at the given time slot"""
    for student_name in student_names:
        if student_name not in student_schedules:
            continue
        
        schedule = student_schedules[student_name]
        for blocked_time in schedule.blocked_times:
            if blocked_time.day.lower() == day.lower():
                blocked_start = time_to_minutes(blocked_time.start)
                blocked_end = time_to_minutes(blocked_time.end)
                
                # Check if time slot overlaps with blocked time
                if not (slot_end_mins <= blocked_start or slot_start_mins >= blocked_end):
                    return True  # At least one student is blocked
    
    return False  # No students are blocked


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
    
    # Track scheduled minutes per student per subject per day
    scheduled_minutes_by_day: Dict[str, Dict[str, Dict[str, int]]] = {}  # student -> subject -> day -> minutes
    scheduled_weekly_minutes: Dict[str, Dict[str, int]] = {}  # student -> subject -> total weekly minutes
    scheduled_weekly_sessions: Dict[str, Dict[str, int]] = {}  # student -> subject -> number of sessions
    # Track which subjects have been scheduled per student per day (for weekly constraints - prevent same subject twice per day)
    weekly_subjects_by_day: Dict[str, Dict[str, set]] = {}  # student -> day -> set of subject names
    
    for config in request.student_configs:
        scheduled_minutes_by_day[config.name] = {subj.name: {} for subj in config.subjects}
        scheduled_weekly_minutes[config.name] = {subj.name: 0 for subj in config.subjects}
        scheduled_weekly_sessions[config.name] = {subj.name: 0 for subj in config.subjects}
        weekly_subjects_by_day[config.name] = {}
    
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
        
        # Initialize daily minutes tracking for each subject
        for student_name in scheduled_minutes_by_day.keys():
            for subject_name in scheduled_minutes_by_day[student_name].keys():
                scheduled_minutes_by_day[student_name][subject_name][day] = 0
            # Initialize weekly subjects tracking for this day
            if day not in weekly_subjects_by_day[student_name]:
                weekly_subjects_by_day[student_name][day] = set()
    
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
    
    # Sort students by priority (more subjects = higher priority, or by total minutes needed)
    def get_student_priority(student_config):
        total_minutes = 0
        for subject in student_config.subjects:
            if subject.constraint_type == "daily" and subject.daily_minutes:
                total_minutes += subject.daily_minutes * len(request.working_hours.days)
            if subject.constraint_type == "weekly":
                if subject.weekly_days and subject.weekly_minutes_per_session:
                    total_minutes += subject.weekly_days * subject.weekly_minutes_per_session
        return total_minutes
    
    student_priority = sorted(
        request.student_configs,
        key=get_student_priority,
        reverse=True
    )
    
    # Schedule subjects: prioritize daily constraints first, then weekly
    # Strategy: For each subject/day combination, try to find the largest possible group first
    
    # First pass: Schedule daily constraints - prioritize multi-student groups
    for day in request.working_hours.days:
        if day not in available_by_day:
            continue
        
        # Group students by subject for this day
        subject_groups: Dict[str, List[str]] = {}  # subject_name -> [list of student names needing it]
        
        for student_config in request.student_configs:
            student_name = student_config.name
            for subject in student_config.subjects:
                if subject.constraint_type == "daily" and subject.daily_minutes:
                    scheduled_today = scheduled_minutes_by_day[student_name][subject.name].get(day, 0)
                    if scheduled_today < subject.daily_minutes:
                        if subject.name not in subject_groups:
                            subject_groups[subject.name] = []
                        subject_groups[subject.name].append(student_name)
        
        # For each subject, try to schedule groups (prioritize largest groups)
        for subject_name, students_needing in subject_groups.items():
            if not students_needing:
                continue
            
            # Continue scheduling until all students needing this subject are scheduled
            while True:
                # Filter to students who still need this subject today
                remaining_students = []
                for student_name in students_needing:
                    scheduled_today = scheduled_minutes_by_day[student_name][subject_name].get(day, 0)
                    student_needs = next((subj.daily_minutes for subj in student_config_dict[student_name].subjects 
                                         if subj.name == subject_name and subj.constraint_type == "daily"), 0)
                    if scheduled_today < student_needs:
                        remaining_students.append(student_name)
                
                if not remaining_students:
                    break  # All students for this subject are scheduled
                
                # Find max minutes needed for remaining students
                max_minutes = 0
                for student_name in remaining_students:
                    for subj in student_config_dict[student_name].subjects:
                        if subj.name == subject_name and subj.constraint_type == "daily":
                            max_minutes = max(max_minutes, subj.daily_minutes)
                            break
                
                available_slots = available_by_day[day]
                if not available_slots:
                    break  # No more available slots
                
                slots_needed = int((max_minutes + slot_duration - 1) / slot_duration)
                if slots_needed == 0:
                    slots_needed = 1
                
                # Try all time slots to find the best group (prioritize larger groups)
                best_group = None
                best_slot_index = None
                best_slot_info = None
                
                for i in range(len(available_slots) - slots_needed + 1):
                    consecutive_slots = available_slots[i:i + slots_needed]
                    slot_start_mins = consecutive_slots[0][0]
                    slot_end_mins = consecutive_slots[-1][1]
                    actual_minutes = slot_end_mins - slot_start_mins
                    
                    if actual_minutes < max_minutes:
                        continue
                    
                    # Check lunch overlap
                    lunch_start_mins = lunch_mins
                    lunch_end_mins = lunch_mins + 60
                    overlaps_lunch = not (slot_end_mins <= lunch_start_mins or slot_start_mins >= lunch_end_mins)
                    if overlaps_lunch:
                        continue
                    
                    # Find the largest group of students who can be scheduled together at this time
                    potential_group = []
                    for student_name in remaining_students:
                        # Check if student is blocked at this time
                        if are_students_blocked_at_time([student_name], day, slot_start_mins, slot_end_mins, request.students):
                            continue
                        
                        # Check if this student can overlap with all students in the potential group
                        if check_all_can_overlap(potential_group + [student_name], request.students):
                            potential_group.append(student_name)
                    
                    # Keep track of the best group (largest group size)
                    if potential_group and (best_group is None or len(potential_group) > len(best_group)):
                        best_group = potential_group
                        best_slot_index = i
                        best_slot_info = (slot_start_mins, slot_end_mins, actual_minutes)
                
                # Schedule the best group found
                if best_group and best_slot_info:
                    slot_start_mins, slot_end_mins, actual_minutes = best_slot_info
                    
                    if len(best_group) > 1:
                        # Multi-student session (prioritized)
                        schedule.append(TimeSlot(
                            day=day,
                            start=minutes_to_time(slot_start_mins),
                            end=minutes_to_time(slot_end_mins),
                            students=best_group,
                            subject=subject_name,
                            type="session"
                        ))
                    else:
                        # Single-student session (fallback)
                        schedule.append(TimeSlot(
                            day=day,
                            start=minutes_to_time(slot_start_mins),
                            end=minutes_to_time(slot_end_mins),
                            student=best_group[0],
                            subject=subject_name,
                            type="session"
                        ))
                    
                    # Update tracking for all students in the group
                    for student in best_group:
                        scheduled_minutes_by_day[student][subject_name][day] = actual_minutes
                        scheduled_weekly_minutes[student][subject_name] += actual_minutes
                        scheduled_weekly_sessions[student][subject_name] += 1
                    
                    # Remove used slots
                    slots_used = int((actual_minutes + slot_duration - 1) / slot_duration)
                    available_slots = available_slots[best_slot_index + slots_used:]
                    available_by_day[day] = available_slots
                else:
                    # No valid slot found for remaining students, move to next subject
                    break
    
    # Second pass: Schedule weekly constraints - prioritize multi-student groups
    for day in request.working_hours.days:
        if day not in available_by_day:
            continue
        
        # Group students by subject for this day (weekly constraints)
        subject_groups: Dict[str, List[str]] = {}  # subject_name -> [list of student names needing it]
        
        for student_config in request.student_configs:
            student_name = student_config.name
            for subject in student_config.subjects:
                if subject.constraint_type == "weekly" and subject.weekly_days and subject.weekly_minutes_per_session:
                    current_sessions = scheduled_weekly_sessions[student_name][subject.name]
                    if current_sessions < subject.weekly_days:
                        if subject.name not in subject_groups:
                            subject_groups[subject.name] = []
                        subject_groups[subject.name].append(student_name)
        
        # For each subject, try to schedule groups (prioritize largest groups)
        for subject_name, students_needing in subject_groups.items():
            if not students_needing:
                continue
            
            # Continue scheduling until all students needing this subject are scheduled
            while True:
                # Filter to students who still need this subject (weekly constraint)
                # AND who haven't already been scheduled for this subject on this day
                remaining_students = []
                for student_name in students_needing:
                    current_sessions = scheduled_weekly_sessions[student_name][subject_name]
                    sessions_needed = next((subj.weekly_days for subj in student_config_dict[student_name].subjects 
                                          if subj.name == subject_name and subj.constraint_type == "weekly"), 0)
                    # Check if student still needs sessions AND hasn't been scheduled for this subject on this day
                    already_scheduled_today = subject_name in weekly_subjects_by_day[student_name].get(day, set())
                    if current_sessions < sessions_needed and not already_scheduled_today:
                        remaining_students.append(student_name)
                
                if not remaining_students:
                    break  # All students for this subject are scheduled
                
                # Find max minutes per session for remaining students
                max_minutes = 0
                for student_name in remaining_students:
                    for subj in student_config_dict[student_name].subjects:
                        if subj.name == subject_name and subj.constraint_type == "weekly" and subj.weekly_minutes_per_session:
                            max_minutes = max(max_minutes, subj.weekly_minutes_per_session)
                            break
                
                available_slots = available_by_day[day]
                if not available_slots:
                    break  # No more available slots
                
                slots_needed = int((max_minutes + slot_duration - 1) / slot_duration)
                if slots_needed == 0:
                    slots_needed = 1
                
                # Try all time slots to find the best group (prioritize larger groups)
                best_group = None
                best_slot_index = None
                best_slot_info = None
                
                for i in range(len(available_slots) - slots_needed + 1):
                    consecutive_slots = available_slots[i:i + slots_needed]
                    slot_start_mins = consecutive_slots[0][0]
                    slot_end_mins = consecutive_slots[-1][1]
                    actual_minutes = slot_end_mins - slot_start_mins
                    
                    if actual_minutes < max_minutes:
                        continue
                    
                    # Check lunch overlap
                    lunch_start_mins = lunch_mins
                    lunch_end_mins = lunch_mins + 60
                    overlaps_lunch = not (slot_end_mins <= lunch_start_mins or slot_start_mins >= lunch_end_mins)
                    if overlaps_lunch:
                        continue
                    
                    # Find the largest group of students who can be scheduled together at this time
                    potential_group = []
                    for student_name in remaining_students:
                        # Check if student is blocked at this time
                        if are_students_blocked_at_time([student_name], day, slot_start_mins, slot_end_mins, request.students):
                            continue
                        
                        # Check if this student can overlap with all students in the potential group
                        if check_all_can_overlap(potential_group + [student_name], request.students):
                            potential_group.append(student_name)
                    
                    # Keep track of the best group (largest group size)
                    if potential_group and (best_group is None or len(potential_group) > len(best_group)):
                        best_group = potential_group
                        best_slot_index = i
                        best_slot_info = (slot_start_mins, slot_end_mins, actual_minutes)
                
                # Schedule the best group found
                if best_group and best_slot_info:
                    slot_start_mins, slot_end_mins, actual_minutes = best_slot_info
                    
                    if len(best_group) > 1:
                        # Multi-student session (prioritized)
                        schedule.append(TimeSlot(
                            day=day,
                            start=minutes_to_time(slot_start_mins),
                            end=minutes_to_time(slot_end_mins),
                            students=best_group,
                            subject=subject_name,
                            type="session"
                        ))
                    else:
                        # Single-student session (fallback)
                        schedule.append(TimeSlot(
                            day=day,
                            start=minutes_to_time(slot_start_mins),
                            end=minutes_to_time(slot_end_mins),
                            student=best_group[0],
                            subject=subject_name,
                            type="session"
                        ))
                    
                    # Update tracking for all students in the group
                    for student in best_group:
                        if day not in scheduled_minutes_by_day[student][subject_name]:
                            scheduled_minutes_by_day[student][subject_name][day] = 0
                        scheduled_minutes_by_day[student][subject_name][day] += actual_minutes
                        scheduled_weekly_minutes[student][subject_name] += actual_minutes
                        scheduled_weekly_sessions[student][subject_name] += 1
                        # Mark that this subject has been scheduled for this student on this day
                        if day not in weekly_subjects_by_day[student]:
                            weekly_subjects_by_day[student][day] = set()
                        weekly_subjects_by_day[student][day].add(subject_name)
                    
                    # Remove used slots
                    slots_used = int((actual_minutes + slot_duration - 1) / slot_duration)
                    available_slots = available_slots[best_slot_index + slots_used:]
                    available_by_day[day] = available_slots
                else:
                    # No valid slot found for remaining students, move to next subject
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
        
        for subject in student_config.subjects:
            # Check daily constraints
            if subject.constraint_type == "daily" and subject.daily_minutes:
                for day in request.working_hours.days:
                    scheduled_minutes = scheduled_minutes_by_day[student_name][subject.name].get(day, 0)
                    if scheduled_minutes < subject.daily_minutes:
                        conflicts.append(
                            f"{student_name} - {subject.name} on {day}: "
                            f"Scheduled {scheduled_minutes}min, needed {subject.daily_minutes}min daily"
                        )
            
            # Check weekly constraints
            if subject.constraint_type == "weekly":
                if subject.weekly_days and subject.weekly_minutes_per_session:
                    scheduled_sessions = scheduled_weekly_sessions[student_name][subject.name]
                    scheduled_minutes = scheduled_weekly_minutes[student_name][subject.name]
                    needed_sessions = subject.weekly_days
                    needed_minutes = subject.weekly_days * subject.weekly_minutes_per_session
                    
                    if scheduled_sessions < needed_sessions:
                        conflicts.append(
                            f"{student_name} - {subject.name}: "
                            f"Scheduled {scheduled_sessions} sessions, needed {needed_sessions} sessions per week"
                        )
                    
                    if scheduled_minutes < needed_minutes:
                        conflicts.append(
                            f"{student_name} - {subject.name}: "
                            f"Scheduled {scheduled_minutes}min total, needed {needed_minutes}min per week "
                            f"({needed_sessions} sessions × {subject.weekly_minutes_per_session}min)"
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

