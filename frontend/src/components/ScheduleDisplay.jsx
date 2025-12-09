import React, { useState } from 'react';

const ScheduleDisplay = ({ scheduleData, workingDays = [], studentColors = {}, studentSchedules = {}, config = null, onScheduleUpdate }) => {
  const [exportFormat, setExportFormat] = useState('json');
  const [editingSlot, setEditingSlot] = useState(null);
  const [editForm, setEditForm] = useState({
    day: '',
    start: '',
    end: '',
    student: '',
    subject: '',
    originalIndex: -1
  });
  const [validationErrors, setValidationErrors] = useState([]);

  if (!scheduleData || !scheduleData.schedule) {
    return (
      <div className="schedule-display">
        <p>No schedule generated yet. Configure students and generate a schedule.</p>
      </div>
    );
  }

  const { schedule, success, message, conflicts } = scheduleData;

  // Group schedule by day
  const scheduleByDay = {};
  workingDays.forEach(day => {
    scheduleByDay[day] = [];
  });

  schedule.forEach(slot => {
    // Filter out blocked times from display
    if (slot.type === 'blocked') {
      return;
    }
    if (!scheduleByDay[slot.day]) {
      scheduleByDay[slot.day] = [];
    }
    scheduleByDay[slot.day].push(slot);
  });

  // Sort slots by time within each day
  Object.keys(scheduleByDay).forEach(day => {
    scheduleByDay[day].sort((a, b) => {
      const timeA = a.start.split(':').map(Number);
      const timeB = b.start.split(':').map(Number);
      return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
    });
  });

  const getSlotColor = (slot) => {
    switch (slot.type) {
      case 'lunch':
        return '#ffd700';
      case 'prep':
        return '#90ee90';
      case 'blocked':
        return '#ffcccc';
      case 'session':
        // For multi-student sessions, use the first student's color
        // For single-student sessions, use that student's color
        const studentName = slot.students && slot.students.length > 0 
          ? slot.students[0] 
          : slot.student;
        return studentName && studentColors[studentName] 
          ? studentColors[studentName] 
          : '#87ceeb'; // Default color
      default:
        return '#f0f0f0';
    }
  };

  // Convert 24-hour time to 12-hour format
  const to12Hour = (time24) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatTime = (timeStr) => {
    return to12Hour(timeStr);
  };

  // Convert 12-hour time to 24-hour format
  const to24Hour = (time12) => {
    const [time, period] = time12.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours);
    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    return `${hour24.toString().padStart(2, '0')}:${minutes}`;
  };

  // Convert time string to minutes since midnight
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check if two time ranges overlap
  const timeRangesOverlap = (start1, end1, start2, end2) => {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return !(e1 <= s2 || s1 >= e2);
  };

  // Validate edit: check conflicts and blocked hours
  const validateEdit = (day, start, end, student, originalIndex) => {
    const errors = [];
    const schedule = scheduleData.schedule;

    // Check for conflicts with other scheduled times (excluding the slot being edited)
    for (let i = 0; i < schedule.length; i++) {
      if (i === originalIndex) continue; // Skip the slot being edited
      
      const slot = schedule[i];
      if (slot.type === 'blocked' || slot.type === 'lunch' || slot.type === 'prep') {
        continue; // Only check conflicts with session slots
      }

      if (slot.day === day && slot.type === 'session') {
        const slotStudents = slot.students || (slot.student ? [slot.student] : []);
        
        // Check if any student in the slot being edited conflicts with this slot
        if (slotStudents.includes(student)) {
          if (timeRangesOverlap(start, end, slot.start, slot.end)) {
            errors.push(`Time conflicts with existing session: ${to12Hour(slot.start)} - ${to12Hour(slot.end)} (${slotStudents.join(', ')})`);
          }
        }
      }
    }

    // Check if time is during student's blocked hours
    if (student && studentSchedules[student]) {
      const studentSchedule = studentSchedules[student];
      const blockedTimes = studentSchedule.blocked_times || [];
      
      for (const blockedTime of blockedTimes) {
        if (blockedTime.day.toLowerCase() === day.toLowerCase()) {
          if (timeRangesOverlap(start, end, blockedTime.start, blockedTime.end)) {
            errors.push(`Time conflicts with ${student}'s blocked hours: ${to12Hour(blockedTime.start)} - ${to12Hour(blockedTime.end)}${blockedTime.label ? ` (${blockedTime.label})` : ''}`);
          }
        }
      }
    }

    return errors;
  };

  // Handle click on time slot
  const handleSlotClick = (slot, index) => {
    if (slot.type !== 'session') return; // Only allow editing session slots
    
    const students = slot.students || (slot.student ? [slot.student] : []);
    const student = students.length > 0 ? students[0] : '';
    
    setEditForm({
      day: slot.day,
      start: slot.start,
      end: slot.end,
      student: student,
      subject: slot.subject || '',
      originalIndex: index
    });
    setEditingSlot(slot);
    setValidationErrors([]);
  };

  // Handle form input changes
  const handleFormChange = (field, value) => {
    const updatedForm = {
      ...editForm,
      [field]: value
    };
    setEditForm(updatedForm);
    
    // Validate in real-time if all required fields are filled
    if (updatedForm.day && updatedForm.start && updatedForm.end && updatedForm.student) {
      const errors = validateEdit(
        updatedForm.day,
        updatedForm.start,
        updatedForm.end,
        updatedForm.student,
        updatedForm.originalIndex
      );
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  };

  // Handle save edit
  const handleSaveEdit = () => {
    // Validate
    const errors = validateEdit(
      editForm.day,
      editForm.start,
      editForm.end,
      editForm.student,
      editForm.originalIndex
    );

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Update the schedule
    const updatedSchedule = [...scheduleData.schedule];
    const slotToUpdate = updatedSchedule[editForm.originalIndex];
    
    // Update the slot
    updatedSchedule[editForm.originalIndex] = {
      ...slotToUpdate,
      day: editForm.day,
      start: editForm.start,
      end: editForm.end,
      student: editForm.student,
      students: [editForm.student],
      subject: editForm.subject
    };

    // Update schedule data
    const updatedScheduleData = {
      ...scheduleData,
      schedule: updatedSchedule
    };

    // Notify parent component
    if (onScheduleUpdate) {
      onScheduleUpdate(updatedScheduleData);
    }

    // Close modal
    setEditingSlot(null);
    setValidationErrors([]);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingSlot(null);
    setEditForm({
      day: '',
      start: '',
      end: '',
      student: '',
      subject: '',
      originalIndex: -1
    });
    setValidationErrors([]);
  };

  // Get all student names for dropdown
  const getAllStudentNames = () => {
    const names = new Set();
    if (config && config.students) {
      config.students.forEach(s => {
        if (s.name) names.add(s.name);
      });
    }
    return Array.from(names).sort();
  };

  // Get all subject names for dropdown
  const getAllSubjectNames = () => {
    const subjects = new Set();
    if (config && config.students) {
      config.students.forEach(student => {
        if (student.subjects) {
          student.subjects.forEach(subj => {
            if (subj.name) subjects.add(subj.name);
          });
        }
      });
    }
    return Array.from(subjects).sort();
  };

  const exportSchedule = () => {
    let content = '';
    let filename = 'schedule';

    if (exportFormat === 'json') {
      content = JSON.stringify(scheduleData, null, 2);
      filename += '.json';
    } else if (exportFormat === 'csv') {
      // CSV format: Day, Start, End, Type, Student(s), Subject, Label
      const rows = ['Day,Start,End,Type,Student(s),Subject,Label'];
      schedule.forEach(slot => {
        // Filter out blocked times from CSV export
        if (slot.type === 'blocked') {
          return;
        }
        const students = slot.students && slot.students.length > 0
          ? slot.students.join('; ')
          : (slot.student || '');
        rows.push(
          `${slot.day},${to12Hour(slot.start)},${to12Hour(slot.end)},${slot.type},"${students}",${slot.subject || ''},${slot.label || ''}`
        );
      });
      content = rows.join('\n');
      filename += '.csv';
    } else {
      // Text format
      const lines = [];
      workingDays.forEach(day => {
        lines.push(`\n${day}:`);
        lines.push('─'.repeat(50));
        scheduleByDay[day]?.forEach(slot => {
          // Filter out blocked times from text export
          if (slot.type === 'blocked') {
            return;
          }
          if (slot.type === 'session') {
            const students = slot.students && slot.students.length > 0
              ? slot.students.join(', ')
              : slot.student;
            lines.push(`  ${to12Hour(slot.start)} - ${to12Hour(slot.end)}: ${students} - ${slot.subject}`);
          } else if (slot.type === 'lunch') {
            lines.push(`  ${to12Hour(slot.start)} - ${to12Hour(slot.end)}: LUNCH`);
          } else if (slot.type === 'prep') {
            lines.push(`  ${to12Hour(slot.start)} - ${to12Hour(slot.end)}: PREP TIME`);
          }
        });
      });
      content = lines.join('\n');
      filename += '.txt';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="schedule-display">
      <div className="schedule-header">
        <h2>Generated Schedule</h2>
        <div className="status-indicator">
          <span className={success ? 'status success' : 'status warning'}>
            {success ? '✓' : '⚠'} {message}
          </span>
        </div>
      </div>

      {conflicts && conflicts.length > 0 && (
        <div className="conflicts">
          <h3>Conflicts / Unmet Requirements:</h3>
          <ul>
            {conflicts.map((conflict, index) => (
              <li key={index} className="conflict-item">{conflict}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="schedule-calendar">
        {workingDays.map(day => (
          <div key={day} className="day-column">
            <h3>{day}</h3>
            <div className="time-slots">
              {scheduleByDay[day]?.map((slot, index) => {
                // Find the original index in the full schedule array
                // Use a more robust matching that handles both single and multi-student slots
                const originalIndex = schedule.findIndex(s => {
                  if (s.day !== slot.day || s.start !== slot.start || s.end !== slot.end || s.type !== slot.type) {
                    return false;
                  }
                  if (slot.type === 'session') {
                    // Match by subject and students
                    const slotStudents = slot.students || (slot.student ? [slot.student] : []);
                    const sStudents = s.students || (s.student ? [s.student] : []);
                    return s.subject === slot.subject && 
                           JSON.stringify(slotStudents.sort()) === JSON.stringify(sStudents.sort());
                  }
                  return true;
                });
                
                return (
                  <div
                    key={`${day}-${index}-${slot.start}-${slot.end}`}
                    className={`time-slot ${slot.type === 'session' ? 'editable-slot' : ''}`}
                    style={{ backgroundColor: getSlotColor(slot) }}
                    title={`${to12Hour(slot.start)} - ${to12Hour(slot.end)}: ${slot.type === 'session' ? `${slot.students ? slot.students.join(', ') : slot.student} - ${slot.subject}` : slot.type.toUpperCase()}${slot.type === 'session' ? ' (Click to edit)' : ''}`}
                    onClick={() => slot.type === 'session' && originalIndex >= 0 && handleSlotClick(slot, originalIndex)}
                  >
                    <div className="slot-time">{formatTime(slot.start)} - {formatTime(slot.end)}</div>
                    {slot.type === 'session' && (
                      <>
                        <div className="slot-student">
                          {slot.students && slot.students.length > 0
                            ? slot.students.join(', ')
                            : slot.student}
                        </div>
                        <div className="slot-subject">{slot.subject}</div>
                      </>
                    )}
                    {slot.type === 'lunch' && <div className="slot-label">LUNCH</div>}
                    {slot.type === 'prep' && <div className="slot-label">PREP</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="export-section">
        <h3>Export Schedule</h3>
        <div className="export-controls">
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="text">Text</option>
          </select>
          <button onClick={exportSchedule}>Export</button>
        </div>
      </div>

      <div className="legend">
        <h3>Legend</h3>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#87ceeb' }}></div>
            <span>Session (Click to edit)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ffd700' }}></div>
            <span>Lunch</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#90ee90' }}></div>
            <span>Prep Time</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingSlot && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Schedule Slot</h2>
              <button className="modal-close" onClick={handleCancelEdit}>×</button>
            </div>
            <div className="modal-body">
              <div className="edit-form">
                {validationErrors.length > 0 && (
                  <div className="validation-errors">
                    <h4>⚠️ Validation Warnings:</h4>
                    <ul>
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="form-row-two-columns">
                  <div className="form-group">
                    <label>Student</label>
                    <select
                      value={editForm.student}
                      onChange={(e) => handleFormChange('student', e.target.value)}
                    >
                      <option value="">Select student</option>
                      {getAllStudentNames().map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Subject</label>
                    <select
                      value={editForm.subject}
                      onChange={(e) => handleFormChange('subject', e.target.value)}
                    >
                      <option value="">Select subject</option>
                      {getAllSubjectNames().map(subj => (
                        <option key={subj} value={subj}>{subj}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={editForm.start}
                    onChange={(e) => handleFormChange('start', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={editForm.end}
                    onChange={(e) => handleFormChange('end', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Day</label>
                  <select
                    value={editForm.day}
                    onChange={(e) => handleFormChange('day', e.target.value)}
                  >
                    {workingDays.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-button" onClick={handleCancelEdit}>Cancel</button>
              <button className="save-button" onClick={handleSaveEdit}>
                {validationErrors.length > 0 ? 'Save Anyway' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleDisplay;

