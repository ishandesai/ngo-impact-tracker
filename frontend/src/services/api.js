import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Submit a single report
export const submitReport = async (reportData) => {
  const response = await api.post('/report', reportData);
  return response.data;
};

// Upload CSV file for bulk processing
export const uploadCSV = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/reports/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Get job status
export const getJobStatus = async (jobId) => {
  const response = await api.get(`/job-status/${jobId}`);
  return response.data;
};

// Get dashboard data with filters and pagination
export const getDashboard = async ({ monthFrom, monthTo, ngoId, offset = 0, limit = 20 } = {}) => {
  const params = {};

  if (monthFrom) params.month_from = monthFrom;
  if (monthTo) params.month_to = monthTo;
  if (ngoId) params.ngo_id = ngoId;
  params.offset = offset;
  params.limit = limit;

  const response = await api.get('/dashboard', { params });
  return response.data;
};

// Get all reports
export const getReports = async (month = null) => {
  const response = await api.get('/reports', {
    params: month ? { month } : {},
  });
  return response.data;
};

export default api;
