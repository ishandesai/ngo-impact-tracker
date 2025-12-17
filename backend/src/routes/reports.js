import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import {
  insertOrUpdateReport,
  getDashboardStats,
  getReportsByMonth,
  getAllReports,
  createJob,
  getJob,
  getFilteredDashboardStats,
  getFilteredReports
} from '../database.js';
import { processCSVFile } from '../services/csvProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Validate single report
function validateReport(data) {
  const errors = [];

  if (!data.ngo_id || String(data.ngo_id).trim() === '') {
    errors.push('NGO ID is required');
  }

  if (!data.month || String(data.month).trim() === '') {
    errors.push('Month is required');
  } else if (!/^\d{4}-\d{2}$/.test(String(data.month).trim())) {
    errors.push('Month must be in YYYY-MM format (e.g., 2024-01)');
  }

  const peopleHelped = parseInt(data.people_helped);
  if (isNaN(peopleHelped) || peopleHelped < 0) {
    errors.push('People Helped must be a non-negative number');
  }

  const eventsConducted = parseInt(data.events_conducted);
  if (isNaN(eventsConducted) || eventsConducted < 0) {
    errors.push('Events Conducted must be a non-negative number');
  }

  const fundsUtilized = parseFloat(data.funds_utilized);
  if (isNaN(fundsUtilized) || fundsUtilized < 0) {
    errors.push('Funds Utilized must be a non-negative number');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      ngo_id: String(data.ngo_id).trim(),
      month: String(data.month).trim(),
      people_helped: peopleHelped || 0,
      events_conducted: eventsConducted || 0,
      funds_utilized: fundsUtilized || 0
    }
  };
}

// POST /report - Submit a single report
router.post('/report', (req, res) => {
  try {
    const validation = validateReport(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    insertOrUpdateReport.run(validation.data);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: validation.data
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit report'
    });
  }
});

// POST /reports/upload - Upload CSV file for bulk processing
router.post('/reports/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No CSV file uploaded'
      });
    }

    const jobId = uuidv4();

    // Create job record
    createJob.run(jobId, 0);

    // Start background processing (don't await)
    processCSVFile(req.file.path, jobId).catch((err) => {
      console.error('CSV processing error:', err);
    });

    res.status(202).json({
      success: true,
      message: 'File uploaded. Processing started.',
      jobId
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

// GET /job-status/:jobId - Get job processing status
router.get('/job-status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = getJob.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        totalRows: job.total_rows,
        processedRows: job.processed_rows,
        successfulRows: job.successful_rows,
        failedRows: job.failed_rows,
        errors: JSON.parse(job.errors || '[]'),
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job status'
    });
  }
});

// GET /dashboard - Get aggregated stats with filters and pagination
router.get('/dashboard', (req, res) => {
  try {
    const { month, month_from, month_to, ngo_id, offset = '0', limit = '20' } = req.query;

    // Build filters object
    const filters = {};

    // Support legacy single month param OR range params
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid month format. Use YYYY-MM'
        });
      }
      filters.monthFrom = month;
      filters.monthTo = month;
    } else {
      if (month_from) {
        if (!/^\d{4}-\d{2}$/.test(month_from)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid month_from format. Use YYYY-MM'
          });
        }
        filters.monthFrom = month_from;
      }
      if (month_to) {
        if (!/^\d{4}-\d{2}$/.test(month_to)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid month_to format. Use YYYY-MM'
          });
        }
        filters.monthTo = month_to;
      }
    }

    // NGO ID filter (partial match)
    if (ngo_id && ngo_id.trim()) {
      filters.ngoId = ngo_id.trim();
    }

    // Parse pagination params
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    // Get filtered stats
    const stats = getFilteredDashboardStats(filters);

    // Get filtered and paginated reports
    const { reports, totalRecords, hasMore } = getFilteredReports(filters, offsetNum, limitNum);

    res.json({
      success: true,
      data: {
        filters: {
          monthFrom: filters.monthFrom || null,
          monthTo: filters.monthTo || null,
          ngoId: filters.ngoId || null
        },
        summary: {
          totalNgosReporting: stats.total_ngos || 0,
          totalPeopleHelped: stats.total_people_helped || 0,
          totalEventsConducted: stats.total_events_conducted || 0,
          totalFundsUtilized: stats.total_funds_utilized || 0
        },
        reports,
        pagination: {
          offset: offsetNum,
          limit: limitNum,
          totalRecords,
          hasMore
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// GET /reports - Get all reports (with optional month filter)
router.get('/reports', (req, res) => {
  try {
    const { month } = req.query;
    let reports;

    if (month) {
      reports = getReportsByMonth.all(month);
    } else {
      reports = getAllReports.all();
    }

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
});

export default router;
