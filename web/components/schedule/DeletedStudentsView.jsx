"use client";

import React, { useState } from "react";

const DeletedStudentsView = ({
  deletedStudents,
  onRestore,
  onPermanentDelete,
}) => {
  const items = deletedStudents || [];
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState(null);

  const handleRestore = (studentName) => {
    try {
      onRestore(studentName);
    } catch (err) {
      setError(err.message || "Failed to restore student");
    }
  };

  const handlePermanentDelete = (studentName) => {
    try {
      onPermanentDelete(studentName);
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.message || "Failed to permanently delete");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="deleted-students-section">
      <div
        className="deleted-students-header"
        onClick={() => setExpanded(!expanded)}
      >
        <h3>Deleted Students ({items.length})</h3>
        <span className="expand-icon">{expanded ? "▼" : "▶"}</span>
      </div>

      {expanded && (
        <div className="deleted-students-content">
          {error && <div className="error">{error}</div>}
          <div className="deleted-students-list">
            {items.map((deleted) => (
              <div key={deleted.student_name} className="deleted-student-card">
                <div className="deleted-student-info">
                  <h4>{deleted.student_name}</h4>
                  <p className="deleted-date">
                    Deleted: {formatDate(deleted.deleted_at)}
                  </p>
                  <p className="blocked-times-count">
                    {deleted.blocked_times?.length || 0} blocked time
                    {(deleted.blocked_times?.length || 0) !== 1 ? "s" : ""}
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
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div
            className="modal-content delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Permanently Delete</h3>
            <p>
              Are you sure you want to permanently delete{" "}
              <strong>{deleteConfirm}</strong> from the deletion log?
            </p>
            <p className="warning-text">
              ⚠️ This action cannot be undone. The student will be permanently
              removed and cannot be restored.
            </p>
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
