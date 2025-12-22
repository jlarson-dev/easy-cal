import React, { useState } from 'react';
import { uploadSchedule } from '../services/api';

const StudentScheduleUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedData, setUploadedData] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
        setError(null);
        setDuplicateWarning(null);
      } else {
        setError('Please upload a JSON file');
        setFile(null);
      }
    }
  };

  const handleUpload = async (overwrite = false) => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setDuplicateWarning(null);

    try {
      const result = await uploadSchedule(file, overwrite);
      
      // Check if there are existing students that weren't overwritten
      if (result.existing_students && result.existing_students.length > 0) {
        setDuplicateWarning({
          existing: result.existing_students,
          saved: result.saved_students || []
        });
        setUploadedData(null);
      } else {
        setUploadedData(result);
        setDuplicateWarning(null);
        if (onUploadSuccess) {
          onUploadSuccess(result.students);
        }
      }
    } catch (err) {
      const errorMessage = err.message || err.toString() || 'Failed to upload schedule';
      setError(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleOverwrite = () => {
    handleUpload(true);
  };

  const handleSkip = () => {
    // Just clear the warning, don't upload
    setDuplicateWarning(null);
    setFile(null);
  };

  return (
    <div className="upload-section">
      <h2>Upload Student Schedules</h2>
      <div className="upload-controls">
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload Schedule'}
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {duplicateWarning && (
        <div className="duplicate-warning">
          <p><strong>⚠️ Duplicate schedules detected</strong></p>
          <p>The following students already have schedules:</p>
          <ul>
            {duplicateWarning.existing.map(name => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {duplicateWarning.saved.length > 0 && (
            <p className="saved-info">
              ✓ Uploaded {duplicateWarning.saved.length} new student schedule(s): {duplicateWarning.saved.join(', ')}
            </p>
          )}
          <div className="duplicate-actions">
            <button onClick={handleOverwrite} className="overwrite-button">
              Overwrite Existing
            </button>
            <button onClick={handleSkip} className="skip-button">
              Skip Duplicates
            </button>
          </div>
        </div>
      )}
      
      {uploadedData && (
        <div className="success">
          <p>✓ Successfully uploaded schedule for {Object.keys(uploadedData.students).length} student(s)</p>
          <details>
            <summary>View uploaded data</summary>
            <pre>{JSON.stringify(uploadedData.students, null, 2)}</pre>
          </details>
        </div>
      )}
      
      <details className="help-text">
        <summary><strong>Expected JSON format</strong></summary>
        <pre>{`{
  "student_name": {
    "blocked_times": [
      {"day": "Monday", "start": "09:00", "end": "10:00"},
      {"day": "Tuesday", "start": "14:00", "end": "15:30"}
    ]
  }
}`}</pre>
      </details>
    </div>
  );
};

export default StudentScheduleUpload;

