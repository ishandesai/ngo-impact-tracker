import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import reportsRouter from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', reportsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds 10MB limit'
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints:`);
  console.log(`POST /api/report - Submit single report`);
  console.log(`POST /api/reports/upload - Upload CSV for bulk processing`);
  console.log(`GET  /api/job-status/:jobId - Check job status`);
  console.log(`GET  /api/dashboard?month=YYYY-MM OR month_from=YYYY-MM&month_to=YYYY-MM&ngo_id=NGO001`);
  console.log(`GET  /api/reports - Get all reports`);
});

