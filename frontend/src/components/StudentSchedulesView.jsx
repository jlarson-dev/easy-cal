import React, { useState, useEffect, useRef } from 'react';

const StudentSchedulesView = ({ students, studentNames = [], onUpdate }) => {
  const [studentSchedules, setStudentSchedules] = useState({});
  const [expandedStudents, setExpandedStudents] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    day: 'Monday',
    start: '09:00',
    end: '10:00',
    label: '',
    isDaily: false
  });
  const isInitialMount = useRef(true);
  const prevStudentsRef = useRef(null);
  const isUserAction = useRef(false);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Convert 24-hour time to 12-hour format
  const to12Hour = (time24) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Convert 12-hour time to 24-hour format
  const to24Hour = (time12) => {
    if (!time12) return '';
    // Try to match various formats: "9:00 AM", "9:00AM", "09:00 AM", etc.
    const match = time12.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
      // If it's already in 24-hour format, return as-is
      if (time12.match(/^\d{2}:\d{2}$/)) {
        return time12;
      }
      return time12; // Return as-is if format is wrong
    }
    
    let hour = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3].toUpperCase();
    
    if (hour < 1 || hour > 12) return time12; // Invalid hour
    
    if (ampm === 'PM' && hour !== 12) {
      hour += 12;
    } else if (ampm === 'AM' && hour === 12) {
      hour = 0;
    }
    
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  };

  // Handle time input change (time input uses 24-hour internally)
  const handleTimeChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  // Helper to create a stable key for comparing students objects
  const getStudentsKey = (studentsObj, names) => {
    if (!studentsObj) return JSON.stringify(names.sort());
    const keys = Object.keys(studentsObj).sort();
    const schedules = keys.map(k => {
      const times = (studentsObj[k]?.blocked_times || []).map(bt => 
        `${bt.day}-${bt.start}-${bt.end}-${bt.label || ''}`
      ).sort();
      return `${k}:${times.join('|')}`;
    });
    return `${keys.join(',')}:${schedules.join(';')}:${names.sort().join(',')}`;
  };

  // Initialize student schedules from props (only when props actually change)
  useEffect(() => {
    // Don't update if this is a user action (we'll handle that separately)
    if (isUserAction.current) {
      isUserAction.current = false;
      return;
    }
    
    const currentKey = getStudentsKey(students, studentNames);
    const prevKey = prevStudentsRef.current;
    
    // Only update if the key actually changed
    if (currentKey !== prevKey) {
      const schedules = {};
      
      // Add students from the students prop (uploaded/managed)
      if (students) {
        Object.keys(students).forEach(studentName => {
          schedules[studentName] = students[studentName].blocked_times || [];
        });
      }
      
      // Add students from studentNames prop (from config) that don't have schedules yet
      studentNames.forEach(studentName => {
        if (!schedules[studentName]) {
          schedules[studentName] = [];
        }
      });
      
      setStudentSchedules(schedules);
      prevStudentsRef.current = currentKey;
    }
  }, [students, studentNames]);

  // Notify parent when schedules change due to user actions
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Only notify if this was a user action
    if (isUserAction.current && onUpdate) {
      onUpdate(studentSchedules);
      isUserAction.current = false;
    }
  }, [studentSchedules, onUpdate]);

  const toggleStudent = (studentName) => {
    setExpandedStudents({
      ...expandedStudents,
      [studentName]: !expandedStudents[studentName]
    });
  };

  const handleAddBlockedTime = (studentName) => {
    if (formData.start >= formData.end) {
      alert('End time must be after start time');
      return;
    }

    isUserAction.current = true;
    setStudentSchedules(prevSchedules => {
      const currentTimes = prevSchedules[studentName] || [];
      
        if (editingIndex !== null && editingStudent === studentName) {
          // Update existing - if daily, update all instances
          if (formData.isDaily) {
            const updated = currentTimes.filter(bt => 
              !(weekdays.includes(bt.day) && bt.start === formData.start && bt.end === formData.end)
            );
            weekdays.forEach(day => {
              updated.push({
                day,
                start: formData.start,
                end: formData.end,
                label: formData.label.trim() || null
              });
            });
            return {
              ...prevSchedules,
              [studentName]: updated
            };
          } else {
            // Update single day
            const updated = [...currentTimes];
            updated[editingIndex] = {
              day: formData.day,
              start: formData.start,
              end: formData.end,
              label: formData.label.trim() || null
            };
            return {
              ...prevSchedules,
              [studentName]: updated
            };
          }
        } else {
          // Add new
          if (formData.isDaily) {
            // Add to all weekdays
            const newTimes = weekdays.map(day => ({
              day,
              start: formData.start,
              end: formData.end,
              label: formData.label.trim() || null
            }));
            return {
              ...prevSchedules,
              [studentName]: [...currentTimes, ...newTimes]
            };
          } else {
            // Add to single day
            const newBlockedTime = {
              day: formData.day,
              start: formData.start,
              end: formData.end,
              label: formData.label.trim() || null
            };
            return {
              ...prevSchedules,
              [studentName]: [...currentTimes, newBlockedTime]
            };
          }
        }
    });

    setEditingIndex(null);
    setEditingStudent(null);

    // Reset form
    setFormData({
      day: 'Monday',
      start: '09:00',
      end: '10:00',
      label: '',
      isDaily: false
    });
  };

  const handleEdit = (studentName, index) => {
    const blockedTime = studentSchedules[studentName][index];
    setFormData({
      day: blockedTime.day,
      start: blockedTime.start,
      end: blockedTime.end,
      label: blockedTime.label || '',
      isDaily: false // Don't auto-detect daily, let user decide
    });
    setEditingIndex(index);
    setEditingStudent(studentName);
    // Expand the student if not already expanded
    if (!expandedStudents[studentName]) {
      setExpandedStudents({
        ...expandedStudents,
        [studentName]: true
      });
    }
  };

  const handleDelete = (studentName, index) => {
    isUserAction.current = true;
    setStudentSchedules(prevSchedules => {
      const updated = (prevSchedules[studentName] || []).filter((_, i) => i !== index);
      return {
        ...prevSchedules,
        [studentName]: updated
      };
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingStudent(null);
    setFormData({
      day: 'Monday',
      start: '09:00',
      end: '10:00',
      label: '',
      isDaily: false
    });
  };

  const handleAddLabel = (studentName, index) => {
    setStudentSchedules(prevSchedules => {
      const blockedTime = prevSchedules[studentName]?.[index];
      if (!blockedTime) return prevSchedules;
      
      const label = prompt('Enter label for this blocked time:', blockedTime.label || '');
      if (label === null) return prevSchedules;
      
      isUserAction.current = true;
      const updated = [...(prevSchedules[studentName] || [])];
      updated[index] = {
        ...blockedTime,
        label: label.trim() || null
      };
      return {
        ...prevSchedules,
        [studentName]: updated
      };
    });
  };

  // Group blocked times by day for display
  const groupByDay = (blockedTimes) => {
    const grouped = {};
    daysOfWeek.forEach(day => {
      grouped[day] = blockedTimes.filter(bt => bt.day === day);
    });
    return grouped;
  };

  const allStudentNames = Object.keys(studentSchedules).sort();

  if (allStudentNames.length === 0) {
    return (
      <div className="schedules-view-section">
        <h2>Student Schedules</h2>
        <p className="empty-message">No students added yet. Add students in the Subject Configuration section below.</p>
      </div>
    );
  }

  return (
    <div className="schedules-view-section">
      <h2>Student Schedules</h2>
      <p className="section-description">View and manage blocked times for each student. Add labels to identify why times are blocked.</p>
      
      {allStudentNames.map(studentName => {
        const blockedTimes = studentSchedules[studentName] || [];
        const grouped = groupByDay(blockedTimes);
        const isExpanded = expandedStudents[studentName];
        const isEditing = editingIndex !== null && editingStudent === studentName;

        return (
          <div key={studentName} className="student-schedule-card">
            <div className="student-schedule-header" onClick={() => toggleStudent(studentName)}>
              <h3>{studentName}</h3>
              <div className="student-schedule-stats">
                <span>{blockedTimes.length} blocked time{blockedTimes.length !== 1 ? 's' : ''}</span>
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="student-schedule-content">
                {/* Add/Edit Form */}
                <div className="blocked-time-form-section">
                  <h4>{isEditing ? 'Edit' : 'Add'} Blocked Time</h4>
                  <div className="blocked-time-form-inline">
                    <label>
                      {formData.isDaily ? 'Days: Monday-Friday' : 'Day:'}
                      <select
                        value={formData.day}
                        onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                        disabled={formData.isDaily}
                      >
                        {daysOfWeek.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Start:
                      <input
                        type="time"
                        value={formData.start}
                        onChange={(e) => handleTimeChange('start', e.target.value)}
                      />
                    </label>
                    <label>
                      End:
                      <input
                        type="time"
                        value={formData.end}
                        onChange={(e) => handleTimeChange('end', e.target.value)}
                      />
                    </label>
                    <label>
                      Label:
                      <input
                        type="text"
                        placeholder="e.g., Class, Appointment"
                        value={formData.label}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      />
                    </label>
                    <label className="checkbox-label-inline">
                      <input
                        type="checkbox"
                        checked={formData.isDaily}
                        onChange={(e) => setFormData({ ...formData, isDaily: e.target.checked })}
                      />
                      Apply to all weekdays (M-F)
                    </label>
                    <div className="form-actions-inline">
                      <button
                        onClick={() => handleAddBlockedTime(studentName)}
                        className="add-button small"
                      >
                        {isEditing ? 'Update' : 'Add'}
                      </button>
                      {isEditing && (
                        <button onClick={handleCancelEdit} className="cancel-button small">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Blocked Times List */}
                {blockedTimes.length === 0 ? (
                  <p className="empty-message">No blocked times added yet.</p>
                ) : (
                  <div className="blocked-times-list-view">
                    {daysOfWeek.map(day => {
                      const dayTimes = grouped[day];
                      if (dayTimes.length === 0) return null;

                      return (
                        <div key={day} className="day-blocked-times">
                          <h5>{day}</h5>
                          <div className="blocked-times-items-compact">
                            {dayTimes.map((bt, dayIndex) => {
                              // Find the actual index in the full blockedTimes array
                              let globalIndex = -1;
                              for (let i = 0; i < blockedTimes.length; i++) {
                                if (blockedTimes[i].day === bt.day && 
                                    blockedTimes[i].start === bt.start && 
                                    blockedTimes[i].end === bt.end &&
                                    blockedTimes[i].label === (bt.label || null)) {
                                  globalIndex = i;
                                  break;
                                }
                              }
                              // Fallback: use dayIndex if exact match not found
                              if (globalIndex === -1) {
                                globalIndex = blockedTimes.findIndex(
                                  b => b.day === bt.day && b.start === bt.start && b.end === bt.end
                                );
                              }
                              
                              return (
                                <div key={`${day}-${dayIndex}`} className="blocked-time-item-compact">
                                  <div className="blocked-time-info-compact">
                                    <span className="time-range">{to12Hour(bt.start)} - {to12Hour(bt.end)}</span>
                                    {bt.label && (
                                      <span className="blocked-time-label-badge">{bt.label}</span>
                                    )}
                                    {!bt.label && (
                                      <span className="no-label-hint">(no label)</span>
                                    )}
                                  </div>
                                  <div className="blocked-time-actions-compact">
                                    <button
                                      onClick={() => handleAddLabel(studentName, globalIndex)}
                                      className="label-button"
                                      title="Add or edit label"
                                    >
                                      {bt.label ? '✏️ Edit Label' : '🏷️ Add Label'}
                                    </button>
                                    <button
                                      onClick={() => handleEdit(studentName, globalIndex)}
                                      className="edit-button small"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(studentName, globalIndex)}
                                      className="remove-button small"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StudentSchedulesView;

