import React, { useState } from 'react';
import { uploadSchedule } from '../services/api';

const StudentScheduleUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedData, setUploadedData] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a JSON file');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadSchedule(file);
      setUploadedData(result);
      if (onUploadSuccess) {
        onUploadSuccess(result.students);
      }
    } catch (err) {
      setError(err.message || 'Failed to upload schedule');
    } finally {
      setUploading(false);
    }
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
      
      {uploadedData && (
        <div className="success">
          <p>✓ Successfully uploaded schedule for {Object.keys(uploadedData.students).length} student(s)</p>
          <details>
            <summary>View uploaded data</summary>
            <pre>{JSON.stringify(uploadedData.students, null, 2)}</pre>
          </details>
        </div>
      )}
      
      <div className="help-text">
        <p><strong>Expected JSON format:</strong></p>
        <pre>{`{
  "student_name": {
    "blocked_times": [
      {"day": "Monday", "start": "09:00", "end": "10:00"},
      {"day": "Tuesday", "start": "14:00", "end": "15:30"}
    ]
  }
}`}</pre>
      </div>
    </div>
  );
};

export default StudentScheduleUpload;

