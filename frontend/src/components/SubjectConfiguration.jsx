import React, { useState } from 'react';

const SubjectConfiguration = ({ onConfigChange, uploadedStudents = [] }) => {
  const [workingHours, setWorkingHours] = useState({
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    start_time: '08:00',
    end_time: '17:00'
  });
  const [lunchTime, setLunchTime] = useState('12:00');
  const [prepTime, setPrepTime] = useState('16:00');
  const [students, setStudents] = useState([]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const addStudent = () => {
    const newStudent = {
      name: '',
      subjects: [],
      daily_minimum_hours: 1.0,
      weekly_total_hours: 5.0
    };
    setStudents([...students, newStudent]);
  };

  const removeStudent = (index) => {
    setStudents(students.filter((_, i) => i !== index));
  };

  const updateStudent = (index, field, value) => {
    const updated = [...students];
    updated[index] = { ...updated[index], [field]: value };
    setStudents(updated);
    notifyConfigChange();
  };

  const addSubject = (studentIndex) => {
    const updated = [...students];
    updated[studentIndex].subjects = [
      ...updated[studentIndex].subjects,
      { name: '', hours_per_week: 2.0, frequency_per_week: 2 }
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
    updated[studentIndex].subjects[subjectIndex] = {
      ...updated[studentIndex].subjects[subjectIndex],
      [field]: field === 'name' ? value : parseFloat(value) || 0
    };
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
        students,
        workingHours,
        lunchTime,
        prepTime
      });
    }
  };

  React.useEffect(() => {
    notifyConfigChange();
  }, [lunchTime, prepTime, workingHours]);

  return (
    <div className="config-section">
      <h2>Subject Configuration</h2>
      
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
          <label>
            Prep Time:
            <input
              type="time"
              value={prepTime}
              onChange={(e) => {
                setPrepTime(e.target.value);
                notifyConfigChange();
              }}
            />
          </label>
        </div>
      </div>

      <div className="students-section">
        <h3>Students</h3>
        <button onClick={addStudent} className="add-button">+ Add Student</button>
        
        {students.map((student, studentIndex) => (
          <div key={studentIndex} className="student-card">
            <div className="student-header">
              <input
                type="text"
                placeholder="Student name"
                value={student.name}
                onChange={(e) => updateStudent(studentIndex, 'name', e.target.value)}
                className="student-name-input"
              />
              <button onClick={() => removeStudent(studentIndex)} className="remove-button">
                Remove
              </button>
            </div>
            
            <div className="student-requirements">
              <label>
                Daily Minimum Hours:
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={student.daily_minimum_hours}
                  onChange={(e) => updateStudent(studentIndex, 'daily_minimum_hours', e.target.value)}
                />
              </label>
              <label>
                Weekly Total Hours:
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={student.weekly_total_hours}
                  onChange={(e) => updateStudent(studentIndex, 'weekly_total_hours', e.target.value)}
                />
              </label>
            </div>

            <div className="subjects-section">
              <h4>Subjects</h4>
              <button onClick={() => addSubject(studentIndex)} className="add-button small">
                + Add Subject
              </button>
              
              {student.subjects.map((subject, subjectIndex) => (
                <div key={subjectIndex} className="subject-row">
                  <input
                    type="text"
                    placeholder="Subject name"
                    value={subject.name}
                    onChange={(e) => updateSubject(studentIndex, subjectIndex, 'name', e.target.value)}
                  />
                  <label>
                    Hours/Week:
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={subject.hours_per_week}
                      onChange={(e) => updateSubject(studentIndex, subjectIndex, 'hours_per_week', e.target.value)}
                    />
                  </label>
                  <label>
                    Frequency/Week:
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={subject.frequency_per_week}
                      onChange={(e) => updateSubject(studentIndex, subjectIndex, 'frequency_per_week', e.target.value)}
                    />
                  </label>
                  <button
                    onClick={() => removeSubject(studentIndex, subjectIndex)}
                    className="remove-button small"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubjectConfiguration;

