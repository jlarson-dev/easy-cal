"""
Schedule storage utilities for managing student schedule files.
Handles reading/writing schedule files, directory management, and file operations.
"""
import json
import os
from typing import Dict, Optional, List, Tuple
from pathlib import Path
from datetime import datetime

try:
    from .models import StudentSchedule, BlockedTime
except ImportError:
    from models import StudentSchedule, BlockedTime


CONFIG_FILE = "schedule_config.json"


def get_config_path(base_dir: str) -> str:
    """Get path to config file."""
    return os.path.join(base_dir, CONFIG_FILE)


def load_config(base_dir: str) -> Dict:
    """Load configuration from file."""
    config_path = get_config_path(base_dir)
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_config(base_dir: str, config: Dict) -> bool:
    """Save configuration to file."""
    try:
        config_path = get_config_path(base_dir)
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except IOError:
        return False


def get_schedule_directory(base_dir: str) -> Optional[str]:
    """Get the configured schedule directory path."""
    config = load_config(base_dir)
    return config.get("schedule_directory")


def set_schedule_directory(base_dir: str, directory_path: str) -> Tuple[bool, str]:
    """Set the schedule directory path. Returns (success, message)."""
    # Validate directory
    if not os.path.exists(directory_path):
        return False, f"Directory does not exist: {directory_path}"
    
    if not os.path.isdir(directory_path):
        return False, f"Path is not a directory: {directory_path}"
    
    # Check write permissions
    if not os.access(directory_path, os.W_OK):
        return False, f"Directory is not writable: {directory_path}"
    
    # Save to config
    config = load_config(base_dir)
    config["schedule_directory"] = directory_path
    if save_config(base_dir, config):
        return True, "Directory configured successfully"
    else:
        return False, "Failed to save configuration"


def sanitize_filename(name: str) -> str:
    """Sanitize student name for use as filename."""
    # Remove or replace invalid filename characters
    invalid_chars = '<>:"/\\|?*'
    sanitized = name
    for char in invalid_chars:
        sanitized = sanitized.replace(char, '_')
    # Remove leading/trailing spaces and dots
    sanitized = sanitized.strip(' .')
    # Replace spaces with underscores
    sanitized = sanitized.replace(' ', '_')
    return sanitized


def get_student_file_path(directory: str, student_name: str) -> str:
    """Get file path for a student's schedule."""
    filename = f"{sanitize_filename(student_name)}.json"
    return os.path.join(directory, filename)


def list_schedule_files(directory: str) -> List[Dict]:
    """List all schedule JSON files in directory with metadata."""
    if not os.path.exists(directory):
        return []
    
    # Exclude logs directory and config file
    logs_dir_name = LOGS_DIR
    files = []
    for filename in os.listdir(directory):
        # Skip logs directory, config file, and any hidden files/directories
        if filename == logs_dir_name or filename == CONFIG_FILE or filename.startswith('.'):
            continue
            
        if filename.endswith('.json'):
            file_path = os.path.join(directory, filename)
            if os.path.isfile(file_path):
                try:
                    stat = os.stat(file_path)
                    files.append({
                        "filename": filename,
                        "student_name": filename[:-5],  # Remove .json extension
                        "modified_time": stat.st_mtime,
                        "size": stat.st_size
                    })
                except OSError:
                    continue
    
    return files


def load_student_schedule(directory: str, student_name: str) -> Optional[StudentSchedule]:
    """Load a student's schedule from file."""
    file_path = get_student_file_path(directory, student_name)
    
    if not os.path.exists(file_path):
        return None
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle both old format (with student name key) and new format (direct blocked_times)
        if isinstance(data, dict) and "blocked_times" in data:
            blocked_times = [BlockedTime(**bt) for bt in data.get("blocked_times", [])]
            can_overlap = data.get("can_overlap", [])
        elif isinstance(data, dict) and student_name in data:
            # Old format: {"student_name": {"blocked_times": [...]}}
            schedule_data = data[student_name]
            blocked_times = [BlockedTime(**bt) for bt in schedule_data.get("blocked_times", [])]
            can_overlap = schedule_data.get("can_overlap", [])
        else:
            blocked_times = []
            can_overlap = []
        
        return StudentSchedule(blocked_times=blocked_times, can_overlap=can_overlap or [])
    except (json.JSONDecodeError, IOError, KeyError) as e:
        return None


def load_all_schedules(directory: str) -> Dict[str, StudentSchedule]:
    """Load all student schedules from directory."""
    schedules = {}
    files = list_schedule_files(directory)
    
    for file_info in files:
        student_name = file_info["student_name"]
        schedule = load_student_schedule(directory, student_name)
        if schedule:
            schedules[student_name] = schedule
    
    return schedules


def save_student_schedule(directory: str, student_name: str, schedule: StudentSchedule) -> Tuple[bool, str]:
    """Save a student's schedule to file. Returns (success, message)."""
    if not os.path.exists(directory):
        return False, f"Directory does not exist: {directory}"
    
    if not os.access(directory, os.W_OK):
        return False, f"Directory is not writable: {directory}"
    
    file_path = get_student_file_path(directory, student_name)
    
    try:
        # Convert schedule to JSON-serializable format
        data = {
            "blocked_times": [
                {
                    "day": bt.day,
                    "start": bt.start,
                    "end": bt.end,
                    "label": bt.label if bt.label else None
                }
                for bt in schedule.blocked_times
            ],
            "can_overlap": schedule.can_overlap or []
        }
        
        # Write to file atomically (write to temp file, then rename)
        temp_path = file_path + ".tmp"
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        # Atomic rename
        os.replace(temp_path, file_path)
        return True, "Schedule saved successfully"
    except IOError as e:
        return False, f"Failed to save schedule: {str(e)}"
    except Exception as e:
        return False, f"Error saving schedule: {str(e)}"


