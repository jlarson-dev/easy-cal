import React, { useState, useEffect } from 'react';
import { getDeletedSchedules, restoreStudentSchedule, permanentlyDeleteFromLog } from '../services/api';

const DeletedStudentsView = ({ onRestore }) => {
  const [deletedStudents, setDeletedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadDeletedStudents();
  }, []);

  const loadDeletedStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDeletedSchedules();
      setDeletedStudents(result.deleted || []);
    } catch (err) {
      setError(err.message || 'Failed to load deleted students');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (studentName) => {
    try {
      await restoreStudentSchedule(studentName);
      // Reload the list
      await loadDeletedStudents();
      // Notify parent to reload schedules
      if (onRestore) {
        onRestore();
      }
    } catch (err) {
      alert(`Failed to restore student: ${err.message}`);
    }
  };

  const handlePermanentDelete = async (studentName) => {
    try {
      await permanentlyDeleteFromLog(studentName);
      // Reload the list
      await loadDeletedStudents();
      setDeleteConfirm(null);
    } catch (err) {
      alert(`Failed to permanently delete: ${err.message}`);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (deletedStudents.length === 0 && !loading) {
    return null; // Don't show section if no deleted students
  }

  return (
    <div className="deleted-students-section">
      <div className="deleted-students-header" onClick={() => setExpanded(!expanded)}>
        <h3>Deleted Students ({deletedStudents.length})</h3>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="deleted-students-content">
          {loading && <p>Loading...</p>}
          {error && <div className="error">{error}</div>}
          
          {deletedStudents.length === 0 ? (
            <p className="empty-message">No deleted students to restore.</p>
          ) : (
            <div className="deleted-students-list">
              {deletedStudents.map((deleted) => (
                <div key={deleted.student_name} className="deleted-student-card">
                  <div className="deleted-student-info">
                    <h4>{deleted.student_name}</h4>
                    <p className="deleted-date">Deleted: {formatDate(deleted.deleted_at)}</p>
                    <p className="blocked-times-count">
                      {deleted.blocked_times?.length || 0} blocked time{(deleted.blocked_times?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="deleted-student-actions">
                    <button
                      onClick={() => handleRestore(deleted.student_name)}
                      className="restore-button"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(deleted.student_name)}
                      className="permanent-delete-button"
                      title="Permanently delete (cannot be restored)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Permanently Delete</h3>
            <p>Are you sure you want to permanently delete <strong>{deleteConfirm}</strong> from the deletion log?</p>
            <p className="warning-text">⚠️ This action cannot be undone. The student will be permanently removed and cannot be restored.</p>
            <div className="modal-actions">
              <button
                onClick={() => handlePermanentDelete(deleteConfirm)}
                className="confirm-delete-button"
              >
                Yes, Permanently Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletedStudentsView;

