import React, { useState, useEffect } from 'react';

const SchedulerConfiguration = ({ onConfigChange, uploadedStudents = [] }) => {
  const [customStudentNames, setCustomStudentNames] = useState(new Set());
  const [workingHours, setWorkingHours] = useState({
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    start_time: '08:00',
    end_time: '17:00'
  });
  const [lunchTime, setLunchTime] = useState('12:00');
  const [prepTimeRequired, setPrepTimeRequired] = useState(true);
  const [students, setStudents] = useState([]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Color palette for students
  const colorPalette = [
    '#87ceeb', // Sky blue (default)
    '#ffb6c1', // Light pink
    '#98fb98', // Pale green
    '#dda0dd', // Plum
    '#f0e68c', // Khaki
    '#ffa07a', // Light salmon
    '#87cefa', // Light sky blue
    '#ffd700', // Gold
    '#90ee90', // Light green
    '#ff69b4', // Hot pink
    '#20b2aa', // Light sea green
    '#ff6347', // Tomato
  ];

  // Load subjects from localStorage
  const loadSubjects = () => {
    const saved = localStorage.getItem('masterSubjects');
    if (saved) {
      return JSON.parse(saved);
    }
    return ['Math', 'Language', 'Writing', 'Reading', 'Science'];
  };

  const [masterSubjects] = useState(loadSubjects());

  const addStudent = () => {
    // Assign a color that hasn't been used yet, or cycle through palette
    const usedColors = students.map(s => s.color).filter(Boolean);
    const availableColors = colorPalette.filter(c => !usedColors.includes(c));
    const defaultColor = availableColors.length > 0 
      ? availableColors[0] 
      : colorPalette[students.length % colorPalette.length];
    
    const newStudent = {
      name: '',
      subjects: [],
      color: defaultColor
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

  const notifyConfigChange = () => {
    if (onConfigChange) {
      onConfigChange({
        workingHours,
        lunchTime,
        prepTimeRequired,
        students
      });
    }
  };

  // Notify on initial mount and when relevant state changes
  useEffect(() => {
    notifyConfigChange();
  }, [workingHours, lunchTime, prepTimeRequired, students]);

  return (
    <div className="scheduler-configuration">
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
        <h3>Breaks & Prep Time</h3>
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
        <button className="add-button" onClick={addStudent}>
          Add Student
        </button>

        {students.map((student, index) => (
          <div key={index} className="student-card">
            <div className="student-header">
              <div className="student-name-color-row">
                <select
                  className="student-name-select"
                  value={student.name}
                  onChange={(e) => updateStudent(index, 'name', e.target.value)}
                >
                  <option value="">Select student...</option>
                  {uploadedStudents.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {Array.from(customStudentNames).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="color-picker-container">
                  <span className="color-picker-label">Color:</span>
                  <div className="color-picker">
                    {colorPalette.map(color => (
                      <button
                        key={color}
                        className={`color-option ${student.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateStudent(index, 'color', color)}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button
                className="remove-button"
                onClick={() => removeStudent(index)}
              >
                Remove
              </button>
            </div>

            <div className="subjects-section">
              <h4>Subjects</h4>
              <button
                className="add-button small"
                onClick={() => addSubject(index)}
              >
                Add Subject
              </button>

              {student.subjects.map((subject, subjIndex) => (
                <div key={subjIndex} className="subject-card">
                  <div className="subject-header-row">
                    <div className="subject-name-label">
                      <label>Subject Name</label>
                      <select
                        value={subject.name}
                        onChange={(e) => updateSubject(index, subjIndex, 'name', e.target.value)}
                      >
                        <option value="">Select subject...</option>
                        {masterSubjects.map(subj => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="remove-button small"
                      onClick={() => removeSubject(index, subjIndex)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="subject-constraints">
                    <div className="constraint-type-label">
                      <label>Constraint Type</label>
                      <select
                        value={subject.constraint_type}
                        onChange={(e) => updateSubject(index, subjIndex, 'constraint_type', e.target.value)}
                      >
                        <option value="daily">Daily (minutes per day)</option>
                        <option value="weekly">Weekly (sessions per week)</option>
                      </select>
                    </div>

                    {subject.constraint_type === 'daily' ? (
                      <label>
                        Minutes per day:
                        <input
                          type="number"
                          min="1"
                          value={subject.daily_minutes || ''}
                          onChange={(e) => updateSubject(index, subjIndex, 'daily_minutes', e.target.value)}
                        />
                      </label>
                    ) : (
                      <>
                        <label>
                          Sessions per week:
                          <input
                            type="number"
                            min="1"
                            value={subject.weekly_days || ''}
                            onChange={(e) => updateSubject(index, subjIndex, 'weekly_days', e.target.value)}
                          />
                        </label>
                        <label>
                          Minutes per session:
                          <input
                            type="number"
                            min="1"
                            value={subject.weekly_minutes_per_session || ''}
                            onChange={(e) => updateSubject(index, subjIndex, 'weekly_minutes_per_session', e.target.value)}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchedulerConfiguration;

