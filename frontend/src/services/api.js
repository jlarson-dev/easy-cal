// Detect if running in desktop app (localhost hostname) or web
const isDesktop = window.location.hostname === '127.0.0.1' || 
                 window.location.hostname === 'localhost';
const API_BASE_URL = isDesktop 
  ? 'http://127.0.0.1:8000/api' 
  : '/api';

export const uploadSchedule = async (file, overwrite = false) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add overwrite parameter as a query parameter (ensure it's a boolean string)
  const overwriteValue = overwrite === true ? 'true' : 'false';
  const url = `${API_BASE_URL}/upload?overwrite=${overwriteValue}`;
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload schedule');
  }
  
  return response.json();
};

export const generateSchedule = async (scheduleRequest) => {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleRequest),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate schedule');
  }
  
  return response.json();
};

export const healthCheck = async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json();
};

// Schedule persistence API functions

export const getScheduleDirectory = async () => {
  const response = await fetch(`${API_BASE_URL}/schedules/directory`);
  if (!response.ok) {
    throw new Error('Failed to get schedule directory');
  }
  return response.json();
};

export const loadSchedules = async () => {
  const response = await fetch(`${API_BASE_URL}/schedules/load`);
  if (!response.ok) {
    throw new Error('Failed to load schedules');
  }
  return response.json();
};

export const reloadSchedules = async () => {
  const response = await fetch(`${API_BASE_URL}/schedules/reload`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to reload schedules');
  }
  return response.json();
};

export const saveStudentSchedule = async (studentName, schedule) => {
  const response = await fetch(`${API_BASE_URL}/schedules/save/${encodeURIComponent(studentName)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(schedule),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to save schedule');
  }
  
  return response.json();
};

export const deleteStudentSchedule = async (studentName) => {
  const response = await fetch(`${API_BASE_URL}/schedules/${encodeURIComponent(studentName)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete schedule');
  }
  
  return response.json();
};

export const getDeletedSchedules = async () => {
  const response = await fetch(`${API_BASE_URL}/schedules/deleted`);
  if (!response.ok) {
    throw new Error('Failed to get deleted schedules');
  }
  return response.json();
};

export const restoreStudentSchedule = async (studentName) => {
  const response = await fetch(`${API_BASE_URL}/schedules/restore/${encodeURIComponent(studentName)}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to restore schedule');
  }
  
  return response.json();
};

export const permanentlyDeleteFromLog = async (studentName) => {
  const response = await fetch(`${API_BASE_URL}/schedules/deleted/${encodeURIComponent(studentName)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to permanently delete');
  }
  
  return response.json();
};

// Saved Schedule Persistence API functions

export const saveGeneratedSchedule = async (scheduleName, scheduleData) => {
  const response = await fetch(`${API_BASE_URL}/saved-schedules/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schedule_name: scheduleName,
      schedule_data: scheduleData
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to save schedule');
  }
  
  return response.json();
};

export const listSavedSchedules = async () => {
  const response = await fetch(`${API_BASE_URL}/saved-schedules/list`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to list schedules');
  }
  
  return response.json();
};

export const loadSavedSchedule = async (scheduleName) => {
  const response = await fetch(`${API_BASE_URL}/saved-schedules/load/${encodeURIComponent(scheduleName)}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to load schedule');
  }
  
  return response.json();
};

export const deleteSavedSchedule = async (scheduleName) => {
  const response = await fetch(`${API_BASE_URL}/saved-schedules/${encodeURIComponent(scheduleName)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete schedule');
  }
  
  return response.json();
};

