import React, { useState, useMemo, useCallback } from 'react';
import StudentScheduleUpload from './components/StudentScheduleUpload';
import StudentSchedulesView from './components/StudentSchedulesView';
import SubjectConfiguration from './components/SubjectConfiguration';
import ScheduleDisplay from './components/ScheduleDisplay';
import { generateSchedule } from './services/api';
import './styles/App.css';

function App() {
  const [uploadedStudents, setUploadedStudents] = useState({});
  const [managedSchedules, setManagedSchedules] = useState({}); // Manually managed schedules
  const [config, setConfig] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleUploadSuccess = (students) => {
    setUploadedStudents(students);
    // Also update managed schedules to include uploaded students
    const merged = { ...managedSchedules };
    Object.keys(students).forEach(studentName => {
      if (!merged[studentName]) {
        merged[studentName] = students[studentName].blocked_times || [];
      }
    });
    setManagedSchedules(merged);
  };

  const handleSchedulesUpdate = useCallback((updatedSchedules) => {
    setManagedSchedules(updatedSchedules);
  }, []);

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
  };

  // Merge uploaded and manually managed schedules (memoized to prevent unnecessary re-renders)
  const studentSchedulesData = useMemo(() => {
    const merged = {};
    
    // Add uploaded students
    Object.keys(uploadedStudents).forEach(studentName => {
      merged[studentName] = {
        blocked_times: uploadedStudents[studentName].blocked_times || []
      };
    });
    
    // Add/update with managed schedules (managed takes precedence)
    Object.keys(managedSchedules).forEach(studentName => {
      merged[studentName] = {
        blocked_times: managedSchedules[studentName]
      };
    });
    
    return merged;
  }, [uploadedStudents, managedSchedules]);

  // Get all student names from both uploaded and config (memoized)
  const allStudentNames = useMemo(() => {
    const names = new Set();
    Object.keys(uploadedStudents).forEach(name => names.add(name));
    Object.keys(managedSchedules).forEach(name => names.add(name));
    if (config && config.students) {
      config.students.forEach(student => {
        if (student.name) names.add(student.name);
      });
    }
    return Array.from(names);
  }, [uploadedStudents, managedSchedules, config]);

  const handleGenerate = async () => {
    if (!config) {
      setError('Please configure students and subjects first');
      return;
    }

    if (config.students.length === 0) {
      setError('Please add at least one student');
      return;
    }

    // Validate that all students have names
    const invalidStudents = config.students.filter(s => !s.name || s.name.trim() === '');
    if (invalidStudents.length > 0) {
      setError('All students must have names');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Convert frontend config to API request format
      const scheduleRequest = {
        students: {},
        student_configs: [],
        working_hours: {
          days: config.workingHours.days,
          start_time: config.workingHours.start_time,
          end_time: config.workingHours.end_time
        },
        lunch_time: config.lunchTime,
        prep_time_required: config.prepTimeRequired !== undefined ? config.prepTimeRequired : true
      };

      // Get merged student schedules
      const allStudentSchedules = studentSchedulesData;

      // Add student schedules (from upload/managed or empty)
      config.students.forEach(student => {
        if (allStudentSchedules[student.name]) {
          scheduleRequest.students[student.name] = {
            blocked_times: allStudentSchedules[student.name].blocked_times.map(bt => ({
              day: bt.day,
              start: bt.start,
              end: bt.end,
              label: bt.label || null
            }))
          };
        } else {
          scheduleRequest.students[student.name] = {
            blocked_times: []
          };
        }

        // Add student config
        scheduleRequest.student_configs.push({
          name: student.name,
          subjects: student.subjects.map(subj => ({
            name: subj.name,
            hours_per_week: subj.hours_per_week,
            frequency_per_week: subj.frequency_per_week
          })),
          daily_minimum_hours: student.daily_minimum_hours,
          weekly_total_hours: student.weekly_total_hours
        });
      });

      const result = await generateSchedule(scheduleRequest);
      setSchedule(result);
    } catch (err) {
      setError(err.message || 'Failed to generate schedule');
      setSchedule(null);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Student Schedule Generator</h1>
        <p>Generate optimized weekly schedules for multiple students</p>
      </header>

      <main className="app-main">
        <div className="app-content">
          <section className="input-section">
            <StudentScheduleUpload onUploadSuccess={handleUploadSuccess} />
            
            <StudentSchedulesView
              students={studentSchedulesData}
              studentNames={allStudentNames}
              onUpdate={handleSchedulesUpdate}
            />
            
            <SubjectConfiguration
              onConfigChange={handleConfigChange}
              uploadedStudents={allStudentNames}
            />

            <div className="generate-section">
              <button
                onClick={handleGenerate}
                disabled={!config || config.students.length === 0 || generating}
                className="generate-button"
              >
                {generating ? 'Generating Schedule...' : 'Generate Schedule'}
              </button>
              {error && <div className="error">{error}</div>}
            </div>
          </section>

          {schedule && (
            <section className="output-section">
              <ScheduleDisplay
                scheduleData={schedule}
                workingDays={config?.workingHours?.days || []}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

