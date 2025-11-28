import React, { useState } from 'react';
import StudentScheduleUpload from './components/StudentScheduleUpload';
import SubjectConfiguration from './components/SubjectConfiguration';
import ScheduleDisplay from './components/ScheduleDisplay';
import { generateSchedule } from './services/api';
import './styles/App.css';

function App() {
  const [uploadedStudents, setUploadedStudents] = useState({});
  const [config, setConfig] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleUploadSuccess = (students) => {
    setUploadedStudents(students);
  };

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
  };

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
        prep_time: config.prepTime
      };

      // Add student schedules (from upload or empty)
      config.students.forEach(student => {
        if (uploadedStudents[student.name]) {
          scheduleRequest.students[student.name] = {
            blocked_times: uploadedStudents[student.name].blocked_times.map(bt => ({
              day: bt.day,
              start: bt.start,
              end: bt.end
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
            
            <SubjectConfiguration
              onConfigChange={handleConfigChange}
              uploadedStudents={Object.keys(uploadedStudents)}
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

