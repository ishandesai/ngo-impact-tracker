import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'ngo_impact.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- Reports table with unique constraint for idempotency
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ngo_id TEXT NOT NULL,
    month TEXT NOT NULL,
    people_helped INTEGER NOT NULL DEFAULT 0,
    events_conducted INTEGER NOT NULL DEFAULT 0,
    funds_utilized REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ngo_id, month)
  );

  -- Jobs table for tracking CSV upload processing
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    errors TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Create index for faster dashboard queries
  CREATE INDEX IF NOT EXISTS idx_reports_month ON reports(month);
  CREATE INDEX IF NOT EXISTS idx_reports_ngo_month ON reports(ngo_id, month);
`);

// Report operations
export const insertOrUpdateReport = db.prepare(`
  INSERT INTO reports (ngo_id, month, people_helped, events_conducted, funds_utilized)
  VALUES (@ngo_id, @month, @people_helped, @events_conducted, @funds_utilized)
  ON CONFLICT(ngo_id, month) DO UPDATE SET
    people_helped = @people_helped,
    events_conducted = @events_conducted,
    funds_utilized = @funds_utilized,
    updated_at = CURRENT_TIMESTAMP
`);

export const getReportByNgoAndMonth = db.prepare(`
  SELECT * FROM reports WHERE ngo_id = ? AND month = ?
`);

export const getDashboardStats = db.prepare(`
  SELECT
    COUNT(DISTINCT ngo_id) as total_ngos,
    SUM(people_helped) as total_people_helped,
    SUM(events_conducted) as total_events_conducted,
    SUM(funds_utilized) as total_funds_utilized
  FROM reports
  WHERE month = ?
`);

export const getAllReports = db.prepare(`
  SELECT * FROM reports ORDER BY month DESC, ngo_id ASC
`);

export const getReportsByMonth = db.prepare(`
  SELECT * FROM reports WHERE month = ? ORDER BY ngo_id ASC
`);

// Dynamic query builder for filtered dashboard
export function getFilteredDashboardStats(filters) {
  const conditions = [];
  const params = [];

  if (filters.monthFrom) {
    conditions.push('month >= ?');
    params.push(filters.monthFrom);
  }
  if (filters.monthTo) {
    conditions.push('month <= ?');
    params.push(filters.monthTo);
  }
  if (filters.ngoId) {
    conditions.push('ngo_id LIKE ?');
    params.push(`%${filters.ngoId}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      COUNT(DISTINCT ngo_id) as total_ngos,
      SUM(people_helped) as total_people_helped,
      SUM(events_conducted) as total_events_conducted,
      SUM(funds_utilized) as total_funds_utilized
    FROM reports
    ${whereClause}
  `;

  return db.prepare(query).get(...params);
}

// Dynamic query for filtered reports with pagination
export function getFilteredReports(filters, offset = 0, limit = 20) {
  const conditions = [];
  const params = [];

  if (filters.monthFrom) {
    conditions.push('month >= ?');
    params.push(filters.monthFrom);
  }
  if (filters.monthTo) {
    conditions.push('month <= ?');
    params.push(filters.monthTo);
  }
  if (filters.ngoId) {
    conditions.push('ngo_id LIKE ?');
    params.push(`%${filters.ngoId}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM reports ${whereClause}`;
  const totalRecords = db.prepare(countQuery).get(...params).total;

  // Get paginated results
  const query = `
    SELECT * FROM reports
    ${whereClause}
    ORDER BY month DESC, ngo_id ASC
    LIMIT ? OFFSET ?
  `;

  const reports = db.prepare(query).all(...params, limit, offset);

  return {
    reports,
    totalRecords,
    hasMore: offset + reports.length < totalRecords
  };
}

// Job operations
export const createJob = db.prepare(`
  INSERT INTO jobs (id, status, total_rows)
  VALUES (?, 'pending', ?)
`);

export const updateJobProgress = db.prepare(`
  UPDATE jobs SET
    total_rows = @total_rows,
    processed_rows = @processed_rows,
    successful_rows = @successful_rows,
    failed_rows = @failed_rows,
    errors = @errors,
    status = @status,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

export const getJob = db.prepare(`
  SELECT * FROM jobs WHERE id = ?
`);

export default db;
