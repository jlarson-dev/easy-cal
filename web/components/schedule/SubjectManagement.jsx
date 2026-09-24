"use client";

import React, { useState } from "react";

const SubjectManagement = ({ subjects, onChange }) => {
  const [newSubjectName, setNewSubjectName] = useState("");

  const addSubjectToMaster = () => {
    const name = newSubjectName.trim();
    if (name && !subjects.includes(name)) {
      onChange([...subjects, name]);
      setNewSubjectName("");
    }
  };

  const removeSubjectFromMaster = (subjectName) => {
    onChange(subjects.filter((item) => item !== subjectName));
  };

  return (
    <div className="subject-management-section">
      <div className="settings-section">
        <h3>Subject Management</h3>
        <p className="section-description">
          Manage the master list of subjects available for assignment to students.
        </p>

        <div className="subject-management">
          <div className="add-subject-input">
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Enter new subject name..."
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  addSubjectToMaster();
                }
              }}
            />
            <button onClick={addSubjectToMaster} className="add-button">
              Add Subject
            </button>
          </div>

          <div className="master-subjects-list">
            <h4>Available Subjects</h4>
            <div className="subjects-tags">
              {subjects.map((subject) => (
                <div key={subject} className="subject-tag">
                  <span>{subject}</span>
                  <button
                    className="remove-button small"
                    onClick={() => removeSubjectFromMaster(subject)}
                    title={`Remove ${subject}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubjectManagement;