def delete_student_schedule(directory: str, student_name: str) -> Tuple[bool, str]:
    """Delete a student's schedule file. Returns (success, message)."""
    file_path = get_student_file_path(directory, student_name)
    
    if not os.path.exists(file_path):
        return False, f"Schedule file not found: {student_name}"
    
    try:
        # Load the schedule before deleting (for logging)
        schedule = load_student_schedule(directory, student_name)
        if schedule:
            # Log the deletion
            log_deletion(directory, student_name, schedule)
        
        os.remove(file_path)
        return True, "Schedule deleted successfully"
    except IOError as e:
        return False, f"Failed to delete schedule: {str(e)}"


DELETION_LOG_FILE = "deletion_log.json"
LOGS_DIR = ".logs"


def get_logs_directory(directory: str) -> str:
    """Get path to logs directory."""
    logs_dir = os.path.join(directory, LOGS_DIR)
    os.makedirs(logs_dir, exist_ok=True)
    return logs_dir


def get_deletion_log_path(directory: str) -> str:
    """Get path to deletion log file."""
    logs_dir = get_logs_directory(directory)
    return os.path.join(logs_dir, DELETION_LOG_FILE)


def log_deletion(directory: str, student_name: str, schedule: StudentSchedule):
    """Log a deletion for potential rollback."""
    log_path = get_deletion_log_path(directory)
    
    # Load existing log
    deletions = {}
    if os.path.exists(log_path):
        try:
            with open(log_path, 'r', encoding='utf-8') as f:
                deletions = json.load(f)
        except (json.JSONDecodeError, IOError):
            deletions = {}
    
    # Add deletion entry with timestamp
    from datetime import datetime
    deletions[student_name] = {
        "deleted_at": datetime.now().isoformat(),
        "schedule": {
            "blocked_times": [
                {
                    "day": bt.day,
                    "start": bt.start,
                    "end": bt.end,
                    "label": bt.label if bt.label else None
                }
                for bt in schedule.blocked_times
            ],
            "can_overlap": schedule.can_overlap or []
        }
    }
    
    # Save log
    try:
        with open(log_path, 'w', encoding='utf-8') as f:
            json.dump(deletions, f, indent=2, ensure_ascii=False)
    except IOError:
        pass  # If we can't log, continue anyway


def get_deletion_log(directory: str) -> Dict:
    """Get the deletion log."""
    log_path = get_deletion_log_path(directory)
    
    if not os.path.exists(log_path):
        return {}
    
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def restore_student_schedule(directory: str, student_name: str) -> Tuple[bool, str]:
    """Restore a deleted student schedule from the deletion log."""
    deletions = get_deletion_log(directory)
    
    if student_name not in deletions:
        return False, f"No deletion record found for: {student_name}"
    
    deletion_entry = deletions[student_name]
    schedule_data = deletion_entry.get("schedule", {})
    
    # Create StudentSchedule from logged data
    blocked_times = [BlockedTime(**bt) for bt in schedule_data.get("blocked_times", [])]
    can_overlap = schedule_data.get("can_overlap", [])
    schedule = StudentSchedule(blocked_times=blocked_times, can_overlap=can_overlap or [])
    
    # Save the schedule
    success, message = save_student_schedule(directory, student_name, schedule)
    
    if success:
        # Remove from deletion log
        deletions.pop(student_name, None)
        log_path = get_deletion_log_path(directory)
        try:
            with open(log_path, 'w', encoding='utf-8') as f:
                json.dump(deletions, f, indent=2, ensure_ascii=False)
        except IOError:
            pass  # If we can't update log, continue anyway
    
    return success, message


def permanently_delete_from_log(directory: str, student_name: str) -> Tuple[bool, str]:
    """Permanently remove a student from the deletion log (cannot be restored)."""
    deletions = get_deletion_log(directory)
    
    if student_name not in deletions:
        return False, f"No deletion record found for: {student_name}"
    
    # Remove from deletion log
    deletions.pop(student_name, None)
    log_path = get_deletion_log_path(directory)
    
    try:
        with open(log_path, 'w', encoding='utf-8') as f:
            json.dump(deletions, f, indent=2, ensure_ascii=False)
        return True, "Permanently deleted from log"
    except IOError as e:
        return False, f"Failed to update deletion log: {str(e)}"


def reload_schedules(directory: str, last_known_files: Optional[Dict[str, float]] = None) -> Dict:
    """
    Reload schedules from directory and detect changes.
    Returns dict with:
    - schedules: Dict of all loaded schedules
    - changes: Dict with 'new', 'modified', 'deleted' lists
    - file_metadata: Dict of current file modification times
    """
    current_files = list_schedule_files(directory)
    current_metadata = {f["student_name"]: f["modified_time"] for f in current_files}
    
    changes = {
        "new": [],
        "modified": [],
        "deleted": []
    }
    
    # Detect changes if we have previous state
    if last_known_files:
        current_names = set(current_metadata.keys())
        previous_names = set(last_known_files.keys())
        
        # New files
        changes["new"] = list(current_names - previous_names)
        
        # Deleted files
        changes["deleted"] = list(previous_names - current_names)
        
        # Modified files (check modification time)
        for name in current_names & previous_names:
            if current_metadata[name] != last_known_files[name]:
                changes["modified"].append(name)
    else:
        # If no previous state, all files are considered "new"
        changes["new"] = list(current_metadata.keys())
    
    # Load all schedules
    schedules = load_all_schedules(directory)
    
    return {
        "schedules": schedules,
        "changes": changes,
        "file_metadata": current_metadata
    }

