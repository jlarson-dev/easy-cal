import React, { useState, useEffect } from 'react';
import { getScheduleDirectory, setScheduleDirectory, reloadSchedules } from '../services/api';

const ScheduleDirectoryConfig = ({ onDirectoryChange, onSchedulesReloaded }) => {
  const [directory, setDirectory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadStatus, setReloadStatus] = useState(null);
  const [lastReload, setLastReload] = useState(null);

  useEffect(() => {
    // Load current directory on mount
    loadCurrentDirectory();
  }, []);

  const loadCurrentDirectory = async () => {
    try {
      const result = await getScheduleDirectory();
      setDirectory(result.directory || '');
    } catch (err) {
      console.error('Failed to load directory:', err);
    }
  };

  const handleFolderPicker = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try File System Access API first (modern browsers: Chrome, Edge)
      if (window.showDirectoryPicker) {
        try {
          const directoryHandle = await window.showDirectoryPicker();
          const directoryName = directoryHandle.name;
          
          // Browsers don't expose full paths for security, so we need to ask the user
          const fullPath = prompt(
            `Please enter the full path to the "${directoryName}" folder:\n\n` +
            `(Browsers don't expose full file paths for security. Please paste the complete path that the Docker container can access.)`,
            directory || ''
          );
          
          if (fullPath && fullPath.trim()) {
            await setDirectoryFromPath(fullPath.trim());
          } else {
            setLoading(false);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            // User cancelled - try fallback method
            setLoading(false);
            await handleFolderPickerFallback();
          } else {
            setLoading(false);
          }
        }
      } else {
        // Fallback: use file input with webkitdirectory
        await handleFolderPickerFallback();
      }
    } catch (err) {
      setError(err.message || 'Failed to select directory');
      setLoading(false);
    }
  };

  const handleFolderPickerFallback = () => {
    return new Promise((resolve) => {
      // Create a hidden file input for folder selection
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.directory = true;
      input.multiple = true;
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          // Extract folder name from the first file's webkitRelativePath
          const firstFile = files[0];
          let folderName = 'selected folder';
          
          if (firstFile.webkitRelativePath) {
            const pathParts = firstFile.webkitRelativePath.split('/');
            folderName = pathParts[0];
          }
          
          // Prompt user for full path (browsers don't expose it for security)
          const fullPath = prompt(
            `Please enter the full path to the "${folderName}" folder:\n\n` +
            `(Browsers don't expose full file paths for security. Please paste the complete path that the Docker container can access.)`,
            directory || ''
          );
          
          if (fullPath && fullPath.trim()) {
            await setDirectoryFromPath(fullPath.trim());
          }
        }
        setLoading(false);
        resolve();
      };
      
      input.oncancel = () => {
        setLoading(false);
        resolve();
      };
      
      // Trigger file picker
      document.body.appendChild(input);
      input.click();
      // Clean up after a delay
      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      }, 100);
    });
  };

  const setDirectoryFromPath = async (path) => {
    setDirectory(path);
    setLoading(true);
    setError(null);

    try {
      const result = await setScheduleDirectory(path);
      if (result.success) {
        setError(null);
        if (onDirectoryChange) {
          onDirectoryChange(path);
        }
        // Auto-load schedules after setting directory
        await handleReload();
      }
    } catch (err) {
      setError(err.message || 'Failed to set directory');
    } finally {
      setLoading(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    setError(null);
    setReloadStatus(null);

    try {
      const result = await reloadSchedules();
      const changes = result.changes || {};
      const newCount = changes.new?.length || 0;
      const modifiedCount = changes.modified?.length || 0;
      const deletedCount = changes.deleted?.length || 0;

      setReloadStatus({
        success: true,
        new: newCount,
        modified: modifiedCount,
        deleted: deletedCount,
      });

      setLastReload(new Date());

      if (onSchedulesReloaded) {
        onSchedulesReloaded(result.students, changes);
      }
    } catch (err) {
      setError(err.message || 'Failed to reload schedules');
      setReloadStatus({
        success: false,
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="directory-config-section">
      <h3>Schedule Directory</h3>
      
      <div className="directory-input-group">
        {directory && (
          <div className="current-directory">
            <label>Current Directory:</label>
            <div className="directory-path-display">{directory}</div>
          </div>
        )}
        <button
          onClick={handleFolderPicker}
          disabled={loading}
          className="folder-picker-button"
        >
          {loading ? 'Loading...' : directory ? 'Change Directory' : 'Select Directory'}
        </button>
      </div>

      {directory && (
        <div className="directory-actions">
          <button
            onClick={handleReload}
            disabled={loading}
            className="reload-button"
          >
            {loading ? 'Reloading...' : 'Reload Schedules'}
          </button>
          {lastReload && (
            <span className="last-reload">
              Last reload: {lastReload.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {reloadStatus && reloadStatus.success && (
        <div className="reload-summary">
          {reloadStatus.new > 0 && <span>+{reloadStatus.new} new</span>}
          {reloadStatus.modified > 0 && <span>{reloadStatus.modified} modified</span>}
          {reloadStatus.deleted > 0 && <span>-{reloadStatus.deleted} deleted</span>}
          {reloadStatus.new === 0 && reloadStatus.modified === 0 && reloadStatus.deleted === 0 && (
            <span>No changes detected</span>
          )}
        </div>
      )}

      {reloadStatus && !reloadStatus.success && (
        <div className="error">{reloadStatus.error}</div>
      )}
    </div>
  );
};

export default ScheduleDirectoryConfig;

