import React, { useState } from 'react';
import { saveStudentSchedule } from '../services/api';

const CreateStudentSchedule = ({ onStudentCreated }) => {
  const [studentName, setStudentName] = useState('');
  const [blockedTimes, setBlockedTimes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [newBlockedTime, setNewBlockedTime] = useState({
    day: 'Monday',
    start: '09:00',
    end: '10:00',
    label: ''
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleAddBlockedTime = () => {
    if (!newBlockedTime.start || !newBlockedTime.end) {
      setError('Please provide both start and end times');
      return;
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newBlockedTime.start) || !timeRegex.test(newBlockedTime.end)) {
      setError('Time must be in HH:MM format (24-hour)');
      return;
    }

    // Validate start < end
    const [startHour, startMin] = newBlockedTime.start.split(':').map(Number);
    const [endHour, endMin] = newBlockedTime.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes >= endMinutes) {
      setError('Start time must be before end time');
      return;
    }

    setBlockedTimes([...blockedTimes, { ...newBlockedTime }]);
    setNewBlockedTime({
      day: 'Monday',
      start: '09:00',
      end: '10:00',
      label: ''
    });
    setError(null);
  };

  const handleRemoveBlockedTime = (index) => {
    setBlockedTimes(blockedTimes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!studentName.trim()) {
      setError('Please enter a student name');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const schedule = {
        blocked_times: blockedTimes,
        can_overlap: []
      };

      await saveStudentSchedule(studentName.trim(), schedule);
      
      setSuccess(true);
      setStudentName('');
      setBlockedTimes([]);
      setNewBlockedTime({
        day: 'Monday',
        start: '09:00',
        end: '10:00',
        label: ''
      });

      if (onStudentCreated) {
        onStudentCreated();
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        setShowForm(false);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to create student schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setStudentName('');
    setBlockedTimes([]);
    setNewBlockedTime({
      day: 'Monday',
      start: '09:00',
      end: '10:00',
      label: ''
    });
    setError(null);
    setSuccess(false);
  };

  if (!showForm) {
    return (
      <div className="create-student-section">
        <button 
          onClick={() => setShowForm(true)}
          className="create-student-button"
        >
          + Create New Student Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="create-student-section">
      <h3>Create New Student Schedule</h3>
      
      <form onSubmit={handleSubmit} className="create-student-form">
        <div className="form-group">
          <label htmlFor="student-name">Student Name *</label>
          <input
            type="text"
            id="student-name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter student name"
            required
            disabled={saving}
          />
        </div>

        <div className="blocked-times-section">
          <h4>Blocked Times</h4>
          
          {blockedTimes.length > 0 && (
            <div className="blocked-times-list">
              {blockedTimes.map((bt, index) => (
                <div key={index} className="blocked-time-item">
                  <span className="blocked-time-info">
                    <strong>{bt.day}</strong>: {bt.start} - {bt.end}
                    {bt.label && <span className="blocked-time-label"> ({bt.label})</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlockedTime(index)}
                    className="remove-time-button"
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="add-blocked-time-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="day">Day</label>
                <select
                  id="day"
                  value={newBlockedTime.day}
                  onChange={(e) => setNewBlockedTime({ ...newBlockedTime, day: e.target.value })}
                  disabled={saving}
                >
                  {daysOfWeek.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="start">Start Time (HH:MM)</label>
                <input
                  type="text"
                  id="start"
                  value={newBlockedTime.start}
                  onChange={(e) => setNewBlockedTime({ ...newBlockedTime, start: e.target.value })}
                  placeholder="09:00"
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="end">End Time (HH:MM)</label>
                <input
                  type="text"
                  id="end"
                  value={newBlockedTime.end}
                  onChange={(e) => setNewBlockedTime({ ...newBlockedTime, end: e.target.value })}
                  placeholder="10:00"
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="label">Label (Optional)</label>
                <input
                  type="text"
                  id="label"
                  value={newBlockedTime.label}
                  onChange={(e) => setNewBlockedTime({ ...newBlockedTime, label: e.target.value })}
                  placeholder="e.g., School, Practice"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label>&nbsp;</label>
                <button
                  type="button"
                  onClick={handleAddBlockedTime}
                  className="add-time-button"
                  disabled={saving}
                >
                  Add Time
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">✓ Student schedule created successfully!</div>}

        <div className="form-actions">
          <button
            type="submit"
            disabled={saving || !studentName.trim()}
            className="submit-button"
          >
            {saving ? 'Creating...' : 'Create Student Schedule'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="cancel-button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateStudentSchedule;

