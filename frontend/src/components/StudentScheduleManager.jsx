import React, { useState, useEffect } from 'react';

const StudentScheduleManager = ({ student, blockedTimes = [], onSave, onClose, workingHours, workingDays = [] }) => {
  const [localBlockedTimes, setLocalBlockedTimes] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    day: 'Monday',
    start: '09:00',
    end: '10:00',
    label: ''
  });

  useEffect(() => {
    setLocalBlockedTimes(blockedTimes);
  }, [blockedTimes]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleAddBlockedTime = () => {
    if (formData.start >= formData.end) {
      alert('End time must be after start time');
      return;
    }

    const newBlockedTime = {
      day: formData.day,
      start: formData.start,
      end: formData.end,
      label: formData.label || null
    };

    if (editingIndex !== null) {
      // Update existing
      const updated = [...localBlockedTimes];
      updated[editingIndex] = newBlockedTime;
      setLocalBlockedTimes(updated);
      setEditingIndex(null);
    } else {
      // Add new
      setLocalBlockedTimes([...localBlockedTimes, newBlockedTime]);
    }

    // Reset form
    setFormData({
      day: 'Monday',
      start: '09:00',
      end: '10:00',
      label: ''
    });
  };

  const handleEdit = (index) => {
    const blockedTime = localBlockedTimes[index];
    setFormData({
      day: blockedTime.day,
      start: blockedTime.start,
      end: blockedTime.end,
      label: blockedTime.label || ''
    });
    setEditingIndex(index);
  };

  const handleDelete = (index) => {
    setLocalBlockedTimes(localBlockedTimes.filter((_, i) => i !== index));
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setFormData({
      day: 'Monday',
      start: '09:00',
      end: '10:00',
      label: ''
    });
  };

  const handleSave = () => {
    if (onSave) {
      onSave(student, localBlockedTimes);
    }
    onClose();
  };

  // Group blocked times by day
  const blockedByDay = {};
  daysOfWeek.forEach(day => {
    blockedByDay[day] = localBlockedTimes.filter(bt => bt.day === day);
  });

  // Generate time slots for display
  const generateTimeSlots = () => {
    if (!workingHours) return [];
    const slots = [];
    const start = parseInt(workingHours.start_time.split(':')[0]);
    const end = parseInt(workingHours.end_time.split(':')[0]);
    
    for (let hour = start; hour < end; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const isTimeInBlocked = (day, time) => {
    return blockedByDay[day].some(bt => {
      return time >= bt.start && time < bt.end;
    });
  };

  const getBlockedTimeLabel = (day, time) => {
    const bt = blockedByDay[day].find(bt => time >= bt.start && time < bt.end);
    return bt ? bt.label : null;
  };

  if (!student) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Schedule: {student}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="schedule-form-section">
            <h3>{editingIndex !== null ? 'Edit' : 'Add'} Blocked Time</h3>
            <div className="blocked-time-form">
              <label>
                Day:
                <select
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                >
                  {daysOfWeek.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label>
                Start Time:
                <input
                  type="time"
                  value={formData.start}
                  onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                />
              </label>
              <label>
                End Time:
                <input
                  type="time"
                  value={formData.end}
                  onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                />
              </label>
              <label>
                Label (optional):
                <input
                  type="text"
                  placeholder="e.g., Class, Appointment"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </label>
              <div className="form-actions">
                <button onClick={handleAddBlockedTime} className="add-button">
                  {editingIndex !== null ? 'Update' : 'Add'} Blocked Time
                </button>
                {editingIndex !== null && (
                  <button onClick={handleCancelEdit} className="cancel-button">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="schedule-calendar-section">
            <h3>Weekly Calendar View</h3>
            <div className="schedule-grid">
              <div className="schedule-header">
                <div className="time-column-header">Time</div>
                {workingDays.map(day => (
                  <div key={day} className="day-column-header">{day}</div>
                ))}
              </div>
              <div className="schedule-rows">
                {timeSlots.map(time => (
                  <div key={time} className="schedule-row">
                    <div className="time-cell">{time}</div>
                    {workingDays.map(day => {
                      const isBlocked = isTimeInBlocked(day, time);
                      const label = getBlockedTimeLabel(day, time);
                      const blockedTime = blockedByDay[day].find(bt => time >= bt.start && time < bt.end);
                      const isStart = blockedTime && time === blockedTime.start;
                      
                      return (
                        <div
                          key={day}
                          className={`schedule-cell ${isBlocked ? 'blocked' : ''} ${isStart ? 'blocked-start' : ''}`}
                          title={isBlocked ? `${blockedTime.start} - ${blockedTime.end}${label ? `: ${label}` : ''}` : ''}
                        >
                          {isStart && (
                            <div className="blocked-time-info">
                              <div className="blocked-time-range">{blockedTime.start} - {blockedTime.end}</div>
                              {label && <div className="blocked-time-label">{label}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="blocked-times-list">
            <h3>Blocked Times List</h3>
            {localBlockedTimes.length === 0 ? (
              <p>No blocked times added yet.</p>
            ) : (
              <div className="blocked-times-items">
                {localBlockedTimes.map((bt, index) => (
                  <div key={index} className="blocked-time-item">
                    <div className="blocked-time-details">
                      <strong>{bt.day}</strong>: {bt.start} - {bt.end}
                      {bt.label && <span className="blocked-time-label-badge"> {bt.label}</span>}
                    </div>
                    <div className="blocked-time-actions">
                      <button onClick={() => handleEdit(index)} className="edit-button">Edit</button>
                      <button onClick={() => handleDelete(index)} className="remove-button small">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-button">Cancel</button>
          <button onClick={handleSave} className="save-button">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default StudentScheduleManager;

