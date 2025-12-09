import React, { useState, useEffect } from 'react';

const SubjectManagement = () => {
  // Load subjects from localStorage or use defaults
  const loadSubjects = () => {
    const saved = localStorage.getItem('masterSubjects');
    if (saved) {
      return JSON.parse(saved);
    }
    return ['Math', 'Language', 'Writing', 'Reading', 'Science'];
  };

  const [masterSubjects, setMasterSubjects] = useState(loadSubjects());
  const [newSubjectName, setNewSubjectName] = useState('');

  // Save subjects to localStorage when they change
  useEffect(() => {
    localStorage.setItem('masterSubjects', JSON.stringify(masterSubjects));
  }, [masterSubjects]);

  const addSubjectToMaster = () => {
    if (newSubjectName.trim() && !masterSubjects.includes(newSubjectName.trim())) {
      setMasterSubjects([...masterSubjects, newSubjectName.trim()]);
      setNewSubjectName('');
    }
  };

  const removeSubjectFromMaster = (subjectName) => {
    setMasterSubjects(masterSubjects.filter(s => s !== subjectName));
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
                if (e.key === 'Enter') {
                  addSubjectToMaster();
                }
              }}
            />
            <button className="add-button" onClick={addSubjectToMaster}>
              Add Subject
            </button>
          </div>

          <div className="master-subjects-list">
            <h4>Available Subjects</h4>
            <div className="subjects-tags">
              {masterSubjects.map((subject) => (
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

