import React, { useState, useMemo, useCallback, useEffect } from 'react';
import StudentScheduleUpload from './components/StudentScheduleUpload';
import StudentSchedulesView from './components/StudentSchedulesView';
import DeletedStudentsView from './components/DeletedStudentsView';
import SubjectConfiguration from './components/SubjectConfiguration';
import ScheduleDisplay from './components/ScheduleDisplay';
import { generateSchedule, loadSchedules, reloadSchedules } from './services/api';
import './styles/App.css';

function App() {
  const [uploadedStudents, setUploadedStudents] = useState({});
  const [managedSchedules, setManagedSchedules] = useState({}); // Manually managed schedules
  const [persistedSchedules, setPersistedSchedules] = useState({}); // Schedules loaded from files
  const [config, setConfig] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleUploadSuccess = (students) => {
    setUploadedStudents(students);
    // Also update persisted and managed schedules
    setPersistedSchedules(students);
    const merged = { ...managedSchedules };
    Object.keys(students).forEach(studentName => {
      merged[studentName] = students[studentName].blocked_times || [];
    });
    setManagedSchedules(merged);
  };

  const handleSchedulesUpdate = useCallback((updatedSchedules) => {
    setManagedSchedules(updatedSchedules);
  }, []);

  // Auto-load schedules on startup
  useEffect(() => {
    const initializeSchedules = async () => {
      try {
        // Load schedules from uploads directory
        const loadResult = await loadSchedules();
        if (loadResult.students) {
          setPersistedSchedules(loadResult.students);
          // Also merge into managed schedules
          setManagedSchedules(prev => {
            const merged = { ...prev };
            Object.keys(loadResult.students).forEach(studentName => {
              merged[studentName] = loadResult.students[studentName].blocked_times || [];
            });
            return merged;
          });
        }
      } catch (err) {
        console.error('Failed to initialize schedules:', err);
        // Don't show error to user on startup, just log it
      }
    };

    initializeSchedules();
  }, []);

  const handleSchedulesReloaded = useCallback((students, changes) => {
    if (students) {
      setPersistedSchedules(students);
      // Merge into managed schedules
      setManagedSchedules(prev => {
        const merged = { ...prev };
        Object.keys(students).forEach(studentName => {
          merged[studentName] = students[studentName].blocked_times || [];
        });
        return merged;
      });
    }
  }, []);

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
  };

  // Merge uploaded, persisted, and manually managed schedules (memoized to prevent unnecessary re-renders)
  const studentSchedulesData = useMemo(() => {
    const merged = {};
    
    // Add uploaded students
    Object.keys(uploadedStudents).forEach(studentName => {
      merged[studentName] = {
        blocked_times: uploadedStudents[studentName].blocked_times || [],
        can_overlap: uploadedStudents[studentName].can_overlap || []
      };
    });
    
    // Add/update with persisted schedules (includes can_overlap)
    Object.keys(persistedSchedules).forEach(studentName => {
      merged[studentName] = {
        blocked_times: persistedSchedules[studentName].blocked_times || [],
        can_overlap: persistedSchedules[studentName].can_overlap || []
      };
    });
    
    // Add/update with managed schedules (managed takes precedence for blocked_times, but preserve can_overlap)
    Object.keys(managedSchedules).forEach(studentName => {
      merged[studentName] = {
        blocked_times: managedSchedules[studentName],
        can_overlap: merged[studentName]?.can_overlap || []
      };
    });
    
    return merged;
  }, [uploadedStudents, persistedSchedules, managedSchedules]);

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
            constraint_type: subj.constraint_type || 'weekly',
            daily_minutes: subj.daily_minutes || null,
            weekly_days: subj.weekly_days || null,
            weekly_minutes_per_session: subj.weekly_minutes_per_session || null
          })),
          color: student.color || null
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
                
                <div className="reload-section">
                  <button
                    onClick={async () => {
                      try {
                        const result = await reloadSchedules();
                        handleSchedulesReloaded(result.students, result.changes);
                      } catch (err) {
                        console.error('Failed to reload schedules:', err);
                      }
                    }}
                    className="reload-button"
                  >
                    Reload Schedules
                  </button>
                </div>
                
                <StudentSchedulesView
                  students={studentSchedulesData}
                  studentNames={allStudentNames}
                  onUpdate={handleSchedulesUpdate}
                />

                <DeletedStudentsView
                  onRestore={async () => {
                    // Reload schedules after restoration
                    try {
                      const loadResult = await loadSchedules();
                      if (loadResult.students) {
                        setPersistedSchedules(loadResult.students);
                        setManagedSchedules(prev => {
                          const merged = { ...prev };
                          Object.keys(loadResult.students).forEach(studentName => {
                            merged[studentName] = loadResult.students[studentName].blocked_times || [];
                          });
                          return merged;
                        });
                      }
                    } catch (err) {
                      console.error('Failed to reload schedules:', err);
                    }
                  }}
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
                studentColors={config?.students ? 
                  Object.fromEntries(config.students.map(s => [s.name, s.color || '#87ceeb'])) 
                  : {}}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

