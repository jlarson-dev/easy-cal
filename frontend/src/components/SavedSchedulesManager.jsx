import React, { useState, useEffect } from 'react';
import { saveGeneratedSchedule, listSavedSchedules, loadSavedSchedule, deleteSavedSchedule } from '../services/api';

const SavedSchedulesManager = ({ scheduleData, onLoadSchedule }) => {
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load saved schedules list
  const loadSchedulesList = async () => {
    try {
      setLoading(true);
      const result = await listSavedSchedules();
      setSavedSchedules(result.schedules || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedulesList();
  }, []);

  // Handle save schedule
  const handleSave = async () => {
    if (!scheduleName.trim()) {
      setError('Please enter a schedule name');
      return;
    }

    if (!scheduleData || !scheduleData.schedule) {
      setError('No schedule to save');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await saveGeneratedSchedule(scheduleName.trim(), scheduleData);
      setSuccess(`Schedule "${scheduleName}" saved successfully!`);
      setScheduleName('');
      setShowSaveModal(false);
      await loadSchedulesList();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle load schedule
  const handleLoad = async (scheduleName) => {
    try {
      setLoading(true);
      setError(null);
      const result = await loadSavedSchedule(scheduleName);
      
      if (onLoadSchedule) {
        onLoadSchedule(result.schedule);
      }
      
      setShowLoadModal(false);
      setSuccess(`Schedule "${result.name}" loaded successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Scroll to schedule display after loading
      setTimeout(() => {
        const scheduleSection = document.querySelector('.schedule-display');
        if (scheduleSection) {
          scheduleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete schedule
  const handleDelete = async (scheduleName, event) => {
    event.stopPropagation();
    
    if (!window.confirm(`Are you sure you want to delete "${scheduleName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await deleteSavedSchedule(scheduleName);
      setSuccess(`Schedule "${scheduleName}" deleted successfully!`);
      await loadSchedulesList();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="saved-schedules-manager">
      <div className="saved-schedules-header">
        <h3>Saved Schedules</h3>
        <div className="saved-schedules-actions">
          <button
            className="save-schedule-button"
            onClick={() => {
              setShowSaveModal(true);
              setScheduleName('');
              setError(null);
            }}
            disabled={!scheduleData || !scheduleData.schedule}
            title={!scheduleData || !scheduleData.schedule ? 'Generate a schedule first' : 'Save current schedule'}
          >
            Save Current Schedule
          </button>
          <button
            className="load-schedules-button"
            onClick={() => {
              setShowLoadModal(true);
              setError(null);
              loadSchedulesList();
            }}
          >
            Load Saved Schedule
          </button>
        </div>
      </div>

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Save Schedule</h2>
              <button className="modal-close" onClick={() => setShowSaveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Schedule Name</label>
                <input
                  type="text"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  placeholder="Enter schedule name..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    }
                  }}
                  autoFocus
                />
              </div>
              {error && <div className="error-message">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="cancel-button" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button className="save-button" onClick={handleSave} disabled={loading || !scheduleName.trim()}>
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Load Saved Schedule</h2>
              <button className="modal-close" onClick={() => setShowLoadModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {loading && savedSchedules.length === 0 ? (
                <div className="loading-message">Loading schedules...</div>
              ) : savedSchedules.length === 0 ? (
                <div className="empty-message">No saved schedules found.</div>
              ) : (
                <div className="saved-schedules-list">
                  {savedSchedules.map((schedule, index) => (
                    <div
                      key={index}
                      className="saved-schedule-item"
                      onClick={() => handleLoad(schedule.filename)}
                    >
                      <div className="saved-schedule-info">
                        <div className="saved-schedule-name">{schedule.name}</div>
                        <div className="saved-schedule-meta">
                          Saved: {formatDate(schedule.saved_at)}
                        </div>
                      </div>
                      <div className="saved-schedule-actions">
                        <button
                          className="load-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoad(schedule.filename);
                          }}
                        >
                          Load
                        </button>
                        <button
                          className="delete-saved-button"
                          onClick={(e) => handleDelete(schedule.filename, e)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {error && <div className="error-message">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="cancel-button" onClick={() => setShowLoadModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedSchedulesManager;

