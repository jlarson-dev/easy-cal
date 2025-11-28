import React, { useState } from 'react';

const ScheduleDisplay = ({ scheduleData, workingDays = [] }) => {
  const [exportFormat, setExportFormat] = useState('json');

  if (!scheduleData || !scheduleData.schedule) {
    return (
      <div className="schedule-display">
        <p>No schedule generated yet. Configure students and generate a schedule.</p>
      </div>
    );
  }

  const { schedule, success, message, conflicts } = scheduleData;

  // Group schedule by day
  const scheduleByDay = {};
  workingDays.forEach(day => {
    scheduleByDay[day] = [];
  });

  schedule.forEach(slot => {
    if (!scheduleByDay[slot.day]) {
      scheduleByDay[slot.day] = [];
    }
    scheduleByDay[slot.day].push(slot);
  });

  // Sort slots by time within each day
  Object.keys(scheduleByDay).forEach(day => {
    scheduleByDay[day].sort((a, b) => {
      const timeA = a.start.split(':').map(Number);
      const timeB = b.start.split(':').map(Number);
      return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
    });
  });

  const getSlotColor = (slot) => {
    switch (slot.type) {
      case 'lunch':
        return '#ffd700';
      case 'prep':
        return '#90ee90';
      case 'blocked':
        return '#ffcccc';
      case 'session':
        return '#87ceeb';
      default:
        return '#f0f0f0';
    }
  };

  const formatTime = (timeStr) => {
    return timeStr;
  };

  const exportSchedule = () => {
    let content = '';
    let filename = 'schedule';

    if (exportFormat === 'json') {
      content = JSON.stringify(scheduleData, null, 2);
      filename += '.json';
    } else if (exportFormat === 'csv') {
      // CSV format: Day, Start, End, Type, Student, Subject, Label
      const rows = ['Day,Start,End,Type,Student,Subject,Label'];
      schedule.forEach(slot => {
        rows.push(
          `${slot.day},${slot.start},${slot.end},${slot.type},${slot.student || ''},${slot.subject || ''},${slot.label || ''}`
        );
      });
      content = rows.join('\n');
      filename += '.csv';
    } else {
      // Text format
      const lines = [];
      workingDays.forEach(day => {
        lines.push(`\n${day}:`);
        lines.push('─'.repeat(50));
        scheduleByDay[day]?.forEach(slot => {
          if (slot.type === 'session') {
            lines.push(`  ${slot.start} - ${slot.end}: ${slot.student} - ${slot.subject}`);
          } else if (slot.type === 'lunch') {
            lines.push(`  ${slot.start} - ${slot.end}: LUNCH`);
          } else if (slot.type === 'prep') {
            lines.push(`  ${slot.start} - ${slot.end}: PREP TIME`);
          } else if (slot.type === 'blocked') {
            lines.push(`  ${slot.start} - ${slot.end}: BLOCKED${slot.label ? ` - ${slot.label}` : ''}`);
          }
        });
      });
      content = lines.join('\n');
      filename += '.txt';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="schedule-display">
      <div className="schedule-header">
        <h2>Generated Schedule</h2>
        <div className="status-indicator">
          <span className={success ? 'status success' : 'status warning'}>
            {success ? '✓' : '⚠'} {message}
          </span>
        </div>
      </div>

      {conflicts && conflicts.length > 0 && (
        <div className="conflicts">
          <h3>Conflicts / Unmet Requirements:</h3>
          <ul>
            {conflicts.map((conflict, index) => (
              <li key={index} className="conflict-item">{conflict}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="schedule-calendar">
        {workingDays.map(day => (
          <div key={day} className="day-column">
            <h3>{day}</h3>
            <div className="time-slots">
              {scheduleByDay[day]?.map((slot, index) => (
                <div
                  key={index}
                  className="time-slot"
                  style={{ backgroundColor: getSlotColor(slot) }}
                  title={`${slot.start} - ${slot.end}: ${slot.type === 'session' ? `${slot.student} - ${slot.subject}` : slot.type.toUpperCase()}${slot.type === 'blocked' && slot.label ? ` - ${slot.label}` : ''}`}
                >
                  <div className="slot-time">{formatTime(slot.start)} - {formatTime(slot.end)}</div>
                  {slot.type === 'session' && (
                    <>
                      <div className="slot-student">{slot.student}</div>
                      <div className="slot-subject">{slot.subject}</div>
                    </>
                  )}
                  {slot.type === 'lunch' && <div className="slot-label">LUNCH</div>}
                  {slot.type === 'prep' && <div className="slot-label">PREP</div>}
                  {slot.type === 'blocked' && (
                    <div className="slot-label">
                      BLOCKED{slot.label && <span className="blocked-label-text">: {slot.label}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="export-section">
        <h3>Export Schedule</h3>
        <div className="export-controls">
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="text">Text</option>
          </select>
          <button onClick={exportSchedule}>Export</button>
        </div>
      </div>

      <div className="legend">
        <h3>Legend</h3>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#87ceeb' }}></div>
            <span>Session</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ffd700' }}></div>
            <span>Lunch</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#90ee90' }}></div>
            <span>Prep Time</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ffcccc' }}></div>
            <span>Blocked</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDisplay;

