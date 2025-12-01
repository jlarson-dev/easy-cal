import React, { useState, useEffect } from 'react';

const SubjectConfiguration = ({ onConfigChange, uploadedStudents = [] }) => {
  const [customStudentNames, setCustomStudentNames] = useState(new Set());
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
  const [workingHours, setWorkingHours] = useState({
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    start_time: '08:00',
    end_time: '17:00'
  });
  const [lunchTime, setLunchTime] = useState('12:00');
  const [prepTimeRequired, setPrepTimeRequired] = useState(true);
  const [students, setStudents] = useState([]);

  // Save subjects to localStorage when they change
  useEffect(() => {
    localStorage.setItem('masterSubjects', JSON.stringify(masterSubjects));
  }, [masterSubjects]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const addStudent = () => {
    const newStudent = {
      name: '',
      subjects: []
    };
    setStudents([...students, newStudent]);
  };

  const removeStudent = (index) => {
    setStudents(students.filter((_, i) => i !== index));
  };

  const updateStudent = (index, field, value) => {
    const updated = [...students];
    updated[index] = { ...updated[index], [field]: value };
    
    // Track custom student names
    if (field === 'name' && value && !uploadedStudents.includes(value)) {
      setCustomStudentNames(prev => new Set([...prev, value]));
    }
    
    setStudents(updated);
    notifyConfigChange();
  };

  const addSubject = (studentIndex) => {
    const updated = [...students];
    updated[studentIndex].subjects = [
      ...updated[studentIndex].subjects,
      { 
        name: '', 
        constraint_type: 'weekly',
        daily_minutes: null,
        weekly_days: 2,
        weekly_minutes_per_session: 30
      }
    ];
    setStudents(updated);
    notifyConfigChange();
  };

  const removeSubject = (studentIndex, subjectIndex) => {
    const updated = [...students];
    updated[studentIndex].subjects = updated[studentIndex].subjects.filter(
      (_, i) => i !== subjectIndex
    );
    setStudents(updated);
    notifyConfigChange();
  };

  const updateSubject = (studentIndex, subjectIndex, field, value) => {
    const updated = [...students];
    const subject = updated[studentIndex].subjects[subjectIndex];
    
    if (field === 'constraint_type') {
      // Reset constraint values when type changes
      updated[studentIndex].subjects[subjectIndex] = {
        ...subject,
        constraint_type: value,
        daily_minutes: value === 'daily' ? (subject.daily_minutes || 30) : null,
        weekly_days: value === 'weekly' ? (subject.weekly_days || 2) : null,
        weekly_minutes_per_session: value === 'weekly' ? (subject.weekly_minutes_per_session || 30) : null
      };
    } else {
      updated[studentIndex].subjects[subjectIndex] = {
        ...subject,
        [field]: field === 'name' ? value : (field.includes('minutes') || field.includes('days') ? parseInt(value) || 0 : value)
      };
    }
    
    setStudents(updated);
    notifyConfigChange();
  };

  const toggleWorkingDay = (day) => {
    const updated = { ...workingHours };
    if (updated.days.includes(day)) {
      updated.days = updated.days.filter(d => d !== day);
    } else {
      updated.days = [...updated.days, day].sort((a, b) => 
        daysOfWeek.indexOf(a) - daysOfWeek.indexOf(b)
      );
    }
    setWorkingHours(updated);
    notifyConfigChange();
  };

  const addSubjectToMaster = () => {
    if (newSubjectName.trim() && !masterSubjects.includes(newSubjectName.trim())) {
      setMasterSubjects([...masterSubjects, newSubjectName.trim()]);
      setNewSubjectName('');
    }
  };

  const removeSubjectFromMaster = (subjectName) => {
    setMasterSubjects(masterSubjects.filter(s => s !== subjectName));
    // Also remove from all students' subject lists
    const updated = students.map(student => ({
      ...student,
      subjects: student.subjects.filter(s => s.name !== subjectName)
    }));
    setStudents(updated);
    notifyConfigChange();
  };

  const notifyConfigChange = () => {
    if (onConfigChange) {
      onConfigChange({
        students,
        workingHours,
        lunchTime,
        prepTimeRequired
      });
    }
  };

  React.useEffect(() => {
    notifyConfigChange();
  }, [lunchTime, prepTimeRequired, workingHours, students]);

  return (
    <div className="config-section">
      <h2>Subject Configuration</h2>
      
      <div className="settings-section">
        <h3>Subject Settings</h3>
        <p>Manage the list of available subjects. These will appear in the dropdown when adding subjects to students.</p>
        <div className="subject-management">
          <div className="add-subject-input">
            <input
              type="text"
              placeholder="Enter subject name"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSubjectToMaster()}
            />
            <button onClick={addSubjectToMaster} className="add-button small">
              + Add Subject
            </button>
          </div>
          <div className="master-subjects-list">
            <h4>Available Subjects:</h4>
            {masterSubjects.length === 0 ? (
              <p>No subjects added yet. Add subjects above.</p>
            ) : (
              <div className="subjects-tags">
                {masterSubjects.map((subject, index) => (
                  <div key={index} className="subject-tag">
                    <span>{subject}</span>
                    <button
                      onClick={() => removeSubjectFromMaster(subject)}
                      className="remove-button small"
                      title="Remove subject"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="working-hours-section">
        <h3>Working Hours</h3>
        <div className="time-inputs">
          <label>
            Start Time:
            <input
              type="time"
              value={workingHours.start_time}
              onChange={(e) => {
                setWorkingHours({ ...workingHours, start_time: e.target.value });
                notifyConfigChange();
              }}
            />
          </label>
          <label>
            End Time:
            <input
              type="time"
              value={workingHours.end_time}
              onChange={(e) => {
                setWorkingHours({ ...workingHours, end_time: e.target.value });
                notifyConfigChange();
              }}
            />
          </label>
        </div>
        <div className="days-selection">
          <label>Working Days:</label>
          <div className="days-checkboxes">
            {daysOfWeek.map(day => (
              <label key={day} className="day-checkbox">
                <input
                  type="checkbox"
                  checked={workingHours.days.includes(day)}
                  onChange={() => toggleWorkingDay(day)}
                />
                {day}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed-breaks">
        <h3>Fixed Breaks</h3>
        <div className="time-inputs">
          <label>
            Lunch Time:
            <input
              type="time"
              value={lunchTime}
              onChange={(e) => {
                setLunchTime(e.target.value);
                notifyConfigChange();
              }}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={prepTimeRequired}
              onChange={(e) => {
                setPrepTimeRequired(e.target.checked);
                notifyConfigChange();
              }}
            />
            Include 1 hour prep time daily (flexible scheduling)
          </label>
        </div>
      </div>

      <div className="students-section">
        <h3>Students</h3>
        <button onClick={addStudent} className="add-button">+ Add Student</button>
        
        {students.map((student, studentIndex) => (
          <div key={studentIndex} className="student-card">
            <div className="student-header">
              {uploadedStudents.length > 0 ? (
                <select
                  value={student.name}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      // Switch to text input for custom name
                      const input = prompt('Enter student name:');
                      if (input && input.trim()) {
                        updateStudent(studentIndex, 'name', input.trim());
                      }
                    } else {
                      updateStudent(studentIndex, 'name', e.target.value);
                    }
                  }}
                  className="student-name-select"
                >
                  <option value="">Select a student...</option>
                  {uploadedStudents.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {Array.from(customStudentNames).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="__custom__">+ Add custom student name</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Student name"
                  value={student.name}
                  onChange={(e) => updateStudent(studentIndex, 'name', e.target.value)}
                  className="student-name-input"
                />
              )}
              <button onClick={() => removeStudent(studentIndex)} className="remove-button">
                Remove
              </button>
            </div>
            
            <div className="subjects-section">
              <h4>Subjects</h4>
              
              {student.subjects.map((subject, subjectIndex) => (
                <div key={subjectIndex} className="subject-card">
                  <div className="subject-header-row">
                    <label className="subject-name-label">
                      Subject:
                      <select
                        value={subject.name || ''}
                        onChange={(e) => updateSubject(studentIndex, subjectIndex, 'name', e.target.value)}
                      >
                        <option value="">Select a subject</option>
                        {masterSubjects.map(subj => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => removeSubject(studentIndex, subjectIndex)}
                      className="remove-button small"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="subject-constraints">
                    <label className="constraint-type-label">
                      Constraint Type:
                      <select
                        value={subject.constraint_type || 'weekly'}
                        onChange={(e) => updateSubject(studentIndex, subjectIndex, 'constraint_type', e.target.value)}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Variable Days</option>
                      </select>
                    </label>
                    
                    {subject.constraint_type === 'daily' && (
                      <label>
                        Daily Minutes:
                        <input
                          type="number"
                          step="5"
                          min="5"
                          value={subject.daily_minutes || ''}
                          onChange={(e) => updateSubject(studentIndex, subjectIndex, 'daily_minutes', e.target.value)}
                          placeholder="e.g., 30"
                        />
                      </label>
                    )}
                    
                    {subject.constraint_type === 'weekly' && (
                      <>
                        <label>
                          Days per Week:
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="7"
                            value={subject.weekly_days || ''}
                            onChange={(e) => updateSubject(studentIndex, subjectIndex, 'weekly_days', e.target.value)}
                            placeholder="e.g., 3"
                          />
                        </label>
                        <label>
                          Minutes per Session:
                          <input
                            type="number"
                            step="5"
                            min="5"
                            value={subject.weekly_minutes_per_session || ''}
                            onChange={(e) => updateSubject(studentIndex, subjectIndex, 'weekly_minutes_per_session', e.target.value)}
                            placeholder="e.g., 45"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              ))}
              
              <button onClick={() => addSubject(studentIndex)} className="add-button small">
                + Add Subject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubjectConfiguration;

