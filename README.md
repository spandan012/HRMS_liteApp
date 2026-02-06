# HRMS Lite

## Project Overview
HRMS Lite is a lightweight, web-based internal HR tool for a single admin. It supports core HR operations:
- Employee management (add, list, delete)
- Daily attendance tracking (present/absent)
- Basic dashboard summary (totals + present days per employee)
- Attendance filtering by date range

The app focuses on usability and a professional UI while keeping the stack minimal and easy to run locally.

## Tech Stack Used
- Frontend: HTML, CSS, Vanilla JavaScript (single-page admin console)
- Backend: Node.js + Express (REST APIs)
- Database: SQLite (file-based persistence via sqlite3)

## Steps to Run Locally
1. Install dependencies:
   ```powershell
   npm install
   ```
2. Start the server:
   ```powershell
   npm start
   ```
3. Open the app in your browser:
   - http://localhost:3000

## API Endpoints (Quick Reference)
- `GET /api/employees`
- `POST /api/employees`
- `DELETE /api/employees/:employeeId`
- `POST /api/attendance`
- `GET /api/employees/:employeeId/attendance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/summary`

## Assumptions / Limitations
- Single admin user (no authentication).
- No leave management, payroll, or advanced HR features.
- SQLite file is stored at `server/data/hrms.db`.
- Designed for small-to-medium internal use; no horizontal scaling concerns.

## Submission Links (Fill In)
- Live Application URL: https://hrms-lite-app.vercel.app/
- Hosted Backend API: https://hrmsliteapp-production.up.railway.app
- GitHub Repository Link: https://github.com/spandan012/HRMS_liteApp

## Contact
- Spandan Jain
- spandan1106@gmail.com
