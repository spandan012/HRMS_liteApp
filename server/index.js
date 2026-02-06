const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const defaultDbPath = path.join(__dirname, 'data', 'hrms.db');
const dbPath = process.env.DB_PATH || defaultDbPath;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

const isValidDate = (dateStr) => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

const nowIso = () => new Date().toISOString();

const initDb = async () => {
  await run('PRAGMA foreign_keys = ON');
  await run(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(employee_id, date),
      FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
    )
  `);
};

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/employees', async (req, res) => {
  try {
    const employees = await all(
      'SELECT employee_id, full_name, email, department, created_at FROM employees ORDER BY created_at DESC'
    );
    res.json({ employees });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employees.' });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const employeesRow = await get('SELECT COUNT(*) AS total FROM employees');
    const attendanceRow = await get('SELECT COUNT(*) AS total FROM attendance');
    const presentRow = await get(
      "SELECT COUNT(*) AS total FROM attendance WHERE status = 'Present'"
    );

    const perEmployee = await all(
      `
        SELECT e.employee_id, e.full_name, COUNT(a.id) AS present_days
        FROM employees e
        LEFT JOIN attendance a
          ON e.employee_id = a.employee_id AND a.status = 'Present'
        GROUP BY e.employee_id
        ORDER BY present_days DESC, e.full_name ASC
      `
    );

    res.json({
      totals: {
        employees: employeesRow?.total || 0,
        attendance: attendanceRow?.total || 0,
        present: presentRow?.total || 0,
      },
      presentByEmployee: perEmployee,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load summary.' });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { employeeId, fullName, email, department } = req.body || {};

    if (!employeeId || !fullName || !email || !department) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email format is invalid.' });
    }

    const existingById = await get('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
    if (existingById) {
      return res.status(409).json({ error: 'Employee ID already exists.' });
    }

    const existingByEmail = await get('SELECT email FROM employees WHERE email = ?', [email]);
    if (existingByEmail) {
      return res.status(409).json({ error: 'Email already exists.' });
    }

    await run(
      'INSERT INTO employees (employee_id, full_name, email, department, created_at) VALUES (?, ?, ?, ?, ?)',
      [employeeId, fullName, email, department, nowIso()]
    );

    res.status(201).json({ message: 'Employee created.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

app.delete('/api/employees/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const existing = await get('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    await run('DELETE FROM employees WHERE employee_id = ?', [employeeId]);
    res.json({ message: 'Employee deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete employee.' });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { employeeId, date, status } = req.body || {};

    if (!employeeId || !date || !status) {
      return res.status(400).json({ error: 'Employee ID, date, and status are required.' });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
    }

    if (!['Present', 'Absent'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Present or Absent.' });
    }

    const employee = await get('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const existing = await get(
      'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, date]
    );
    if (existing) {
      return res.status(409).json({ error: 'Attendance already recorded for this date.' });
    }

    await run(
      'INSERT INTO attendance (employee_id, date, status, created_at) VALUES (?, ?, ?, ?)',
      [employeeId, date, status, nowIso()]
    );

    res.status(201).json({ message: 'Attendance recorded.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record attendance.' });
  }
});

app.get('/api/employees/:employeeId/attendance', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    const employee = await get('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const where = ['employee_id = ?'];
    const params = [employeeId];

    if (startDate) {
      if (!isValidDate(startDate)) {
        return res.status(400).json({ error: 'Start date must be in YYYY-MM-DD format.' });
      }
      where.push('date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      if (!isValidDate(endDate)) {
        return res.status(400).json({ error: 'End date must be in YYYY-MM-DD format.' });
      }
      where.push('date <= ?');
      params.push(endDate);
    }

    const records = await all(
      `SELECT id, employee_id, date, status, created_at FROM attendance WHERE ${where.join(
        ' AND '
      )} ORDER BY date DESC`,
      params
    );

    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load attendance.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Unexpected server error.' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`HRMS Lite server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database', err);
    process.exit(1);
  });
