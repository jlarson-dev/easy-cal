# Student Schedule Generator

A locally-hosted web application that generates optimized weekly schedules for tutoring multiple students, accounting for student availability, subject requirements, and fixed breaks.

## Features

- **Student Schedule Upload**: Upload JSON files containing student blocked time slots
- **Subject Configuration**: Configure subjects, hours, and frequency for each student
- **Smart Scheduling**: Algorithm generates optimized schedules considering all constraints
- **Visual Schedule Display**: Weekly calendar view with color-coded time slots
- **Export Options**: Export schedules as JSON, CSV, or text files

## Technology Stack

- **Frontend**: React with Vite
- **Backend**: FastAPI (Python)
- **Scheduling Algorithm**: Constraint-based optimization

## Setup Instructions

### Quick Start with Docker (Recommended)

1. **Prerequisites**: Docker and Docker Compose installed

2. **Build and run the application**:
   ```bash
   make build
   make run
   ```

3. **Access the application**:
   - Frontend: http://localhost
   - Backend API: http://localhost:8000

4. **Stop the application**:
   ```bash
   make stop
   ```

5. **View logs**:
   ```bash
   make logs              # All logs
   make backend-logs      # Backend only
   make frontend-logs     # Frontend only
   ```

### Manual Setup (Development)

### Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

   The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

## Usage

1. **Upload Student Schedules**: Upload a JSON file containing student blocked times
   - Format example:
     ```json
     {
       "Student Name": {
         "blocked_times": [
           {"day": "Monday", "start": "09:00", "end": "10:00"},
           {"day": "Tuesday", "start": "14:00", "end": "15:30"}
         ]
       }
     }
     ```

2. **Configure Subjects**: 
   - Add students and their subjects
   - Set hours per week and frequency for each subject
   - Set daily minimum hours and weekly total hours per student
   - Configure working hours and days
   - Set lunch and prep time slots

3. **Generate Schedule**: Click "Generate Schedule" to create an optimized weekly schedule

4. **View and Export**: Review the generated schedule and export it in your preferred format

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/upload` - Upload student schedule JSON file
- `POST /api/generate` - Generate schedule based on configuration

## Project Structure

```
easy-cal/
├── backend/
│   ├── main.py            # FastAPI application
│   ├── models.py          # Pydantic models
│   ├── scheduler.py       # Scheduling algorithm
│   ├── requirements.txt   # Python dependencies
│   ├── Dockerfile         # Backend Docker image
│   └── .dockerignore      # Docker ignore rules
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── components/    # React components
│   │   ├── services/      # API client
│   │   └── styles/        # CSS styles
│   ├── package.json
│   ├── Dockerfile         # Frontend Docker image
│   ├── nginx.conf         # Nginx configuration
│   └── .dockerignore      # Docker ignore rules
├── docker-compose.yml     # Docker Compose configuration
├── Makefile              # Build and run commands
└── README.md
```

## Desktop App

The application can be built as a standalone desktop executable using PyInstaller.

### Prerequisites for Desktop Build

- Python 3.8 or higher
- Node.js 16 or higher (for building frontend)
- All Python dependencies installed
- PyInstaller and pywebview installed

### Building the Desktop App

1. **Install desktop dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Build the desktop executable**:
   ```bash
   cd desktop_app
   python build.py
   ```

   This will:
   - Build the React frontend
   - Bundle everything into a single executable
   - Output to `desktop_app/dist/`

3. **Output files**:
   - Windows: `dist/StudentScheduleGenerator.exe`
   - macOS: `dist/StudentScheduleGenerator.app`
   - Linux: `dist/StudentScheduleGenerator`

### Running in Development Mode

To test the desktop app before building:

```bash
cd desktop_app
python dev.py
```

This runs the app with the webview window for testing.

### Desktop App Features

- **Standalone executable**: No need to install Python or Node.js
- **Data persistence**: User data stored in platform app data directories:
  - Windows: `%APPDATA%\StudentScheduleGenerator`
  - macOS: `~/Library/Application Support/StudentScheduleGenerator`
  - Linux: `~/.local/share/StudentScheduleGenerator`
- **Native window**: Uses system webview for native look and feel
- **Automatic backend**: Backend server starts automatically

### Troubleshooting Desktop App

- **Backend fails to start**: Check if port 8000 is already in use
- **Frontend not loading**: Ensure frontend was built before creating executable
- **Data not persisting**: Check app data directory permissions
- **Build errors**: Ensure all dependencies are installed and frontend build succeeds

## Notes

- The scheduling algorithm uses 30-minute time slots
- Lunch and prep time are fixed and cannot be overridden
- The algorithm prioritizes meeting weekly requirements first
- If constraints cannot be fully met, conflicts will be reported

